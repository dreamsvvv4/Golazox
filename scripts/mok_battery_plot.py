from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
import re
from typing import Iterable


TS_FORMAT = "%Y-%m-%d %H:%M:%S.%f"


@dataclass(frozen=True)
class BatteryPoint:
    timestamp: datetime
    battery: int
    rssi: int | None
    line_no: int


def filter_battery_points(points: list[BatteryPoint], *, min_battery: int) -> list[BatteryPoint]:
    if min_battery <= -10_000:
        return points
    return [p for p in points if p.battery >= min_battery]


def to_volts(points: list[BatteryPoint], *, scale: float) -> list[BatteryPoint]:
    # We keep BatteryPoint but store volts*1000 as an int? No: keep volts as float would
    # require changing dataclass. Instead, we scale into "mV"-ish ints for plotting.
    # Default mapping used in logs: batteryLevel(V) = Battery / 50.
    # We'll plot in V with floats (handled in plot), so this helper is unused.
    return points


@dataclass(frozen=True)
class ResetEvent:
    timestamp: datetime
    reason: str
    line_no: int
    count: int = 1


@dataclass(frozen=True)
class SimpleEvent:
    timestamp: datetime
    kind: str
    detail: str
    line_no: int
    count: int = 1


@dataclass(frozen=True)
class EventSent:
    timestamp: datetime
    code: str
    variant: str | None
    transport: str
    payload: str
    result: str | None
    line_no: int


def _event_sent_category(e: EventSent) -> str:
    """Category label used for plotting/grouping.

    Special-case MLB so we can distinguish AMLB vs DMLB (alarm vs restore)
    when it is visible in payload.
    """

    if e.code == "MLB" and e.variant in {"AMLB", "DMLB"}:
        return e.variant
    return e.code


@dataclass(frozen=True)
class TraceLine:
    timestamp: datetime
    kind: str
    line_no: int
    text: str


def _scan_battery_mlb_trace_lines(
    log_path: Path,
    *,
    serial: str,
    device_type: str | None = None,
) -> list[TraceLine]:
    """Scan the log and capture *exact* trace lines relevant to Battery/MLB for a node.

    We keep raw lines (with line numbers) to make investigations shareable.
    """

    ts_pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]"
    )
    serial_u = serial.upper()
    dtype_u = device_type.upper() if device_type else None

    mlb_send_pattern = re.compile(
        r"\bSending MLB event for serial:\s*(?P<sn>\S+)\s+and battery level:\s*(?P<lvl>-?\d+)\b",
        re.IGNORECASE,
    )

    hits: list[TraceLine] = []
    with log_path.open("r", encoding="utf-8", errors="replace") as f:
        for line_no, line in enumerate(f, start=1):
            ts_match = ts_pattern.search(line)
            if not ts_match:
                continue

            ts = _parse_timestamp(ts_match.group("ts"))
            if ts is None:
                continue

            line_u = line.upper()

            # MLB send line includes the serial explicitly.
            if "SENDING MLB EVENT" in line_u:
                m = mlb_send_pattern.search(line)
                if m and m.group("sn").upper() == serial_u:
                    hits.append(
                        TraceLine(
                            timestamp=ts,
                            kind="mlb_send",
                            line_no=line_no,
                            text=line.rstrip("\n"),
                        )
                    )
                continue

            # For the rest, filter by serial presence to avoid noise.
            if serial_u not in line_u:
                continue

            if "BATTERYLEVELSTATUSCHANGED" in line_u:
                hits.append(TraceLine(ts, "battery_level_status_changed", line_no, line.rstrip("\n")))
                continue

            if "SIGNAL EMITTED" in line_u and "BATTERYLOW" in line_u:
                hits.append(TraceLine(ts, "battery_low_signal", line_no, line.rstrip("\n")))
                continue

            if "BATTERY LOW FOR DEVICE" in line_u:
                hits.append(TraceLine(ts, "battery_low_text", line_no, line.rstrip("\n")))
                continue

            if "REMOTE CALL EXECUTED" in line_u and "GETBATTERYSTATUS" in line_u:
                hits.append(TraceLine(ts, "get_battery_status", line_no, line.rstrip("\n")))
                continue

            if "REMOTE CALL EXECUTED" in line_u and "GETBATTERYVOLTAGELEVEL" in line_u:
                hits.append(TraceLine(ts, "get_battery_voltage", line_no, line.rstrip("\n")))
                continue

            if "BATTERY VOLTAGE RECEIVED IN V" in line_u:
                hits.append(TraceLine(ts, "battery_voltage_received", line_no, line.rstrip("\n")))
                continue

            if "APPPERIODICSTATUS" in line_u and "BATTERY:" in line_u:
                # Optional device type filter to reduce false positives.
                if dtype_u and dtype_u not in line_u:
                    continue
                hits.append(TraceLine(ts, "periodic_battery", line_no, line.rstrip("\n")))
                continue

            if "RETRIEVED ERROR CODE GETTING BATTERY LEVEL DATA NOT AVAILABLE" in line_u:
                hits.append(TraceLine(ts, "battery_level_hardcoded", line_no, line.rstrip("\n")))
                continue

    hits.sort(key=lambda h: h.timestamp)
    return hits


def _last_before(
    items: list[TraceLine], *, kind: str, ts: datetime, within: timedelta
) -> TraceLine | None:
    best: TraceLine | None = None
    for it in items:
        if it.kind != kind:
            continue
        if it.timestamp > ts:
            continue
        if it.timestamp < ts - within:
            continue
        if best is None or it.timestamp >= best.timestamp:
            best = it
    return best


def _window(items: list[TraceLine], *, start: datetime, end: datetime) -> list[TraceLine]:
    return [it for it in items if start <= it.timestamp <= end]


