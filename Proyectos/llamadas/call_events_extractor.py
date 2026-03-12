#!/usr/bin/env python3
"""call_events_extractor.py

Primer paso: extraer datos básicos de cada intento de llamada (eventos 'Call incoming').
Enfocado en campos f2 (número de llamada), f3 (número remoto o URI), f4 (estado: accepted/rejected), f5 (tipo: GSM/VOIP) y timestamp.

Uso:
  python call_events_extractor.py --log path/al/log --csv incoming_calls.csv

Salida CSV columnas:
 timestamp,session_id,call_number,remote,status,type,raw_line

Limitaciones:
 - Solo procesa eventos 'CallHub.cpp:317_onIncoming'.
 - No calcula duración; eso es para etapas posteriores.
"""
from __future__ import annotations
import argparse
import csv
import re
import json
import sys
import os
TOOL_VERSION = "0.2.0"
# Valores de metadatos por defecto ("a pelo") cuando no se pasan flags
# Ajusta estos valores según la versión/configuración que quieras fijar por defecto.
DEFAULT_METADATA = {
    'installation': '5499266',
    'cu_version': '1.32.16',
    'svk_version': '2CHFF7QW',
    'device_type': 'SVK',
    'hw_version': '1E',
    # Base FW anterior (antes del cambio a 4.12.1)
    'fw_version': '4.11.1',
    'build_type': 'release'
}
from datetime import datetime
from typing import Optional, Dict

INNER_TS_RE = re.compile(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3,6})\]")  # acepta ms (3) o microsegundos (6)
TAG_FIELDS_RE = re.compile(r"\((f\d+)=([^)]*)\)")
INCOMING_MARK = "CallHub.cpp:317_onIncoming"  # mantenido para referencia, ya no obligatorio


def parse_fields(line: str) -> Dict[str,str]:
    return {m.group(1): m.group(2) for m in TAG_FIELDS_RE.finditer(line)}


def parse_timestamp(line: str) -> Optional[str]:
    m = INNER_TS_RE.search(line)
    if not m:
        return None
    return m.group(1)


def _open_with_encodings(path: str, encodings, verbose: bool):
    last_err = None
    for enc in encodings:
        try:
            if verbose:
                print(f"[encoding-try] {enc}")
            with open(path, 'r', encoding=enc) as fh:
                # read small chunk to validate
                fh.readline()
                fh.seek(0)
                if verbose:
                    print(f"[encoding-ok] {enc}")
                return fh.read().splitlines()
        except Exception as e:
            last_err = e
            if verbose:
                print(f"[encoding-fail] {enc}: {e}")
    raise last_err if last_err else RuntimeError("Unable to read file with provided encodings")

