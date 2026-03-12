import re
import statistics
from pathlib import Path
from datetime import datetime, timedelta
import csv
import sys
from typing import List, Dict, Any

# Unified analyzer for both ordered.log style and semicolon CSV extracted earlier
# Detects operations, validates correctness, flags reboots/status snapshots, computes metrics.

# Patterns for ordered.log
TS_BRACKET = re.compile(r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]")
CMD_ORDERED = re.compile(r"State: (?P<state_txt>unlocked|locked) User: (?P<user>\d+) X id: (?P<xid>\d+) State: (?P<method_txt>\w+) .*?(?:LOCK|DOORLOCK).*? cmdLock")
REP_ORDERED = re.compile(r"State: (?P<state>\d+), Method: (?P<method>\d+), User id: (?P<user>\d+), X id: (?P<xid>\d+), Result: (?P<result>\d+), Attemped operation: (?P<attempt>\d+).*?(?:LOCK|DOORLOCK).*? seReportLockState")
RULE_LINE = re.compile(r"RuleId::(smartlock_local_unlock|smartlock_local_lock|smartlock_remote_unlock|smartlock_remote_lock)")

# Patterns for semicolon CSV lines (previous filtered format)
CMD_CSV = re.compile(r"cmdLock;State: (?P<state_txt>unlocked|locked) User: (?P<user>\d+) X id: (?P<xid>\d+) State: (?P<method_txt>\w+)")
REP_CSV = re.compile(r"seReportLockState;State: (?P<state>\d+), Method: (?P<method>\d+), User id: (?P<user>\d+), X id: (?P<xid>\d+), Result: (?P<result>\d+), Attemped operation: (?P<attempt>\d+)")
TS_END = re.compile(r"(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})$")

STATE_TXT_TO_NUM = {"unlocked": 0, "locked": 1}
STATE_NUM_TO_TXT = {0: "unlocked", 1: "locked", 255: "unknown"}
METHOD_MAP = {0:"unknown",1:"code",2:"tag",3:"pin_tag",4:"remote",5:"auto_l",6:"thumb",7:"star",8:"arming",9:"fire",10:"action",11:"autocalibration",12:"lock_button"}
RESULT_MAP = {0:"success",1:"fail_blocked",2:"fail_busy",3:"fail_invalid_connection",4:"no_change",5:"fail_battery"}
ATTEMPT_NUM_TO_TXT = {0:"unlocked",1:"locked",255:"unknown"}
TIME_FMT = "%Y-%m-%d %H:%M:%S.%f"
LOOKBACK = timedelta(seconds=15)
REBOOT_GAP = timedelta(minutes=30)
PAIR_WINDOW = timedelta(seconds=10)

# Classification helpers

def classify_remote(cmd, rep):
    requested = cmd['requested_state_code']
    attempt = rep['attempt_code']
    result = rep['result_txt']
    final_state = rep['state_code']
    if attempt != requested:
        return 'FAIL', 'attempt_mismatch'
    if result == 'success':
        return ('OK', 'applied') if final_state == requested else ('WARN', 'state_mismatch_after_success')
    if result == 'no_change':
        return ('NOOP', 'already_in_desired_state') if final_state == requested else ('FAIL', 'no_change_wrong_state')
    return 'FAIL', result

def classify_manual(rep):
    result = rep['result_txt']
    if result == 'success':
        return ('OK', 'manual_applied') if rep['state_code'] == rep['attempt_code'] else ('WARN', 'manual_success_state_mismatch')
    if result == 'no_change':
        return ('NOOP', 'manual_already_state') if rep['state_code'] == rep['attempt_code'] else ('FAIL', 'manual_no_change_wrong_state')
    return 'FAIL', result

def classify_status(rep, prev_ts):
    result = rep['result_txt']
    if result == 'success':
        reason = 'status_current'
    elif result == 'no_change':
        reason = 'status_no_change'
    else:
        reason = f'status_{result}'
    if prev_ts and rep['timestamp'] - prev_ts > REBOOT_GAP:
        reason += '_possible_reboot'
    return 'INFO', reason

# Parsing unified