def write_mlb_battery_trace_report(
    *,
    log_path: Path,
    serial: str,
    device_type: str,
    trace_lines: list[TraceLine],
    event_sent: list[EventSent],
    out_path: Path,
    event_sent_contains: str | None,
    context_seconds_before: float = 2.0,
    context_seconds_after: float = 4.0,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Keep only MLB event-sent (and optionally filter by payload contains)
    mlb_sent = [e for e in event_sent if e.code == "MLB"]
    if event_sent_contains:
        needle = str(event_sent_contains)
        mlb_sent = [e for e in mlb_sent if needle in e.payload or (e.result and needle in e.result)]

    mlb_send = [t for t in trace_lines if t.kind == "mlb_send"]

    before = timedelta(seconds=float(context_seconds_before))
    after = timedelta(seconds=float(context_seconds_after))
    near = timedelta(seconds=8)

    with out_path.open("w", encoding="utf-8") as f:
        f.write(f"# MLB vs Battery trace report\n\n")
        f.write(f"- Log: {log_path.as_posix()}\n")
        f.write(f"- Device: {device_type} {serial}\n")
        if event_sent_contains:
            f.write(f"- Event sent filter: contains={event_sent_contains!r}\n")
        f.write(f"- MLB send events: {len(mlb_send)}\n")
        f.write(f"- Event sent MLB: {len(mlb_sent)}\n\n")

        if not mlb_send:
            f.write("No 'Sending MLB event...' traces found for this serial.\n")
            return

        for idx, send in enumerate(mlb_send, start=1):
            t0 = send.timestamp
            f.write(f"## Episode {idx}: {t0.isoformat(sep=' ')} (L{send.line_no})\n\n")
            f.write(f"**MLB send trace**\n\n")
            f.write(f"- L{send.line_no} {send.text}\n\n")

            last_state = _last_before(
                trace_lines,
                kind="battery_level_status_changed",
                ts=t0,
                within=timedelta(seconds=120),
            )
            last_get = _last_before(
                trace_lines,
                kind="get_battery_status",
                ts=t0,
                within=timedelta(seconds=120),
            )

            if last_state:
                f.write("**Nearest BatteryLevelStatusChanged before**\n\n")
                f.write(f"- L{last_state.line_no} {last_state.text}\n\n")
            if last_get:
                f.write("**Nearest GetBatteryStatus before**\n\n")
                f.write(f"- L{last_get.line_no} {last_get.text}\n\n")

            # Match Event sent MLB near the send timestamp
            sent_near = [e for e in mlb_sent if abs((e.timestamp - t0).total_seconds()) <= near.total_seconds()]
            if sent_near:
                f.write("**Event sent MLB near MLB send**\n\n")
                for e in sent_near:
                    v = e.variant or ""
                    suffix = f" ({v})" if v else ""
                    f.write(
                        f"- L{e.line_no} {e.timestamp.isoformat(sep=' ')} Event sent. MLB{suffix} {e.transport} {e.payload}"
                    )
                    if e.result:
                        f.write(f" - {e.result}")
                    f.write("\n")
                f.write("\n")

            # Raw context window
            w_start = t0 - before
            w_end = t0 + after
            ctx = _window(trace_lines, start=w_start, end=w_end)
            f.write(f"**Raw traces window** ({context_seconds_before:.1f}s before → {context_seconds_after:.1f}s after)\n\n")
            f.write("```text\n")
            for it in ctx:
                f.write(f"L{it.line_no} {it.text}\n")
            f.write("```\n\n")



def infer_resets_from_battery(points: list[BatteryPoint]) -> list[ResetEvent]:
    # Some radios/devices expose a battery counter that can reset (e.g., after reboot)
    # which makes the line chart look like a huge "drop". We infer these jumps and
    # treat them as reset markers to improve readability.
    if len(points) < 2:
        return []

    batts = [p.battery for p in points]
    y_min = min(batts)
    y_max = max(batts)
    span = max(1, y_max - y_min)

    # Heuristic: if battery suddenly drops by a large fraction of the observed span,
    # it's likely a counter reset/rollover rather than real discharge.
    threshold = max(40, int(0.55 * span))

    inferred: list[ResetEvent] = []
    prev = points[0]
    for cur in points[1:]:
        if (prev.battery - cur.battery) >= threshold:
            inferred.append(
                ResetEvent(
                    timestamp=cur.timestamp,
                    reason=f"Inferred battery reset ({prev.battery}→{cur.battery})",
                    line_no=cur.line_no,
                )
            )
        prev = cur

    return inferred


def _split_points_by_resets(
    points: list[BatteryPoint], resets: list[ResetEvent]
) -> list[list[BatteryPoint]]:
    if not points:
        return []
    if not resets:
        return [points]

    reset_times = sorted({r.timestamp for r in resets})
    segments: list[list[BatteryPoint]] = []
    current: list[BatteryPoint] = []
    idx = 0

    for p in points:
        while idx < len(reset_times) and p.timestamp >= reset_times[idx]:
            if current:
                segments.append(current)
                current = []
            idx += 1
        current.append(p)

    if current:
        segments.append(current)
    return segments


def _parse_timestamp(ts: str) -> datetime | None:
    try:
        return datetime.strptime(ts, TS_FORMAT)
    except ValueError:
        return None


def parse_device_battery_points(
    lines: Iterable[str],
    *,
    device_type: str,
    serial: str,
) -> list[BatteryPoint]:
    # Examples:
    # [2026-01-14 16:54:28.696] ... Battery: 163, RSSI: -59, ... MOK 2DW9XPUM appPeriodicStatus
    # [2026-01-23 14:50:56.190] ... Battery: 185, RSSI: -41, ... AQUILA 2DT4EP64 appPeriodicStatus
    ts_pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]"
    )
    battery_pattern = re.compile(r"\bBattery:\s*(?P<batt>-?\d+)", re.IGNORECASE)
    rssi_pattern = re.compile(r"\bRSSI:\s*(?P<rssi>-?\d+)", re.IGNORECASE)

    points: list[BatteryPoint] = []
    for line_no, line in enumerate(lines, start=1):
        if device_type not in line:
            continue
        if serial not in line:
            continue
        if "appPeriodicStatus" not in line:
            continue
        if "Battery:" not in line:
            continue

        ts_match = ts_pattern.search(line)
        b_match = battery_pattern.search(line)
        if not ts_match or not b_match:
            continue

        ts = _parse_timestamp(ts_match.group("ts"))
        if ts is None:
            continue

        rssi_match = rssi_pattern.search(line)
        rssi = int(rssi_match.group("rssi")) if rssi_match else None

        points.append(
            BatteryPoint(
                timestamp=ts,
                battery=int(b_match.group("batt")),
                rssi=rssi,
                line_no=line_no,
            )
        )

    points.sort(key=lambda p: p.timestamp)
    return points


def parse_mok_battery_points(lines: Iterable[str], serial: str) -> list[BatteryPoint]:
    # Backwards-compatible wrapper
    return parse_device_battery_points(lines, device_type="MOK", serial=serial)


