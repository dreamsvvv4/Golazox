"""call_dialer.py
Pequeño lanzador de llamadas SIP integrable con el analizador.

Objetivo: ejecutar secuencias de llamadas usando Phoner / PhonerLite en Windows
para luego analizar el log resultante con `analyze_calls`.

Estrategia mínima:
 - Se abre PhonerLite con parámetros para iniciar una llamada.
 - Se espera N segundos (duración deseada) mientras el softphone mantiene la llamada.
 - Se realiza colgado (hangup) intentando enviar tecla ESC / ALT+F4 o usando pywinauto si está disponible.
 - Repetir para la lista de destinos.

Limitaciones:
 - Requiere que PhonerLite ya tenga la cuenta SIP registrada (config manual previa).
 - El colgado automático puede variar según versión; ajustar KEY_HANGUP.
 - No controla éxito real de la llamada (no parsea estados RTP / SIP); se basa en tiempos.

Próximos pasos sugeridos (no implementados todavía):
 - Integrar lectura en tiempo real del log generado por Phoner o del log propio del backend y lanzar analizador tras cada llamada.
 - Añadir a la GUI un botón "Campaña de llamadas" con progreso.
 - Métricas de MOS / jitter usando herramientas externas.
"""
from __future__ import annotations
import time
import os
import random
from datetime import datetime, timedelta
import csv
import subprocess
import sys
import shutil
import platform
import ctypes
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Callable
import configparser
import urllib.request
import zipfile

try:
    import pywinauto  # type: ignore
    from pywinauto.application import Application  # noqa
except Exception:  # pywinauto es opcional
    pywinauto = None  # type: ignore

_CURRENT_CFG: Optional['DialerConfig'] = None  # acceso global rápido
_ABORT = False  # bandera de abortar campaña desde GUI


@dataclass
class DialerConfig:
    phoner_path: Path              # Ruta a ejecutable (PhonerLite.exe o Phoner.exe)
    targets: List[str]             # Lista de destinos (número o sip:user@host)
    call_duration_s: int = 20
    pause_between_s: int = 5
    hangup_timeout_s: int = 2  # Reducido para minimizar el retardo tras colgar
    log_after_each: bool = False
    auto_close: bool = True
    extra_args: List[str] = None
    reuse_existing: bool = False   # Reutilizar ventana ya abierta (requiere pywinauto)
    dry_run: bool = False          # Simular sin lanzar ejecutable
    repeat: int = 1                # Número de veces a iterar la lista completa de destinos
    continuous: bool = False       # Ignora repeat y ejecuta hasta Ctrl+C
    interval_override: float | None = None  # Intervalo fijo entre llamadas (s)
    jitter: float = 0.0            # Aleatorio +/- jitter segundos sobre pausa entre llamadas
    start_delay: float = 0.0       # Espera inicial antes de empezar (s)
    honor_process_exit: bool = False  # Si True, si el proceso termina se corta antes; si False se mantiene duración completa
    debug: bool = False              # Verbose debug
    alt_forms: bool = True           # Probar formas alternativas de marcación si el proceso termina rápido
    sip_domain: Optional[str] = None # Dominio SIP a añadir si el destino es solo numérico
    uri_template: Optional[str] = None  # Plantilla: ej "sip:{target}@pbx.local" (prioriza sobre sip_domain)
    prepend_plus: bool = False       # Añadir '+' delante del número antes de formar URI
    dial_keys: List[str] = None      # Secuencia de teclas para iniciar llamada en ventana existente
    hangup_keys: List[str] = None    # Secuencia de teclas para colgar en ventana existente
    strict_timing: bool = True       # Usar reloj monotonic para cortar exactamente en call_duration_s
    hangup_retries: int = 4          # Intentos de secuencia de hangup
    force_kill: bool = False         # Forzar kill del proceso si no cuelga
    dial_wait: float = 0.0           # Espera tras lanzar proceso antes de marcar (registro SIP)
    manual_dial: bool = False        # Siempre iniciar softphone y luego marcar vía GUI/Win32 (ignora argumentos /callto)
    overshoot_comp: float = 0.0      # Segundos a restar al objetivo para compensar drift
    gui_after_launch: bool = False   # Inyectar siempre número+teclas tras lanzar (útil para Phoner.exe si /callto no marca)
    inject_delay: float = 0.8        # Espera inicial antes de intentar inyectar número (GUI)
    inject_retries: int = 3          # Reintentos de inyección GUI (por latencia de arranque)
    # Modo segundo plano
    start_minimized: bool = False    # Lanzar Phoner minimizado/sin activar
    no_focus: bool = False           # Evitar traer al frente ventanas: no inyectar teclas ni set_focus; hangup por terminate

    # PhonerLite: perfil/cuenta a seleccionar al iniciar campaña.
    # Se basa en sipper.ini (sección [Profile] -> Profile=...).
    phonerlite_profile: Optional[str] = None

    def __post_init__(self):
        if self.extra_args is None:
            self.extra_args = []
        if self.dial_keys is None:
            # Intentos comunes: ENTER (PhonerLite), F9 (Phoner clásico)
            self.dial_keys = ['{ENTER}','{F9}']
        if self.hangup_keys is None:
            # Orden: ESC, F9 (toggle), Ctrl+H, Alt+F4 final
            self.hangup_keys = ['{ESC}','{F9}','^h','%{F4}']


_BASE_DIR = Path(__file__).resolve().parent
COMMON_CANDIDATES = [
    # Proyecto (descarga local)
    _BASE_DIR / 'bin' / 'PhonerLite' / 'PhonerLite.exe',
    # Instalaciones típicas
    Path(r"C:\Program Files\PhonerLite\PhonerLite.exe"),
    Path(r"C:\Program Files (x86)\PhonerLite\PhonerLite.exe"),
    Path(r"C:\Program Files\PhoneLite\PhoneLite.exe"),
    Path(r"C:\Program Files (x86)\PhoneLite\PhoneLite.exe"),
    Path(r"C:\Program Files\Phoner\Phoner.exe"),
    Path(r"C:\Program Files (x86)\Phoner\Phoner.exe"),
]


def _locate_phoner(p: Path) -> Path:
    """Devuelve ruta final al ejecutable aceptando:
      - Ruta directa al exe
            - Directorio que contenga PhonerLite.exe / PhoneLite.exe / Phoner.exe
      - Placeholder 'auto' -> busca candidatos comunes
    """
    if str(p).lower() in ('auto','autodetect'):
        for cand in COMMON_CANDIDATES:
            if cand.exists():
                return cand
        env = os.environ.get('PHONER_PATH')
        if env and Path(env).exists():
            return Path(env)
        raise FileNotFoundError("No se pudo autodetectar Phoner/PhonerLite (probar --phoner con ruta completa)")
    if p.is_dir():
        for name in ('PhonerLite.exe','PhoneLite.exe','Phoner.exe'):
            cand = p / name
            if cand.exists():
                return cand
        raise FileNotFoundError(f"Directorio sin ejecutable Phoner/PhonerLite/PhoneLite: {p}")
    if p.exists():
        return p
    raise FileNotFoundError(f"No existe ejecutable: {p}")


def _locate_config_from_exe(exe: Path) -> Optional[Path]:
    """Intenta localizar archivo INI de configuración.
    Heurísticas:
      - %APPDATA%/PhonerLite/PhonerLite.ini
      - Mismo directorio del exe (PhonerLite.ini / Phoner.ini)
      - %APPDATA%/Phoner/Phoner.ini
    """
    candidates: List[Path] = []
    appdata = os.environ.get('APPDATA')
    if exe.name.lower() == 'phonerlite.exe':
        if appdata:
            candidates.append(Path(appdata) / 'PhonerLite' / 'PhonerLite.ini')
        candidates.append(exe.parent / 'PhonerLite.ini')
    elif exe.name.lower() == 'phonelite.exe':
        if appdata:
            candidates.append(Path(appdata) / 'PhoneLite' / 'PhoneLite.ini')
        candidates.append(exe.parent / 'PhoneLite.ini')
    elif exe.name.lower() == 'phoner.exe':
        if appdata:
            candidates.append(Path(appdata) / 'Phoner' / 'Phoner.ini')
        candidates.append(exe.parent / 'Phoner.ini')
    else:  # fallback ambos
        if appdata:
            candidates.append(Path(appdata) / 'PhonerLite' / 'PhonerLite.ini')
            candidates.append(Path(appdata) / 'PhoneLite' / 'PhoneLite.ini')
            candidates.append(Path(appdata) / 'Phoner' / 'Phoner.ini')
        candidates.append(exe.parent / 'PhonerLite.ini')
        candidates.append(exe.parent / 'PhoneLite.ini')
        candidates.append(exe.parent / 'Phoner.ini')
    for c in candidates:
        if c.exists():
            return c
    return None


def _read_ini(path: Path) -> tuple[configparser.ConfigParser, str]:
    """Lee un INI intentando varias codificaciones. Devuelve (ConfigParser, raw_text).
    Lanza excepción si no puede leerse o parsearse. Usa ConfigParser con case-insensitive keys.
    """
    last_err: Optional[Exception] = None
    text: Optional[str] = None
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = path.read_text(encoding=enc)
            break
        except Exception as e:
            last_err = e
            continue
    if text is None:
        raise RuntimeError(f"No se pudo leer INI {path}: {last_err}")
    cp = configparser.ConfigParser()
    cp.optionxform = str.lower  # case-insensitive keys
    try:
        cp.read_string(text)
    except Exception as e:
        raise RuntimeError(f"No se pudo parsear INI {path}: {e}")
    return cp, text


