#!/usr/bin/env python3
"""Find CU IP (by MAC/serial) and run CheckVersion.sh via SSH.

Usage examples:
  # Find by MAC and run check script using key file
  python check_cu_and_version.py --mac 00:23:c1:2d:d9:1c --key "Proyectos/cu_devkey_private"

  # Find by serial saved in network_scanner.MAC_INFO
  python check_cu_and_version.py --serial 26QXL99B --key "Proyectos/cu_devkey_private"

  # Direct host
  python check_cu_and_version.py --host 192.168.1.155 --key "Proyectos/cu_devkey_private"

The script prefers Paramiko; falls back to system ssh with rsa options if needed.
Prints JSON with results for each target.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import re
import os
import shlex
import subprocess
import sys
import contextlib
from typing import Optional, List, Tuple


def load_network_scanner(module_path: str):
    spec = importlib.util.spec_from_file_location('network_scanner', module_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def find_ip_for_mac(scanner_mod, mac: str, subnet: Optional[str] = None) -> Optional[str]:
    # normalize mac
    if not subnet:
        subnet = scanner_mod.detectar_subred_local()
    return scanner_mod.find_ip_from_mac(mac, subnet)


def find_ip_for_serial(scanner_mod, serial: str) -> Optional[Tuple[str, str]]:
    # Look up MAC_INFO for serial -> mac, then find ip
    for mac, info in getattr(scanner_mod, 'MAC_INFO', {}).items():
        if info.get('Serial Number') == serial or info.get('Numero de instalacion') == serial:
            ip = find_ip_for_mac(scanner_mod, mac, scanner_mod.detectar_subred_local())
            return (ip, mac)
    return None


def run_paramiko_cmd(host: str, user: str, port: int, key_path: Optional[str], passphrase: Optional[str], use_agent: bool, remote_cmd: str, timeout: int = 20):
    try:
        import paramiko
    except Exception:
        return {'error': 'paramiko-missing'}

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        pkey = None
        if key_path:
            # Let paramiko handle key file detection
            pass

        client.connect(hostname=host, port=port, username=user, key_filename=key_path, allow_agent=use_agent, look_for_keys=use_agent, timeout=timeout)
        stdin, stdout, stderr = client.exec_command(remote_cmd, timeout=timeout)
        out = stdout.read().decode('utf-8', errors='ignore').strip()
        err = stderr.read().decode('utf-8', errors='ignore').strip()
        rc = stdout.channel.recv_exit_status()
        client.close()
        return {'rc': rc, 'stdout': out, 'stderr': err}
    except Exception as e:
        try:
            client.close()
        except Exception:
            pass
        return {'error': str(e)}


def run_ssh_subprocess(host: str, user: str, port: int, key_path: Optional[str], use_agent: bool, remote_cmd: str, timeout: int = 20):
    # Build ssh command with rsa accept options to support older devices
    opts = [
        '-o', 'HostKeyAlgorithms=+ssh-rsa',
        '-o', 'PubkeyAcceptedKeyTypes=+ssh-rsa',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=NUL'
    ]
    cmd = ['ssh'] + opts + ['-p', str(port)]
    if key_path:
        cmd += ['-i', key_path]
    cmd += [f'{user}@{host}', remote_cmd]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {'rc': out.returncode, 'stdout': out.stdout.strip(), 'stderr': out.stderr.strip()}
    except Exception as e:
        return {'error': str(e)}


def main(argv=None):
    ap = argparse.ArgumentParser(description='Find CU IP and run CheckVersion.sh')
    ap.add_argument('--host', help='Direct host IP')
    ap.add_argument('--mac', help='MAC address to search (AA:BB:CC:DD:EE:FF)')
    ap.add_argument('--serial', help='Serial number as in MAC_INFO')
    ap.add_argument('--key', help='Path to private key file', default=os.path.join(os.path.dirname(__file__), 'cu_devkey_private'))
    ap.add_argument('--user', default='root')
    ap.add_argument('--port', type=int, default=22)
    ap.add_argument('--use-agent', action='store_true')
    ap.add_argument('--verbose', action='store_true', help='Show detailed scanner output (disabled by default)')
    # Remote commands embedded in code (no need to pass at runtime)
    # The script will try these in order and use the first that returns output.
    REMOTE_CMDS = ['checkVersion.sh']
    # Command to list nodes from the CU sqlite DB and busctl (runs on the CU)
    NODE_LIST_CMD = r'''db=/mnt/extra/vsdb_cu.sqlite3; fmt="%-10s %-6s %-12s %-10s %-8s %-9s %-18s
"; printf "$fmt" sn zone config_label fw hw is_active location; sqlite3 -noheader -batch "$db" "SELECT label AS sn, COALESCE(zone,''), COALESCE(config_label,''), COALESCE(is_active,0), COALESCE(location,'') FROM devices ORDER BY sn;" | while IFS='|' read -r sn zone cfg active location; do fw=$(busctl call com.verisure.cuxs-core /node com.verisure.Node GetNodeFirmwareVersion s "$sn" 2>/dev/null | awk -F'"' '{print $2}'); hw=$(busctl call com.verisure.cuxs-core /node com.verisure.Node GetNodeHardwareVersion s "$sn" 2>/dev/null | awk -F'"' '{print $2}'); printf "$fmt" "$sn" "$zone" "$cfg" "$fw" "$hw" "$active" "$location"; done; echo'''
    ap.add_argument('--timeout', type=int, default=20)
    ap.add_argument('--show-tag-only', action='store_true', help='Print only TAG_VERSION per host')
    ap.add_argument('--pretty', action='store_true', help='Print a pretty table of Host, Serial, Installation, TAG_VERSION')
    ap.add_argument('--export', help='Write full results to JSON file')
    args = ap.parse_args(argv)

    # If the script is executed without flags (no host/mac/serial and no output flags),
    # default to pretty output so it can be run directly.
    if not any([args.host, args.mac, args.serial, args.pretty, args.show_tag_only, args.export, args.verbose]):
        args.pretty = True

    scanner_path = os.path.join(os.path.dirname(__file__), 'network_scanner.py')
    scanner = load_network_scanner(scanner_path)

    targets = []
    if args.host:
        targets.append({'host': args.host, 'mac': None})
    elif args.mac:
        if args.verbose:
            ip = find_ip_for_mac(scanner, args.mac)
        else:
            devnull = open(os.devnull, 'w')
            with contextlib.redirect_stdout(devnull), contextlib.redirect_stderr(devnull):
                ip = find_ip_for_mac(scanner, args.mac)
            devnull.close()
        targets.append({'host': ip, 'mac': args.mac})
    elif args.serial:
        found = find_ip_for_serial(scanner, args.serial)
        if found:
            ip, mac = found
            targets.append({'host': ip, 'mac': mac})
        else:
            print(json.dumps({'error': 'serial-not-found'}))
            return 2
    else:
        # Use only stored serials/MACs in network_scanner.MAC_INFO
        for mac, info in getattr(scanner, 'MAC_INFO', {}).items():
            # find_ip_for_mac (and the scanner) prints a lot; silence unless verbose
            if args.verbose:
                ip = find_ip_for_mac(scanner, mac)
            else:
                devnull = open(os.devnull, 'w')
                with contextlib.redirect_stdout(devnull), contextlib.redirect_stderr(devnull):
                    ip = find_ip_for_mac(scanner, mac)
                devnull.close()
            targets.append({'host': ip, 'mac': mac, 'serial': info.get('Serial Number'), 'installation': info.get('Numero de instalacion')})

    results = []
    for t in targets:
        host = t.get('host')
        if not host:
            results.append({'host': None, 'error': 'ip-not-found', 'mac': t.get('mac'), 'serial': t.get('serial')})
            continue

        # Try embedded remote commands in order and stop at first successful output
        cmd_result = None
        for remote_cmd in REMOTE_CMDS:
            res = run_paramiko_cmd(host, args.user, args.port, args.key, None, args.use_agent, remote_cmd, timeout=args.timeout)
            if isinstance(res, dict) and res.get('error') == 'paramiko-missing':
                # fallback to ssh subprocess
                res2 = run_ssh_subprocess(host, args.user, args.port, args.key, args.use_agent, remote_cmd, timeout=args.timeout)
                if res2.get('stdout'):
                    cmd_result = {'host': host, 'mac': t.get('mac'), 'method': 'ssh-subprocess', 'command': remote_cmd, 'result': res2}
                    break
                continue

            if isinstance(res, dict) and res.get('error'):
                # try ssh subprocess as fallback
                res2 = run_ssh_subprocess(host, args.user, args.port, args.key, args.use_agent, remote_cmd, timeout=args.timeout)
                if res2.get('stdout'):
                    cmd_result = {'host': host, 'mac': t.get('mac'), 'method': 'ssh-subprocess', 'command': remote_cmd, 'result': res2}
                    break
                else:
                    continue

            # Paramiko succeeded; check output
            if res.get('stdout'):
                cmd_result = {'host': host, 'mac': t.get('mac'), 'method': 'paramiko', 'command': remote_cmd, 'result': res}
                break

        if not cmd_result:
            results.append({'host': host, 'mac': t.get('mac'), 'serial': t.get('serial'), 'error': 'no-command-output'})
        else:
            # parse TAG_VERSION from stdout if present
            stdout_text = ''
            if isinstance(cmd_result.get('result'), dict):
                stdout_text = cmd_result['result'].get('stdout', '') or ''
            elif isinstance(cmd_result.get('result'), str):
                stdout_text = cmd_result['result']

            tag = None
            m = re.search(r'TAG_VERSION\s*=\s*"?([^"\n]+)"?', stdout_text)
            if m:
                tag = m.group(1).strip()
                cmd_result.setdefault('parsed', {})['TAG_VERSION'] = tag

            if 'serial' in t:
                cmd_result['serial'] = t.get('serial')
                cmd_result['installation'] = t.get('installation')
            # After successful checkVersion, try to collect node list from the CU
            nodes_out = None
            nodes_parsed = []
            try:
                # Try paramiko first
                nres = run_paramiko_cmd(host, args.user, args.port, args.key, None, args.use_agent, NODE_LIST_CMD, timeout=max(30, args.timeout))
                if isinstance(nres, dict) and nres.get('error') == 'paramiko-missing':
                    nres2 = run_ssh_subprocess(host, args.user, args.port, args.key, args.use_agent, NODE_LIST_CMD, timeout=max(30, args.timeout))
                    if nres2.get('stdout'):
                        nodes_out = nres2.get('stdout','')
                elif isinstance(nres, dict) and nres.get('error'):
                    nres2 = run_ssh_subprocess(host, args.user, args.port, args.key, args.use_agent, NODE_LIST_CMD, timeout=max(30, args.timeout))
                    if nres2.get('stdout'):
                        nodes_out = nres2.get('stdout','')
                else:
                    if nres.get('stdout'):
                        nodes_out = nres.get('stdout','')
            except Exception:
                nodes_out = None

            if nodes_out:
                # parse lines into columns (maxsplit=6 to preserve location)
                for line in nodes_out.splitlines():
                    if not line.strip():
                        continue
                    parts = line.split(None, 6)
                    if len(parts) < 7:
                        # skip header-like or malformed lines
                        continue
                    sn, zone, cfg, fw, hw, active, location = parts
                    # Skip header lines emitted by the remote command (e.g. a leading 'sn zone ...')
                    if str(sn).strip().lower() == 'sn':
                        continue
                    nodes_parsed.append({
                        'sn': sn, 'zone': zone, 'config_label': cfg,
                        'fw': fw, 'hw': hw, 'is_active': active, 'location': location
                    })
                cmd_result['nodes_raw'] = nodes_out
                cmd_result['nodes'] = nodes_parsed

            results.append(cmd_result)

    output = {'targets': results}
    if args.export:
        try:
            with open(args.export, 'w', encoding='utf-8') as f:
                json.dump(output, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[warn] Could not write export file: {e}", file=sys.stderr)

    if args.show_tag_only:
        # Print one line per target: host serial installation TAG_VERSION
        for t in results:
            host = t.get('host')
            serial = t.get('serial')
            inst = t.get('installation')
            tag = None
            if isinstance(t.get('parsed'), dict):
                tag = t['parsed'].get('TAG_VERSION')
            # fallback: try to parse from result stdout
            if not tag and isinstance(t.get('result'), dict):
                s = t['result'].get('stdout','')
                mm = re.search(r'TAG_VERSION\s*=\s*"?([^"\n]+)"?', s)
                if mm:
                    tag = mm.group(1).strip()
            print(f"{host or '-'}\t{serial or '-'}\t{inst or '-'}\t{tag or ''}")
    else:
        # If pretty requested, print aligned table with selected fields
        if args.pretty:
            cols = ["Host", "Serial", "Installation", "TAG_VERSION"]
            widths = [18, 14, 14, 12]
            header = f"{cols[0]:<{widths[0]}} {cols[1]:<{widths[1]}} {cols[2]:<{widths[2]}} {cols[3]:<{widths[3]}}"
            print(header)
            print('-' * (sum(widths) + 3))
            for t in results:
                host = t.get('host') or '-'
                serial = t.get('serial') or '-'
                inst = str(t.get('installation') or '-')
                tag = None
                if isinstance(t.get('parsed'), dict):
                    tag = t['parsed'].get('TAG_VERSION')
                if not tag and isinstance(t.get('result'), dict):
                    s = t['result'].get('stdout','')
                    mm = re.search(r'TAG_VERSION\s*=\s*"?([^"\n]+)"?', s)
                    if mm:
                        tag = mm.group(1).strip()
                tag = tag or '-'
                print(f"{host:<{widths[0]}} {serial:<{widths[1]}} {inst:<{widths[2]}} {tag:<{widths[3]}}")
            # After printing versions table, also print nodes table per host if present
            for t in results:
                host = t.get('host')
                nodes = t.get('nodes')
                if not nodes:
                    continue
                print('\nNodes for host: %s' % (host or '-'))
                ncols = ["sn", "zone", "config_label", "fw", "hw", "is_active", "location"]
                nwidths = [10, 6, 12, 10, 8, 9, 18]
                nheader = f"{ncols[0]:<{nwidths[0]}} {ncols[1]:<{nwidths[1]}} {ncols[2]:<{nwidths[2]}} {ncols[3]:<{nwidths[3]}} {ncols[4]:<{nwidths[4]}} {ncols[5]:<{nwidths[5]}} {ncols[6]:<{nwidths[6]}}"
                print(nheader)
                print('-' * (sum(nwidths) + 6))
                for n in nodes:
                    print(f"{n.get('sn',''):<{nwidths[0]}} {n.get('zone',''):<{nwidths[1]}} {n.get('config_label',''):<{nwidths[2]}} {n.get('fw',''):<{nwidths[3]}} {n.get('hw',''):<{nwidths[4]}} {n.get('is_active',''):<{nwidths[5]}} {n.get('location',''):<{nwidths[6]}}")
        else:
            print(json.dumps(output, indent=2))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print('\nInterrupted')
        sys.exit(1)