def parse_reset_events(
    lines: Iterable[str],
    *,
    serial: str,
    device_type: str = "MOK",
) -> list[ResetEvent]:
    # Example:
    # [2026-01-14 16:56:20.020] ... Reason: Brown out reset MOK 2DW9XPUM appPowerup
    # (Other radios may also log appPowerup/reset reasons)
    ts_pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]"
    )
    reason_pattern = re.compile(r"\bReason:\s*(?P<reason>.*?)(?:\s{2,}|\s+$)")

    # AQUILA example:
    # [....] Node rebooted { node_id: 2DT4EP64, device_type: AQUILA, reason: BROWN_OUT_RESET }
    reboot_pattern = re.compile(
        r"\bNode rebooted\s*\{[^}]*\bnode_id:\s*(?P<sn>\S+)[^}]*\breason:\s*(?P<reason>[A-Z0-9_]+)",
        re.IGNORECASE,
    )

    # Also seen as a "signal emitted" line:
    # ... signal_name: node-rebooted ... node_id: 2DT4EP64 ... reboot_reason ... brown_out_reset
    signal_reboot_pattern = re.compile(
        r"\bsignal_name:\s*node-rebooted\b.*?\bnode_id:\s*(?P<sn>\S+)\b.*?\breboot_reason\b.*?\b(?P<reason>power_up_reset|brown_out_reset|watchdog_reset|software_reset)\b",
        re.IGNORECASE,
    )

    events: list[ResetEvent] = []
    for line_no, line in enumerate(lines, start=1):
        ts_match = ts_pattern.search(line)
        if not ts_match:
            continue

        ts = _parse_timestamp(ts_match.group("ts"))
        if ts is None:
            continue

        # Pattern 1: "Reason: <...reset...>" (classic MOK style)
        if "Reason:" in line and device_type in line and serial in line:
            reason_match = reason_pattern.search(line)
            reason = reason_match.group("reason").strip() if reason_match else ""
            if "reset" in reason.lower():
                events.append(ResetEvent(timestamp=ts, reason=reason, line_no=line_no))
            continue

        # Pattern 2: "Node rebooted { ... }" (AQUILA style)
        if "Node rebooted" in line:
            m = reboot_pattern.search(line)
            if m and m.group("sn").upper() == serial.upper():
                reason = m.group("reason").upper()
                events.append(ResetEvent(timestamp=ts, reason=reason, line_no=line_no))
            continue

        # Pattern 3: signal emitted / node-rebooted (AQUILA style)
        if "node-rebooted" in line:
            m = signal_reboot_pattern.search(line)
            if m and m.group("sn").upper() == serial.upper():
                reason = m.group("reason").upper()
                events.append(ResetEvent(timestamp=ts, reason=reason, line_no=line_no))
            continue

    events.sort(key=lambda e: e.timestamp)
    return events


def _scan_log(
    log_path: Path,
    *,
    device_type: str,
    battery_serial: str,
    events_serial: str,
    nodefault_type: str | None,
    parse_battery: bool = True,
) -> tuple[list[BatteryPoint], list[ResetEvent], list[SimpleEvent], list[SimpleEvent], list[EventSent]]:
    """Single-pass streaming scan (fast for large ordered.log).

    Returns: (battery_points, resets, login_logout, nodefaults, event_sent)
    """

    ts_pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]"
    )
    battery_pattern = re.compile(r"\bBattery:\s*(?P<batt>-?\d+)", re.IGNORECASE)
    rssi_pattern = re.compile(r"\bRSSI:\s*(?P<rssi>-?\d+)", re.IGNORECASE)
    reason_pattern = re.compile(r"\bReason:\s*(?P<reason>.*?)(?:\s{2,}|\s+$)")
    reboot_pattern = re.compile(
        r"\bNode rebooted\s*\{[^}]*\bnode_id:\s*(?P<sn>\S+)[^}]*\breason:\s*(?P<reason>[A-Z0-9_]+)",
        re.IGNORECASE,
    )
    signal_reboot_pattern = re.compile(
        r"\bsignal_name:\s*node-rebooted\b.*?\bnode_id:\s*(?P<sn>\S+)\b.*?\breboot_reason\b.*?\b(?P<reason>power_up_reset|brown_out_reset|watchdog_reset|software_reset)\b",
        re.IGNORECASE,
    )
    nodefault_pattern = re.compile(
        r"\bNodefault received from node through RF\s+(?P<dtype>\S+)\s+(?P<sn>\S+)\b",
        re.IGNORECASE,
    )

    event_sent_pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\].*?\bEvent sent\.\s+(?P<code>[A-Z0-9]{2,6})\s+(?P<transport>\S+)\s+(?P<body>.*)$",
        re.IGNORECASE,
    )
    event_sent_result_pattern = re.compile(r"\s-\s(?P<result>.+?)\s*$")
    mlb_variant_pattern = re.compile(r"\b(?P<v>[AD]MLB)\b", re.IGNORECASE)

    battery_serial_u = battery_serial.upper()
    events_serial_u = events_serial.upper()
    nodefault_type_u = nodefault_type.upper() if nodefault_type else None

    points: list[BatteryPoint] = []
    resets: list[ResetEvent] = []
    logins: list[SimpleEvent] = []
    nodefaults: list[SimpleEvent] = []
    event_sent: list[EventSent] = []

    with log_path.open("r", encoding="utf-8", errors="replace") as f:
        for line_no, line in enumerate(f, start=1):
            ts_match = ts_pattern.search(line)
            if not ts_match:
                continue
            ts = _parse_timestamp(ts_match.group("ts"))
            if ts is None:
                continue

            # Battery points (filtered by device type + serial + appPeriodicStatus)
            if parse_battery:
                if (
                    "appPeriodicStatus" in line
                    and "Battery:" in line
                    and device_type in line
                    and battery_serial in line
                ):
                    b_match = battery_pattern.search(line)
                    if b_match:
                        rssi_match = rssi_pattern.search(line)
                        rssi = int(rssi_match.group("rssi")) if rssi_match else None
                        points.append(
                            BatteryPoint(
                                timestamp=ts,
                                battery=int(b_match.group("batt")),
                                rssi=rssi,
                                line_no=line_no,
                            )
                        )

            # Reset events
            if "Reason:" in line and device_type in line and battery_serial in line:
                rm = reason_pattern.search(line)
                reason = rm.group("reason").strip() if rm else ""
                if "reset" in reason.lower():
                    resets.append(ResetEvent(timestamp=ts, reason=reason, line_no=line_no))
                continue

            if "Node rebooted" in line and events_serial_u in line.upper():
                m = reboot_pattern.search(line)
                if m and m.group("sn").upper() == events_serial_u:
                    resets.append(
                        ResetEvent(timestamp=ts, reason=m.group("reason").upper(), line_no=line_no)
                    )
                continue

            if "node-rebooted" in line and events_serial_u in line.upper():
                m = signal_reboot_pattern.search(line)
                if m and m.group("sn").upper() == events_serial_u:
                    resets.append(
                        ResetEvent(timestamp=ts, reason=m.group("reason").upper(), line_no=line_no)
                    )
                continue

            # Login/Logout events
            if "event received" in line and "Device:" in line and events_serial_u in line.upper():
                if "Login event received" in line:
                    logins.append(SimpleEvent(timestamp=ts, kind="login", detail="", line_no=line_no))
                    continue
                if "Logout event received" in line:
                    logins.append(SimpleEvent(timestamp=ts, kind="logout", detail="", line_no=line_no))
                    continue

            # Nodefault events
            if "Nodefault received from node through RF" in line:
                nm = nodefault_pattern.search(line)
                if not nm:
                    continue
                dtype = nm.group("dtype")
                sn = nm.group("sn")
                if sn.upper() != events_serial_u:
                    continue
                if nodefault_type_u and dtype.upper() != nodefault_type_u:
                    continue
                nodefaults.append(
                    SimpleEvent(
                        timestamp=ts,
                        kind="nodefault",
                        detail=f"{dtype} {sn}",
                        line_no=line_no,
                    )
                )

            # Event sent.
            if "Event sent." in line:
                m = event_sent_pattern.search(line)
                if not m:
                    continue

                body = m.group("body").strip()
                result_match = event_sent_result_pattern.search(body)
                result = result_match.group("result").strip() if result_match else None
                payload = body[: result_match.start()].strip() if result_match else body

                code = m.group("code").upper()
                variant = None
                if code == "MLB":
                    vm = mlb_variant_pattern.search(payload)
                    if vm:
                        variant = vm.group("v").upper()

                event_sent.append(
                    EventSent(
                        timestamp=ts,
                        code=code,
                        variant=variant,
                        transport=m.group("transport"),
                        payload=payload,
                        result=result,
                        line_no=line_no,
                    )
                )
                continue

    points.sort(key=lambda p: p.timestamp)
    resets.sort(key=lambda e: e.timestamp)
    logins.sort(key=lambda e: e.timestamp)
    nodefaults.sort(key=lambda e: e.timestamp)
    event_sent.sort(key=lambda e: e.timestamp)
    return points, resets, logins, nodefaults, event_sent