def _read_ini_keep_case(path: Path) -> tuple[configparser.ConfigParser, str]:
    """Lee un INI preservando el case de las claves al escribir."""
    last_err: Optional[Exception] = None
    text: Optional[str] = None
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = path.read_text(encoding=enc)
            break
        except Exception as e:
            last_err = e
            continue
    if text is None:
        raise RuntimeError(f"No se pudo leer INI {path}: {last_err}")
    cp = configparser.ConfigParser()
    cp.optionxform = str  # preserve case
    try:
        cp.read_string(text)
    except Exception as e:
        raise RuntimeError(f"No se pudo parsear INI {path}: {e}")
    return cp, text


def list_phonerlite_profiles(phonerlite_exe: Path) -> list[str]:
    """Lista perfiles disponibles en PhonerLite leyendo sipper.ini.

    Devuelve nombres de secciones tipo "user@host".
    """
    try:
        exe = _locate_phoner(phonerlite_exe)
    except Exception:
        return []
    if exe.name.lower() != 'phonerlite.exe':
        return []
    sipper = exe.parent / 'sipper.ini'
    if not sipper.exists():
        return []
    try:
        cp, _ = _read_ini_keep_case(sipper)
    except Exception:
        return []
    profiles: list[str] = []
    for sec in cp.sections():
        if sec in ('Profile', 'Settings'):
            continue
        if '@' in sec:
            profiles.append(sec)
    profiles.sort(key=lambda s: s.lower())
    # Poner el actual primero si se puede
    try:
        current = cp.get('Profile', 'Profile', fallback='') if cp.has_section('Profile') else ''
        if current and current in profiles:
            profiles.remove(current)
            profiles.insert(0, current)
    except Exception:
        pass
    return profiles


def get_phonerlite_profiles_info(phonerlite_exe: Path) -> dict[str, dict[str, str]]:
    """Devuelve info básica de perfiles PhonerLite desde sipper.ini.

    Retorna un dict: {"user@host": {"gateway": "...", "username": "..."}}
    """
    try:
        exe = _locate_phoner(phonerlite_exe)
    except Exception:
        return {}
    if exe.name.lower() != 'phonerlite.exe':
        return {}
    sipper = exe.parent / 'sipper.ini'
    if not sipper.exists():
        return {}
    try:
        cp, _ = _read_ini_keep_case(sipper)
    except Exception:
        return {}

    info: dict[str, dict[str, str]] = {}
    for sec in cp.sections():
        if sec in ('Profile', 'Settings'):
            continue
        if '@' not in sec:
            continue
        try:
            gateway = (cp.get(sec, 'Gateway', fallback='') or '').strip()
            username = (cp.get(sec, 'UserName', fallback='') or '').strip()
        except Exception:
            gateway = ''
            username = ''
        info[sec] = {
            'gateway': gateway,
            'username': username,
        }
    return info


def set_phonerlite_profile(phonerlite_exe: Path, profile_name: str, *, debug: bool = False) -> bool:
    """Selecciona un perfil/cuenta en PhonerLite actualizando sipper.ini.

    Esto permite elegir (p.ej. VoIP vs GSM/VoLTE) antes de lanzar llamadas.
    """
    exe = _locate_phoner(phonerlite_exe)
    if exe.name.lower() != 'phonerlite.exe':
        return False
    sipper = exe.parent / 'sipper.ini'
    if not sipper.exists():
        if debug:
            print(f"[dialer][WARN] sipper.ini no existe: {sipper}")
        return False
    cp, _raw = _read_ini_keep_case(sipper)
    if not cp.has_section(profile_name):
        if debug:
            print(f"[dialer][WARN] Perfil no encontrado en sipper.ini: {profile_name}")
        return False
    if not cp.has_section('Profile'):
        cp.add_section('Profile')
    cp.set('Profile', 'Profile', profile_name)

    # Sincronizar algunos valores en [Settings] para que el motor use el perfil seleccionado.
    if not cp.has_section('Settings'):
        cp.add_section('Settings')
    try:
        p_user = cp.get(profile_name, 'UserName', fallback='').strip()
        p_gw = cp.get(profile_name, 'Gateway', fallback='').strip()
        p_pwd = cp.get(profile_name, 'PWD', fallback='').strip()
        if p_user:
            cp.set('Settings', 'UserName', f"{p_user}|{profile_name}")
        if p_gw:
            cp.set('Settings', 'Gateway', p_gw)
        if p_pwd:
            cp.set('Settings', 'PWD', p_pwd)
        cp.set('Settings', 'Register', cp.get(profile_name, 'Register', fallback=cp.get('Settings', 'Register', fallback='1')))
    except Exception:
        pass

    # Backup rápido (best-effort)
    try:
        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        backup_path = sipper.with_suffix(f'.ini.bak.{stamp}')
        shutil.copy2(sipper, backup_path)
    except Exception:
        pass

    with open(sipper, 'w', encoding='utf-8') as f:
        cp.write(f)

    # También actualizar PhonerLite.ini básico (para que UI/auto-detección mantenga coherencia)
    try:
        pl_ini = exe.parent / 'PhonerLite.ini'
        if pl_ini.exists():
            pl_cp, _ = _read_ini(pl_ini)
        else:
            pl_cp = configparser.ConfigParser(); pl_cp.optionxform = str.lower
        if not pl_cp.has_section('SIP'):
            pl_cp.add_section('SIP')
        if not pl_cp.has_section('Settings'):
            pl_cp.add_section('Settings')
        try:
            if p_gw:
                pl_cp.set('SIP', 'registrar', p_gw)
                pl_cp.set('SIP', 'domain', p_gw)
                pl_cp.set('Settings', 'gateway', p_gw)
            if p_user:
                pl_cp.set('SIP', 'username', p_user)
                pl_cp.set('SIP', 'authuser', p_user)
                pl_cp.set('SIP', 'displayname', p_user)
                pl_cp.set('Settings', 'username', p_user)
                pl_cp.set('Settings', 'displayname', p_user)
            if p_pwd:
                pl_cp.set('SIP', 'password', p_pwd)
                pl_cp.set('Settings', 'pwd', p_pwd)
            pl_cp.set('SIP', 'register', '1')
            pl_cp.set('Settings', 'register', '1')
        except Exception:
            pass
        with open(pl_ini, 'w', encoding='utf-8') as f:
            pl_cp.write(f)
    except Exception:
        pass

    if debug:
        print(f"[dialer] Perfil PhonerLite seleccionado: {profile_name}")
    return True


def migrate_phoner_to_phonerlite(phoner_exe: Optional[Path] = None, phonerlite_exe: Optional[Path] = None) -> dict:
    """Intenta migrar/copiar parámetros básicos SIP desde Phoner.ini a PhonerLite.ini.

    - Auto-detecta INIs a partir de ejecutables si no se pasan.
    - Realiza copia de seguridad de PhonerLite.ini antes de escribir.
    - Copia únicamente un conjunto seguro de claves típicas de cuenta/servidor SIP.

    Devuelve resumen: {
      'source_ini': str,
      'target_ini': str,
      'backup': str | None,
      'copied': [(section, key)],
    }

    Nota: Las estructuras exactas de INI pueden variar por versión; esta migración es "mejor esfuerzo" y no garantiza cobertura total.
    """
    # Resolver ejecutables, luego INIs
    # Si pasa Path('auto'), _locate_phoner lo maneja
    if phoner_exe is None:
        # Buscar Phoner.exe explícitamente
        for cand in COMMON_CANDIDATES:
            if cand.name.lower() == 'phoner.exe' and cand.exists():
                phoner_exe = cand
                break
    if phonerlite_exe is None:
        for cand in COMMON_CANDIDATES:
            if cand.name.lower() == 'phonerlite.exe' and cand.exists():
                phonerlite_exe = cand
                break
    if phoner_exe is None:
        raise FileNotFoundError("No se detectó Phoner.exe; seleccione ruta al ejecutable de Phoner")
    if phonerlite_exe is None:
        raise FileNotFoundError("No se detectó PhonerLite.exe; seleccione ruta al ejecutable de PhonerLite")

    ph_exe = _locate_phoner(phoner_exe)
    pl_exe = _locate_phoner(phonerlite_exe)
    src_ini = _locate_config_from_exe(ph_exe)
    tgt_ini = _locate_config_from_exe(pl_exe)
    if not src_ini or not src_ini.exists():
        raise FileNotFoundError("No se encontró Phoner.ini (origen)")
    if not tgt_ini:
        # Crear INI por defecto en %APPDATA% de PhonerLite
        appdata = os.environ.get('APPDATA')
        if appdata:
            tgt_ini = Path(appdata) / 'PhonerLite' / 'PhonerLite.ini'
            tgt_ini.parent.mkdir(parents=True, exist_ok=True)
        else:
            tgt_ini = pl_exe.parent / 'PhonerLite.ini'
    # Leer INIs
    src_cp, _ = _read_ini(src_ini)
    try:
        tgt_cp, _ = _read_ini(tgt_ini)
    except Exception:
        tgt_cp = configparser.ConfigParser(); tgt_cp.optionxform = str.lower

    # Selección de claves candidatas (minimiza riesgo)
    allowed_keys = {
        'registrar','register','server','proxy','outboundproxy','domain','realm',
        'username','user','authname','authuser','authorizationuser','password','displayname',
        'stunserver','stun','sipport','rtpport','dtmfmethod','srtp','transport'
    }
    # Encontrar sección objetivo en PhonerLite
    target_section = None
    for s in tgt_cp.sections():
        sl = s.lower()
        if 'account' in sl or sl == 'sip' or 'sip' in sl:
            target_section = s
            break
    if target_section is None:
        target_section = 'SIP'
        if not tgt_cp.has_section(target_section):
            tgt_cp.add_section(target_section)

    copied: list[tuple[str,str]] = []
    # Buscar claves en todas las secciones del origen
    for s in src_cp.sections():
        for k, v in src_cp.items(s):
            lk = k.lower()
            if lk in allowed_keys:
                # Mapa simple de equivalencias: algunas variantes comunes
                key_map = {
                    'user': 'username',
                    'authname': 'authuser',
                    'authorizationuser': 'authuser',
                    'register': 'registrar',
                }
                tk = key_map.get(lk, lk)
                try:
                    tgt_cp.set(target_section, tk, v)
                    copied.append((target_section, tk))
                except Exception:
                    continue

    # Guardar con backup
    backup_path = None
    try:
        if tgt_ini.exists():
            stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            backup_path = tgt_ini.with_suffix(f'.ini.bak.{stamp}')
            shutil.copy2(tgt_ini, backup_path)
    except Exception:
        backup_path = None
    with open(tgt_ini, 'w', encoding='utf-8') as f:
        tgt_cp.write(f)

    return {
        'source_ini': str(src_ini),
        'target_ini': str(tgt_ini),
        'backup': str(backup_path) if backup_path else None,
        'copied': copied,
    }