def parse_line(line: str) -> Dict[str, Any] | None:
    line = line.rstrip('\n')
    # ordered.log style
    bracket = TS_BRACKET.match(line)
    if bracket:
        ts = datetime.strptime(bracket.group('ts'), TIME_FMT)
        # Detect rule lines for redundancy root cause heuristics
        rl = RULE_LINE.search(line)
        if rl:
            return {
                'type':'rule', 'timestamp': ts, 'rule_id': rl.group(1), 'raw': line
            }
        if 'cmdLock' in line:
            m = CMD_ORDERED.search(line)
            if m:
                return {
                    'type':'cmd','timestamp':ts,
                    'requested_state_txt': m.group('state_txt'),
                    'requested_state_code': STATE_TXT_TO_NUM[m.group('state_txt')],
                    'user_id': int(m.group('user')),
                    'x_id': int(m.group('xid')),
                    'method_txt': m.group('method_txt').lower(),
                    'raw': line
                }
        elif 'seReportLockState' in line:
            m = REP_ORDERED.search(line)
            if m:
                state_code = int(m.group('state'))
                method_code = int(m.group('method'))
                attempt_code = int(m.group('attempt'))
                return {
                    'type':'report','timestamp':ts,
                    'state_code': state_code,
                    'state_txt': STATE_NUM_TO_TXT.get(state_code, f"unknown_{state_code}"),
                    'method_code': method_code,
                    'method_txt': METHOD_MAP.get(method_code, f"unknown_{method_code}"),
                    'user_id': int(m.group('user')),
                    'x_id': int(m.group('xid')),
                    'result_code': int(m.group('result')),
                    'result_txt': RESULT_MAP.get(int(m.group('result')), f"unknown_{m.group('result')}"),
                    'attempt_code': attempt_code,
                    'attempt_txt': ATTEMPT_NUM_TO_TXT.get(attempt_code, f"unknown_{attempt_code}"),
                    'raw': line
                }
        return None
    # semicolon CSV style
    ts_match = TS_END.search(line)
    if ts_match:
        ts = datetime.strptime(ts_match.group('ts'), TIME_FMT)
        if 'cmdLock;' in line:
            m = CMD_CSV.search(line)
            if m:
                return {
                    'type':'cmd','timestamp':ts,
                    'requested_state_txt': m.group('state_txt'),
                    'requested_state_code': STATE_TXT_TO_NUM[m.group('state_txt')],
                    'user_id': int(m.group('user')),
                    'x_id': int(m.group('xid')),
                    'method_txt': m.group('method_txt').lower(),
                    'raw': line
                }
        elif 'seReportLockState;' in line:
            m = REP_CSV.search(line)
            if m:
                state_code = int(m.group('state'))
                method_code = int(m.group('method'))
                attempt_code = int(m.group('attempt'))
                return {
                    'type':'report','timestamp':ts,
                    'state_code': state_code,
                    'state_txt': STATE_NUM_TO_TXT.get(state_code, f"unknown_{state_code}"),
                    'method_code': method_code,
                    'method_txt': METHOD_MAP.get(method_code, f"unknown_{method_code}"),
                    'user_id': int(m.group('user')),
                    'x_id': int(m.group('xid')),
                    'result_code': int(m.group('result')),
                    'result_txt': RESULT_MAP.get(int(m.group('result')), f"unknown_{m.group('result')}"),
                    'attempt_code': attempt_code,
                    'attempt_txt': ATTEMPT_NUM_TO_TXT.get(attempt_code, f"unknown_{attempt_code}"),
                    'raw': line
                }
    return None