def _write_event_sent_csv(events: list[EventSent], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "code", "variant", "transport", "result", "payload", "line_no"])
        for e in events:
            writer.writerow(
                [
                    e.timestamp.strftime(TS_FORMAT),
                    e.code,
                    e.variant or "",
                    e.transport,
                    e.result or "",
                    e.payload,
                    e.line_no,
                ]
            )


def plot_battery_and_event_sent(
    points: list[BatteryPoint],
    event_sent: list[EventSent],
    title: str,
    out_path: Path,
    *,
    as_volts: bool = False,
    event_panel_height: float = 2.0,
    event_marker_scale: float = 1.15,
    max_codes: int = 14,
    style: str = "raster",
    zoom_last_hours: float | None = None,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.dates as mdates
    import matplotlib.pyplot as plt
    from matplotlib.lines import Line2D

    if not points and not event_sent:
        raise SystemExit("No se encontraron lecturas Battery (appPeriodicStatus) ni líneas 'Event sent.'.")

    # Zoom window (optional)
    xlim_min = None
    xlim_max = None
    if zoom_last_hours is not None and zoom_last_hours > 0:
        candidates: list[datetime] = []
        if points:
            candidates.append(max(p.timestamp for p in points))
        if event_sent:
            candidates.append(max(e.timestamp for e in event_sent))
        if candidates:
            last_ts = max(candidates)
            xlim_max = last_ts
            xlim_min = last_ts - timedelta(hours=zoom_last_hours)

    plt.rcParams.update(
        {
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "axes.edgecolor": "#D0D0D0",
            "axes.labelcolor": "#222222",
            "text.color": "#222222",
            "xtick.color": "#333333",
            "ytick.color": "#333333",
            "grid.color": "#E6E6E6",
            "grid.linestyle": "-",
            "grid.linewidth": 0.8,
            "font.size": 10,
            "axes.titlesize": 12,
            "axes.titleweight": "semibold",
        }
    )

    base_width = 13.5
    base_height = 6.4 + max(0.0, (event_panel_height - 1.2) * 2.2)

    if points:
        fig, (ax, ax_evt) = plt.subplots(
            nrows=2,
            ncols=1,
            figsize=(base_width, base_height),
            sharex=True,
            gridspec_kw={"height_ratios": [3.3, max(1.0, event_panel_height)], "hspace": 0.08},
            constrained_layout=True,
        )
    else:
        fig, ax_evt = plt.subplots(
            nrows=1,
            ncols=1,
            figsize=(base_width, max(3.5, 2.2 + event_panel_height * 1.7)),
            constrained_layout=True,
        )
        ax = None

    # --- Top: Battery
    if ax is not None:
        batts_raw = [p.battery for p in points]
        batts = [b / 1000.0 for b in batts_raw] if as_volts else batts_raw

        y_min = min(batts)
        y_max = max(batts)
        y_span = max(1, y_max - y_min)
        y_top = y_max + max(2, int(0.06 * y_span))
        y_bot = y_min - max(2, int(0.06 * y_span))

        ax.plot(
            [p.timestamp for p in points],
            batts,
            color="#1f77b4",
            linewidth=1.5,
            alpha=0.95,
        )
        n = max(1, len(points))
        scatter_s = 10 if n <= 1500 else 6 if n <= 6000 else 3
        ax.scatter(
            [p.timestamp for p in points],
            batts,
            s=scatter_s,
            color="#1f77b4",
            alpha=0.30,
            linewidths=0,
        )
        ax.set_title(title)
        ax.set_ylabel("Battery (V)" if as_volts else "Battery")
        ax.set_ylim(y_bot - 1, y_top + 1)
        ax.grid(True, axis="both")
        ax.margins(x=0)
        if xlim_min is not None and xlim_max is not None:
            ax.set_xlim(xlim_min, xlim_max)
    else:
        ax_evt.set_title(title + " (Event sent)")

    # --- Bottom: Event sent
    if xlim_min is not None and xlim_max is not None:
        event_sent = [e for e in event_sent if xlim_min <= e.timestamp <= xlim_max]

    ax_evt.set_xlabel("Tiempo")
    ax_evt.grid(True, axis="x")
    ax_evt.grid(False, axis="y")

    # Grouping counts by category (MLB -> AMLB/DMLB when possible)
    cat_counts: dict[str, int] = {}
    for e in event_sent:
        cat = _event_sent_category(e)
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    cats_sorted = sorted(cat_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    top_cats = [c for c, _ in cats_sorted[: max(1, int(max_codes))]]
    use_other = len(cat_counts) > len(top_cats)

    def lane_for_event(e: EventSent) -> str:
        cat = _event_sent_category(e)
        return cat if cat in top_cats else "OTHER"

    lane_names = top_cats + (["OTHER"] if use_other else [])
    lane_y = {name: i for i, name in enumerate(lane_names)}

    # Downsample for readability.
    max_marks = 5000
    if len(event_sent) > max_marks:
        step = max(1, len(event_sent) // max_marks)
        event_sent = event_sent[::step]

    cmap = plt.get_cmap("tab20")
    colors = {name: cmap(i % 20) for i, name in enumerate(lane_names)}

    if style not in {"raster", "scatter"}:
        raise ValueError(f"Unknown style={style!r}; expected 'raster' or 'scatter'.")

    # Build lane->times once
    lane_times: dict[str, list[datetime]] = {name: [] for name in lane_names}
    for e in event_sent:
        name = lane_for_event(e)
        if name in lane_times:
            lane_times[name].append(e.timestamp)

    if style == "scatter":
        for name in lane_names:
            times = lane_times.get(name) or []
            if not times:
                continue
            ax_evt.scatter(
                times,
                [lane_y[name]] * len(times),
                marker="|",
                s=320 * (event_marker_scale**2),
                color=colors[name],
                alpha=0.70,
            )

        ax_evt.set_yticks([lane_y[n] for n in lane_names])
        ax_evt.set_yticklabels(lane_names)
        ax_evt.set_ylim(-1, len(lane_names))
    else:
        # Raster style: one row per lane; much easier to read on long time ranges.
        # Use eventplot so each event becomes a short tick, not a full-height line.
        lane_nums = []
        lane_offsets = []
        lane_colors = []
        ytick_labels = []
        for name in lane_names:
            times = lane_times.get(name) or []
            nums = [mdates.date2num(t) for t in times]
            lane_nums.append(nums)
            lane_offsets.append(lane_y[name])
            lane_colors.append(colors[name])
            cnt = cat_counts.get(name, 0)
            if name == "OTHER":
                cnt = sum(v for c, v in cat_counts.items() if c not in top_cats)
            ytick_labels.append(f"{name} ({cnt})")

        ax_evt.eventplot(
            lane_nums,
            lineoffsets=lane_offsets,
            linelengths=0.72,
            linewidths=max(0.9, 1.2 * float(event_marker_scale)),
            colors=lane_colors,
            alpha=0.85,
        )
        ax_evt.set_yticks(lane_offsets)
        ax_evt.set_yticklabels(ytick_labels)
        ax_evt.set_ylim(-1, len(lane_names))

    locator = mdates.AutoDateLocator(minticks=4, maxticks=10)
    ax_evt.xaxis.set_major_locator(locator)
    ax_evt.xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))

    # Legend: keep it compact; raster mode already shows counts on the Y axis.
    if style == "scatter":
        legend_handles = []
        if ax is not None:
            legend_handles.append(Line2D([0], [0], color="#1f77b4", lw=1.6, label="Battery"))
        for name in lane_names[: min(10, len(lane_names))]:
            if name == "OTHER":
                other_count = sum(v for c, v in cat_counts.items() if c not in top_cats)
                label = f"OTHER ({other_count})"
            else:
                label = f"{name} ({cat_counts.get(name, 0)})"
            legend_handles.append(
                Line2D([0], [0], marker="|", color=colors[name], lw=0, markersize=14, label=label)
            )
        ax_evt.legend(
            handles=legend_handles,
            loc="upper left",
            frameon=True,
            framealpha=0.9,
            facecolor="white",
            edgecolor="#DDDDDD",
            fontsize=9,
            ncol=4,
            borderpad=0.5,
            columnspacing=1.0,
            handlelength=1.7,
        )

    if xlim_min is not None and xlim_max is not None:
        ax_evt.set_xlim(xlim_min, xlim_max)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=160)