def show_config_summary(exe: Path) -> None:
    try:
        exe_resolved = _locate_phoner(exe)
    except Exception as e:
        print(f"[config] No se pudo resolver ejecutable: {e}")
        return
    ini = _locate_config_from_exe(exe_resolved)
    if not ini:
        print("[config] No se encontró archivo INI de configuración")
        return
    print(f"[config] INI detectado: {ini}")
    text = None
    for enc in ('utf-8-sig','utf-8','latin-1'):  # manejar BOM
        try:
            text = ini.read_text(encoding=enc)
            break
        except Exception:
            continue
    if text is None:
        print('[config] No se pudo leer INI')
        return
    # Intentar parsear con ConfigParser; si falla, fallback manual
    cp = configparser.ConfigParser()
    parsed = False
    try:
        cp.read_string(text)
        parsed = True
    except Exception as e:
        print(f"[config] Parser estándar falló: {e}; usando fallback")

    if parsed and cp.sections():
        for section in cp.sections():
            if len(section) > 60:
                continue
            lower = section.lower()
            if any(k in lower for k in ('password','secret','credential')):
                continue
            print(f"[config] [{section}]")
            for k,v in cp.items(section):
                lk = k.lower()
                if any(s in lk for s in ('pass','secret','pwd','credential')):
                    print(f"    {k}=***")
                else:
                    val = v[:120] + ('...' if len(v)>120 else '')
                    print(f"    {k}={val}")
    else:
        # Fallback: imprimir líneas de secciones y claves sencillas
        for line in text.splitlines():
            ln = line.strip()
            if not ln or ln.startswith(';'):
                continue
            if ln.startswith('[') and ln.endswith(']'):
                if any(s in ln.lower() for s in ('password','secret','credential')):
                    continue
                print(f"[config] {ln}")
            elif '=' in ln:
                key, val = ln.split('=',1)
                lk = key.lower()
                if any(s in lk for s in ('pass','secret','pwd','credential')):
                    print(f"[config]    {key}=***")
                else:
                    short = val[:120] + ('...' if len(val)>120 else '')
                    print(f"[config]    {key}={short}")
    print("[config] Fin resumen (sensibles ocultos)")


def ensure_local_phonerlite(dest_dir: Optional[Path] = None) -> Path:
    """Descarga PhonerLite portable y lo deja en Proyectos/llamadas/bin/PhonerLite.

    Devuelve la ruta a PhonerLite.exe una vez disponible.
    """
    base = Path(__file__).resolve().parent
    target_dir = dest_dir or (base / 'bin' / 'PhonerLite')
    exe = target_dir / 'PhonerLite.exe'
    if exe.exists():
        return exe
    target_dir.mkdir(parents=True, exist_ok=True)
    url = 'https://www.phoner.de/PhonerLite.zip'
    zip_path = target_dir / 'PhonerLite.zip'
    try:
        print(f"[dialer] Descargando PhonerLite desde {url} ...")
        urllib.request.urlretrieve(url, zip_path)
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(target_dir)
        try:
            zip_path.unlink(missing_ok=True)
        except Exception:
            pass
        if not exe.exists():
            # Algunas veces el exe está dentro de subcarpeta, intentar localizarlo
            for p in target_dir.rglob('PhonerLite.exe'):
                return p
        return exe
    except Exception as e:
        raise RuntimeError(f"No se pudo descargar PhonerLite: {e}")