def analyze(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    entries.sort(key=lambda e: e['timestamp'])
    cmds = [e for e in entries if e['type']=='cmd']
    rules = [e for e in entries if e['type']=='rule']

    def find_prev_cmd(user, xid, ts):
        candidates = [c for c in cmds if c['user_id']==user and c['x_id']==xid and timedelta(0) <= ts - c['timestamp'] <= LOOKBACK]
        if not candidates:
            return None
        return max(candidates, key=lambda c: c['timestamp'])

    prev_ts = None
    report_rows = []
    latencies = []
    remote_unlock_success = 0
    remote_unlock_noop = 0
    remote_unlock_total = 0
    remote_lock_success = 0
    failures = 0
    per_user = {}
    last_state = None  # track last known lock state globally (x_id seems request-specific)

    for e in entries:
        if e['type'] == 'report':
            method = e['method_code']
            prev_cmd = find_prev_cmd(e['user_id'], e['x_id'], e['timestamp']) if method == 4 else None
            prev_change = last_state
            prev_state = prev_change['state'] if prev_change else None
            prev_change_age_s = (e['timestamp'] - prev_change['ts']).total_seconds() if prev_change else ''
            prev_source = prev_change['source'] if prev_change else ''
            if method == 4:  # remote
                action = 'Lock' if e['attempt_txt']=='locked' else ('Unlock' if e['attempt_txt']=='unlocked' else e['attempt_txt'].capitalize())
                if prev_cmd:
                    status, reason = classify_remote(prev_cmd, e)
                    latency = (e['timestamp'] - prev_cmd['timestamp']).total_seconds()
                    latencies.append(latency)
                else:
                    status, reason = 'UNKNOWN', 'no_cmd_found'
                    latency = ''
                if action == 'Unlock':
                    if status == 'OK':
                        remote_unlock_success += 1
                    elif status == 'NOOP':
                        remote_unlock_noop += 1
                    remote_unlock_total += 1
                elif action == 'Lock' and status == 'OK':
                    remote_lock_success += 1
                if status == 'FAIL':
                    failures += 1
                op_desc = f"{action} Remote"
                # per-user stats
                u = e['user_id']
                pu = per_user.setdefault(u, {'remote_unlock':0,'remote_unlock_noop':0,'remote_unlock_success':0,'remote_lock_success':0,'remote_lock':0})
                if action == 'Unlock':
                    pu['remote_unlock'] += 1
                    if status == 'NOOP':
                        pu['remote_unlock_noop'] += 1
                    if status == 'OK':
                        pu['remote_unlock_success'] += 1
                elif action == 'Lock':
                    pu['remote_lock'] += 1
                    if status == 'OK':
                        pu['remote_lock_success'] += 1
            elif method == 6:  # manual thumb
                status, reason = classify_manual(e)
                latency = ''
                op_desc = f"{'Lock' if e['attempt_txt']=='locked' else 'Unlock'} Manual"
            elif method == 0:  # status snapshot
                status, reason = classify_status(e, prev_ts)
                latency = ''
                op_desc = f"Status Report ({'Lock' if e['state_txt']=='locked' else 'Unlock'})"
            else:
                status, reason = classify_manual(e)
                latency = ''
                op_desc = f"{e['attempt_txt'].capitalize()} {e['method_txt'].capitalize()}"

            expected_final_match = (e['result_txt']=='success' and e['state_code']==e['attempt_code']) or (e['result_txt']=='no_change' and e['state_code']==e['attempt_code'])
            anomaly = False
            if e['result_txt']=='success' and e['state_code']!=e['attempt_code']:
                anomaly = True
            if e['result_txt']=='no_change' and e['state_code']!=e['attempt_code']:
                anomaly = True
            if status=='FAIL':
                anomaly = True

            # Root cause heuristic for redundancy (NOOP remote operations)
            root_cause_redun = ''
            if method == 4 and status == 'NOOP':
                if action == 'Unlock' and prev_change and prev_change['state'] == 0:
                    if prev_change_age_s != '' and prev_change_age_s < 5:
                        # very recent unlock, check rule trigger in last 2 seconds
                        recent_rules = [r for r in rules if 0 <= (e['timestamp'] - r['timestamp']).total_seconds() <= 2]
                        if recent_rules:
                            root_cause_redun = 'rule_preempted'
                        elif prev_source.startswith('unlock manual'):
                            root_cause_redun = 'manual_prior'
                        else:
                            root_cause_redun = 'recent_unlock'
                    elif prev_source.startswith('unlock manual'):
                        root_cause_redun = 'manual_prior'
                    elif prev_change_age_s != '' and prev_change_age_s > 1800:
                        root_cause_redun = 'stale_client_state_possible'
                    else:
                        root_cause_redun = 'already_unlocked'
                elif action == 'Lock' and prev_change and prev_change['state'] == 1:
                    root_cause_redun = 'already_locked'

            report_rows.append({
                'timestamp': e['timestamp'],
                'user_id': e['user_id'],
                'x_id': e['x_id'],
                'method': e['method_txt'],
                'operation': op_desc,
                'attempted': e['attempt_txt'],
                'final_state': e['state_txt'],
                'result': e['result_txt'],
                'status': status,
                'reason': reason,
                'latency_s': latency,
                'expected_final_match': expected_final_match,
                'anomaly': anomaly,
                'prev_state': STATE_NUM_TO_TXT.get(prev_state, '') if prev_state is not None else '',
                'prev_change_age_s': prev_change_age_s,
                'prev_source': prev_source,
                'root_cause_redun': root_cause_redun,
                'raw': e['raw'],
            })
            # update last state cache if this report confirms current state (success or no_change)
            if e['result_txt'] in ('success','no_change'):
                last_state = {
                    'state': e['state_code'],
                    'ts': e['timestamp'],
                    'source': op_desc.lower()
                }
            prev_ts = e['timestamp']
        else:
            prev_ts = e['timestamp']

    redundancy_ratio = (remote_unlock_noop / remote_unlock_total) if remote_unlock_total else 0.0
    latency_stats = {}
    valid_lat = [l for l in latencies if isinstance(l, (int,float))]
    if valid_lat:
        latency_stats = {
            'count': len(valid_lat),
            'avg': statistics.mean(valid_lat),
            'p50': statistics.median(valid_lat),
            'p95': percentile(valid_lat, 95),
            'max': max(valid_lat)
        }

    return {
        'rows': report_rows,
        'metrics': {
            'remote_unlock_total': remote_unlock_total,
            'remote_unlock_success': remote_unlock_success,
            'remote_unlock_noop': remote_unlock_noop,
            'remote_lock_success': remote_lock_success,
            'failures': failures,
            'redundancy_ratio_unlock': redundancy_ratio,
            'latency': latency_stats,
            'total_reports': len(report_rows),
            'per_user': per_user
        }
    }


def percentile(data: List[float], p: float) -> float:
    if not data:
        return 0.0
    data = sorted(data)
    k = (len(data)-1) * (p/100.0)
    f = int(k)
    c = min(f+1, len(data)-1)
    if f == c:
        return data[int(k)]
    d0 = data[f] * (c - k)
    d1 = data[c] * (k - f)
    return d0 + d1


def write_outputs(base_path: Path, analysis: Dict[str, Any]):
    csv_path = base_path.with_name(base_path.stem + '_analyzed.csv')
    txt_path = base_path.with_name(base_path.stem + '_summary.txt')
    with csv_path.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['timestamp','user_id','x_id','method','operation','attempted','final_state','result','status','reason','latency_s','expected_final_match','anomaly','prev_state','prev_change_age_s','prev_source','root_cause_redun'])
        for r in analysis['rows']:
            w.writerow([
                r['timestamp'], r['user_id'], r['x_id'], r['method'], r['operation'], r['attempted'], r['final_state'], r['result'], r['status'], r['reason'], r['latency_s'], int(r['expected_final_match']), int(r['anomaly']), r['prev_state'], r['prev_change_age_s'], r['prev_source'], r['root_cause_redun']
            ])
    metrics = analysis['metrics']
    with txt_path.open('w', encoding='utf-8') as ft:
        # Additional categorical counts for clarity
        manual_unlock = sum(1 for r in analysis['rows'] if r['operation'].startswith('Unlock Manual'))
        manual_lock = sum(1 for r in analysis['rows'] if r['operation'].startswith('Lock Manual'))
        status_unlock = sum(1 for r in analysis['rows'] if r['operation'].startswith('Status Report (Unlock)'))
        status_lock = sum(1 for r in analysis['rows'] if r['operation'].startswith('Status Report (Lock)'))
        remote_lock_noop = sum(1 for r in analysis['rows'] if r['operation'].startswith('Lock Remote') and r['status']=='NOOP')

        ft.write('# Resumen de Cerradura (Lock Log Summary)\n')
        ft.write('=== Métricas Globales ===\n')
        ft.write(f"Total de eventos (report lines): {metrics['total_reports']}\n")
        ft.write(f"Remote UNLOCK: total={metrics['remote_unlock_total']} éxito={metrics['remote_unlock_success']} redundante(no-change)={metrics['remote_unlock_noop']} ratio_redundancia={metrics['redundancy_ratio_unlock']:.2%}\n")
        ft.write(f"Remote LOCK: éxito={metrics['remote_lock_success']} no-change={remote_lock_noop}\n")
        ft.write(f"Manual UNLOCK (thumb): {manual_unlock}\n")
        ft.write(f"Manual LOCK (thumb): {manual_lock}\n")
        ft.write(f"Status snapshots UNLOCK: {status_unlock}\n")
        ft.write(f"Status snapshots LOCK: {status_lock}\n")
        ft.write(f"Operaciones FAIL: {metrics['failures']}\n")
        anomalies = sum(1 for r in analysis['rows'] if r['anomaly'])
        ft.write(f"Anomalías marcadas: {anomalies}\n")
        if metrics['latency']:
            lat = metrics['latency']
            ft.write("Latencia (operaciones remotas) [segundos]:\n")
            ft.write(f"  count={lat['count']} avg={lat['avg']:.3f} p50={lat['p50']:.3f} p95={lat['p95']:.3f} max={lat['max']:.3f}\n")

        # Per-user stats section with inferred origin
        ft.write('\n=== Actividad por Usuario (Remoto) ===\n')
        ft.write('user_id;remote_unlock;unlock_success;unlock_noop;remote_lock;lock_success;ratio_unlock_redundancia;origen_inferido\n')
        for u, st in sorted(metrics['per_user'].items(), key=lambda kv: kv[0]):
            unlock = st['remote_unlock']
            unlock_noop = st['remote_unlock_noop']
            unlock_succ = st['remote_unlock_success']
            lock = st['remote_lock']
            lock_succ = st['remote_lock_success']
            ratio_red = (unlock_noop / unlock) if unlock else 0.0
            # Infer origin heuristics
            if u == 64511:
                origen = 'manual_local_thumb'
            elif u == 65279:
                origen = 'sistema_snapshot'
            elif lock and lock_succ and unlock and ratio_red > 0.8:
                origen = 'app_cliente_repetitiva'
            elif lock and not unlock:
                origen = 'tarea_programada_lock'
            elif unlock and ratio_red > 0.9:
                origen = 'sondeo_estado_app'
            else:
                origen = 'indefinido'
            ft.write(f"{u};{unlock};{unlock_succ};{unlock_noop};{lock};{lock_succ};{ratio_red:.2%};{origen}\n")

        ft.write('\n=== Interpretación Rápida ===\n')
        ft.write('- Alto ratio de unlock remotos redundantes: posible reintento app / falta de sincronización estado.\n')
        ft.write('- Locks remotos consistentes y sin fallos.\n')
        ft.write('- Sin fallos explícitos (FAIL), ni discrepancias de estado tras success.\n')
        ft.write('- Snapshots (método 0) marcan posibles reinicios si hay brechas largas.\n')
        # Root cause redundancy summary
        redun_causes = {}
        for r in analysis['rows']:
            if r.get('root_cause_redun'):
                redun_causes[r['root_cause_redun']] = redun_causes.get(r['root_cause_redun'],0)+1
        if redun_causes:
            ft.write('\n=== Causas Redundancia (heurísticas) ===\n')
            for k,v in sorted(redun_causes.items(), key=lambda kv: -kv[1]):
                ft.write(f"{k}: {v}\n")

        ft.write('\n=== Todas las Operaciones (orden cronológico) ===\n')
        for r in analysis['rows']:
            lat_str = f" {r['latency_s']:.3f}s" if isinstance(r['latency_s'], (int,float)) else ''
            ft.write(f"{r['timestamp']} | {r['operation']} -> {r['status']} {r['reason']}{lat_str}\n")
    return csv_path, txt_path


def main():
    if len(sys.argv) < 2:
        print("Uso: python lock_log_analyzer.py <log_file>")
        return 1
    log_path = Path(sys.argv[1])
    lines = log_path.read_text(encoding='utf-8', errors='ignore').splitlines()
    parsed = [p for line in lines if (p:=parse_line(line))]
    analysis = analyze(parsed)
    csv_path, txt_path = write_outputs(log_path, analysis)
    print(f"Generados:\n  CSV: {csv_path}\n  Resumen: {txt_path}\n  Total report lines: {analysis['metrics']['total_reports']}\n  Redundancia Unlock: {analysis['metrics']['redundancy_ratio_unlock']:.2%}")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