def parse_login_logout_events(lines: Iterable[str], serial: str) -> list[SimpleEvent]:
    # Examples:
    # [....] Logout event received. Device: 2DW9XPUM
    # [....] Login event received. Device: 2DW9XPUM
    pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]"
        r".*?\b(?P<kind>Login|Logout) event received\.\s*Device:\s*" + re.escape(serial) + r"\b",
        re.IGNORECASE,
    )

    events: list[SimpleEvent] = []
    for line_no, line in enumerate(lines, start=1):
        match = pattern.search(line)
        if not match:
            continue

        ts = _parse_timestamp(match.group("ts"))
        if ts is None:
            continue

        kind = match.group("kind").lower()
        events.append(SimpleEvent(timestamp=ts, kind=kind, detail="", line_no=line_no))

    events.sort(key=lambda e: e.timestamp)
    return events


def parse_nodefault_events(
    lines: Iterable[str],
    *,
    serial: str | None = None,
    device_type: str | None = None,
) -> list[SimpleEvent]:
    # Example:
    # [....][W] Nodefault received from node through RF MOK 2DW9XPUM 0x10140003 1.11.0 2.14
    # [....][W] Nodefault received from node through RF ORION 2DRTRGQE ...
    # We capture <type> and <serial> to allow filtering.
    pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]"
        r".*?\bNodefault received from node through RF\s+(?P<dtype>\S+)\s+(?P<sn>\S+)\b",
        re.IGNORECASE,
    )

    serial_norm = serial.upper() if serial else None
    dtype_norm = device_type.upper() if device_type else None

    events: list[SimpleEvent] = []
    for line_no, line in enumerate(lines, start=1):
        match = pattern.search(line)
        if not match:
            continue

        ts = _parse_timestamp(match.group("ts"))
        if ts is None:
            continue

        dtype = match.group("dtype")
        sn = match.group("sn")

        if serial_norm and sn.upper() != serial_norm:
            continue
        if dtype_norm and dtype.upper() != dtype_norm:
            continue

        events.append(
            SimpleEvent(
                timestamp=ts,
                kind="nodefault",
                detail=f"{dtype} {sn}",
                line_no=line_no,
            )
        )

    events.sort(key=lambda e: e.timestamp)
    return events