def ensure_phonerlite_ready(phonerlite_exe: Path) -> Optional[Path]:
    """Asegura que PhonerLite tenga una configuración SIP básica disponible.

    Estrategia:
    - Si existe un INI con claves mínimas (registrar/username), no hace nada.
    - Si falta, intenta migrar automáticamente desde Phoner.ini.
    - Si no hay Phoner.ini, intenta crear/actualizar INI a partir de variables de entorno:
      PHONERLITE_REGISTRAR, PHONERLITE_USERNAME, PHONERLITE_PASSWORD, PHONERLITE_DOMAIN, PHONERLITE_DISPLAYNAME.

    Devuelve la ruta al INI usado si lo crea/actualiza, o None si no fue necesario.
    """
    try:
        exe = _locate_phoner(phonerlite_exe)
    except Exception:
        return None
    # Sincronización temprana: si el INI portable carece de secciones y en APPDATA sí existen, copiar/merge
    try:
        appdata_dir = os.environ.get('APPDATA')
        portable_ini = Path(exe).parent / 'PhonerLite.ini'
        app_ini = None
        if appdata_dir:
            app_ini = Path(appdata_dir) / 'PhonerLite' / 'PhonerLite.ini'
        def _has_core_sections(path: Path) -> bool:
            try:
                cp_tmp, _ = _read_ini(path)
                has_sip = any(s.lower()=='sip' for s in cp_tmp.sections())
                has_settings = cp_tmp.has_section('Settings')
                return has_sip or has_settings
            except Exception:
                return False
        if app_ini and app_ini.exists() and _has_core_sections(app_ini):
            if not portable_ini.exists() or not _has_core_sections(portable_ini):
                try:
                    import shutil as _sh
                    _sh.copy2(app_ini, portable_ini)
                    print(f"[dialer] Copiada configuración desde %APPDATA% a portable: {portable_ini}")
                except Exception as _e:
                    print(f"[dialer][WARN] No se pudo copiar config APPDATA->portable: {_e}")
            else:
                # Merge selectivo por si la portable está incompleta
                try:
                    port_cp, _ = _read_ini(portable_ini)
                except Exception:
                    port_cp = configparser.ConfigParser(); port_cp.optionxform = str.lower
                try:
                    app_cp, _ = _read_ini(app_ini)
                except Exception:
                    app_cp = None
                if app_cp:
                    changed=False
                    for sec_name in ('SIP','Settings'):
                        if app_cp.has_section(sec_name):
                            if not port_cp.has_section(sec_name):
                                port_cp.add_section(sec_name); changed=True
                            for k,v in app_cp.items(sec_name):
                                if port_cp.get(sec_name, k, fallback=None) != v:
                                    try:
                                        port_cp.set(sec_name, k, v); changed=True
                                    except Exception: pass
                    if changed:
                        try:
                            with open(portable_ini,'w',encoding='utf-8') as f: port_cp.write(f)
                            print("[dialer] Fusionada configuración APPDATA -> portable (SIP/Settings)")
                        except Exception: pass
    except Exception:
        pass
    ini = _locate_config_from_exe(exe)
    # Comprobar si ya está configurado
    if ini and ini.exists():
        try:
            cp, _ = _read_ini(ini)
            # Detectar si ya hay sección estilo PhonerLite ([Settings]) con UserName y Gateway
            has_settings = cp.has_section('Settings') and cp.has_option('Settings','UserName') and cp.has_option('Settings','Gateway')
            # Detectar sección genérica SIP que nosotros creamos antes
            sip_sec = None
            for s in cp.sections():
                if s.lower() in ('sip','account','cuenta'):
                    sip_sec = s; break
            if has_settings:
                # Sincronizar copia portable (crear o fusionar secciones SIP/Settings)
                try:
                    portable_ini = exe.parent / 'PhonerLite.ini'
                    import shutil as _sh
                    if not portable_ini.exists():
                        _sh.copy2(ini, portable_ini)
                        print(f"[dialer] INI portable creado desde existente: {portable_ini}")
                    else:
                        try:
                            port_cp, _ = _read_ini(portable_ini)
                        except Exception:
                            port_cp = configparser.ConfigParser(); port_cp.optionxform = str.lower
                        changed = False
                        for section_name in ('SIP','Settings'):
                            if cp.has_section(section_name):
                                if not port_cp.has_section(section_name):
                                    port_cp.add_section(section_name)
                                    changed = True
                                # Copiar claves que falten o actualizar (mantener pwd si ya existía distinta?)
                                for k, v in cp.items(section_name):
                                    try:
                                        old_v = port_cp.get(section_name, k, fallback=None)
                                    except Exception:
                                        old_v = None
                                    if old_v != v and (k.lower() != 'pwd' or v):
                                        try:
                                            port_cp.set(section_name, k, v)
                                            changed = True
                                        except Exception:
                                            pass
                        if changed:
                            with open(portable_ini,'w',encoding='utf-8') as f:
                                port_cp.write(f)
                            print(f"[dialer] INI portable fusionado con secciones SIP/Settings")
                except Exception as _e:
                    print(f"[dialer][WARN] No se pudo sincronizar/ fusionar INI portable: {_e}")
                return None
            # Si no hay [Settings] pero sí tenemos datos en [SIP], crear [Settings]
            if sip_sec:
                try:
                    reg = cp.get(sip_sec,'registrar', fallback=cp.get(sip_sec,'server', fallback=''))
                except Exception:
                    reg = ''
                try:
                    user = cp.get(sip_sec,'username', fallback=cp.get(sip_sec,'user', fallback=''))
                except Exception:
                    user = ''
                pwd = cp.get(sip_sec,'password', fallback='') if cp.has_option(sip_sec,'password') else ''
                disp = cp.get(sip_sec,'displayname', fallback=user)
                if reg and user:
                    if not cp.has_section('Settings'):
                        cp.add_section('Settings')
                    cp.set('Settings','UserName', user)
                    cp.set('Settings','DisplayName', disp)
                    if pwd:
                        cp.set('Settings','PWD', pwd)
                    cp.set('Settings','Gateway', reg)
                    cp.set('Settings','Register','1')
                    cp.set('Settings','LocalPort','5060')
                    try:
                        with open(ini,'w',encoding='utf-8') as f:
                            cp.write(f)
                        print(f"[dialer] Añadida sección [Settings] a {ini} para compatibilidad PhonerLite")
                        # Después de crear [Settings], fusionar también al portable
                        try:
                            portable_ini = exe.parent / 'PhonerLite.ini'
                            import shutil as _sh
                            if not portable_ini.exists():
                                _sh.copy2(ini, portable_ini)
                                print(f"[dialer] INI portable creado tras añadir [Settings]")
                            else:
                                try:
                                    port_cp, _ = _read_ini(portable_ini)
                                except Exception:
                                    port_cp = configparser.ConfigParser(); port_cp.optionxform = str.lower
                                if not port_cp.has_section('Settings'):
                                    port_cp.add_section('Settings')
                                for k,v in cp.items('Settings'):
                                    try:
                                        port_cp.set('Settings',k,v)
                                    except Exception:
                                        pass
                                # Copiar también sección SIP si no existe
                                if sip_sec and cp.has_section(sip_sec):
                                    if not port_cp.has_section('SIP'):
                                        port_cp.add_section('SIP')
                                    for k,v in cp.items(sip_sec):
                                        try:
                                            port_cp.set('SIP',k,v)
                                        except Exception:
                                            pass
                                with open(portable_ini,'w',encoding='utf-8') as f:
                                    port_cp.write(f)
                                print("[dialer] INI portable actualizado con [Settings]/[SIP]")
                        except Exception as _ee:
                            print(f"[dialer][WARN] No se pudo actualizar INI portable tras añadir Settings: {_ee}")
                    except Exception as _e:
                        print(f"[dialer][WARN] No se pudo añadir [Settings]: {_e}")
                    return None
        except Exception:
            pass
    # Intentar migración automática desde Phoner.ini (una sola vez)
    try:
        res = migrate_phoner_to_phonerlite(phonerlite_exe=exe)
        print(f"[dialer] Migrada configuración desde Phoner.ini -> {res.get('target_ini')}")
        return Path(res.get('target_ini')) if res.get('target_ini') else None
    except Exception:
        pass
    # Fallback: usar PHONER_INI o %APPDATA%\Phoner\Phoner.ini directamente
    src_ini_env = os.environ.get('PHONER_INI')
    candidates = []
    if src_ini_env:
        try:
            candidates.append(Path(src_ini_env))
        except Exception:
            pass
    appdata = os.environ.get('APPDATA')
    if appdata:
        candidates.append(Path(appdata) / 'Phoner' / 'Phoner.ini')
    for src_ini in candidates:
        try:
            if not src_ini or not src_ini.exists():
                continue
            src_cp, _ = _read_ini(src_ini)
            # Determinar INI destino de PhonerLite
            tgt_ini = _locate_config_from_exe(exe)
            if not tgt_ini:
                if appdata:
                    tgt_ini = Path(appdata) / 'PhonerLite' / 'PhonerLite.ini'
                    tgt_ini.parent.mkdir(parents=True, exist_ok=True)
                else:
                    tgt_ini = exe.parent / 'PhonerLite.ini'
            try:
                tgt_cp, _ = _read_ini(tgt_ini)
            except Exception:
                tgt_cp = configparser.ConfigParser(); tgt_cp.optionxform = str.lower
            # Selección segura de claves
            allowed_keys = {
                'registrar','register','server','proxy','outboundproxy','domain','realm',
                'username','user','authname','authuser','authorizationuser','password','displayname',
                'stunserver','stun','sipport','rtpport','dtmfmethod','srtp','transport'
            }
            # Sección objetivo en PhonerLite
            target_section = None
            for s in tgt_cp.sections():
                sl = s.lower()
                if 'account' in sl or sl == 'sip' or 'sip' in sl:
                    target_section = s
                    break
            if target_section is None:
                target_section = 'SIP'
                if not tgt_cp.has_section(target_section):
                    tgt_cp.add_section(target_section)
            # Copiar claves
            key_map = {
                'user': 'username',
                'authname': 'authuser',
                'authorizationuser': 'authuser',
                'register': 'registrar',
            }
            copied_any = False
            for s in src_cp.sections():
                for k, v in src_cp.items(s):
                    lk = k.lower()
                    if lk in allowed_keys:
                        tk = key_map.get(lk, lk)
                        try:
                            tgt_cp.set(target_section, tk, v)
                            copied_any = True
                        except Exception:
                            continue
            if copied_any:
                # Backup
                try:
                    if tgt_ini.exists():
                        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
                        backup_path = tgt_ini.with_suffix(f'.ini.bak.{stamp}')
                        shutil.copy2(tgt_ini, backup_path)
                except Exception:
                    pass
                with open(tgt_ini, 'w', encoding='utf-8') as f:
                    tgt_cp.write(f)
                print(f"[dialer] Config de Phoner importada desde {src_ini} -> {tgt_ini}")
                return tgt_ini
        except Exception:
            continue
    # Intentar crear INI desde variables de entorno
    reg = os.environ.get('PHONERLITE_REGISTRAR')
    user = os.environ.get('PHONERLITE_USERNAME')
    pwd = os.environ.get('PHONERLITE_PASSWORD')
    dom = os.environ.get('PHONERLITE_DOMAIN')
    dname = os.environ.get('PHONERLITE_DISPLAYNAME')
    # NUEVO: intentar cargar de phonerlite_config.json si faltan datos mínimos
    if (not reg or not user):
        try:
            json_cfg = Path(__file__).with_name('phonerlite_config.json')
            if json_cfg.exists():
                import json as _json
                with open(json_cfg, 'r', encoding='utf-8') as jf:
                    data = _json.load(jf)
                # Admite claves en minúsculas o camel
                reg = reg or data.get('registrar') or data.get('REGISTRAR')
                user = user or data.get('username') or data.get('user') or data.get('USERNAME')
                pwd = pwd or data.get('password') or data.get('PASSWORD')
                dom = dom or data.get('domain') or data.get('DOMAIN')
                dname = dname or data.get('displayname') or data.get('display_name') or data.get('DISPLAYNAME')
                if reg and user:
                    print(f"[dialer] Config SIP tomada de {json_cfg}")
        except Exception as e:  # pragma: no cover - tolerante
            print(f"[dialer][WARN] No se pudo leer phonerlite_config.json: {e}")
    if not reg or not user:
        # Sin datos suficientes (ni env vars ni json)
        return None
    # Determinar ruta INI objetivo (preferir %APPDATA%)
    appdata = os.environ.get('APPDATA')
    if appdata:
        ini = Path(appdata) / 'PhonerLite' / 'PhonerLite.ini'
        ini.parent.mkdir(parents=True, exist_ok=True)
    else:
        ini = exe.parent / 'PhonerLite.ini'
    cp = configparser.ConfigParser(); cp.optionxform = str.lower
    if ini.exists():
        try:
            cp, _ = _read_ini(ini)
        except Exception:
            cp = configparser.ConfigParser(); cp.optionxform = str.lower
    sec = None
    for s in cp.sections():
        if 'sip' in s.lower() or 'account' in s.lower():
            sec = s; break
    if sec is None:
        sec = 'SIP';
        if not cp.has_section(sec):
            cp.add_section(sec)
    cp.set(sec, 'registrar', reg)
    cp.set(sec, 'username', user)
    if dom:
        cp.set(sec, 'domain', dom)
    if dname:
        cp.set(sec, 'displayname', dname)
    if pwd:
        cp.set(sec, 'password', pwd)
    # Activar registro automático si procede
    try:
        cp.set(sec, 'register', '1')
    except Exception:
        pass
    with open(ini, 'w', encoding='utf-8') as f:
        cp.write(f)
    print(f"[dialer] Configuración básica de PhonerLite escrita en {ini}")
    # También crear sección [Settings] que PhonerLite espera si no existe
    try:
        cp_settings = configparser.ConfigParser(); cp_settings.optionxform = str.lower
        try:
            cp_settings, _ = _read_ini(ini)
        except Exception:
            pass
        if not cp_settings.has_section('Settings'):
            if not cp_settings.has_section('Settings'):
                cp_settings.add_section('Settings')
            cp_settings.set('Settings','UserName', user)
            cp_settings.set('Settings','DisplayName', dname or user)
            if pwd:
                cp_settings.set('Settings','PWD', pwd)
            cp_settings.set('Settings','Gateway', reg)
            cp_settings.set('Settings','Register','1')
            cp_settings.set('Settings','LocalPort','5060')
            with open(ini,'w',encoding='utf-8') as f:
                cp_settings.write(f)
            print(f"[dialer] Añadida sección [Settings] inicial")
    except Exception as _e:  # pragma: no cover
        print(f"[dialer][WARN] No se pudo crear sección Settings: {_e}")
    # Copiar también al directorio del ejecutable (modo portable) para evitar wizard.
    try:
        portable_ini = exe.parent / 'PhonerLite.ini'
        # NUEVO: generar siempre un INI mínimo en la carpeta del exe para forzar que PhonerLite lo lea primero
        try:
            base_cp = configparser.ConfigParser(); base_cp.optionxform = str.lower
            base_cp.add_section('SIP')
            for k,v in cp.items(sec):
                try: base_cp.set('SIP', k, v)
                except Exception: pass
            if not base_cp.has_section('Settings'): base_cp.add_section('Settings')
            # Mapear claves esenciales a Settings (PhonerLite usa camelcase internamente pero acepta lowercase?)
            try:
                base_cp.set('Settings','UserName', cp.get(sec,'username', fallback=user))
                base_cp.set('Settings','DisplayName', cp.get(sec,'displayname', fallback=dname or user))
                if pwd: base_cp.set('Settings','PWD', pwd)
                base_cp.set('Settings','Gateway', cp.get(sec,'registrar', fallback=reg))
                base_cp.set('Settings','Register','1')
                base_cp.set('Settings','LocalPort', cp.get(sec,'sipport', fallback='5060'))
            except Exception: pass
            with open(portable_ini,'w',encoding='utf-8') as f:
                base_cp.write(f)
            print(f"[dialer] INI mínimo escrito en {portable_ini}")
            # Crear también perfil explícito Profiles/Settings.ini (estructura similar a PhonerLite nativa)
            try:
                profiles_dir = portable_ini.parent / 'Profiles'
                profiles_dir.mkdir(parents=True, exist_ok=True)
                profile_path = profiles_dir / 'Settings.ini'
                prof_lines = [
                    '[Account]',
                    f'UserName={cp.get(sec,"username", fallback=user)}',
                    f'DisplayName={cp.get(sec,"displayname", fallback=dname or user)}',
                    f'Gateway={cp.get(sec,"registrar", fallback=reg)}',
                    f'Register=1',
                    f'LocalPort={cp.get(sec,"sipport", fallback="5060")}',
                ]
                if pwd:
                    prof_lines.append(f'PWD={pwd}')
                prof_lines.append('')
                with open(profile_path,'w',encoding='utf-8') as pf:
                    pf.write('\n'.join(prof_lines))
                print(f"[dialer] Perfil creado: {profile_path}")
            except Exception as _pe:
                print(f"[dialer][WARN] No se pudo crear perfil Settings.ini: {_pe}")
        except Exception as _e2:
            print(f"[dialer][WARN] No se pudo escribir INI mínimo portable: {_e2}")
    except Exception as _e:  # pragma: no cover
        print(f"[dialer][WARN] No se pudo sincronizar INI portable: {_e}")
    return ini

