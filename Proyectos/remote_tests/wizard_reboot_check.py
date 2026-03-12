#!/usr/bin/env python3
"""Interactive wizard to run repeated reboot+service-check iterations on a CU.

Usage: python wizard_reboot_check.py

The wizard will scan the local network (using the project's `network_scanner.py`),
present known installations, ask which to use (or manual IP), then ask for the
number of iterations. For each iteration it will send a reboot (unless --no-reboot),
wait for SSH to return, wait 5 minutes, run `systemctl` checks and save/print results.
"""
from __future__ import annotations
import os
import time
import argparse
import csv
import json
import importlib.util
import sys
from typing import Optional


def load_module(path: str, name: str):
    import os
    candidates = [path]
    # try same directory as this script
    candidates.append(os.path.abspath(os.path.join(os.path.dirname(__file__), os.path.basename(path))))
    # try path relative to this file's parent (../network_scanner.py)
    candidates.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', os.path.basename(path))))
    # try parent of parent (in case the layout differs)
    candidates.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', os.path.basename(path))))
    # try sibling 'Proyectos' folder (workspace layouts)
    candidates.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'Proyectos', os.path.basename(path))))

    for p in candidates:
        if p and os.path.exists(p):
            spec = importlib.util.spec_from_file_location(name, p)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod

    raise FileNotFoundError(f"Could not find module {name} at any of: {candidates}")


# Output styling
USE_COLORS = sys.stdout.isatty()
COL = {
    'green': '32',
    'red': '31',
    'yellow': '33',
    'white': '37',
    'cyan': '36',
    'magenta': '35',
}

def color(text: str, name: str) -> str:
    if not USE_COLORS:
        return text
    code = COL.get(name, '0')
    return f"\x1b[{code}m{text}\x1b[0m"

def header(title: str):
    sep = '=' * max(20, len(title) + 4)
    print(color(sep, 'cyan'))
    print(color(f"  {title}", 'cyan'))
    print(color(sep, 'cyan'))

# Wait time after reboot before running checks (seconds)
POST_REBOOT_WAIT = 60  # 1 minute (default changed for testing)


def normalize_mac_ignore_first(mac: str) -> str:
    s = mac.lower().replace(':', '-').replace(' ', '')
    parts = s.split('-')
    if len(parts) == 6:
        return '-'.join(parts[1:])
    return s


def parse_systemctl_list(s: str):
    """Parse the output of `systemctl list-units` into a list of dicts.
    Each dict contains `unit` when parseable, otherwise `raw_line`.
    """
    lines = (s or '').splitlines()
    parsed = []
    start = 0
    for i, L in enumerate(lines):
        if L.strip().startswith('UNIT'):
            start = i + 1
            break
    for L in lines[start:]:
        Ls = L.rstrip()
        if not Ls.strip():
            continue
        Ls = Ls.lstrip(' \t\u25CF')
        parts = Ls.split()
        if len(parts) < 4:
            parsed.append({'raw_line': Ls})
            continue
        unit = parts[0]
        # filter out artefacts where the first column is not a unit-like name
        # unit names normally contain a dot (e.g. 'xyz.service'). If not, keep as raw_line
        if '.' not in unit:
            parsed.append({'raw_line': Ls})
            continue
        load = parts[1]
        active = parts[2]
        sub = parts[3]
        desc = ' '.join(parts[4:]) if len(parts) > 4 else ''
        parsed.append({'unit': unit, 'load': load, 'active': active, 'sub': sub, 'description': desc, 'raw_line': Ls})
    return parsed


def find_installations(scanner_mod):
    """Return list of installations with resolved IP if present."""
    subnet = scanner_mod.detectar_subred_local()
    devices = scanner_mod.scan_network_devices(subnet)
    # build map of device mac normalized -> ip
    dev_map = {}
    for ip, mac in devices:
        dev_map[normalize_mac_ignore_first(mac)] = ip

    installs = []
    for mac, info in getattr(scanner_mod, 'MAC_INFO', {}).items():
        serial = info.get('Serial Number')
        inst_no = info.get('Numero de instalacion')
        mac_norm = normalize_mac_ignore_first(mac)
        ip = dev_map.get(mac_norm)
        installs.append({'serial': serial, 'inst_no': inst_no, 'mac': mac, 'ip': ip})
    return installs


def choose_installation(installs):
    print('\n' + color('Instalaciones detectadas:', 'cyan'))
    for i, it in enumerate(installs, start=1):
        ip = it['ip'] or '-'
        tag = it.get('tag_version') or '-'
        line = f"  [{i}] Serial: {it['serial']:<12} Inst: {it['inst_no']:<8} IP: {ip} TAG_VERSION: {tag}"
        # color entries with IP in green, others in white
        if it.get('ip'):
            print(color(line, 'green'))
        else:
            print(color(line, 'white'))
    print(color("  [m] Introducir IP manualmente", 'magenta'))

    while True:
        pick = input('\nElige una instalación (número) o m: ').strip()
        if pick.lower() == 'm':
            ip = input('Introduce IP manual: ').strip()
            return ip
        if pick.isdigit():
            idx = int(pick) - 1
            if 0 <= idx < len(installs):
                if installs[idx]['ip']:
                    return installs[idx]['ip']
                else:
                    print('La instalación seleccionada no tiene IP detectada. Elige otra o usa m para introducir IP.')
        print('Entrada inválida.')


