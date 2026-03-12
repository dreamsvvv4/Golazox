#!/usr/bin/env python3
"""Minimal SSH helper used by remote tests.

Provides `ssh_run_cmd` (uses system ssh) and `wait_for_ssh` helper.
"""
import subprocess
from typing import Optional


SSH_BASE_OPTS = [
    '-o', 'HostKeyAlgorithms=+ssh-rsa',
    '-o', 'PubkeyAcceptedKeyTypes=+ssh-rsa',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=NUL'
]


def ssh_run_cmd(host: str, user: str, key_path: Optional[str], remote_cmd: str, port: int = 22, timeout: int = 20):
    cmd = ['ssh'] + SSH_BASE_OPTS + ['-p', str(port)]
    if key_path:
        cmd += ['-i', key_path]
    cmd += [f"{user}@{host}", remote_cmd]
    try:
        # Force UTF-8 decoding and replace undecodable bytes to avoid
        # UnicodeDecodeError on Windows terminals with cp1252 locale.
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
        stdout = proc.stdout.strip() if proc.stdout is not None else ''
        stderr = proc.stderr.strip() if proc.stderr is not None else ''
        return {'rc': proc.returncode, 'stdout': stdout, 'stderr': stderr}
    except Exception as e:
        return {'error': str(e)}


def wait_for_ssh(host: str, user: str, key_path: Optional[str], port: int = 22, timeout: int = 10, retries: int = 30, interval: int = 5):
    """Wait until ssh to host responds to a simple echo command.

    Returns True when ssh succeeds, False if timeout.
    """
    import time
    for attempt in range(retries):
        res = ssh_run_cmd(host, user, key_path, "echo ok", port=port, timeout=timeout)
        if isinstance(res, dict) and res.get('rc') == 0 and 'ok' in (res.get('stdout') or ''):
            return True
        time.sleep(interval)
    return False