def _validate_config(cfg: DialerConfig):
    # Normaliza ruta (permite 'auto')
    if not cfg.dry_run:
        cfg.phoner_path = _locate_phoner(cfg.phoner_path)
        if not shutil.which(str(cfg.phoner_path)) and not cfg.phoner_path.is_file():
            raise FileNotFoundError(f"Ruta inválida para Phoner: {cfg.phoner_path}")
    if not cfg.targets:
        raise ValueError("Lista de destinos vacía")


def _build_cmd(cfg: DialerConfig, target: str) -> List[str]:
    # Intentar /callto= primero; algunos aceptan simple target.
    base = [str(cfg.phoner_path), f"/callto={target}"]
    if cfg.extra_args:
        base.extend(cfg.extra_args)
    return base


def _build_alternate_cmds(cfg: DialerConfig, target: str) -> List[List[str]]:
    """Devuelve lista de comandos alternativos a probar si el primero falla rápido."""
    base = str(cfg.phoner_path)
    variants = [
        [base, f"/callto={target}"],
        [base, target],
    ]
    # Solo añadir variante con prefijo 'sip:' si el target no lo tiene ya
    if not str(target).lower().startswith('sip:'):
        variants.append([base, f"sip:{target}"])
    # Añadir extra_args a cada uno
    final = []
    for v in variants:
        final.append(v + (cfg.extra_args or []))
    # Quitar duplicados preservando orden
    dedup = []
    seen = set()
    for cmd in final:
        key = tuple(cmd)
        if key in seen:
            continue
        seen.add(key)
        dedup.append(cmd)
    return dedup


def _format_target(cfg: DialerConfig, raw: str) -> str:
    """Construye URI marcable.

    Reglas:
      - Si uri_template definida => uri_template.format(target=raw_mod)
      - Else si contiene '@' o empieza por 'sip:' => se usa tal cual
      - Else si sip_domain definido => sip:{raw_mod}@sip_domain
      - Else => raw_mod
    Donde raw_mod aplica prepend_plus si procede.
    """
    raw_mod = raw
    if cfg.prepend_plus and not raw_mod.startswith('+'):
        raw_mod = '+' + raw_mod
    if cfg.uri_template:
        try:
            return cfg.uri_template.format(target=raw_mod)
        except Exception as e:
            if cfg.debug:
                print(f"[dialer][debug] uri_template error: {e}")
            return raw_mod
    lower = raw_mod.lower()
    if '@' in lower or lower.startswith('sip:'):
        return raw_mod
    if cfg.sip_domain:
        return f"sip:{raw_mod}@{cfg.sip_domain}"
    return raw_mod


def _attach_existing_window() -> Optional["pywinauto.base_wrapper.BaseWrapper"]:  # type: ignore
    if not pywinauto:
        return None
    try:
        from pywinauto import Desktop  # type: ignore
        # Buscar ventana principal que contenga 'Phoner'
        wins = [w for w in Desktop(backend='win32').windows() if 'phoner' in (w.window_text() or '').lower()]
        if wins:
            return wins[0]
    except Exception as e:
        print(f"[dialer] No se pudo adjuntar ventana existente: {e}")
    return None


def _find_all_phoner_windows():
    if not pywinauto:
        return []
    try:
        from pywinauto import Desktop  # type: ignore
        wins = [w for w in Desktop(backend='win32').windows() if 'phoner' in (w.window_text() or '').lower()]
        return wins
    except Exception:
        return []


def _global_hangup(cfg: DialerConfig):
    """Intenta colgar usando cualquier ventana Phoner abierta (cuando no tenemos handle del proceso inicial)."""
    wins = _find_all_phoner_windows()
    if not wins:
        # Fallback Win32 si no hay pywinauto
        if not pywinauto and platform.system().lower() == 'windows':
            _win32_global_hangup(cfg)
        return
    keys_seq = cfg.hangup_keys if cfg.hangup_keys else ['{ESC}','{F9}','^h','%{F4}']
    for w in wins:
        try:
            w.set_focus()
        except Exception:
            continue
        for k in keys_seq:
            try:
                w.type_keys(k, pause=0.15)
                time.sleep(0.4)
            except Exception:
                continue


# ------------------------ Win32 fallback (sin pywinauto) ---------------------
def _enum_windows():
    user32 = ctypes.windll.user32
    EnumWindows = user32.EnumWindows
    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
    GetWindowText = user32.GetWindowTextW
    GetWindowTextLength = user32.GetWindowTextLengthW
    IsWindowVisible = user32.IsWindowVisible
    handles = []
    def foreach(hwnd, lParam):
        if IsWindowVisible(hwnd):
            length = GetWindowTextLength(hwnd)
            buff = ctypes.create_unicode_buffer(length + 1)
            GetWindowText(hwnd, buff, length + 1)
            title = buff.value
            if title and 'phoner' in title.lower():
                handles.append((hwnd, title))
        return True
    EnumWindows(EnumWindowsProc(foreach), 0)
    return handles


VK = {
    'ESC': 0x1B,
    'F9': 0x78,
    # Alt handled via keybd_event with VK_MENU (0x12) + F4
    'F4': 0x73,
}

def _send_key_to_hwnd(hwnd, vk, alt=False):
    user32 = ctypes.windll.user32
    SetForegroundWindow = user32.SetForegroundWindow
    keybd_event = user32.keybd_event
    VK_MENU = 0x12
    SetForegroundWindow(hwnd)
    time.sleep(0.05)
    if alt:
        keybd_event(VK_MENU, 0, 0, 0)
        keybd_event(vk, 0, 0, 0)
        keybd_event(vk, 0, 2, 0)
        keybd_event(VK_MENU, 0, 2, 0)
    else:
        keybd_event(vk, 0, 0, 0)
        keybd_event(vk, 0, 2, 0)


def _interpret_key_token(token: str):
    t = token.strip().upper()
    if t.startswith('{') and t.endswith('}'):
        t = t[1:-1]
    if t == 'ESC':
        return ('ESC', False)
    if t == 'F9':
        return ('F9', False)
    if t in ('ALT+F4','%{F4}','ALT+F4'):
        return ('F4', True)
    return (None, False)


def _win32_global_hangup(cfg: DialerConfig):
    try:
        handles = _enum_windows()
        if not handles:
            return
        seq = cfg.hangup_keys if cfg.hangup_keys else ['{ESC}','{F9}','%{F4}']
        for hwnd, title in handles:
            for token in seq:
                key_name, alt = _interpret_key_token(token)
                if not key_name:
                    continue
                vk = VK.get(key_name)
                if vk is None:
                    continue
                _send_key_to_hwnd(hwnd, vk, alt=alt)
                time.sleep(0.3)
    except Exception:
        pass


def _win32_type_and_dial(number: str, dial_keys: List[str]):
    """Marca número en ventana Phoner usando Win32 fallback."""
    try:
        handles = _enum_windows()
        if not handles:
            return False
        # Usar la primera ventana
        hwnd, _title = handles[0]
        # Simplista: enviar Ctrl+A Delete y luego dígitos y teclas de marcado
        user32 = ctypes.windll.user32
        SetForegroundWindow = user32.SetForegroundWindow
        keybd_event = user32.keybd_event
        VK_BACK = 0x08
        VK_DELETE = 0x2E
        VK_CONTROL = 0x11
        # Focus
        SetForegroundWindow(hwnd)
        time.sleep(0.05)
        # Ctrl+A
        keybd_event(VK_CONTROL,0,0,0); keybd_event(0x41,0,0,0); keybd_event(0x41,0,2,0); keybd_event(VK_CONTROL,0,2,0)
        time.sleep(0.02)
        # Delete
        keybd_event(VK_DELETE,0,0,0); keybd_event(VK_DELETE,0,2,0)
        time.sleep(0.02)
        for ch in number:
            vk = ord(ch.upper()) if ch.isalnum() else None
            if vk is None:
                # ignorar caracteres no básicos
                continue
            keybd_event(vk,0,0,0); keybd_event(vk,0,2,0)
            time.sleep(0.02)
        # Dial keys
        for token in dial_keys:
            name,_alt = _interpret_key_token(token)
            if not name:
                if token.upper() in ('{ENTER}','ENTER'):
                    keybd_event(0x0D,0,0,0); keybd_event(0x0D,0,2,0)
                continue
            if name == 'F9':
                keybd_event(0x78,0,0,0); keybd_event(0x78,0,2,0)
            elif name == 'ESC':
                keybd_event(0x1B,0,0,0); keybd_event(0x1B,0,2,0)
            elif name == 'F4':
                # evitar cerrar al marcar
                continue
            time.sleep(0.1)
        return True
    except Exception:
        return False


