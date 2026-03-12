#!/usr/bin/env python3
"""Reboot a CU and verify services after boot.

Usage examples:
  python reboot_and_check.py --host 192.168.1.155
  python reboot_and_check.py --serial 26QXL99B

This script uses `remote_client.ssh_run_cmd` and `wait_for_ssh` to send reboot,
wait for the node to come back and then run systemctl checks.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import time
import contextlib
import importlib.util


def load_network_scanner(module_path: str):
    spec = importlib.util.spec_from_file_location('network_scanner', module_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


from remote_client import ssh_run_cmd, wait_for_ssh


def find_ip_for_serial(scanner_mod, serial: str):
    for mac, info in getattr(scanner_mod, 'MAC_INFO', {}).items():
        if info.get('Serial Number') == serial or str(info.get('Numero de instalacion')) == str(serial):
            # call scanner's helper
            return scanner_mod.find_ip_from_mac(mac, scanner_mod.detectar_subred_local())
    return None


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--host', help='Direct host IP')
    ap.add_argument('--serial', help='Serial from MAC_INFO')
    ap.add_argument('--key', default=os.path.join(os.path.dirname(__file__), 'cu_devkey_private'))
    ap.add_argument('--user', default='root')
    ap.add_argument('--port', type=int, default=22)
    ap.add_argument('--wait-timeout', type=int, default=10)
    ap.add_argument('--wait-retries', type=int, default=40)
    ap.add_argument('--wait-interval', type=int, default=5)
    ap.add_argument('--no-reboot', action='store_true', help='Do not actually reboot, just run post-checks')
    ap.add_argument('--export', help='Write JSON results to file')
    args = ap.parse_args(argv)

    scanner_path = os.path.join(os.path.dirname(__file__), '..', 'network_scanner.py')
    scanner = load_network_scanner(scanner_path)

    host = args.host
    if not host and args.serial:
        host = find_ip_for_serial(scanner, args.serial)

    if not host:
        print('No host resolved for given input', file=sys.stderr)
        return 2

    result = {'host': host, 'reboot_sent': False, 'reboot_ok': False, 'post_checks': {}}

    if not args.no_reboot:
        print('Sending reboot to', host)
        r = ssh_run_cmd(host, args.user, args.key, 'reboot', port=args.port, timeout=10)
        if isinstance(r, dict) and r.get('error'):
            print('Error sending reboot:', r.get('error'))
        else:
            result['reboot_sent'] = True

    # Now wait for the host to go down and come back up
    print('Waiting for SSH to become unavailable (host rebooting)...')
    # simple sleep to allow command to execute
    time.sleep(3)

    # wait until ssh fails (down) - attempt a few times quickly
    down_count = 0
    for _ in range(8):
        resp = ssh_run_cmd(host, args.user, args.key, 'echo ping', port=args.port, timeout=5)
        if isinstance(resp, dict) and resp.get('rc') != 0:
            down_count += 1
            break
        time.sleep(1)

    print('Waiting for SSH to become available (post-reboot)...')
    up = wait_for_ssh(host, args.user, args.key, port=args.port, timeout=args.wait_timeout, retries=args.wait_retries, interval=args.wait_interval)
    result['reboot_ok'] = bool(up)

    if not up:
        print('Host did not come back up within timeout')
        if args.export:
            with open(args.export, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
        return 3

    # Run post-checks
    print('Running post-boot service checks...')
    failed = ssh_run_cmd(host, args.user, args.key, "systemctl --failed --no-pager", port=args.port, timeout=30)
    inactive = ssh_run_cmd(host, args.user, args.key, "systemctl list-units --type=service --state=inactive --no-pager", port=args.port, timeout=30)
    running = ssh_run_cmd(host, args.user, args.key, "systemctl list-units --type=service --state=running --no-pager", port=args.port, timeout=30)

    result['post_checks']['failed'] = failed
    result['post_checks']['inactive'] = inactive
    result['post_checks']['running'] = running

    # Print a brief summary
    print('\nSummary for', host)
    if isinstance(failed, dict) and failed.get('stdout'):
        print('Failed units:\n', failed.get('stdout'))
    else:
        print('No failed units or could not read failed units output')

    if isinstance(inactive, dict) and inactive.get('stdout'):
        print('\nSome inactive services (sample):')
        lines = inactive.get('stdout').splitlines()
        for L in lines[:20]:
            print(' ', L)

    if args.export:
        try:
            with open(args.export, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print('Results exported to', args.export)
        except Exception as e:
            print('Could not write export:', e)

    return 0


if __name__ == '__main__':
    sys.exit(main())