def process_log(log_path: str,
                csv_path: Optional[str],
                verbose: bool=False,
                encoding: Optional[str]=None,
                summary_text_path: Optional[str]=None,
                summary_json_path: Optional[str]=None,
                metadata: Optional[dict]=None,
                use_colors: bool=False,
                color_summary_text: bool=False):
    # New unified approach (multi-line incoming + audio events)
    rows: list[dict] = []
    enc_list = [encoding] if encoding else ['utf-8-sig','utf-8','utf-16','utf-16-le','latin-1']
    lines = _open_with_encodings(log_path, enc_list, verbose)
    hangups: dict[tuple[str,str], dict] = {}
    states_map: dict[tuple[str,str], dict] = {}
    audio_events: list[tuple[str,str]] = []  # (timestamp, kind)
    # Buffer audio events; assign later with window logic
    pending_audio: list[tuple[str,str]] = []
    last_ts = ''
    pending_incoming_ts: Optional[str] = None
    for raw_line in lines:
        line = raw_line.rstrip('\n')
        low = line.lower()
        ts_here = parse_timestamp(line)
        if ts_here:
            last_ts = ts_here
        # Detect header line (first line) of onIncoming
        if 'callhub.cpp:317_onincoming' in low:
            pending_incoming_ts = last_ts
        # Audio events (may not have TAG line)
        if 'actionconnectaudio' in low or 'actiondisconnectaudio' in low:
            ats = parse_timestamp(line) or last_ts or ''
            kind = 'connect' if 'actionconnectaudio' in low else 'disconnect'
            pending_audio.append((kind, ats))
        if '#tag=2wv#' not in low:
            continue
        fields = parse_fields(line)
        st_field = fields.get('f4','')
        is_incoming_line = 'call incoming' in low
        is_hangup_line = any(p in low for p in (
            'hanging up call','hung up call','hungup call',' hungup ','call ended','call finished','ending call','disconnecting call'))
        state_tokens = ('ON_CONNECTED','CONNECTED','ON_JOINED','DEINIT')
        is_state_line = st_field in state_tokens
        is_device = 'device operation' in low
        if not (is_incoming_line or is_hangup_line or is_device or is_state_line):
            continue
        ts = parse_timestamp(line) or last_ts or ''
        session_id = fields.get('f1','')
        call_number = fields.get('f2','')
        remote = fields.get('f3','')
        status = fields.get('f4','')
        call_type = fields.get('f5','')
        key = (session_id, call_number)
        if is_incoming_line:
            real_ts = pending_incoming_ts or ts
            pending_incoming_ts = None
            if status == 'accepted':
                rows.append({
                    'timestamp': real_ts or '',
                    'hangup_timestamp': '',
                    'duration_ms': '',
                    'on_connected_ts': '',
                    'on_joined_ts': '',
                    'deinit_ts': '',
                    'time_to_join_ms': '',
                    'state_path_ok': '',
                    'missing_states': '',
                    'audio_connected_ts': '',
                    'audio_disconnected_ts': '',
                    'audio_connect_delay_ms': '',
                    'audio_duration_ms': '',
                    'audio_ok': '',
                    'session_id': session_id,
                    'call_number': call_number,
                    'remote': remote,
                    'status': status,
                    'type': call_type,
                    'raw_line': line.strip()
                })
                if verbose:
                    print(f"[incoming] ts={real_ts} f1={session_id} f2={call_number} f3={remote} f4={status} f5={call_type}")
            elif status == 'rejected':
                rows.append({
                    'timestamp': real_ts or '',
                    'hangup_timestamp': '',
                    'duration_ms': '',
                    'on_connected_ts': '',
                    'on_joined_ts': '',
                    'deinit_ts': '',
                    'time_to_join_ms': '',
                    'state_path_ok': '',
                    'missing_states': '',
                    'audio_connected_ts': '',
                    'audio_disconnected_ts': '',
                    'audio_connect_delay_ms': '',
                    'audio_duration_ms': '',
                    'audio_ok': '',
                    'session_id': session_id,
                    'call_number': call_number,
                    'remote': remote,
                    'status': status,
                    'type': call_type,
                    'reason': 'CRA Windows not opened',
                    'raw_line': line.strip()
                })
                if verbose:
                    print(f"[rejected] ts={real_ts} f1={session_id} f2={call_number} f3={remote} f4={status} f5={call_type} reason=CRA Windows not opened")
        elif is_hangup_line:
            hangups[key] = {'hangup_timestamp': ts or ''}
            if verbose:
                print(f"[hangup] ts={ts} f1={session_id} f2={call_number}")
        elif is_device or is_state_line:
            st = status
            if st in state_tokens:
                d = states_map.setdefault(key, {})
                if is_call_line:
                    real_ts = pending_incoming_ts or ts
                    pending_incoming_ts = None
                    reason = ''
                    if status == 'rejected':
                        # Siempre poner el motivo para rejected
                        reason = 'CRA Windows not opened'
                    rows.append({
                        'timestamp': real_ts or '',
                        'hangup_timestamp': '',
                        'duration_ms': '',
                        'on_connected_ts': '',
                        'on_joined_ts': '',
                        'deinit_ts': '',
                        'time_to_join_ms': '',
                        'state_path_ok': '',
                        'missing_states': '',
                        'audio_connected_ts': '',
                        'audio_disconnected_ts': '',
                        'audio_connect_delay_ms': '',
                        'audio_duration_ms': '',
                        'audio_ok': '',
                        'session_id': session_id,
                        'call_number': call_number,
                        'remote': remote,
                        'status': status,
                        'type': call_type,
                        'reason': reason,
                        'raw_line': line.strip()
                    })
                    if verbose:
                        print(f"[call] ts={real_ts} f1={session_id} f2={call_number} f3={remote} f4={status} f5={call_type} reason={reason}")
                continue
            t_start = _dt(c.get('timestamp',''))
            if not t_start or t_ev < t_start:
                continue
            t_end = _dt(c.get('hangup_timestamp',''))
            if t_end and t_ev > t_end + timedelta(seconds=3):
                continue
            if best is None or t_start > _dt(best.get('timestamp','')):
                best = c
        if not best:
            continue
        if kind == 'connect' and not best.get('audio_connected_ts'):
            best['audio_connected_ts'] = ats
        elif kind == 'disconnect' and best.get('audio_connected_ts') and not best.get('audio_disconnected_ts'):
            best['audio_disconnected_ts'] = ats
            best['audio_ok'] = best.get('audio_ok') or 'YES'

    # (Old post-pass audio assignment removed; integrated in unified pass)

    # Emparejar hangups con incoming aceptados
    for r in rows:
        if r['status'] != 'accepted':
            continue
        key = (r['session_id'], r['call_number'])
        h = hangups.get(key)
        st_data = states_map.get(key, {})
        if h:
            r['hangup_timestamp'] = h['hangup_timestamp']
        # Copy states
        r['on_connected_ts'] = st_data.get('ON_CONNECTED','')
        connected_ts = st_data.get('CONNECTED','')
        r['on_joined_ts'] = st_data.get('ON_JOINED','')
        r['deinit_ts'] = st_data.get('DEINIT','')
        # Infer ON_CONNECTED if missing but CONNECTED present or ON_JOINED present
        inferred_on_conn = False
        if not r['on_connected_ts']:
            if connected_ts:
                r['on_connected_ts'] = connected_ts
                inferred_on_conn = True
            elif r['on_joined_ts']:
                # assume a typical delta ~ -1500ms before JOINED if not logged; just reuse JOINED time
                r['on_connected_ts'] = r['on_joined_ts']
                inferred_on_conn = True
        # Compute metrics
        try:
            if r['timestamp'] and r['hangup_timestamp']:
                t0 = datetime.strptime(r['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                t1 = datetime.strptime(r['hangup_timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                delta = (t1 - t0).total_seconds() * 1000.0
                r['duration_ms'] = f"{delta:.0f}"
        except Exception as e:
            if verbose:
                print(f"[duration-error] {e}")
        try:
            if r['timestamp'] and r['on_joined_ts']:
                tj = datetime.strptime(r['on_joined_ts'], '%Y-%m-%d %H:%M:%S.%f')
                t0 = datetime.strptime(r['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                r['time_to_join_ms'] = f"{(tj - t0).total_seconds()*1000.0:.0f}"
        except Exception:
            pass
        # Required states: we now consider ON_CONNECTED optional if ON_JOINED present.
        required = ['ON_JOINED','DEINIT','HANGUP']
        present = set()
        if r['on_connected_ts']: present.add('ON_CONNECTED')
        if r['on_joined_ts']: present.add('ON_JOINED')
        if r['deinit_ts']: present.add('DEINIT')
        if r['hangup_timestamp']: present.add('HANGUP')
        missing = [s for s in required if s not in present]
        r['state_path_ok'] = 'YES' if not missing else 'NO'
        r['missing_states'] = ','.join(missing)
        if inferred_on_conn:
            r['state_path_ok'] += '_INFCONN'
        # Audio metrics
        if r.get('audio_connected_ts') and not r.get('audio_ok') and r.get('audio_disconnected_ts'):
            r['audio_ok'] = 'YES'
        # Derive audio timing metrics if not already
        try:
            if r.get('timestamp') and r.get('audio_connected_ts') and not r.get('audio_connect_delay_ms'):
                t0 = datetime.strptime(r['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                ta = datetime.strptime(r['audio_connected_ts'], '%Y-%m-%d %H:%M:%S.%f')
                r['audio_connect_delay_ms'] = f"{(ta - t0).total_seconds()*1000:.0f}"
        except Exception:
            pass
        try:
            if r.get('audio_connected_ts') and r.get('audio_disconnected_ts') and not r.get('audio_duration_ms'):
                ta = datetime.strptime(r['audio_connected_ts'], '%Y-%m-%d %H:%M:%S.%f')
                tb = datetime.strptime(r['audio_disconnected_ts'], '%Y-%m-%d %H:%M:%S.%f')
                r['audio_duration_ms'] = f"{(tb - ta).total_seconds()*1000:.0f}"
        except Exception:
            pass
        # Derive timing metrics
        try:
            if r.get('timestamp') and r.get('audio_connected_ts'):
                t0 = datetime.strptime(r['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                t1 = datetime.strptime(r['audio_connected_ts'], '%Y-%m-%d %H:%M:%S.%f')
                r['audio_connect_delay_ms'] = f"{(t1 - t0).total_seconds()*1000:.0f}"
        except Exception:
            pass
        try:
            if r.get('audio_connected_ts') and r.get('audio_disconnected_ts'):
                ta = datetime.strptime(r['audio_connected_ts'], '%Y-%m-%d %H:%M:%S.%f')
                tb = datetime.strptime(r['audio_disconnected_ts'], '%Y-%m-%d %H:%M:%S.%f')
                r['audio_duration_ms'] = f"{(tb - ta).total_seconds()*1000:.0f}"
        except Exception:
            pass
    def print_pretty(rows):
        # Determinar si hay datos de hangup para añadir columnas extra
        has_hangup = any(r.get('hangup_timestamp') for r in rows if r['status']=='accepted')
        headers = ["Llamada","Test","Tipo","Estado","Remote(f3)","HoraIn","Sesion(f1)"]
        if has_hangup:
            headers.extend(["HoraHang","Dur(ms)"])
        # Add state columns for accepted calls if any
        if any(r.get('on_connected_ts') or r.get('on_joined_ts') or r.get('deinit_ts') for r in rows):
            headers.extend(["ON_CONN","ON_JOIN","DEINIT","Join(ms)","PathOK"])            
        data = []
        for r in rows:
            ts_time = ''
            if r['timestamp']:
                # extraer solo HH:MM:SS.mmm
                parts = r['timestamp'].split()
                ts_time = parts[1] if len(parts) > 1 else r['timestamp']
            row_base = [
                r['call_number'] or '?',
                str(r.get('test_group','1')),
                (r['type'] or '').upper(),
                (r['status'] or '').upper(),
                (r['remote'] or '')[:48],
                ts_time,
                r['session_id'] or ''
            ]
            if 'hangup_timestamp' in r and has_hangup:
                ht = ''
                if r.get('hangup_timestamp'):
                    p2 = r['hangup_timestamp'].split()
                    ht = p2[1] if len(p2) > 1 else r['hangup_timestamp']
                row_base.extend([ht, r.get('duration_ms','')])
            if any([r.get('on_connected_ts'), r.get('on_joined_ts'), r.get('deinit_ts')]):
                def _just(t):
                    if not t: return ''
                    parts = t.split()
                    return parts[1] if len(parts)>1 else t
                row_base.extend([
                    _just(r.get('on_connected_ts','')),
                    _just(r.get('on_joined_ts','')),
                    _just(r.get('deinit_ts','')),
                    r.get('time_to_join_ms',''),
                    r.get('state_path_ok','')
                ])
            data.append(row_base)
        widths = [len(h) for h in headers]
        for row in data:
            for i,cell in enumerate(row):
                if len(cell) > widths[i]:
                    widths[i] = len(cell)
        def line(char='-'):
            print('+' + '+'.join(char * (w+2) for w in widths) + '+')
        # Title
        title = "RESUMEN INCOMING CALLS"
        total_line_len = sum(widths) + 3*len(widths)+1
        print('\n' + title.center(total_line_len,'='))
        # Header
        line('=')
        header_cells = [f" {h.ljust(widths[i])} " for i,h in enumerate(headers)]
        print('|' + '|'.join(header_cells) + '|')
        line('=')
        # Rows
        for row in data:
            print('|' + '|'.join(f" {row[i].ljust(widths[i])} " for i in range(len(row))) + '|')
        line('=')
    # Helper para evaluar cada llamada (para exportaciones y resumen final)
    def eval_call(r):
        if r['status'] == 'rejected':
            return 'KO', 'rejected'
        if r['status'] == 'accepted':
            # Clasificación OPEN: llamada aceptada sin hangup (posiblemente aún en curso al final del log)
            if not r.get('hangup_timestamp'):
                # Si no hay JOIN ni DEINIT tampoco, asumimos que puede estar todavía en progreso
                # (aunque ON_CONNECTED esté presente o inferido)
                if not r.get('on_joined_ts') and not r.get('deinit_ts'):
                    # Detallar qué estados faltan en orden de importancia
                    missing_list = []
                    if not r.get('on_joined_ts'): missing_list.append('ON_JOINED')
                    if not r.get('deinit_ts'): missing_list.append('DEINIT')
                    if not r.get('hangup_timestamp'): missing_list.append('HANGUP')
                    motivo = 'abierta faltan: ' + ','.join(missing_list)
                    return 'OPEN', motivo
                return 'KO', 'sin hangup'
            if not r.get('state_path_ok','').startswith('YES'):
                miss = r.get('missing_states','')
                return 'KO', f'faltan estados: {miss}' if miss else 'faltan estados'
            return 'OK', ''
        return 'KO', 'estado desconocido'

    # Estadísticas básicas y salida
    # Deduplicación: elimina entradas duplicadas exactas (conserva la primera aparición)
    if rows:
        deduped = []
        seen_sigs = set()
        for r in rows:
            sig = (r.get('timestamp'), r.get('session_id'), r.get('call_number'), r.get('status'), r.get('type'), r.get('remote'))
            if sig in seen_sigs:
                continue
            seen_sigs.add(sig)
            deduped.append(r)
        if len(deduped) != len(rows):
            removed = len(rows) - len(deduped)
            print(f"[info] Deduplicadas {removed} entradas repetidas")
        rows = deduped

    # Asignar grupos de prueba (Test 1, Test 2, ...) cuando el número de llamada (f2) se reinicia
    if rows:
        prev_cn = None
        test_group = 1
        for r in rows:
            try:
                cn = int(r.get('call_number') or -1)
            except Exception:
                cn = -1
            if prev_cn is not None and cn != -1 and prev_cn != -1 and cn < prev_cn:
                test_group += 1
            r['test_group'] = test_group
            if cn != -1:
                prev_cn = cn

    total = len(rows)
    accepted = sum(1 for r in rows if r['status']=='accepted')
    rejected = sum(1 for r in rows if r['status']=='rejected')
    if total:
        if not getattr(process_log, '_plain', False):
            print_pretty(rows)
        else:
            print("Detected incoming call attempts:")
            for r in rows:
                print(f"{r['timestamp']} call#{r['call_number']} type={r['type']} status={r['status']} remote={r['remote']}")
        print(f"Total: {total}  Aceptadas: {accepted}  Rechazadas: {rejected}  %Aceptación: {accepted/total*100:.2f}%")
        print("Resumen simple:")
        for r in rows:
            num = r['call_number'] or '?'
            tipo = (r['type'] or '').upper() or 'UNKNOWN'
            status = (r['status'] or '').lower() or 'unknown'
            remote = r['remote'] or ''
            print(f"Llamada {num} (Test {r.get('test_group','1')}) {tipo} {status} remote={remote}")
        # Sección explicativa con tabulaciones
        print("\nExplicado (tabulado):")
        print("Llamada\tTest\tTipo\tEstado\tInicio\tHangup\tDuracion(s)\tSesion(f1)\tRemote(f3)")
        for r in rows:
            dur_s = ''
            if r.get('duration_ms'):
                try:
                    dur_s = f"{(float(r['duration_ms'])/1000):.3f}"
                except Exception:
                    dur_s = ''
            print(
                f"{r['call_number'] or ''}\t{r.get('test_group','1')}\t{(r['type'] or '').upper()}\t{(r['status'] or '').upper()}\t"
                f"{r['timestamp']}\t{r.get('hangup_timestamp','')}\t{dur_s}\t{r['session_id']}\t{r['remote'] or ''}"
            )
        # Detalle narrativo
        print("\nDetalle narrativo:")
        for r in rows:
            num = r['call_number'] or '?'
            tipo = (r['type'] or '').upper() or 'UNKNOWN'
            estado = (r['status'] or '').upper()
            inicio = r['timestamp'] or 'N/D'
            hang = r.get('hangup_timestamp') or ''
            remote = r.get('remote') or ''
            ses = r.get('session_id') or ''
            path_info = ''
            if estado == 'ACCEPTED':
                path_info = f" pathOK={r.get('state_path_ok','')}"
                if r.get('missing_states'):
                    path_info += f" missing={r['missing_states']}"
            if r.get('duration_ms'):
                dur_s = float(r['duration_ms'])/1000.0
                print(f"Llamada {num} (Test {r.get('test_group','1')}) ({tipo}) {estado}: inicio {inicio}, fin {hang}, duracion {dur_s:.3f}s, sesion={ses}, remote={remote}{path_info}")
            else:
                if estado == 'ACCEPTED' and not hang:
                    print(f"Llamada {num} (Test {r.get('test_group','1')}) ({tipo}) {estado}: inicio {inicio}, sin hangup aun, sesion={ses}, remote={remote}{path_info}")
                else:
                    print(f"Llamada {num} (Test {r.get('test_group','1')}) ({tipo}) {estado}: inicio {inicio}, sesion={ses}, remote={remote}{path_info}")

        # Resumen final estructurado
        print("\n===== RESUMEN FINAL =====")
        evaluated_calls = []
        # Determinar si hay política de upgrade de firmware
        fw_upgrade = None
        base_fw = None
        if metadata and isinstance(metadata, dict):
            fw_upgrade = metadata.get('fw_upgrade')
            if fw_upgrade:
                base_fw = fw_upgrade.get('base_version') or metadata.get('fw_version')
        # Preparar upgrades de recursos
        resource_upgrades = []
        if metadata and metadata.get('resource_upgrades'):
            # ordenar por from_call asc
            resource_upgrades = sorted(metadata['resource_upgrades'], key=lambda x: x.get('from_call', 0))
        # Mapa base de recursos iniciales (por tipo)
        base_resources = {}
        for res in (metadata.get('resources') or []):
            base_resources[res.get('type')] = {
                'version': res.get('version'),
                'variant': res.get('variant','')
            }
        for idx, r in enumerate(rows, start=1):
            final_status, reason = eval_call(r)
            # Calcular fw_version efectiva para esta llamada (solo almacenar, imprimir luego tras aplicar resource upgrades)
            fw_eff = None
            if fw_upgrade and r.get('call_number'):
                try:
                    cn = int(r.get('call_number'))
                    if cn >= fw_upgrade.get('from_call', 10**9):
                        fw_eff = fw_upgrade.get('new_version')
                    else:
                        fw_eff = base_fw or metadata.get('fw_version')
                except Exception:
                    fw_eff = metadata.get('fw_version')
            else:
                if metadata:
                    fw_eff = metadata.get('fw_version')
            evaluated_calls.append({
                'index': idx,
                'f2_call_number': r.get('call_number'),
                'test_group': r.get('test_group'),
                'session_id_f1': r.get('session_id'),
                'remote_f3': r.get('remote'),
                'type': r.get('type'),
                'status': r.get('status'),
                'verdict': final_status,
                'reason': reason,
                'timestamp_in': r.get('timestamp'),
                'timestamp_hangup': r.get('hangup_timestamp'),
                'duration_ms': r.get('duration_ms'),
                'time_to_join_ms': r.get('time_to_join_ms'),
                'on_connected_ts': r.get('on_connected_ts'),
                'on_joined_ts': r.get('on_joined_ts'),
                'deinit_ts': r.get('deinit_ts'),
                'state_path_ok': r.get('state_path_ok'),
                'missing_states': r.get('missing_states'),
                'fw_version_effective': fw_eff,
                'audio_connected_ts': r.get('audio_connected_ts'),
                'audio_disconnected_ts': r.get('audio_disconnected_ts'),
                'audio_connect_delay_ms': r.get('audio_connect_delay_ms'),
                'audio_duration_ms': r.get('audio_duration_ms'),
                'audio_ok': r.get('audio_ok'),
            })
        # Aplicar upgrades de recursos por llamada (post-loop para simplicidad)
        if evaluated_calls and resource_upgrades:
            for ec in evaluated_calls:
                try:
                    cn = int(ec.get('f2_call_number') or -1)
                except Exception:
                    cn = -1
                # copiar base
                eff_res = {k: v.copy() for k,v in base_resources.items()}
                for up in resource_upgrades:
                    if cn >= up.get('from_call', 10**9):
                        r_type = up.get('type')
                        eff_res.setdefault(r_type, {})
                        eff_res[r_type]['version'] = up.get('new_version')
                        if up.get('new_variant') is not None:
                            eff_res[r_type]['variant'] = up.get('new_variant')
                # Serializar a lista
                ec['resources_effective'] = [
                    {'type': t, 'version': d.get('version'), 'variant': d.get('variant','')} for t,d in eff_res.items()
                ]
        else:
            if evaluated_calls and base_resources:
                for ec in evaluated_calls:
                    ec['resources_effective'] = [
                        {'type': t, 'version': d.get('version'), 'variant': d.get('variant','')} for t,d in base_resources.items()
                    ]
        # ANSI color helpers
        def _c(txt, code):
            return f"\x1b[{code}m{txt}\x1b[0m" if use_colors else txt
        C_OK = '1;32'
        C_KO = '1;31'
        C_WARN = '33'
        C_OPEN = '1;33'
        C_INFO = '36'
        C_FW = '34'
        C_RES_UP = '35'
        C_DIM = '2'
        # Detect upgrades for highlighting
        prev_fw = None
        prev_res_versions = {}
        for ec in evaluated_calls:
            if ec['verdict'] == 'OK':
                verdict_col = _c(ec['verdict'], C_OK)
            elif ec['verdict'] == 'OPEN':
                verdict_col = _c(ec['verdict'], C_OPEN)
            else:
                verdict_col = _c(ec['verdict'], C_KO)
            fw_eff = ec.get('fw_version_effective') or ''
            fw_part = fw_eff
            if fw_eff and fw_eff != prev_fw:
                fw_part = _c(fw_eff, C_FW)
            # Build resource compact highlighting upgrades
            res_compact_parts = []
            for rr in (ec.get('resources_effective') or []):
                key = rr.get('type','')
                ver = rr.get('version','')
                variant = rr.get('variant','')
                show = f"{key}:{ver}:{variant}" if variant else f"{key}:{ver}"
                if prev_res_versions.get(key) and prev_res_versions.get(key) != ver:
                    show = _c(show, C_RES_UP)
                res_compact_parts.append(show)
                prev_res_versions[key] = ver
            res_compact_line = ','.join(res_compact_parts)
            path_val = ec.get('state_path_ok') or ''
            if path_val.startswith('YES'):
                path_col = _c(path_val, C_INFO if 'INFCONN' in path_val else C_OK)
            elif path_val == '':
                path_col = _c('-', C_DIM)
            else:
                path_col = _c(path_val, C_KO)
            reason_txt = ec.get('reason') or ''
            reason_col = _c(reason_txt, C_WARN) if reason_txt else ''
            dur_s = ''
            if ec.get('duration_ms'):
                try:
                    dur_s = f"{float(ec['duration_ms'])/1000:.3f}s"
                except Exception:
                    dur_s = ''
            join_ms = ec.get('time_to_join_ms') or '-'
            base_line = (f"Llamada {ec['index']} [Test {ec.get('test_group','1')}] (f2={ec['f2_call_number']}) -> {verdict_col}\n"
                         f"  Tipo: {(ec.get('type') or '').upper()}  Sesion(f1): {ec.get('session_id_f1','')}\n"
                         f"  Remote(f3): {ec.get('remote_f3','')}\n"
                         f"  Inicio: {ec.get('timestamp_in','')}  Hangup: {ec.get('timestamp_hangup','') or '-'}\n")
            if ec.get('duration_ms'):
                base_line += f"  Duración(ms): {ec['duration_ms']}  Duración(s): {dur_s}\n"
            base_line += (f"  ON_CONNECTED: {'SI' if ec.get('on_connected_ts') else 'NO'}  ON_JOINED: {'SI' if ec.get('on_joined_ts') else 'NO'}  DEINIT: {'SI' if ec.get('deinit_ts') else 'NO'}  HANGUP: {'SI' if ec.get('timestamp_hangup') else 'NO'}\n")
            if ec.get('time_to_join_ms'):
                base_line += f"  Time to JOIN (ms): {ec['time_to_join_ms']}\n"
            if ec.get('state_path_ok'):
                base_line += f"  PathOK: {path_col}\n"
            if fw_eff:
                base_line += f"  FW efectiva: {fw_part}\n"
            if res_compact_line:
                # list resources again detailed
                for rr in (ec.get('resources_effective') or []):
                    r_line = f"  Recurso: {rr.get('type','')}: {rr.get('version','')} (variant={rr.get('variant','')})"
                    # highlight upgrade line if changed
                    if prev_res_versions.get(rr.get('type','')) == rr.get('version',''):
                        base_line += r_line + "\n"
                    else:
                        base_line += _c(r_line, C_RES_UP) + "\n"
            if reason_col:
                base_line += f"  Motivo: {reason_col}\n"
            print(base_line.rstrip('\n'))
            print('-'*60)
            prev_fw = fw_eff
        # end for ec in evaluated_calls
    else:
        print("No incoming calls found.")
        evaluated_calls = []
    if csv_path:
        # Determinar columnas dinámicamente
        base = ['timestamp','hangup_timestamp','duration_ms','on_connected_ts','on_joined_ts','deinit_ts','time_to_join_ms','state_path_ok','missing_states','session_id','call_number','remote','status','type','raw_line']
        present_keys = {k for r in rows for k in r.keys()}
        fieldnames = [c for c in base if c in present_keys]
        with open(csv_path, 'w', newline='', encoding='utf-8') as csvf:
            writer = csv.DictWriter(csvf, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"CSV written: {csv_path}")

    # Exportaciones de resumen
    if summary_text_path:
        try:
            with open(summary_text_path, 'w', encoding='utf-8') as outf:
                # Forzamos salida limpia (sin ANSI) en el fichero aunque se haya pedido --color-summary
                color_summary_text = False
                # Cabecera metadata siempre, con placeholders si faltan
                ordered_keys = [
                    'installation','cu_version','svk_version','device_type',
                    'hw_version','fw_version','build_type'
                ]
                outf.write('===== CONTEXTO INSTALACION =====\n')
                for k in ordered_keys:
                    val = (metadata or {}).get(k)
                    outf.write(f"{k}: {val if val else '-'}\n")
                # Resources
                res_list = (metadata or {}).get('resources') or []
                outf.write('Resources:\n')
                if res_list:
                    for res in res_list:
                        outf.write(f"- type={res['type']} version={res['version']} variant={res['variant']}\n")
                else:
                    outf.write('- none\n')
                # Info de versión de la herramienta y python
                if metadata:
                    tv = metadata.get('tool_version')
                    pyv = metadata.get('python')
                    if tv:
                        outf.write(f"tool_version: {tv}\n")
                    if pyv:
                        outf.write(f"python: {pyv}\n")
                # Información de upgrade de firmware (si se definió)
                if metadata and metadata.get('fw_upgrade'):
                    up = metadata['fw_upgrade']
                    outf.write(
                        f"fw_upgrade: from f2>={up.get('from_call')} base={up.get('base_version')} -> {up.get('new_version')}\n"
                    )
                if metadata and metadata.get('resource_upgrades'):
                    for rup in sorted(metadata['resource_upgrades'], key=lambda x: x.get('from_call',0)):
                        outf.write(
                            f"resource_upgrade: {rup.get('type')} from f2>={rup.get('from_call')} -> {rup.get('new_version')} variant={rup.get('new_variant','')}\n"
                        )
                outf.write('===== RESUMEN FINAL =====\n')
                # Totales al inicio
                outf.write(f"Total: {total} Aceptadas: {accepted} Rechazadas: {rejected} %Aceptación: {(accepted/total*100) if total else 0:.2f}%\n")
                # Bloque compacto inmediato
                outf.write('Llamadas:\n')
                # Optional colored compact lines
                prev_fw_c = None
                prev_res_versions_c = {}
                def _cfile(text, code):
                    return f"\x1b[{code}m{text}\x1b[0m" if color_summary_text else text
                for ec in evaluated_calls:
                    dur_s = ''
                    if ec.get('duration_ms'):
                        try:
                            dur_s = f"{float(ec['duration_ms'])/1000:.3f}s"
                        except Exception:
                            dur_s = ''
                    join_ms = ec.get('time_to_join_ms') or ''
                    path = ec.get('state_path_ok') or ''
                    reason = ec.get('reason') or ''
                    fw_eff = ec.get('fw_version_effective') or ''
                    res_list = ec.get('resources_effective') or []
                    res_compact_parts = []
                    for rr in res_list:
                        t = rr.get('type','')
                        v = rr.get('version','')
                        var = rr.get('variant','')
                        seg = f"{t}:{v}:{var}" if var else f"{t}:{v}"
                        if color_summary_text and prev_res_versions_c.get(t) and prev_res_versions_c.get(t)!=v:
                            seg = _cfile(seg, '35')
                        res_compact_parts.append(seg)
                        prev_res_versions_c[t]=v
                    res_compact = ','.join(res_compact_parts)
                    verdict_disp = ec['verdict']
                    if color_summary_text:
                        if ec['verdict'] == 'OK':
                            verdict_disp = _cfile(verdict_disp, '1;32')
                        elif ec['verdict'] == 'OPEN':
                            verdict_disp = _cfile(verdict_disp, '1;33')
                        else:
                            verdict_disp = _cfile(verdict_disp, '1;31')
                    if color_summary_text and fw_eff and fw_eff!=prev_fw_c:
                        fw_eff_disp = _cfile(fw_eff, '34')
                    else:
                        fw_eff_disp = fw_eff or '-'
                    if color_summary_text:
                        if path.startswith('YES'):
                            path_disp = _cfile(path, '36' if 'INFCONN' in path else '1;32')
                        elif path=='NO':
                            path_disp = _cfile(path, '1;31')
                        else:
                            path_disp = path
                    else:
                        path_disp = path
                    reason_disp = reason
                    if color_summary_text and reason:
                        reason_disp = _cfile(reason, '33')
                    outf.write(
                        f"  #{ec['index']} T{ec.get('test_group','1')} f2={ec['f2_call_number']} {(ec['type'] or '').upper()} {verdict_disp} "
                        f"dur={dur_s or '-'} join={join_ms or '-'} path={path_disp} fw={fw_eff_disp}"
                        f"{' res='+res_compact if res_compact else ''} reason={reason_disp}\n"
                    )
                    prev_fw_c = fw_eff
                outf.write('\nDetalle llamadas:\n')
                for ec in evaluated_calls:
                    outf.write(f"Llamada {ec['index']} [Test {ec.get('test_group','1')}] (f2={ec['f2_call_number']}) -> {ec['verdict']}\n")
                    outf.write(f"  Tipo: {(ec['type'] or '').upper()}  Sesion(f1): {ec['session_id_f1']}\n")
                    outf.write(f"  Remote(f3): {ec['remote_f3'] or ''}\n")
                    outf.write(f"  Inicio: {ec['timestamp_in'] or ''}  Hangup: {ec['timestamp_hangup'] or '-'}\n")
                    if ec.get('duration_ms'):
                        try:
                            outf.write(f"  Duración(ms): {ec['duration_ms']}  Duración(s): {float(ec['duration_ms'])/1000:.3f}\n")
                        except Exception:
                            pass
                    outf.write(
                        f"  ON_CONNECTED: {'SI' if ec.get('on_connected_ts') else 'NO'}  ON_JOINED: {'SI' if ec.get('on_joined_ts') else 'NO'}  DEINIT: {'SI' if ec.get('deinit_ts') else 'NO'}  HANGUP: {'SI' if ec.get('timestamp_hangup') else 'NO'}\n"
                    )
                    if ec.get('fw_version_effective'):
                        outf.write(f"  FW efectiva: {ec.get('fw_version_effective')}\n")
                    # Recursos efectivos por llamada
                    if ec.get('resources_effective'):
                        for rr in ec['resources_effective']:
                            outf.write(
                                f"  Recurso: {rr.get('type','')}: {rr.get('version','')} (variant={rr.get('variant','')})\n"
                            )
                    if ec.get('time_to_join_ms'):
                        outf.write(f"  Time to JOIN (ms): {ec['time_to_join_ms']}\n")
                    if ec.get('state_path_ok'):
                        outf.write(f"  PathOK: {ec['state_path_ok']}\n")
                    if ec.get('reason'):
                        outf.write(f"  Motivo: {ec['reason']}\n")
                    outf.write('-'*60 + '\n')
            print(f"Resumen texto escrito: {summary_text_path}")
        except Exception as e:
            print(f"[error] No se pudo escribir summary text: {e}")

    if summary_json_path:
        try:
            export = {
                'metadata': metadata or {},
                'totals': {
                    'total_calls': total,
                    'accepted': accepted,
                    'rejected': rejected,
                    'acceptance_rate_pct': (accepted/total*100) if total else 0.0,
                },
                'calls': evaluated_calls,
            }
            with open(summary_json_path, 'w', encoding='utf-8') as jf:
                json.dump(export, jf, ensure_ascii=False, indent=2)
            print(f"Resumen JSON escrito: {summary_json_path}")
        except Exception as e:
            print(f"[error] No se pudo escribir summary json: {e}")


def analyze_calls(log_path: str, encoding: Optional[str]=None, verbose: bool=False) -> dict:
    """Versión unificada (multi-línea + audio) para uso en GUI.

    Mantiene la misma heurística que process_log pero sin imprimir.
    """
    enc_list = [encoding] if encoding else ['utf-8-sig','utf-8','utf-16','utf-16-le','latin-1']
    lines = _open_with_encodings(log_path, enc_list, verbose)
    rows: list[dict] = []
    hangups: dict[tuple[str,str], dict] = {}
    states_map: dict[tuple[str,str], dict] = {}
    pending_audio: list[tuple[str,str]] = []  # (kind, ts)
    last_ts = ''
    pending_incoming_ts: Optional[str] = None
    state_tokens = ('ON_CONNECTED','CONNECTED','ON_JOINED','DEINIT')
    for raw_line in lines:
        line = raw_line.rstrip('\n')
        low = line.lower()
        ts_here = parse_timestamp(line)
        if ts_here:
            last_ts = ts_here
        if 'callhub.cpp:317_onincoming' in low:
            pending_incoming_ts = last_ts
        # Buffer audio events (outside TAG) first
        if 'actionconnectaudio' in low or 'actiondisconnectaudio' in low:
            ats = parse_timestamp(line) or last_ts or ''
            k = 'connect' if 'actionconnectaudio' in low else 'disconnect'
            pending_audio.append((k, ats))
        if '#tag=2wv#' not in low:
            continue
        fields = parse_fields(line)
        st_field = fields.get('f4','')
        is_incoming_line = 'call incoming' in low
        is_hangup_line = any(p in low for p in (
            'hanging up call','hung up call','hungup call',' hungup ','call ended','call finished','ending call','disconnecting call'))
        is_state_line = st_field in state_tokens
        is_device = 'device operation' in low
        if not (is_incoming_line or is_hangup_line or is_device or is_state_line):
            continue
        ts = parse_timestamp(line) or last_ts or ''
        session_id = fields.get('f1','')
        call_number = fields.get('f2','')
        remote = fields.get('f3','')
        status = fields.get('f4','')
        call_type = fields.get('f5','')
        key = (session_id, call_number)
        if is_incoming_line:
            real_ts = pending_incoming_ts or ts
            pending_incoming_ts = None
            if status == 'accepted':
                rows.append({
                    'timestamp': real_ts or '', 'hangup_timestamp': '', 'duration_ms': '',
                    'on_connected_ts': '', 'on_joined_ts': '', 'deinit_ts': '', 'time_to_join_ms': '',
                    'state_path_ok': '', 'missing_states': '', 'audio_connected_ts': '', 'audio_disconnected_ts': '',
                    'audio_connect_delay_ms': '', 'audio_duration_ms': '', 'audio_ok': '',
                    'session_id': session_id, 'call_number': call_number, 'remote': remote,
                    'status': status, 'type': call_type, 'raw_line': line.strip()
                })
            elif status == 'rejected':
                rows.append({
                    'timestamp': real_ts or '', 'hangup_timestamp': '', 'duration_ms': '',
                    'on_connected_ts': '', 'on_joined_ts': '', 'deinit_ts': '', 'time_to_join_ms': '',
                    'state_path_ok': '', 'missing_states': '', 'audio_connected_ts': '', 'audio_disconnected_ts': '',
                    'audio_connect_delay_ms': '', 'audio_duration_ms': '', 'audio_ok': '',
                    'session_id': session_id, 'call_number': call_number, 'remote': remote,
                    'status': status, 'type': call_type, 'reason': 'CRA Windows not opened', 'raw_line': line.strip()
                })
        elif is_hangup_line:
            hangups[key] = {'hangup_timestamp': ts or ''}
        elif is_state_line or is_device:
            st = status
            if st in state_tokens:
                d = states_map.setdefault(key, {})
                if st not in d:
                    d[st] = ts or ''
    # Helper dt
    from datetime import timedelta
    def _dt(s: str):
        try:
            return datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f') if s else None
        except Exception:
            return None
    # Attach hangups & states
    for r in rows:
        if r['status'] != 'accepted':
            continue
        key = (r['session_id'], r['call_number'])
        h = hangups.get(key)
        st_data = states_map.get(key, {})
        if h:
            r['hangup_timestamp'] = h['hangup_timestamp']
        r['on_connected_ts'] = st_data.get('ON_CONNECTED','') or st_data.get('CONNECTED','')
        r['on_joined_ts'] = st_data.get('ON_JOINED','')
        r['deinit_ts'] = st_data.get('DEINIT','')
    # Assign audio events with same window rule
    for kind, ats in pending_audio:
        if not ats: continue
        tev = _dt(ats)
        if not tev: continue
        best = None
        for c in rows:
            if c.get('status') != 'accepted':
                continue
            ts0 = _dt(c.get('timestamp',''))
            if not ts0 or tev < ts0:
                continue
            t_end = _dt(c.get('hangup_timestamp',''))
            if t_end and tev > t_end + timedelta(seconds=3):
                continue
            if best is None or ts0 > _dt(best.get('timestamp','')):
                best = c
        if not best:
            continue
        if kind == 'connect' and not best.get('audio_connected_ts'):
            best['audio_connected_ts'] = ats
        elif kind == 'disconnect' and best.get('audio_connected_ts') and not best.get('audio_disconnected_ts'):
            best['audio_disconnected_ts'] = ats
            best['audio_ok'] = best.get('audio_ok') or 'YES'
    # Metrics & state path
    for r in rows:
        if r['status'] != 'accepted':
            continue
        connected_ts = r.get('on_connected_ts','')
        if not connected_ts and r.get('on_joined_ts'):
            # infer ON_CONNECTED
            r['on_connected_ts'] = r['on_joined_ts']
        try:
            if r['timestamp'] and r['hangup_timestamp']:
                t0 = datetime.strptime(r['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                t1 = datetime.strptime(r['hangup_timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                r['duration_ms'] = f"{(t1-t0).total_seconds()*1000:.0f}"
        except Exception:
            pass
        try:
            if r['timestamp'] and r['on_joined_ts']:
                t0 = datetime.strptime(r['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                tj = datetime.strptime(r['on_joined_ts'], '%Y-%m-%d %H:%M:%S.%f')
                r['time_to_join_ms'] = f"{(tj-t0).total_seconds()*1000:.0f}"
        except Exception:
            pass
        required = ['ON_JOINED','DEINIT','HANGUP']
        present = set()
        if r.get('on_connected_ts'): present.add('ON_CONNECTED')
        if r.get('on_joined_ts'): present.add('ON_JOINED')
        if r.get('deinit_ts'): present.add('DEINIT')
        if r.get('hangup_timestamp'): present.add('HANGUP')
        missing = [s for s in required if s not in present]
        r['state_path_ok'] = 'YES' if not missing else 'NO'
        r['missing_states'] = ','.join(missing)
        # audio metrics
        try:
            if r.get('timestamp') and r.get('audio_connected_ts'):
                t0 = datetime.strptime(r['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                ta = datetime.strptime(r['audio_connected_ts'], '%Y-%m-%d %H:%M:%S.%f')
                r['audio_connect_delay_ms'] = f"{(ta-t0).total_seconds()*1000:.0f}"
        except Exception:
            pass
        try:
            if r.get('audio_connected_ts') and r.get('audio_disconnected_ts'):
                ta = datetime.strptime(r['audio_connected_ts'], '%Y-%m-%d %H:%M:%S.%f')
                tb = datetime.strptime(r['audio_disconnected_ts'], '%Y-%m-%d %H:%M:%S.%f')
                r['audio_duration_ms'] = f"{(tb-ta).total_seconds()*1000:.0f}"
        except Exception:
            pass
        if not r.get('audio_ok') and r.get('audio_connected_ts') and r.get('audio_disconnected_ts'):
            r['audio_ok'] = 'YES'
    # Dedup & test groups
    if rows:
        ded=[]; seen=set()
        for r in rows:
            sig=(r.get('timestamp'),r.get('session_id'),r.get('call_number'),r.get('status'))
            if sig in seen: continue
            seen.add(sig); ded.append(r)
        rows=ded
        prev=None; grp=1
        for r in rows:
            try: cn=int(r.get('call_number') or -1)
            except: cn=-1
            if prev is not None and cn!=-1 and prev!=-1 and cn<prev: grp+=1
            r['test_group']=grp
            if cn!=-1: prev=cn
    def verdict(r):
        if r['status']=='rejected': return 'KO','rejected'
        if r['status']=='accepted':
            if not r.get('hangup_timestamp'):
                if not r.get('on_joined_ts') and not r.get('deinit_ts'):
                    miss=['ON_JOINED','DEINIT','HANGUP']
                    return 'OPEN','abierta faltan: '+','.join(miss)
                return 'KO','sin hangup'
            if not r.get('state_path_ok','').startswith('YES'):
                ms=r.get('missing_states','')
                return 'KO','faltan estados: '+ms if ms else 'faltan estados'
            return 'OK',''
        return 'KO','estado desconocido'
    eval_calls=[]
    for r in rows:
        v, reason = verdict(r)
        if v == 'OPEN':  # forzar OPEN a KO (misma política previa GUI)
            v='KO'; reason = (reason + ' (forzada KO)') if reason else 'open->ko'
        ev={k:r.get(k,'') for k in (
            'call_number','test_group','status','type','remote','duration_ms','time_to_join_ms',
            'state_path_ok','missing_states','audio_ok','audio_connect_delay_ms','audio_duration_ms'
        )}
        ev['verdict']=v
        # Si la llamada es rejected y tiene reason, propagarlo
        if r.get('status') == 'rejected' and r.get('reason'):
            ev['reason'] = r['reason']
        else:
            ev['reason'] = reason
        eval_calls.append(ev)
    total=len(rows); accepted=sum(1 for r in rows if r['status']=='accepted'); rejected=sum(1 for r in rows if r['status']=='rejected')
    return {
        'totals':{
            'total_calls': total,
            'accepted': accepted,
            'rejected': rejected,
            'acceptance_rate_pct': (accepted/total*100) if total else 0.0
        },
        'calls': eval_calls
    }


def main():
    ap = argparse.ArgumentParser(description='Extractor básico de intentos de llamada (Call incoming)')
    # Nuevo: argumento posicional opcional para facilitar: python call_events_extractor.py log.log
    ap.add_argument('logfile', nargs='?', help='Ruta al fichero de log (alternativa a --log)')
    ap.add_argument('--log', required=False, help='Ruta al fichero de log')
    ap.add_argument('--csv', help='Ruta de salida CSV')
    ap.add_argument('--verbose', action='store_true', help='Mostrar coincidencias mientras se procesan')
    ap.add_argument('--encoding', help='Forzar una codificación (si se conoce)')
    ap.add_argument('--plain', action='store_true', help='Sin tabla bonita, salida simple')
    # Metadatos de instalación / dispositivo
    ap.add_argument('--installation', help='ID instalación (ej 5499266)')
    ap.add_argument('--cu-version', dest='cu_version', help='CU Version (ej 1.32.16)')
    ap.add_argument('--svk-version', dest='svk_version', help='SVK version code (ej 2CHFF7QW)')
    ap.add_argument('--device-type', dest='device_type', help='Tipo de dispositivo (ej SVK)')
    ap.add_argument('--hw-version', dest='hw_version', help='HW version (ej 1E)')
    ap.add_argument('--fw-version', dest='fw_version', help='FW version (ej 4.11.1)')
    ap.add_argument('--build-type', dest='build_type', help='Build type (ej release)')
    ap.add_argument('--resource', action='append', help='Recurso formato type:version:variant (repetible)')
    # Upgrade de recursos (p.e. audio) a partir de cierto call_number: --resource-upgrade 23:audio:3.4.0:ROTA_Espana
    ap.add_argument('--resource-upgrade', dest='resource_upgrades', action='append', help='Formato N:tipo:version[:variant]. Repetible. Aplica nueva version de recurso desde call_number >= N.')
    # Actualización de firmware a partir de cierto número de llamada: --fw-upgrade 22:4.12.1
    ap.add_argument('--fw-upgrade', dest='fw_upgrade', help='Aplicar nueva fw_version a partir de call_number dado. Formato N:NUEVA_VERSION (ej 22:4.12.1)')
    ap.add_argument('--summary-text', dest='summary_text', help='Ruta de fichero para exportar resumen final en texto')
    ap.add_argument('--summary-json', dest='summary_json', help='Ruta de fichero para exportar resumen final en JSON')
    ap.add_argument('--colors', action='store_true', help='Colorear salida consola resumen final')
    ap.add_argument('--color-summary', action='store_true', help='Insertar códigos ANSI en bloque compacto del summary texto')
    args = ap.parse_args()
    # Compatibilidad: si no se pasó --log pero sí logfile posicional, usarlo
    if not args.log and args.logfile:
        args.log = args.logfile
    # Si sigue faltando, mostrar ayuda clara
    if not args.log:
        print("[ERROR] Debes indicar ruta al log: python call_events_extractor.py <logfile> o --log <logfile>")
        ap.print_help(); sys.exit(2)

    # Resolver ruta automáticamente si no existe tal cual
    def resolve_log_path(path: str) -> str:
        if os.path.exists(path):
            return path
        base = os.path.basename(path)
        candidates_dirs = [
            '.',
            'logs',
            os.path.join('Proyectos','llamadas','logs'),
            os.path.expanduser('~'),
            os.path.join(os.path.expanduser('~'), 'Desktop'),
            os.path.join(os.path.expanduser('~'), 'Desktop', 'Logs Xshell'),
            os.path.join(os.path.expanduser('~'), 'Desktop', 'Logs Xshell', 'zapatofono'),
        ]
        for d in candidates_dirs:
            cand = os.path.join(d, base)
            if os.path.exists(cand):
                print(f"[info] Log localizado automáticamente en: {cand}")
                return cand
        print(f"[ERROR] No se encontró el fichero de log '{path}'. Asegúrate de usar la ruta completa (con comillas si hay espacios).")
        print(f"Ejemplo: python call_events_extractor.py \"C:/Users/{os.getlogin()}/Desktop/Logs Xshell/zapatofono/{base}\"")
        sys.exit(3)

    args.log = resolve_log_path(args.log)

    # Autogenerar salidas si no se especifican
    if not args.summary_text or not args.summary_json:
        base_name = os.path.splitext(os.path.basename(args.log))[0]
        if not args.summary_text:
            args.summary_text = f"{base_name}.summary.txt"
        if not args.summary_json:
            args.summary_json = f"{base_name}.summary.json"
    # Señalizamos preferencia plain mediante atributo en la función
    if args.plain:
        setattr(process_log, '_plain', True)
    else:
        setattr(process_log, '_plain', False)
    # Mostrar cabecera de contexto si hay metadatos
    meta_lines = []
    if args.installation:
        meta_lines.append(f"Instalacion: {args.installation}")
    if args.cu_version:
        meta_lines.append(f"CU Version: {args.cu_version}")
    if args.svk_version:
        meta_lines.append(f"SVK Version: {args.svk_version}")
    if args.device_type:
        meta_lines.append(f"DeviceType: {args.device_type}")
    if args.hw_version:
        meta_lines.append(f"HW: {args.hw_version}")
    if args.fw_version:
        meta_lines.append(f"FW: {args.fw_version}")
    if args.build_type:
        meta_lines.append(f"Build: {args.build_type}")
    resources = []
    if args.resource:
        for r in args.resource:
            parts = r.split(':')
            if len(parts) >= 3:
                resources.append({'type': parts[0], 'version': parts[1], 'variant': parts[2]})
            elif len(parts) == 2:
                resources.append({'type': parts[0], 'version': parts[1], 'variant': ''})
            else:
                resources.append({'type': r, 'version': '', 'variant': ''})
    if meta_lines:
        print('===== CONTEXTO INSTALACION =====')
        for ml in meta_lines:
            print(ml)
        print('Resources:')
        if resources:
            for res in resources:
                print(f"  - type={res['type']} version={res['version']} variant={res['variant']}")
        else:
            print('- none')
        print('================================')
    else:
        # Imprimir también los por defecto si no se pasó nada, pero respetar recursos proporcionados
        print('===== CONTEXTO INSTALACION =====')
        for k in ['installation','cu_version','svk_version','device_type','hw_version','fw_version','build_type']:
            print(f"{k}: {DEFAULT_METADATA.get(k,'-')}")
        print('Resources:')
        if resources:
            for res in resources:
                print(f"  - type={res['type']} version={res['version']} variant={res['variant']}")
        else:
            print('- none')
        print('================================')
    # Construimos metadata dict para exportaciones
    metadata = {}
    metadata['tool_version'] = TOOL_VERSION
    metadata['python'] = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    if args.installation: metadata['installation'] = args.installation
    if args.cu_version: metadata['cu_version'] = args.cu_version
    if args.svk_version: metadata['svk_version'] = args.svk_version
    if args.device_type: metadata['device_type'] = args.device_type
    if args.hw_version: metadata['hw_version'] = args.hw_version
    if args.fw_version: metadata['fw_version'] = args.fw_version
    if args.build_type: metadata['build_type'] = args.build_type
    # Rellenar con defaults cualquier valor faltante
    for k,v in DEFAULT_METADATA.items():
        if k not in metadata:
            metadata[k] = v
    if resources: metadata['resources'] = resources
    # Parseo de fw-upgrade si existe
    if args.fw_upgrade:
        try:
            parts = args.fw_upgrade.split(':',1)
            if len(parts)==2:
                upgrade_from = int(parts[0])
                upgrade_version = parts[1]
                # Guardamos en metadata para que process_log lo interprete
                metadata['fw_upgrade'] = {
                    'from_call': upgrade_from,
                    'new_version': upgrade_version,
                    'base_version': metadata.get('fw_version', DEFAULT_METADATA.get('fw_version'))
                }
            else:
                print('[warn] Formato fw-upgrade invalido, se ignora')
        except Exception as e:
            print(f"[warn] No se pudo parsear fw-upgrade: {e}")
    # Parseo de resource-upgrades
    if args.resource_upgrades:
        upgrades_list = []
        for ru in args.resource_upgrades:
            try:
                # N:tipo:version(:variant opcional)
                parts = ru.split(':')
                if len(parts) < 3:
                    print(f"[warn] resource-upgrade ignorado (formato): {ru}")
                    continue
                from_call = int(parts[0])
                r_type = parts[1]
                r_version = parts[2]
                r_variant = parts[3] if len(parts) > 3 else ''
                upgrades_list.append({
                    'from_call': from_call,
                    'type': r_type,
                    'new_version': r_version,
                    'new_variant': r_variant
                })
            except Exception as e:
                print(f"[warn] resource-upgrade fallo parseando '{ru}': {e}")
        if upgrades_list:
            metadata['resource_upgrades'] = upgrades_list
    process_log(
        args.log,
        args.csv,
        verbose=args.verbose,
        encoding=args.encoding,
        summary_text_path=args.summary_text,
        summary_json_path=args.summary_json,
        metadata=metadata,
        use_colors=args.colors,
        color_summary_text=args.color_summary
    )

if __name__ == '__main__':
    main()