def _attempt_gui_injection(cfg: DialerConfig, formatted: str) -> bool:
    """Intenta inyectar número y marcar via GUI (pywinauto o Win32) con reintentos.
    Devuelve True si aparentemente se envió secuencia."""
    for attempt in range(1, cfg.inject_retries + 1):
        if cfg.debug:
            print(f"[dialer][debug] GUI inject intento {attempt}/{cfg.inject_retries}")
        if pywinauto:
            wnd = _attach_existing_window()
            if wnd:
                _dial_via_existing(wnd, formatted)
                return True
        # fallback
        ok = _win32_type_and_dial(formatted, _CURRENT_CFG.dial_keys if _CURRENT_CFG else ['{ENTER}','{F9}'])
        if ok:
            return True
        time.sleep(0.6)
    if cfg.debug:
        print("[dialer][debug] Falló inyección GUI tras reintentos")
    return False


def _dial_via_existing(wnd, target: str):
    try:
        wnd.set_focus()
        # Limpiar (Ctrl+A, Supr) y escribir número, Enter
        wnd.type_keys('^a{DELETE}', pause=0.05)
        for ch in target:
            wnd.type_keys(ch, with_spaces=True, pause=0.02)
        # Enviar secuencia de teclas de marcado configurables
        # Algunas versiones requieren F9 para iniciar
        try:
            cfg = _CURRENT_CFG  # type: ignore
            keys_seq = cfg.dial_keys if cfg and cfg.dial_keys else ['{ENTER}']
        except Exception:
            keys_seq = ['{ENTER}']
        for k in keys_seq:
            wnd.type_keys(k, pause=0.1)
    except Exception as e:
        print(f"[dialer] Falló marcado en ventana existente: {e}")


def _hangup_existing(wnd):
    try:
        wnd.set_focus()
        try:
            cfg = _CURRENT_CFG  # type: ignore
            keys_seq = cfg.hangup_keys if cfg and cfg.hangup_keys else ['{ESC}','%{F4}']
        except Exception:
            keys_seq = ['{ESC}','%{F4}']
        for k in keys_seq:
            try:
                wnd.type_keys(k, pause=0.1)
                time.sleep(0.6)
                # Opcional: podríamos detectar cambio de estado si tuviéramos API
            except Exception:
                continue
    except Exception:
        pass


def _attempt_hangup_phoner(process: subprocess.Popen, cfg: DialerConfig) -> None:
    """Intenta colgar la llamada.
    Métodos:
      1. pywinauto (si disponible) para buscar ventana y enviar ESC / Alt+F4 / Ctrl+H.
      2. fallback: process.terminate() (forzará cierre app; menos elegante).
    """
    if pywinauto:
        try:
            app = pywinauto.Application(backend='win32').connect(process=process.pid, timeout=5)
            wnd = app.top_window()
            keys_seq = cfg.hangup_keys if cfg.hangup_keys else ['{ESC}','{F9}','^h','%{F4}']
            for k in keys_seq:
                try:
                    wnd.set_focus()
                    wnd.type_keys(k, pause=0.15)
                    time.sleep(0.7)
                except Exception:
                    continue
            return
        except Exception as e:
            print(f"[dialer] pywinauto hangup falló: {e}")
    # Fallback duro
    try:
        process.terminate()
        process.wait(timeout=3)
        print(f"[dialer] Proceso PhonerLite terminado con terminate().")
    except Exception as e:
        print(f"[dialer] terminate() falló: {e}")
        # Último recurso: taskkill
        import subprocess as sp
        try:
            sp.run(["taskkill", "/PID", str(process.pid), "/F", "/T"], check=True)
            print(f"[dialer] Proceso PhonerLite cerrado con taskkill.")
        except Exception as e2:
            print(f"[dialer] taskkill falló: {e2}")
    # Limpieza de procesos huérfanos antes de cada campaña
    try:
        _cleanup_stray_processes(debug=True)
    except Exception as e:
        print(f"[dialer] Limpieza de procesos huérfanos falló: {e}")


def request_abort():
    """Solicita abortar la campaña en curso (usado por GUI)."""
    global _ABORT
    _ABORT = True