def plot_battery(
    points: list[BatteryPoint],
    resets: list[ResetEvent],
    logins: list[SimpleEvent],
    nodefaults: list[SimpleEvent],
    title: str,
    out_path: Path,
    *,
    as_volts: bool = False,
    event_panel_height: float = 1.2,
    event_marker_scale: float = 1.0,
    event_lane_spacing: float = 1.0,
    zoom_last_hours: float | None = None,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.dates as mdates
    import matplotlib.pyplot as plt
    from matplotlib.lines import Line2D

    # Allow rendering events even if battery points are missing (events are separate traces).
    has_any_events = bool(resets or logins or nodefaults)
    if not points and not has_any_events:
        raise SystemExit("No se encontraron lecturas Battery (appPeriodicStatus) ni eventos (login/logout/nodefault/reset).")

    # Add inferred resets (if not already present) to improve plotting for devices
    # whose battery value is a counter that can restart.
    if points:
        inferred = infer_resets_from_battery(points)
        if inferred:
            existing = {(r.timestamp, r.line_no) for r in resets}
            for r in inferred:
                if (r.timestamp, r.line_no) not in existing:
                    resets.append(r)
            resets.sort(key=lambda e: e.timestamp)

    if points:
        batts_all_raw = [p.battery for p in points]
        batts_all = [b / 1000.0 for b in batts_all_raw] if as_volts else batts_all_raw
        segments = _split_points_by_resets(points, resets)

        y_min = min(batts_all)
        y_max = max(batts_all)
        y_span = max(1, y_max - y_min)
        y_top = y_max + max(2, int(0.06 * y_span))
        y_bot = y_min - max(2, int(0.06 * y_span))
    else:
        batts_all = []
        segments = []
        y_min = 0
        y_max = 1
        y_top = 1
        y_bot = 0

    # Zoom window (optional): last N hours based on the newest timestamp among points/events.
    xlim_min = None
    xlim_max = None
    if zoom_last_hours is not None and zoom_last_hours > 0:
        candidates: list[datetime] = []
        if points:
            candidates.append(max(p.timestamp for p in points))
        if resets:
            candidates.append(max(e.timestamp for e in resets))
        if logins:
            candidates.append(max(e.timestamp for e in logins))
        if nodefaults:
            candidates.append(max(e.timestamp for e in nodefaults))
        if candidates:
            last_ts = max(candidates)
            xlim_max = last_ts
            xlim_min = last_ts - timedelta(hours=zoom_last_hours)

    # Professional-ish styling (consistent fonts, subtle grids).
    plt.rcParams.update(
        {
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "axes.edgecolor": "#D0D0D0",
            "axes.labelcolor": "#222222",
            "text.color": "#222222",
            "xtick.color": "#333333",
            "ytick.color": "#333333",
            "grid.color": "#E6E6E6",
            "grid.linestyle": "-",
            "grid.linewidth": 0.8,
            "font.size": 10,
            "axes.titlesize": 12,
            "axes.titleweight": "semibold",
        }
    )

    base_width = 13.5
    base_height = 6.5
    # Make the overall figure taller when the event lane is taller.
    height = base_height + max(0.0, (event_panel_height - 1.2) * 2.2)

    if points:
        fig, (ax, ax_evt) = plt.subplots(
            nrows=2,
            ncols=1,
            figsize=(base_width, height),
            sharex=True,
            gridspec_kw={"height_ratios": [3.5, max(0.8, event_panel_height)], "hspace": 0.08},
            constrained_layout=True,
        )
    else:
        # Events-only rendering (no top battery axis)
        fig, ax_evt = plt.subplots(
            nrows=1,
            ncols=1,
            figsize=(base_width, max(3.5, 2.2 + event_panel_height * 1.7)),
            constrained_layout=True,
        )
        ax = None

    # --- Top: Battery time series.
    # Plot as segments to avoid long diagonal lines over resets.
    if ax is not None:
        # Auto-scale scatter size for dense data
        n = max(1, len(points))
        scatter_s = 10 if n <= 1500 else 6 if n <= 6000 else 3
        for seg in segments:
            if len(seg) < 2:
                continue
            ax.plot(
                [p.timestamp for p in seg],
                [p.battery / 1000.0 for p in seg] if as_volts else [p.battery for p in seg],
                color="#1f77b4",
                linewidth=1.4,
                alpha=0.95,
            )

        # Scatter to show density/flat regions better.
        ax.scatter(
            [p.timestamp for p in points],
            batts_all,
            s=scatter_s,
            color="#1f77b4",
            alpha=0.35,
            linewidths=0,
        )
        ax.set_title(title)
        ax.set_ylabel("Battery (V)" if as_volts else "Battery")
        ax.set_ylim(y_bot - 1, y_top + 1)
        ax.grid(True, axis="both")
        ax.margins(x=0)

        if xlim_min is not None and xlim_max is not None:
            ax.set_xlim(xlim_min, xlim_max)
    else:
        ax_evt.set_title(title + " (events)" if title else "Eventos")

    # --- Bottom: Event timeline lanes.
    # If zoom is enabled, filter events to that window before plotting/downsampling.
    if xlim_min is not None and xlim_max is not None:
        resets = [e for e in resets if xlim_min <= e.timestamp <= xlim_max]
        logins = [e for e in logins if xlim_min <= e.timestamp <= xlim_max]
        nodefaults = [e for e in nodefaults if xlim_min <= e.timestamp <= xlim_max]

    lane_spacing = max(0.6, float(event_lane_spacing))
    y_nodefault = 0.0 * lane_spacing
    y_logout = 1.0 * lane_spacing
    y_login = 2.0 * lane_spacing
    y_reset = 3.0 * lane_spacing

    ax_evt.set_xlabel("Tiempo")
    ax_evt.set_yticks([y_nodefault, y_logout, y_login, y_reset])
    ax_evt.set_yticklabels(["Nodefault", "Logout", "Login", "Reset"])
    ax_evt.set_ylim(-0.7 * lane_spacing, (3.7 * lane_spacing))
    ax_evt.grid(True, axis="x")
    ax_evt.grid(False, axis="y")

    # Reset events (vertical lines across event lane + optional text in lane).
    if resets:
        # Many resets -> vlines become unreadable. Use vlines only when not too many.
        draw_vlines = len(resets) <= 60
        if draw_vlines:
            for evt in resets:
                ax_evt.axvline(
                    evt.timestamp,
                    color="#b71c1c",
                    alpha=0.75,
                    linewidth=1.1 * max(0.7, event_marker_scale),
                )

        # Always draw a marker at the reset lane.
        reset_times = [e.timestamp for e in resets]
        ax_evt.scatter(
            reset_times,
            [y_reset] * len(reset_times),
            marker="x",
            s=26 * (event_marker_scale**2),
            color="#b71c1c",
            alpha=0.9,
            linewidths=1.0,
        )

        if len(resets) <= 40:
            for evt in resets:
                reason_short = evt.reason
                reason_short = reason_short.replace("Brown out reset", "BROWN_OUT")
                reason_short = reason_short.replace("Power up reset", "POWER_UP")
                ax_evt.text(
                    evt.timestamp,
                    y_reset + (0.25 * lane_spacing),
                    reason_short,
                    rotation=90,
                    va="bottom",
                    ha="center",
                    fontsize=8,
                    color="#b71c1c",
                    alpha=0.9,
                    clip_on=True,
                )

    # Login / Logout markers.
    login_times = [e.timestamp for e in logins if e.kind == "login"]
    logout_times = [e.timestamp for e in logins if e.kind == "logout"]
    if login_times:
        ax_evt.scatter(
            login_times,
            [y_login] * len(login_times),
            marker="^",
            s=28 * (event_marker_scale**2),
            color="#2e7d32",
            edgecolors="white",
            linewidths=0.5,
            alpha=0.95,
        )
    if logout_times:
        ax_evt.scatter(
            logout_times,
            [y_logout] * len(logout_times),
            marker="v",
            s=28 * (event_marker_scale**2),
            color="#1565c0",
            edgecolors="white",
            linewidths=0.5,
            alpha=0.95,
        )

    # Nodefault events (can be noisy; sample to keep legible).
    if nodefaults:
        max_marks = 2500
        if len(nodefaults) > max_marks:
            step = max(1, len(nodefaults) // max_marks)
            nodefaults = nodefaults[::step]

        nodefault_times = [e.timestamp for e in nodefaults]
        ax_evt.scatter(
            nodefault_times,
            [y_nodefault] * len(nodefault_times),
            marker="|",
            s=260 * (event_marker_scale**2),
            color="#ef6c00",
            alpha=0.55,
        )

    # Shared X formatting.
    locator = mdates.AutoDateLocator(minticks=4, maxticks=10)
    ax_evt.xaxis.set_major_locator(locator)
    ax_evt.xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))

    # Legend (single, top-left, compact).
    legend_handles = []
    if ax is not None:
        legend_handles.append(Line2D([0], [0], color="#1f77b4", lw=1.6, label="Battery"))
    legend_handles.extend(
        [
            Line2D([0], [0], marker="x", color="#b71c1c", lw=0, markersize=8, label="Reset"),
            Line2D([0], [0], marker="^", color="w", markerfacecolor="#2e7d32", markeredgecolor="white", markersize=8, label="Login"),
            Line2D([0], [0], marker="v", color="w", markerfacecolor="#1565c0", markeredgecolor="white", markersize=8, label="Logout"),
            Line2D([0], [0], marker="|", color="#ef6c00", markersize=14, lw=0, label="Nodefault"),
        ]
    )
    ax.legend(
        handles=legend_handles,
        loc="upper left",
        frameon=True,
        framealpha=0.9,
        facecolor="white",
        edgecolor="#DDDDDD",
        ncol=5 if ax is not None else 4,
        fontsize=9,
        borderpad=0.5,
        columnspacing=1.0,
        handlelength=1.7,
    )

    if xlim_min is not None and xlim_max is not None:
        ax_evt.set_xlim(xlim_min, xlim_max)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=160)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Grafica la evolución de Battery (appPeriodicStatus) desde ordered.log",
    )
    parser.add_argument(
        "--log",
        required=True,
        help="Ruta al ordered.log",
    )
    parser.add_argument(
        "--serial",
        default="2DW9XPUM",
        help="Serial/nodo (por defecto: 2DW9XPUM)",
    )
    parser.add_argument(
        "--node",
        default=None,
        help="Alias de --serial (por ejemplo: 2DT4EP64)",
    )
    parser.add_argument(
        "--radio",
        default="MOK",
        help="Tipo/keyword del dispositivo en el log (ej: MOK, AQUILA, ORION)",
    )
    parser.add_argument(
        "--events-serial",
        default=None,
        help="Serial para eventos (login/logout/nodefault). Por defecto usa --serial.",
    )
    parser.add_argument(
        "--nodefault-type",
        default=None,
        help="Filtrar Nodefault por tipo exacto (p.ej. BROKEN, MOK, ORION).",
    )
    parser.add_argument(
        "--out",
        default="scripts/out/mok_battery.png",
        help="Ruta del PNG de salida",
    )
    parser.add_argument(
        "--min-battery",
        type=int,
        default=5,
        help="Descartar lecturas Battery menores que este valor (por defecto: 5).",
    )
    parser.add_argument(
        "--as-volts",
        action="store_true",
        help="Graficar Battery convertido a voltios usando V = Battery/50.",
    )
    parser.add_argument(
        "--events-only",
        action="store_true",
        help="No buscar Battery (appPeriodicStatus); genera solo panel de eventos.",
    )
    parser.add_argument(
        "--no-resets",
        action="store_true",
        help="No dibujar marcas de reset en la gráfica",
    )
    parser.add_argument(
        "--no-logins",
        action="store_true",
        help="No dibujar marcas de login/logout en la gráfica",
    )
    parser.add_argument(
        "--no-nodefault",
        action="store_true",
        help="No dibujar marcas de Nodefault en la gráfica",
    )
    parser.add_argument(
        "--event-panel-height",
        type=float,
        default=1.6,
        help="Altura relativa del panel de eventos (por defecto: 1.6).",
    )
    parser.add_argument(
        "--event-marker-scale",
        type=float,
        default=1.5,
        help="Escala para el tamaño de marcadores en eventos (por defecto: 1.5).",
    )
    parser.add_argument(
        "--event-lane-spacing",
        type=float,
        default=1.4,
        help="Separación vertical entre lanes de eventos (por defecto: 1.4).",
    )
    parser.add_argument(
        "--event-panel",
        choices=["legacy", "sent"],
        default="legacy",
        help="Panel inferior: legacy=resets/login/logout/nodefault; sent=Event sent. por tipo.",
    )
    parser.add_argument(
        "--event-sent-out",
        default=None,
        help="Ruta del CSV de Event sent. (por defecto: derivada de --out).",
    )
    parser.add_argument(
        "--event-sent-contains",
        default=None,
        help="Filtra Event sent. por substring (ej: '0E5460863#' o '5460863#').",
    )
    parser.add_argument(
        "--event-sent-pad-minutes",
        type=float,
        default=10.0,
        help="Si hay Battery, filtra Event sent. al rango [first-pad,last+pad] minutos (por defecto: 10).",
    )
    parser.add_argument(
        "--event-sent-max-codes",
        type=int,
        default=14,
        help="Máximo de tipos de Event sent. a mostrar; el resto se agrupa en OTHER.",
    )
    parser.add_argument(
        "--event-sent-style",
        choices=["raster", "scatter"],
        default="raster",
        help="Estilo del panel Event sent.: raster (recomendado) o scatter.",
    )
    parser.add_argument(
        "--zoom-last-hours",
        type=float,
        default=None,
        help="Si se indica, hace zoom a las últimas N horas (ej: 6, 12, 24).",
    )
    parser.add_argument(
        "--trace-report",
        action="store_true",
        help="Genera un reporte .md con las trazas exactas (Battery/MLB) con números de línea.",
    )
    parser.add_argument(
        "--trace-report-out",
        default=None,
        help="Ruta del reporte .md (por defecto: derivada de --out).",
    )
    parser.add_argument(
        "--trace-context-before-seconds",
        type=float,
        default=2.0,
        help="Ventana de contexto ANTES de 'Sending MLB event' (segundos).",
    )
    parser.add_argument(
        "--trace-context-after-seconds",
        type=float,
        default=4.0,
        help="Ventana de contexto DESPUÉS de 'Sending MLB event' (segundos).",
    )
    args = parser.parse_args()

    log_path = Path(args.log)
    serial = args.node or args.serial
    device_type = args.radio

    events_serial = args.events_serial or serial
    points_all, resets, logins, nodefaults, event_sent_all = _scan_log(
        log_path,
        device_type=device_type,
        battery_serial=serial,
        events_serial=events_serial,
        nodefault_type=args.nodefault_type,
        parse_battery=not args.events_only,
    )
    points = filter_battery_points(points_all, min_battery=args.min_battery)
    if args.no_resets:
        resets = []
    if args.no_logins:
        logins = []
    if args.no_nodefault:
        nodefaults = []

    # Filter Event sent (optional)
    event_sent = event_sent_all
    if args.event_sent_contains:
        needle = str(args.event_sent_contains)
        event_sent = [e for e in event_sent if needle in e.payload or (e.result and needle in e.result)]

    # Event sent used for trace report: keep full timeline (no battery-pad filtering)
    event_sent_for_trace = event_sent

    # If we have battery points, constrain Event sent to the battery time span (+pad)
    if points_all and args.event_sent_pad_minutes is not None and args.event_sent_pad_minutes > 0:
        pad = timedelta(minutes=float(args.event_sent_pad_minutes))
        start = points_all[0].timestamp - pad
        end = points_all[-1].timestamp + pad
        event_sent = [e for e in event_sent if start <= e.timestamp <= end]

    title = f"{device_type} {serial} - Battery vs tiempo ({log_path.parent.name})"
    if args.as_volts:
        title = f"{device_type} {serial} - Battery(V) vs tiempo ({log_path.parent.name})"

    # If plotting in volts, transform values just for plotting.
    if args.as_volts:
        # Monkey-patch battery field to float-friendly values by storing milli-volts
        # as int, then in plot we will divide by 1000.
        points = [
            BatteryPoint(
                timestamp=p.timestamp,
                battery=int(round((p.battery / 50.0) * 1000)),
                rssi=p.rssi,
                line_no=p.line_no,
            )
            for p in points
        ]
    out_path = Path(args.out)

    if args.event_panel == "sent":
        # Default CSV path derived from --out
        csv_out = (
            Path(args.event_sent_out)
            if args.event_sent_out
            else out_path.with_name(out_path.stem + "_event_sent.csv")
        )
        if event_sent:
            _write_event_sent_csv(event_sent, csv_out)

        plot_battery_and_event_sent(
            points,
            event_sent,
            title=title,
            out_path=out_path,
            as_volts=args.as_volts,
            event_panel_height=max(1.2, float(args.event_panel_height)),
            event_marker_scale=float(args.event_marker_scale),
            max_codes=int(args.event_sent_max_codes),
            style=str(args.event_sent_style),
            zoom_last_hours=args.zoom_last_hours,
        )
    else:
        plot_battery(
            points,
            resets,
            logins,
            nodefaults,
            title=title,
            out_path=out_path,
            as_volts=args.as_volts,
            event_panel_height=args.event_panel_height,
            event_marker_scale=args.event_marker_scale,
            event_lane_spacing=args.event_lane_spacing,
            zoom_last_hours=args.zoom_last_hours,
        )

    # Optional: exact trace report (Battery state vs MLB send / Event sent)
    if args.trace_report:
        report_out = (
            Path(args.trace_report_out)
            if args.trace_report_out
            else out_path.with_name(out_path.stem + "_trace.md")
        )
        trace_lines = _scan_battery_mlb_trace_lines(
            log_path,
            serial=serial,
            device_type=device_type,
        )
        write_mlb_battery_trace_report(
            log_path=log_path,
            serial=serial,
            device_type=device_type,
            trace_lines=trace_lines,
            event_sent=event_sent_for_trace,
            out_path=report_out,
            event_sent_contains=args.event_sent_contains,
            context_seconds_before=float(args.trace_context_before_seconds),
            context_seconds_after=float(args.trace_context_after_seconds),
        )
        print(f"TRACE: {report_out.resolve()}")

    if points:
        first, last = points[0], points[-1]
        print(f"OK: {len(points)} puntos. Rango: {first.timestamp} -> {last.timestamp}")
    else:
        print("OK: sin puntos Battery; se generó gráfica solo de eventos")
    dropped = len(points_all) - len(points)
    if dropped:
        print(f"Filtrados por min-battery={args.min_battery}: {dropped}")
    if resets:
        print(f"Resets: {len(resets)}")
    if logins:
        print(f"Login/Logout: {len(logins)}")
    if nodefaults:
        extra = f" (type={args.nodefault_type})" if args.nodefault_type else ""
        print(f"Nodefault: {len(nodefaults)}{extra}")
    if args.event_panel == "sent":
        print(f"Event sent: {len(event_sent)}")
    print(f"PNG: {Path(args.out).resolve()}")


if __name__ == "__main__":
    main()