def ask_iterations() -> int:
    while True:
        v = input('¿Cuántas iteraciones quieres ejecutar? (enter para 1): ').strip()
        if v == '':
            return 1
        if v.isdigit() and int(v) > 0:
            return int(v)
        print('Introduce un número entero mayor que 0')


def main():
    here = os.path.dirname(__file__)
    # CLI args
    parser = argparse.ArgumentParser(description='CU Reboot & Service-Check Wizard')
    parser.add_argument('--auto', action='store_true', help='Run non-interactively with defaults (no prompts)')
    parser.add_argument('--iterations', '-n', type=int, default=None, help='Number of iterations to run')
    parser.add_argument('--no-reboot', action='store_true', help='Do not send reboot commands')
    parser.add_argument('--post-wait', type=int, default=60, help='Seconds to wait after host is back before running checks (default 60)')
    parser.add_argument('--verbose', action='store_true', help='Show detailed SSH command outputs')
    parser.add_argument('--output', '-o', default=None, help='Output results file (JSON). In auto mode default used if omitted')
    parser.add_argument('--select-first', action='store_true', help='In auto mode select first found installation automatically')
    args = parser.parse_args()
    # prepare results directory for this run
    run_ts = int(time.time())
    if args.output:
        # if explicit output path provided, use its parent as results_dir
        results_dir = os.path.dirname(os.path.abspath(args.output)) or os.path.abspath(here)
    elif args.auto:
        results_dir = os.path.join(os.path.abspath(here), f'run_{run_ts}')
    else:
        # default to a run-specific folder so results are grouped
        results_dir = os.path.join(os.path.abspath(here), f'run_{run_ts}')
    os.makedirs(results_dir, exist_ok=True)
    print(color(f'Results directory: {results_dir}', 'cyan'))
    scanner_path = os.path.join(here, '..', 'network_scanner.py')
    scanner = load_module(scanner_path, 'network_scanner')
    rc_path = os.path.join(here, 'remote_client.py')
    remote = load_module(rc_path, 'remote_client')
    # Determine SSH private key path early so we can query TAG_VERSION for installs with IP
    env_key = os.environ.get('CU_SSH_KEY')
    key_default_local = os.path.join(here, 'cu_devkey_private')
    key_default_user = os.path.expanduser('~/.ssh/cu_devkey_private')
    if env_key:
        key_path = env_key
    elif os.path.exists(key_default_user):
        key_path = key_default_user
    else:
        key_path = key_default_local

    # annotate installs with TAG_VERSION if IP present
    def annotate_tags(installs_list):
        # command to probe version remotely (avoid complex quoting)
        probe_cmd = 'checkVersion.sh || cat /etc/version || uname -a'
        for it in installs_list:
            ip = it.get('ip')
            if not ip:
                it['tag_version'] = None
                continue
            try:
                res = remote.ssh_run_cmd(ip, 'root', key_path, probe_cmd, port=22, timeout=20)
            except Exception:
                res = None
            tag = None
            if isinstance(res, dict) and res.get('stdout'):
                s = res.get('stdout','')
                m = __import__('re').search(r'TAG_VERSION\s*=\s*"?([^"\n]+)"?', s)
                if m:
                    tag = m.group(1).strip()
                else:
                    # fallback: try first non-empty line as version string
                    for L in s.splitlines():
                        Ls = L.strip()
                        if Ls:
                            tag = Ls
                            break
            if not tag and isinstance(res, dict) and (res.get('stderr') or res.get('error')):
                # record debug info when probe failed to find tag
                it.setdefault('probe_debug', {})['stderr'] = res.get('stderr')
                it['probe_debug']['error'] = res.get('error')
            it['tag_version'] = tag

    header('CU Reboot & Service-Check Wizard')
    installs = find_installations(scanner)
    annotate_tags(installs)
    if args.auto and args.select_first:
        if not installs:
            print('No se encontraron instalaciones, abortando')
            return
        target = installs[0]
        target_ip = target.get('ip')
        print('Auto-mode: seleccionada la primera instalación:', target)
    else:
        target_ip = choose_installation(installs)

    # Determine expected MAC for the selected installation (if available)
    expected_mac = None
    selected_install = None
    for it in installs:
        if it.get('ip') == target_ip:
            selected_install = it
            expected_mac = it.get('mac')
            break

    # Print chosen key info so user knows which key will be used
    if os.environ.get('CU_SSH_KEY'):
        print(f'Usando clave privada desde CU_SSH_KEY: {key_path}')
    elif os.path.exists(key_default_user):
        print(f'Usando clave privada desde {key_path}')
    else:
        print(f'Usando clave privada por defecto (local): {key_path}')
    # Force root user for all remote operations
    user = 'root'
    print('Usando usuario SSH: root')
    # Force SSH port 22 for all operations
    port = 22
    print('Usando puerto SSH: 22')

    # Quick check: list inactive services on the target and show summary
    # Verify basic SSH connectivity first
    print()
    print(color('Verificando conectividad SSH con el host...', 'magenta'))
    conn_test = remote.ssh_run_cmd(target_ip, user, key_path, 'echo ok', port=port, timeout=10)
    if isinstance(conn_test, dict):
        if conn_test.get('rc') == 0 and 'ok' in (conn_test.get('stdout') or ''):
            print('Conectividad SSH verificada (echo ok)')
        else:
            print('Fallo al verificar SSH:')
            if conn_test.get('error'):
                print('  error:', conn_test.get('error'))
            if conn_test.get('stderr'):
                print('  stderr:', conn_test.get('stderr'))
            if conn_test.get('stdout'):
                print('  stdout:', conn_test.get('stdout'))
            cont = input('Continuar de todas formas? [y/N]: ').strip().lower() == 'y'
            if not cont:
                print('Abortando por fallo de conectividad SSH')
                return
    else:
        print('Fallo inesperado verificando SSH, abortando')
        return
    # Initial baseline snapshot of inactive services
    baseline_parsed = []
    baseline_units = set()
    try:
        print()
        print(color(f'Comprobando servicios inactivos en {target_ip}', 'magenta'))
        inactive_res = remote.ssh_run_cmd(target_ip, user, key_path, 'systemctl list-units --type=service --state=inactive --no-pager', port=port, timeout=60)
        if not isinstance(inactive_res, dict):
            print('Respuesta inesperada al solicitar list-units; continuando sin baseline')
        elif inactive_res.get('error') or (inactive_res.get('rc') != 0 and not inactive_res.get('stdout')):
            print('No se pudo obtener la lista de servicios inactivos; detalles:')
            if inactive_res.get('error'):
                print('  error:', inactive_res.get('error'))
            if inactive_res.get('stderr'):
                print('  stderr:', inactive_res.get('stderr'))
            if inactive_res.get('stdout'):
                print('  stdout:', inactive_res.get('stdout'))
            print('Continuando sin baseline')
        else:
            inactive_stdout = inactive_res.get('stdout') if isinstance(inactive_res, dict) else ''
            inactive_parsed = parse_systemctl_list(inactive_stdout)
            baseline_parsed = inactive_parsed
            baseline_units = set([e.get('unit') for e in inactive_parsed if e.get('unit')])
            print(color(f'Servicios inactivos detectados (baseline): {len(inactive_parsed)}', 'yellow'))
            # Do not print the whole list to keep output concise
            # save baseline snapshot
            try:
                outdir = results_dir
                os.makedirs(outdir, exist_ok=True)
                fname = os.path.join(outdir, f'inactive_baseline_{int(time.time())}.json')
                with open(fname, 'w', encoding='utf-8') as f:
                    json.dump({'host': target_ip, 'parsed': baseline_parsed, 'raw': inactive_stdout}, f, indent=2, ensure_ascii=False)
                print(color('Baseline guardada en', 'cyan'), fname)
            except Exception:
                pass
    except Exception as e:
        print('Excepción al pedir la lista de servicios inactivos:', e)
        print('Continuando sin baseline')

    # iterations and reboot behavior: allow CLI override for non-interactive runs
    if args.iterations is not None:
        iterations = args.iterations
        print(f'Usando iterations desde CLI: {iterations}')
    else:
        iterations = ask_iterations()

    if args.no_reboot:
        do_reboot = False
    else:
        if args.auto:
            do_reboot = True
        else:
            do_reboot = input('Enviar reboot en cada iteración? [Y/n]: ').strip().lower() != 'n'

    results = {'target': target_ip, 'iterations': []}

    for it in range(1, iterations + 1):
        print(f'\n=== Iteración {it}/{iterations} contra {target_ip} ===')
        # Show which serial/MAC we believe we're targeting for clarity
        try:
            if selected_install and selected_install.get('serial'):
                tgt_serial = selected_install.get('serial')
            else:
                tgt_serial = None
            tgt_mac = expected_mac
            # attempt to resolve the MAC currently at the target_ip for confirmation
            current_mac = None
            try:
                subnet_chk = scanner.detectar_subred_local()
                devices_chk = scanner.scan_network_devices(subnet_chk)
                for ip_c, mac_c in devices_chk:
                    if ip_c == target_ip:
                        current_mac = mac_c
                        break
            except Exception:
                current_mac = None

            if tgt_serial or tgt_mac:
                info_line = '  Objetivo:'
                if tgt_serial:
                    info_line += f' serial={tgt_serial}'
                if tgt_mac:
                    info_line += f' mac={tgt_mac}'
                if current_mac:
                    info_line += f' (MAC en {target_ip} = {current_mac})'
                print(color(info_line, 'magenta'))
            else:
                print(color('  Objetivo: IP seleccionada sin serial/mac conocidos', 'magenta'))
        except Exception:
            pass
        entry = {'iteration': it, 'reboot_sent': False, 'reboot_ok': False, 'post_checks': {}}
        # record initial target IP and any ip changes during this iteration
        entry['target_ip_initial'] = target_ip
        entry['ip_changes'] = []

        if do_reboot:
            # Try multiple reboot delivery methods; some devices close SSH immediately
            # Start with the plain `reboot` command; if it's missing try known fallbacks
            tried = []
            def try_cmd(cmd):
                if args.verbose:
                    print(f'Intentando enviar reboot con: {cmd}')
                r = remote.ssh_run_cmd(target_ip, user, key_path, cmd, port=port, timeout=10)
                if not isinstance(r, dict):
                    if args.verbose:
                        print('  Respuesta inesperada al ejecutar comando')
                    return False, r
                rc = r.get('rc')
                stdout = r.get('stdout') or ''
                stderr = (r.get('stderr') or '')
                if args.verbose:
                    print(f'  Resultado ssh: rc={rc} stdout={repr(stdout)} stderr={repr(stderr)}')
                # consider success when rc == 0 or ssh returned something and not 'not found'
                if rc == 0:
                    return True, r

                # Heuristic: certain SSH connection-closed/reset messages often mean the remote side dropped the connection because
                # it is rebooting. Treat these stderr patterns as probable success and continue waiting for reconnection.
                stderr_l = stderr.lower()
                probable_success_patterns = ['connection closed by', 'connection reset', 'connection to', 'closed by remote host', 'kex_exchange_identification']
                if any(p in stderr_l for p in probable_success_patterns):
                    # mark as probable success for callers
                    try:
                        r['_probable_success'] = True
                    except Exception:
                        pass
                    return True, r

                # Clear failures: command not found indicates the reboot command wasn't available
                if 'not found' in stderr_l or rc == 127:
                    return False, r

                # Otherwise treat as failure (no clear success indication)
                return False, r

            ok, last_res = try_cmd('reboot')
            if not ok:
                # try fallbacks
                # also try forcing PATH to include sbin dirs (non-interactive ssh often has a reduced PATH)
                fallbacks = [
                    'PATH=$PATH:/sbin:/usr/sbin; reboot',
                    'bash -lc \"PATH=$PATH:/sbin:/usr/sbin; reboot\"',
                    '/sbin/reboot',
                    '/usr/sbin/reboot',
                    'systemctl reboot',
                    'shutdown -r now',
                    'busybox reboot',
                ]
                for c in fallbacks:
                    ok, last_res = try_cmd(c)
                    if ok:
                        break

            if not ok:
                # show helpful message including last stderr
                if isinstance(last_res, dict):
                    print('No se pudo enviar reboot; último stderr:', last_res.get('stderr'))
                else:
                    print('No se pudo enviar reboot; respuesta inesperada:', last_res)
                if args.auto:
                    # in auto mode, continue with checks without prompting
                    print('Auto-mode: continuando con checks sin enviar reboot')
                    entry['reboot_ok'] = True
                else:
                    cont_no_reboot = input('Continuar con los checks sin enviar reboot? [y/N]: ').strip().lower() == 'y'
                    if not cont_no_reboot:
                        print('Saltando iteración por falta de reboot enviado')
                        results['iterations'].append(entry)
                        continue
                    else:
                        print('Continuando sin reboot: ejecutando checks inmediatamente')
                        entry['reboot_ok'] = True
            else:
                entry['reboot_sent'] = True

                time.sleep(3)

                # Immediate concise reboot status before waiting for SSH
                try:
                    if ok:
                        print(color('Reboot enviado — comando aceptado (REBOOT SENT). Esperando reconexión...', 'green'))
                        entry['reboot_status_printed'] = True
                    else:
                        print(color('Reboot enviado — comando no confirmado. Esperando reconexión...', 'yellow'))
                        entry['reboot_status_printed'] = True
                except Exception:
                    print('Reboot enviado — esperando reconexión...')
                    entry['reboot_status_printed'] = True

                # wait for host to come back
                print('Esperando que SSH vuelva a estar disponible...')
                # Mejorado: bucle de espera con intentos, tiempo transcurrido y rescaneos periódicos
                retries = 40
                interval = 5
                # perform a network rescan roughly every ~30 seconds while waiting
                scan_every = max(1, 30 // interval)
                start = time.time()
                up = False
                for attempt in range(1, retries + 1):
                    attempt_res = remote.ssh_run_cmd(target_ip, user, key_path, 'echo ok', port=port, timeout=5)
                    rc = None
                    stdout = ''
                    if isinstance(attempt_res, dict):
                        rc = attempt_res.get('rc')
                        stdout = attempt_res.get('stdout') or ''
                    elapsed = int(time.time() - start)
                    mins = elapsed // 60
                    secs = elapsed % 60
                    if rc == 0 and 'ok' in stdout:
                        print(color(f"  SSH disponible después de {mins}m{secs}s (intento {attempt}/{retries})", 'green'))
                        up = True
                        break
                    else:
                        # attempt periodic rescans to locate the expected MAC/serial on a new IP
                        if attempt % scan_every == 0 and (expected_mac or (selected_install and selected_install.get('serial'))):
                            try:
                                subnet = scanner.detectar_subred_local()
                                devices = scanner.scan_network_devices(subnet)
                                new_ip = None
                                # Prefer locating by MAC when available
                                if expected_mac:
                                    for ip, mac in devices:
                                        if normalize_mac_ignore_first(mac) == normalize_mac_ignore_first(expected_mac):
                                            new_ip = ip
                                            break
                                # If not found by MAC, try locating by serial via MAC_INFO mapping
                                if not new_ip and selected_install and selected_install.get('serial'):
                                    expected_serial = str(selected_install.get('serial'))
                                    for mac, info in getattr(scanner, 'MAC_INFO', {}).items():
                                        if str(info.get('Serial Number')) == expected_serial or str(info.get('Numero de instalacion')) == expected_serial:
                                            mac_norm = normalize_mac_ignore_first(mac)
                                            for ip, mac2 in devices:
                                                if normalize_mac_ignore_first(mac2) == mac_norm:
                                                    new_ip = ip
                                                    break
                                        if new_ip:
                                            break
                                if new_ip and new_ip != target_ip:
                                    old_ip = target_ip
                                    print(color(f"\n  Dispositivo con la MAC/serial esperada encontrado en nueva IP: {new_ip}. Cambiando target_ip para los checks.", 'cyan'))
                                    entry['ip_changes'].append({'from': old_ip, 'to': new_ip, 'when': 'wait_rescan', 'reason': 'mac_or_serial_found', 'ts': int(time.time())})
                                    target_ip = new_ip
                                    # continue immediately to try SSH on the new IP
                                    continue
                            except Exception:
                                print(color('\n  No se pudo realizar rescaneo de red durante la espera.', 'yellow'))
                        # actualización en línea para feedback visual
                        print(color(f'  Esperando SSH... {mins}m{secs}s - intento {attempt}/{retries}', 'yellow'), end='\r')
                        time.sleep(interval)
                # si salió del bucle sin éxito
                if not up:
                    print('\nEl host no respondió SSH dentro del timeout')
                    results['iterations'].append(entry)
                    continue
                entry['reboot_ok'] = True

                # After SSH returned, verify device identity (MAC) in case IP changed after reboot.
                if expected_mac:
                    # try to obtain remote MAC (first non-loopback interface)
                    mac_probe = "for i in /sys/class/net/*; do [ \"$(basename $i)\" = lo ] && continue; [ -f $i/address ] && cat $i/address && break; done"
                    try:
                        mac_res = remote.ssh_run_cmd(target_ip, user, key_path, mac_probe, port=port, timeout=10)
                    except Exception:
                        mac_res = None
                    remote_mac = None
                    if isinstance(mac_res, dict) and mac_res.get('stdout'):
                        remote_mac = mac_res.get('stdout').strip().splitlines()[0].strip()

                    if remote_mac:
                        # normalize and compare ignoring first byte (same as normalization used earlier)
                        if normalize_mac_ignore_first(remote_mac) != normalize_mac_ignore_first(expected_mac):
                            print(color('Advertencia: la MAC del host accesible no coincide con la MAC esperada tras reboot.', 'yellow'))
                            print('  MAC esperada:', expected_mac, '  MAC remota:', remote_mac)
                            # rescan network to find the IP that currently holds the expected MAC
                            try:
                                subnet = scanner.detectar_subred_local()
                                devices = scanner.scan_network_devices(subnet)
                                new_ip = None
                                for ip, mac in devices:
                                    if normalize_mac_ignore_first(mac) == normalize_mac_ignore_first(expected_mac):
                                        new_ip = ip
                                        break
                                if new_ip and new_ip != target_ip:
                                    old_ip = target_ip
                                    print(color(f'Dispositivo con la MAC esperada encontrado en nueva IP: {new_ip}. Usando esa IP para los checks.', 'cyan'))
                                    entry['ip_changes'].append({'from': old_ip, 'to': new_ip, 'when': 'post_ssh_mac_rescan', 'reason': 'mac_found_after_ssh', 'ts': int(time.time())})
                                    target_ip = new_ip
                                else:
                                    print(color('No se encontró la MAC esperada en la red tras reboot; continuando con la IP actual.', 'yellow'))
                            except Exception:
                                print(color('No se pudo re-escanear la red para localizar la MAC esperada.', 'yellow'))
                        # Also try to retrieve serial from the reachable host and compare with expected serial
                        if selected_install and selected_install.get('serial'):
                            expected_serial = str(selected_install.get('serial')).strip()
                            serial_probe = "grep -i 'serial' /proc/cpuinfo 2>/dev/null || cat /etc/serial 2>/dev/null || cat /etc/serial_number 2>/dev/null || cat /proc/device-tree/serial-number 2>/dev/null || hostnamectl 2>/dev/null || true"
                            try:
                                sres = remote.ssh_run_cmd(target_ip, user, key_path, serial_probe, port=port, timeout=10)
                            except Exception:
                                sres = None
                            remote_serial = None
                            if isinstance(sres, dict) and sres.get('stdout'):
                                for L in sres.get('stdout','').splitlines():
                                    line = L.strip()
                                    # common patterns: 'Serial', 'Serial Number: XYZ', or plain value
                                    if not line:
                                        continue
                                    m = __import__('re').search(r'(serial\s*(number)?[:=\s]*)([A-Za-z0-9\-]+)', line, __import__('re').IGNORECASE)
                                    if m:
                                        remote_serial = m.group(3).strip()
                                        break
                                    # fallback: if single token line of reasonable length
                                    if len(line) <= 16 and ' ' not in line:
                                        remote_serial = line
                                        break
                            # Treat obviously invalid serials (all zeros or too short) as not present
                            def is_invalid_serial(sv: str) -> bool:
                                if not sv:
                                    return True
                                svs = sv.strip()
                                # too short to be meaningful
                                if len(svs) < 4:
                                    return True
                                # all zeros or mostly zeros
                                if svs.replace('0', '') == '':
                                    return True
                                # common placeholder serials
                                if svs in ('0000000000000000', '00000000'):
                                    return True
                                return False

                            if remote_serial and is_invalid_serial(remote_serial):
                                # ignore bogus-looking serial values
                                if args.verbose:
                                    print(color(f'Serial remoto recogido ({remote_serial}) parece inválido — ignorando.', 'yellow'))
                                remote_serial = None

                            if remote_serial:
                                if remote_serial != expected_serial:
                                    print(color('Advertencia: el serial obtenido del host no coincide con el serial esperado.', 'yellow'))
                                    print('  Serial esperado:', expected_serial, '  Serial remoto:', remote_serial)
                                    # attempt to locate expected serial by rescanning (use network_scanner mapping)
                                    try:
                                        subnet = scanner.detectar_subred_local()
                                        devices = scanner.scan_network_devices(subnet)
                                        # check known MAC_INFO mapping for expected serial
                                        new_ip = None
                                        for mac, info in getattr(scanner, 'MAC_INFO', {}).items():
                                            if str(info.get('Serial Number')) == expected_serial or str(info.get('Numero de instalacion')) == expected_serial:
                                                # find this mac in devices list
                                                mac_norm = normalize_mac_ignore_first(mac)
                                                for ip, mac2 in devices:
                                                    if normalize_mac_ignore_first(mac2) == mac_norm:
                                                        new_ip = ip
                                                        break
                                                if new_ip:
                                                    break
                                        if new_ip and new_ip != target_ip:
                                            old_ip = target_ip
                                            print(color(f'Dispositivo con el serial esperado encontrado en nueva IP: {new_ip}. Usando esa IP para los checks.', 'cyan'))
                                            entry['ip_changes'].append({'from': old_ip, 'to': new_ip, 'when': 'post_ssh_serial_rescan', 'reason': 'serial_map_found', 'ts': int(time.time())})
                                            target_ip = new_ip
                                        else:
                                            # try one more rescan after a short delay (network ARP tables may lag)
                                            try:
                                                if args.verbose:
                                                    print(color('No se encontró la IP para el serial esperado — reintentando rescan corto...', 'yellow'))
                                                time.sleep(3)
                                                devices2 = scanner.scan_network_devices(subnet)
                                                new_ip2 = None
                                                for mac, info in getattr(scanner, 'MAC_INFO', {}).items():
                                                    if str(info.get('Serial Number')) == expected_serial or str(info.get('Numero de instalacion')) == expected_serial:
                                                        mac_norm = normalize_mac_ignore_first(mac)
                                                        for ip, mac2 in devices2:
                                                            if normalize_mac_ignore_first(mac2) == mac_norm:
                                                                new_ip2 = ip
                                                                break
                                                    if new_ip2:
                                                        break
                                                if new_ip2 and new_ip2 != target_ip:
                                                    old_ip = target_ip
                                                    print(color(f'Dispositivo con el serial esperado encontrado en nueva IP (2º intento): {new_ip2}. Usando esa IP para los checks.', 'cyan'))
                                                    entry['ip_changes'].append({'from': old_ip, 'to': new_ip2, 'when': 'post_ssh_serial_rescan_2nd', 'reason': 'serial_map_found_2nd', 'ts': int(time.time())})
                                                    target_ip = new_ip2
                                                else:
                                                    print(color('No se encontró la IP para el serial esperado tras rescaneo.', 'yellow'))
                                            except Exception:
                                                print(color('No se pudo re-escanear la red para localizar el serial esperado.', 'yellow'))
                                    except Exception:
                                        print(color('No se pudo re-escanear la red para localizar el serial esperado.', 'yellow'))
        else:
            print('No se solicitó reboot; asumiendo host disponible y continuando con los checks...')
            entry['reboot_ok'] = True

        if do_reboot:
            # Use configurable wait_seconds (default 120s)
            wait_seconds = args.post_wait
            print(color(f'Host arriba — esperando {wait_seconds} segundos antes de ejecutar los checks...', 'magenta'))
            for s in range(wait_seconds, 0, -1):
                if s % 30 == 0 or s <= 5:
                    print(color(f'  Esperando {s} segundos...', 'yellow'))
                time.sleep(1)
            # Report reboot final status only if not already printed immediately
            if not entry.get('reboot_status_printed'):
                if entry.get('reboot_sent'):
                    if entry.get('reboot_ok'):
                        print('\n' + color('Reboot enviado y host respondió por SSH — REBOOT OK', 'green'))
                    else:
                        print('\n' + color('Reboot enviado pero host NO respondió por SSH — REBOOT FAIL', 'red'))
                else:
                    print('\n' + color('No se envió reboot en esta iteración', 'yellow'))
        else:
            print('No hubo reboot; ejecutando checks inmediatamente...')

        print('Ejecutando checks: systemctl --failed, list inactive y running')
        failed = remote.ssh_run_cmd(target_ip, user, key_path, 'systemctl --failed --no-pager', port=port, timeout=30)
        inactive = remote.ssh_run_cmd(target_ip, user, key_path, 'systemctl list-units --type=service --state=inactive --no-pager', port=port, timeout=30)
        running = remote.ssh_run_cmd(target_ip, user, key_path, 'systemctl list-units --type=service --state=running --no-pager', port=port, timeout=30)

        entry['post_checks'] = {'failed': failed, 'inactive': inactive, 'running': running}

        # Parse inactive output and compare against baseline
        try:
            inactive_stdout_now = inactive.get('stdout') if isinstance(inactive, dict) else ''
            current_parsed = parse_systemctl_list(inactive_stdout_now)
            current_units = set([e.get('unit') for e in current_parsed if e.get('unit')])
            entry['post_checks']['inactive_parsed'] = current_parsed

            comparison = {}
            # prepare a concise service result to show later
            service_result = None
            new_inactive = []
            if baseline_units:
                new_inactive = sorted(list(current_units - baseline_units))
                # filter out parsing artefacts (e.g., stray numbers) — keep entries that look like units
                filtered_new = [u for u in new_inactive if isinstance(u, str) and '.' in u]
                ignored_artifacts = sorted(list(set(new_inactive) - set(filtered_new)))
                if filtered_new:
                    service_result = f"KO — {len(filtered_new)} nuevos servicios inactivos"
                else:
                    service_result = 'OK — no hay nuevos servicios inactivos'

                # minimal comparison data to keep in results
                same = sorted(list(baseline_units & current_units))
                comparison = {
                    'baseline_count': len(baseline_units),
                    'current_count': len(current_units),
                    'same_count': len(same),
                    'new_inactive': filtered_new,
                }
                if ignored_artifacts:
                    comparison['ignored_artifacts'] = ignored_artifacts
            else:
                # If no baseline was obtained initially, use the first iteration's
                # inactive list as baseline so subsequent iterations can be compared.
                if it == 1:
                    baseline_units = set(current_units)
                    try:
                        outdir = os.path.join(here)
                        os.makedirs(outdir, exist_ok=True)
                        bfname = os.path.join(outdir, f'inactive_baseline_from_iter1_{int(time.time())}.json')
                        with open(bfname, 'w', encoding='utf-8') as f:
                            json.dump({'host': target_ip, 'parsed': current_parsed, 'raw': inactive_stdout_now}, f, indent=2, ensure_ascii=False)
                        print('\nBaseline no disponible inicialmente — guardada baseline tomada de esta iteración en', bfname)
                    except Exception:
                        print('\nBaseline no disponible inicialmente — tomada en memoria (no se pudo guardar en disco)')
                    comparison = {'baseline_taken_from_iteration': 1, 'baseline_count': len(baseline_units)}
                else:
                    print('\nNo hay baseline disponible para comparar')
                    comparison = {}

            entry['comparison'] = comparison

            # normalize new_inactive for downstream summary display
            new_inactive = comparison.get('new_inactive', []) if isinstance(comparison, dict) else []
            ignored_artifacts = comparison.get('ignored_artifacts', []) if isinstance(comparison, dict) else []

            # Save per-iteration comparison snapshot
            try:
                outdir = results_dir
                os.makedirs(outdir, exist_ok=True)
                fname = os.path.join(outdir, f'inactive_compare_iter{it}_{int(time.time())}.json')
                with open(fname, 'w', encoding='utf-8') as f:
                    json.dump({'host': target_ip, 'iteration': it, 'baseline_units': sorted(list(baseline_units)), 'current_units': sorted(list(current_units)), 'comparison': comparison}, f, indent=2, ensure_ascii=False)
                print(color('Snapshot de comparación guardado en', 'cyan'), fname)
            except Exception:
                fname = None
        except Exception:
            print('No se pudo parsear/comparear la lista de servicios inactivos de esta iteración')

        # Summarize iteration in a single concise line by default; show details only with --verbose
        comp = entry.get('comparison') or {}
        new = comp.get('new_inactive') or []
        ignored = comp.get('ignored_artifacts') or []

        failed_stdout = failed.get('stdout') if isinstance(failed, dict) else ''
        failed_present = False
        failed_units = []
        if not failed_stdout or '0 loaded units listed' in (failed_stdout or '').lower():
            failed_present = False
        else:
            failed_present = True
            # try to extract unit names from the `systemctl --failed` output
            for L in failed_stdout.splitlines():
                parts = L.strip().split()
                if not parts:
                    continue
                candidate = parts[0]
                if '.' in candidate:
                    failed_units.append(candidate)

        # Determine overall status
        overall_reasons = []
        if new:
            overall_reasons.append(f'{len(new)} new inactive services')
        if failed_present:
            overall_reasons.append('existing failed units')

        # Print a single-line summary for quick scanning
        if overall_reasons:
            print('\n' + color(f'Iteración {it}:', 'magenta'), color('FAIL', 'red'), '—', ', '.join(overall_reasons))
        else:
            print('\n' + color(f'Iteración {it}:', 'magenta'), color('OK', 'green'), '— no nuevos servicios inactivos y sin unidades fallidas')

        # Print snapshot path (if saved) on a second concise line
        if 'fname' in locals() and fname:
            print(color('  Snapshot:', 'cyan'), fname)

        # By default, show concise failed-unit journal for the first failed unit (helpful summary)
        if failed_present and failed_units:
            unit0 = failed_units[0]
            print(color(f'  Failed unit: {unit0} — mostrando journal (últimas líneas):', 'red'))
            try:
                journal_res = remote.ssh_run_cmd(target_ip, user, key_path, f'journalctl -u {unit0} -n 40 --no-pager', port=port, timeout=30)
            except Exception:
                journal_res = None
            if isinstance(journal_res, dict) and journal_res.get('stdout'):
                # print last lines compactly
                for L in journal_res.get('stdout','').splitlines()[-40:]:
                    print('   ', L)
            else:
                # fallback: print the systemctl --failed sample lines we captured
                for L in failed_stdout.splitlines()[:10]:
                    print('   ', L)

        # If verbose flag is set, print the detailed sections (service list and failed units)
        if args.verbose:
            # Detailed service comparison
            if new:
                print(color('  Resultado servicios: ', 'red') + f"KO — {len(new)} nuevos servicios inactivos")
                for u in new[:50]:
                    print(color('   - ' + u, 'red'))
                if ignored:
                    print(color('  Ignored parse artefacts:', 'yellow'), ', '.join(ignored))
            else:
                if 'baseline_count' in comp:
                    print(color('  Resultado servicios: ', 'green') + 'OK — no hay nuevos servicios inactivos')
                else:
                    print(color('  Resultado servicios: no disponible (sin baseline)', 'yellow'))

            # Failed units sample (full)
            if not failed_present:
                print(color('  Failed units (systemctl --failed): none', 'green'))
            else:
                print(color('  Failed units (systemctl --failed) (sample):', 'red'))
                for L in failed_stdout.splitlines()[:50]:
                    print('   ', L)
                # Also attempt to show full journal for each failed unit when verbose
                for unit in failed_units:
                    print(color(f'  Full journal for {unit}:', 'yellow'))
                    try:
                        jr = remote.ssh_run_cmd(target_ip, user, key_path, f'journalctl -u {unit} -n 200 --no-pager', port=port, timeout=60)
                    except Exception:
                        jr = None
                    if isinstance(jr, dict) and jr.get('stdout'):
                        for L in jr.get('stdout','').splitlines()[-200:]:
                            print('    ', L)
                    else:
                        print('    (no se pudo obtener journal)')

        results['iterations'].append(entry)

    # Save results (auto-mode will save automatically)
    if args.output:
        outpath = args.output
    elif args.auto:
        outpath = os.path.join(results_dir, f'remote_tests_summary_{run_ts}.json')
    else:
        outf = input('\nGuardar resultados a archivo (enter para omitir): ').strip()
        # Treat 'n' or 'no' as explicit decline to save; empty = omit
        if outf.lower() in ('n', 'no', 'none'):
            outpath = None
        else:
            outpath = outf or None

    if outpath:
        try:
            with open(outpath, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            print('Resultados guardados en', outpath)
        except Exception as e:
            print('Error guardando resultado:', e)

    # Always produce a concise table summary: CSV + Markdown for easy review
    try:
        ts = int(time.time())
        csv_path = os.path.join(results_dir, f'inactive_summary_{ts}.csv')
        md_path = os.path.join(results_dir, f'inactive_summary_{ts}.md')
        with open(csv_path, 'w', encoding='utf-8', newline='') as cf:
            writer = csv.writer(cf)
            writer.writerow(['iteration', 'reboot_sent', 'reboot_ok', 'new_inactive_count', 'new_inactives'])
            for it in results.get('iterations', []):
                new = []
                comp = it.get('comparison') or {}
                new = comp.get('new_inactive') or []
                writer.writerow([it.get('iteration'), it.get('reboot_sent'), it.get('reboot_ok'), len(new), ';'.join(new)])

        # Markdown table
        with open(md_path, 'w', encoding='utf-8') as mf:
            mf.write('| Iteration | Reboot Sent | Reboot OK | New Inactive Count | New Inactives |\n')
            mf.write('|---:|:---:|:---:|---:|---:|\n')
            for it in results.get('iterations', []):
                new = []
                comp = it.get('comparison') or {}
                new = comp.get('new_inactive') or []
                mf.write(f"| {it.get('iteration')} | {it.get('reboot_sent')} | {it.get('reboot_ok')} | {len(new)} | {', '.join(new)} |\n")

        print('Resumen guardado en:', csv_path, md_path)
    except Exception:
        print('No se pudo generar el resumen de tabla')

    print('\nWizard finalizado')


if __name__ == '__main__':
    main()