def _cleanup_stray_processes(exe_name: str = 'PhonerLite.exe', exclude: Optional[set] = None, debug: bool = False):
    """Elimina procesos huérfanos de PhonerLite para evitar solape de llamadas.

    - Sólo actúa en Windows.
    - Usa 'tasklist' para enumerar y 'taskkill /F /T' para forzar cierre.
    - Exclude: conjunto de PIDs a preservar (si se suministra).
    """
    if platform.system().lower() != 'windows':
        return
    try:
        # tasklist salida CSV para parseo robusto
        cmd = ['tasklist','/FI',f'IMAGENAME eq {exe_name}','/FO','CSV']
        out = subprocess.check_output(cmd, encoding='utf-8', errors='ignore')
        lines = [ln for ln in out.splitlines() if ln.strip()]
        if len(lines) <= 1:
            return
        for row in lines[1:]:
            try:
                # Formato: "Image Name","PID","Session Name","Session#","Mem Usage"
                parsed = next(csv.reader([row]))
            except Exception:
                continue
            if len(parsed) < 2:
                continue
            name = parsed[0].strip('"')
            pid_s = parsed[1].strip('"')
            if name.lower() != exe_name.lower():
                continue
            try:
                pid = int(pid_s)
            except Exception:
                continue
            if exclude and pid in exclude:
                continue
            try:
                subprocess.run(['taskkill','/PID',str(pid),'/F','/T'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if debug:
                    print(f"[dialer][cleanup] Proceso residual {exe_name} PID={pid} terminado")
            except Exception as e:
                if debug:
                    print(f"[dialer][cleanup][WARN] No se pudo matar PID {pid}: {e}")
    except Exception as e:
        if debug:
            print(f"[dialer][cleanup][WARN] Falló enumeración de procesos: {e}")


def run_campaign(cfg: DialerConfig, on_call_end: Optional[Callable[[DialerConfig, str, float], None]] = None):
    _validate_config(cfg)
    # Preparar config antes de iniciar (evita wizard si falta INI portable)
    try:
        if cfg.phoner_path.name.lower() == 'phonerlite.exe':
            # Si viene perfil seleccionado, aplicarlo antes de empezar.
            if cfg.phonerlite_profile:
                try:
                    set_phonerlite_profile(cfg.phoner_path, cfg.phonerlite_profile, debug=cfg.debug)
                except Exception as _pe:
                    print(f"[dialer][WARN] No se pudo seleccionar perfil '{cfg.phonerlite_profile}': {_pe}")
            ensure_phonerlite_ready(cfg.phoner_path)
    except Exception as e:
        print(f"[dialer][WARN] Preparación PhonerLite falló: {e}")
    # Autodetección de dominio SIP si no se proporcionó y el INI ya tiene Gateway/registrar
    try:
        if not cfg.sip_domain and cfg.phoner_path.name.lower() == 'phonerlite.exe':
            ini_path = _locate_config_from_exe(cfg.phoner_path)
            if ini_path and ini_path.exists():
                try:
                    _cp, _raw = _read_ini(ini_path)
                except Exception:
                    _cp = None
                candidate = None
                if _cp:
                    # Preferir Settings.Gateway, luego SIP.registrar/domain
                    if _cp.has_section('Settings'):
                        candidate = _cp.get('Settings','Gateway', fallback=None)
                    if (not candidate or candidate.strip()=='' ) and _cp.has_section('SIP'):
                        candidate = _cp.get('SIP','registrar', fallback=_cp.get('SIP','domain', fallback=None))
                if candidate:
                    # Limpiar posibles prefijos/protocolos (sip:, etc.) y puertos
                    cand = candidate.strip()
                    if cand.lower().startswith('sip:'):
                        cand = cand[4:]
                    # Si incluye esquema user@host, extraer host
                    if '@' in cand:
                        cand = cand.split('@',1)[1]
                    # Quitar puerto si viene host:port
                    if ':' in cand and all(part.isdigit() for part in cand.split(':')[1:]):
                        cand = cand.split(':',1)[0]
                    # Validar simple (letras, dígitos, puntos o guiones)
                    if all(ch.isalnum() or ch in '.-' for ch in cand):
                        cfg.sip_domain = cand
                        print(f"[dialer] sip_domain autodetectado: {cfg.sip_domain}")
    except Exception as _e_auto:
        if cfg.debug:
            print(f"[dialer][debug] No se pudo autodetectar sip_domain: {_e_auto}")
    global _ABORT
    _ABORT = False  # reset al iniciar
    print(f"[dialer] Iniciando campaña: {len(cfg.targets)} destinos, repeat={cfg.repeat}, continuous={cfg.continuous} (reuse_existing={cfg.reuse_existing}, dry_run={cfg.dry_run})")
    print(f"[dialer] Ejecutable: {cfg.phoner_path}")
    if cfg.extra_args:
        print(f"[dialer] Extra args: {' '.join(cfg.extra_args)}")
    if cfg.start_delay > 0:
        print(f"[dialer] Esperando {cfg.start_delay:.1f}s antes de iniciar...")
        time.sleep(cfg.start_delay)
    existing_wnd = None
    if cfg.reuse_existing:
        existing_wnd = _attach_existing_window() if pywinauto else None
        if not existing_wnd and not pywinauto:
            # fallback intentar encontrar ventana con Win32
            if _enum_windows():
                print("[dialer][INFO] Reuse sin pywinauto: usando fallback Win32")
            else:
                print("[dialer][WARN] No se encontró ventana para reutilizar (fallback Win32)")
        elif not existing_wnd:
            print("[dialer][WARN] No se encontró ventana abierta; se lanzarán nuevos procesos")
        if cfg.no_focus:
            print("[dialer][WARN] 'reuse_existing' y 'no_focus' pueden ser incompatibles (se evitará robar foco)")
    cycle = 0
    total_calls = 0
    try:
        while True:
            if _ABORT:
                print("[dialer] Abortado antes de nuevo ciclo")
                break
            cycle += 1
            print(f"[dialer] === Ciclo {cycle} ===")
            for idx, target in enumerate(cfg.targets, start=1):
                if _ABORT:
                    print("[dialer] Abortado durante ciclo")
                    break
                total_calls += 1
                # Prevención: matar procesos huérfanos antes de iniciar una nueva llamada si no reutilizamos ventana
                if not cfg.reuse_existing and cfg.phoner_path.name.lower() == 'phonerlite.exe':
                    _cleanup_stray_processes('PhonerLite.exe', exclude=None, debug=cfg.debug)
                pos = f"{idx}/{len(cfg.targets)} (call {total_calls})"
                formatted = _format_target(cfg, target)
                if cfg.debug and formatted != target:
                    print(f"[dialer][debug] Formateado destino '{target}' -> '{formatted}'")
                print(f"[dialer] {pos} Llamando a {formatted} ...")
                start_ts = time.time()
                proc = None
                if existing_wnd and not cfg.no_focus:
                    _dial_via_existing(existing_wnd, formatted)
                else:
                    if cfg.dry_run:
                        print(f"[dialer][dry] Simulando lanzamiento -> {formatted}")
                    else:
                        popen_kwargs = {}
                        if platform.system().lower() == 'windows' and (cfg.start_minimized or cfg.no_focus):
                            try:
                                si = subprocess.STARTUPINFO()
                                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW  # type: ignore[attr-defined]
                                # SW_SHOWMINNOACTIVE = 7, SW_MINIMIZE = 6, SW_HIDE = 0
                                # En modo no_focus, preferimos ocultar la ventana por completo.
                                si.wShowWindow = 0 if cfg.no_focus else (7 if cfg.start_minimized else 1)
                                popen_kwargs['startupinfo'] = si
                            except Exception:
                                pass
                        if cfg.manual_dial:
                            # Lanzar sólo ejecutable
                            try:
                                proc = subprocess.Popen([str(cfg.phoner_path)] + (cfg.extra_args or []), **popen_kwargs)
                            except Exception as e:
                                print(f"[dialer][ERROR] Lanzamiento manual falló: {e}")
                                continue
                        else:
                            tried = []
                            alt_cmds = _build_alternate_cmds(cfg, formatted) if cfg.alt_forms else [_build_cmd(cfg, formatted)]
                            launch_ok = False
                            for attempt, cmd in enumerate(alt_cmds, start=1):
                                tried.append(' '.join(cmd))
                                if cfg.debug:
                                    print(f"[dialer][debug] Lanzando intento {attempt}: {' '.join(cmd)}")
                                try:
                                    proc = subprocess.Popen(cmd, **popen_kwargs)
                                    time.sleep(0.6)
                                    if proc.poll() is not None and attempt < len(alt_cmds):
                                        if cfg.debug:
                                            print(f"[dialer][debug] Proceso terminó muy rápido (rc={proc.returncode}), probando siguiente forma")
                                        continue
                                    launch_ok = True
                                    break
                                except Exception as e:
                                    print(f"[dialer][ERROR] Falló intento {attempt}: {e}")
                                    proc = None
                                    continue
                            if not launch_ok:
                                print(f"[dialer][ERROR] No se pudo iniciar llamada. Intentos: {len(tried)}")
                                if cfg.debug:
                                    for t in tried:
                                        print(f"   cmd: {t}")
                                continue
                        # Si manual_dial o no se marcó vía CLI, intentar marcar vía GUI tras espera opcional
                        if cfg.dial_wait > 0:
                            if cfg.debug:
                                print(f"[dialer][debug] Esperando {cfg.dial_wait:.2f}s antes de marcar (registro)")
                            time.sleep(cfg.dial_wait)
                        if cfg.manual_dial:
                            if pywinauto:
                                if not cfg.no_focus:
                                    wnd = _attach_existing_window()
                                    if wnd:
                                        _dial_via_existing(wnd, formatted)
                            else:
                                if not cfg.no_focus:
                                    _attempt_gui_injection(cfg, formatted)
                        else:
                            # Fallback adicional: algunas versiones de Phoner.exe ignoran /callto y requieren teclado
                            if (cfg.gui_after_launch or cfg.phoner_path.name.lower() == 'phoner.exe') and not cfg.no_focus:
                                if cfg.debug:
                                    print(f"[dialer][debug] Inyección GUI post-lanzamiento (gui_after_launch={cfg.gui_after_launch}) tras delay {cfg.inject_delay:.2f}s")
                                time.sleep(max(0.0, cfg.inject_delay))
                                _attempt_gui_injection(cfg, formatted)
                # Control de duración
                effective_duration = max(0.1, cfg.call_duration_s - cfg.overshoot_comp)
                if cfg.strict_timing:
                    start_mono = time.monotonic()
                    target_end = start_mono + effective_duration
                    # Granularidad adaptativa (0.25s al inicio, 0.05s al final)
                    while True:
                        remaining = target_end - time.monotonic()
                        if remaining <= 0:
                            break
                        if proc is not None and proc.poll() is not None and cfg.honor_process_exit:
                            break
                        sleep_slice = 0.25 if remaining > 1.0 else (0.05 if remaining > 0.10 else remaining)
                        time.sleep(sleep_slice)
                else:
                    remain = cfg.call_duration_s
                    while remain > 0:
                        time.sleep(1)
                        remain -= 1
                        if proc is not None and proc.poll() is not None and cfg.honor_process_exit:
                            break
                # Hangup
                if existing_wnd:
                    if cfg.no_focus:
                        # Evitar robar foco: no enviar teclas; intentar no intervenir o matar procesos secundarios si existen
                        pass
                    else:
                        for attempt in range(cfg.hangup_retries):
                            _hangup_existing(existing_wnd)
                            time.sleep(0.4)
                        _global_hangup(cfg)
                else:
                    if cfg.dry_run:
                        print(f"[dialer][dry] Simulando colgado {formatted}")
                    else:
                        if proc is not None and proc.poll() is None:
                            if cfg.no_focus:
                                # Evitar interacción con ventana: terminar proceso directamente
                                try:
                                    proc.terminate()
                                    proc.wait(timeout=max(1.0, cfg.hangup_timeout_s))
                                except Exception:
                                    try:
                                        proc.kill()
                                    except Exception:
                                        pass
                            else:
                                for attempt in range(cfg.hangup_retries):
                                    _attempt_hangup_phoner(proc, cfg)
                                    try:
                                        proc.wait(timeout=1.0)
                                        break
                                    except Exception:
                                        pass
                                if proc.poll() is None:
                                    # Último recurso
                                    try:
                                        proc.terminate()
                                        proc.wait(timeout=2)
                                    except Exception:
                                        try:
                                            proc.kill()
                                        except Exception:
                                            pass
                        else:
                            # Proceso terminó antes (posiblemente GUI ya abierta); intentar hangup global
                            if not cfg.no_focus:
                                _global_hangup(cfg)
                if cfg.force_kill and proc is not None and proc.poll() is None:
                    try:
                        proc.kill()
                        print(f"[dialer][WARN] Proceso forzado a terminar tras hangup fallido: PID={proc.pid}")
                    except Exception as e:
                        print(f"[dialer][ERROR] Fallo al forzar kill del proceso PID={proc.pid}: {e}")
                # Extra robustez: si el proceso sigue vivo tras todos los intentos, forzar kill y loggear
                if proc is not None and proc.poll() is None:
                    try:
                        proc.kill()
                        print(f"[dialer][WARN] Proceso seguía vivo tras todos los intentos de hangup, kill forzado: PID={proc.pid}")
                    except Exception as e:
                        print(f"[dialer][ERROR] Fallo al forzar kill final del proceso PID={proc.pid}: {e}")
                # Esperar explícitamente a que el proceso termine antes de continuar
                if proc is not None:
                    try:
                        # Esperar menos tiempo (máx 3s) para minimizar solape
                        proc.wait(timeout=3)
                    except Exception:
                        pass
                # Asegurar que el proceso terminó antes de continuar
                if proc is not None and proc.poll() is None:
                    try:
                        proc.kill()
                        proc.wait(timeout=1)
                        print(f"[dialer][WARN] Proceso forzado a terminar antes de siguiente llamada: PID={proc.pid}")
                    except Exception as e:
                        print(f"[dialer][ERROR] No se pudo forzar kill final antes de siguiente llamada: {e}")
                end_mono = time.monotonic()
                elapsed = end_mono - start_mono if cfg.strict_timing else (time.time() - start_ts)
                if cfg.debug and cfg.strict_timing:
                    drift = elapsed - cfg.call_duration_s
                    print(f"[dialer][debug] Duración objetivo={cfg.call_duration_s:.2f}s (efectiva={effective_duration:.2f}) real={elapsed:.2f}s drift={drift:+.2f}s")
                print(f"[dialer] Fin llamada {formatted} ({elapsed:.1f}s)")
                # Limpieza post-llamada por seguridad (el proceso debería haberse cerrado o colgado ya)
                if not cfg.reuse_existing and cfg.phoner_path.name.lower() == 'phonerlite.exe':
                    _cleanup_stray_processes('PhonerLite.exe', exclude=None, debug=cfg.debug)
                if on_call_end:
                    try:
                        on_call_end(cfg, formatted, elapsed)
                    except Exception as e:
                        if cfg.debug:
                            print(f"[dialer][debug] on_call_end error: {e}")
                # Pausa antes de siguiente llamada (dentro del ciclo)
                if idx < len(cfg.targets):
                    base_gap = cfg.interval_override if cfg.interval_override is not None else cfg.pause_between_s
                    jitter = 0.0
                    if cfg.jitter > 0:
                        jitter = random.uniform(-cfg.jitter, cfg.jitter)
                    wait_s = max(0.1, base_gap + jitter)
                    if wait_s:
                        print(f"[dialer] Esperando {wait_s:.2f}s antes de la siguiente llamada")
                        time.sleep(wait_s)
            if _ABORT:
                break
            # Fin ciclo
            if cfg.continuous:
                base_gap = cfg.interval_override if cfg.interval_override is not None else cfg.pause_between_s
                jitter = random.uniform(-cfg.jitter, cfg.jitter) if cfg.jitter > 0 else 0.0
                wait_cycle = max(0.1, base_gap + jitter)
                print(f"[dialer] Ciclo {cycle} completo. Próximo ciclo en {wait_cycle:.2f}s (Ctrl+C para parar)")
                time.sleep(wait_cycle)
                continue
            if cycle >= cfg.repeat:
                break
            else:
                print(f"[dialer] Preparando siguiente ciclo (#{cycle+1}/{cfg.repeat}) en {cfg.pause_between_s}s")
                time.sleep(cfg.pause_between_s)
    except KeyboardInterrupt:
        print("[dialer] Interrumpido por usuario (Ctrl+C)")
    print("[dialer] Campaña completada")


def load_targets_from_csv(csv_path: Path) -> List[str]:
    nums: List[str] = []
    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        for row in reader:
            if not row: continue
            val = row[0].strip()
            if val and not val.startswith('#'):
                nums.append(val)
    return nums


def main(argv: Optional[Iterable[str]] = None):
    import argparse
    ap = argparse.ArgumentParser(description='Campaña de llamadas vía PhonerLite')
    ap.add_argument('--phoner', required=True, help='Ruta a PhonerLite.exe / Phoner.exe, directorio, o "auto"')
    ap.add_argument('--dest', action='append', help='Destino (repetible). Ej: 6001 o sip:6001@pbx.local')
    ap.add_argument('--csv', help='CSV con una columna de destinos')
    ap.add_argument('--installation-id', help='Numero de instalacion para resolver telefono desde historico_instalaciones.json')
    ap.add_argument('--historico-json', default='historico_instalaciones.json', help='Ruta al JSON de instalaciones (default historico_instalaciones.json)')
    ap.add_argument('--dur', type=int, default=20, help='Duración por llamada (s)')
    ap.add_argument('--gap', type=int, default=5, help='Pausa entre llamadas (s)')
    ap.add_argument('--hangup-timeout', type=int, default=5, help='Timeout para colgar/terminar proceso (s)')
    ap.add_argument('--reuse', action='store_true', help='Reutilizar instancia ya abierta (pywinauto)')
    ap.add_argument('--dry-run', action='store_true', help='Simular sin lanzar ejecutable (prueba rápida)')
    ap.add_argument('--repeat', type=int, default=1, help='Repetir lista completa N veces')
    ap.add_argument('--continuous', action='store_true', help='Ignora --repeat y ejecuta indefinidamente hasta Ctrl+C')
    ap.add_argument('--interval', type=float, help='Intervalo fijo entre llamadas (s) (sobrescribe --gap entre destinos)')
    ap.add_argument('--jitter', type=float, default=0.0, help='+/- segundos aleatorios sobre la pausa/intervalo')
    ap.add_argument('--start-delay', type=float, default=0.0, help='Espera inicial antes de la primera llamada (s)')
    ap.add_argument('--honor-exit', action='store_true', help='Si el proceso PhonerLite termina antes, no esperar la duración completa')
    ap.add_argument('--debug', action='store_true', help='Salida detallada de depuración')
    ap.add_argument('--no-alt-forms', action='store_true', help='No probar variantes de comando (/callto, simple, sip:)')
    ap.add_argument('--sip-domain', help='Dominio SIP a añadir si el destino es numérico (ej: pbx.local)')
    ap.add_argument('--uri-template', help='Plantilla completa ej: "sip:{target}@pbx.local" (anula --sip-domain)')
    ap.add_argument('--plus', action='store_true', help='Añadir prefijo + a números antes de formar URI')
    ap.add_argument('--show-config', action='store_true', help='Muestra resumen de configuración de Phoner/PhonerLite y sale')
    ap.add_argument('--import-from-phoner', action='store_true', help='Copia/migra ajustes básicos desde Phoner.ini a PhonerLite.ini y sale')
    ap.add_argument('--profile', help='Nombre de perfil a forzar (/profile=ProfileName)')
    ap.add_argument('--dial-keys', help='Lista separada por comas de teclas para iniciar llamada en ventana existente (ej: ENTER,F9)')
    ap.add_argument('--hangup-keys', help='Lista separada por comas de teclas para colgar (ej: ESC,F9)')
    ap.add_argument('--no-strict-timing', action='store_true', help='Desactiva temporización fina y usa bucle por segundos')
    ap.add_argument('--force-kill', action='store_true', help='Forzar kill del proceso tras hangup para asegurar corte')
    ap.add_argument('--dial-wait', type=float, default=0.0, help='Espera tras lanzar proceso antes de marcar (segundos)')
    ap.add_argument('--manual-dial', action='store_true', help='No usar /callto: abrir softphone y marcar vía GUI')
    ap.add_argument('--overshoot-comp', type=float, default=0.0, help='Compensación (s) para restar al objetivo y reducir drift positivo')
    ap.add_argument('--gui-after-launch', action='store_true', help='Tras lanzar proceso, inyectar número y teclas aunque se use /callto (útil para Phoner.exe)')
    ap.add_argument('--inject-delay', type=float, default=0.8, help='Delay antes del primer intento de inyección GUI')
    ap.add_argument('--inject-retries', type=int, default=3, help='Reintentos de inyección GUI')
    ap.add_argument('--background', action='store_true', help='Ejecutar en segundo plano: lanzar minimizado y evitar robar foco (sin inyección de teclas)')
    args = ap.parse_args(list(argv) if argv is not None else None)

    # Si solo quiere ver config o migrar, no exige destinos
    if args.show_config:
        show_config_summary(Path(args.phoner))
        return
    if args.import_from_phoner:
        try:
            res = migrate_phoner_to_phonerlite()
            print("[migrate] Origen:", res['source_ini'])
            print("[migrate] Destino:", res['target_ini'])
            if res['backup']:
                print("[migrate] Backup creado:", res['backup'])
            print(f"[migrate] {len(res['copied'])} claves copiadas")
        except Exception as e:
            print(f"[migrate][ERROR] {e}")
        return

    targets: List[str] = []
    if args.csv:
        targets.extend(load_targets_from_csv(Path(args.csv)))
    # Resolver telefono desde JSON si se indicó installation-id y no hay destinos directos
    if args.installation_id and not args.dest and not args.csv:
        try:
            hist_path = Path(args.historico_json)
            if not hist_path.exists():
                raise FileNotFoundError(f"No existe JSON: {hist_path}")
            import json as _json
            with open(hist_path, 'r', encoding='utf-8') as jf:
                data = _json.load(jf)
            insts = data.get('instalaciones') or []
            telefono = None
            for inst in insts:
                num = str(inst.get('Numero de instalacion'))
                if num == str(args.installation_id):
                    telefono = inst.get('Telefono') or inst.get('telefono')
                    break
            if telefono:
                targets.append(str(telefono).strip())
                print(f"[dialer] Destino resuelto para instalacion {args.installation_id}: {telefono}")
            else:
                print(f"[dialer][WARN] No se encontró telefono para instalacion {args.installation_id} en {hist_path}")
        except Exception as _e_lookup:
            print(f"[dialer][WARN] Fallo al resolver installation-id: {_e_lookup}")
    if args.dest:
        targets.extend(args.dest)
    cfg = DialerConfig(
        phoner_path=Path(args.phoner),
        targets=targets,
        call_duration_s=args.dur,
        pause_between_s=args.gap,
        hangup_timeout_s=args.hangup_timeout,
        reuse_existing=args.reuse,
    dry_run=args.dry_run,
    repeat=max(1, args.repeat),
    continuous=args.continuous,
    interval_override=args.interval,
    jitter=max(0.0, args.jitter),
    start_delay=max(0.0, args.start_delay),
    honor_process_exit=args.honor_exit,
    debug=args.debug,
    alt_forms=not args.no_alt_forms,
    sip_domain=args.sip_domain,
    uri_template=args.uri_template,
    prepend_plus=args.plus,
    strict_timing=not args.no_strict_timing,
    force_kill=args.force_kill,
    dial_wait=max(0.0, args.dial_wait),
    manual_dial=args.manual_dial,
    overshoot_comp=max(0.0, args.overshoot_comp),
    gui_after_launch=args.gui_after_launch,
    inject_delay=max(0.0, args.inject_delay),
    inject_retries=max(1, args.inject_retries),
    start_minimized=args.background,
    no_focus=args.background,
    )
    if args.profile:
        cfg.extra_args.append(f"/profile={args.profile}")
    if args.dial_keys:
        cfg.dial_keys = [k.strip().upper().replace('ENTER','{ENTER}').replace('F9','{F9}') for k in args.dial_keys.split(',') if k.strip()]
    if args.hangup_keys:
        cfg.hangup_keys = [k.strip().upper().replace('ENTER','{ENTER}').replace('F9','{F9}').replace('ESC','{ESC}') for k in args.hangup_keys.split(',') if k.strip()]
    global _CURRENT_CFG
    _CURRENT_CFG = cfg
    run_campaign(cfg)


if __name__ == '__main__':  # pragma: no cover
    main()
