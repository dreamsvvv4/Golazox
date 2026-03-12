from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import re
from typing import Iterable


@dataclass(frozen=True)
class BatteryReading:
    timestamp: datetime
    battery: int
    line_no: int


@dataclass(frozen=True)
class VoltageReport:
    timestamp: datetime
    voltage: int
    voltage_load: int | None
    consumed: int | None
    temperature: int | None
    line_no: int


TS_FORMAT = "%Y-%m-%d %H:%M:%S.%f"


def parse_battery_readings(
    lines: Iterable[str],
    *,
    device_keyword: str,
    node_id: str | None,
) -> list[BatteryReading]:
    # Fast path: filter by substrings first, then parse with small regexes.
    # Expected lines:
    # [2026-01-16 10:23:15.999] ... Battery: 175, ... MOK ... appPeriodicStatus
    # [2026-01-18 12:06:43.169] ... Battery: 248, ... AQUILA 2DT4EP64 appPeriodicStatus
    ts_pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]"
    )
    batt_pattern = re.compile(r"\bBattery:\s*(?P<batt>-?\d+)", re.IGNORECASE)

    readings: list[BatteryReading] = []
    for line_no, line in enumerate(lines, start=1):
        if device_keyword not in line:
            continue
        if node_id and node_id not in line:
            continue
        if "Battery:" not in line:
            continue
        if "appPeriodicStatus" not in line:
            continue

        ts_match = ts_pattern.search(line)
        batt_match = batt_pattern.search(line)
        if not ts_match or not batt_match:
            continue

        try:
            ts = datetime.strptime(ts_match.group("ts"), TS_FORMAT)
        except ValueError:
            continue

        readings.append(
            BatteryReading(
                timestamp=ts,
                battery=int(batt_match.group("batt")),
                line_no=line_no,
            )
        )

    readings.sort(key=lambda r: r.timestamp)
    return readings


def parse_voltage_reports(
    lines: Iterable[str],
    *,
    device_keyword: str,
    node_id: str | None,
) -> list[VoltageReport]:
    # Matches lines like:
    # [2026-01-18 11:09:05.190] ... Voltage: 4969, ... Voltage load: 4974,  AQUILA 2DT4EP64 seBatteryReport
    # Use substring filters first to avoid expensive regex on every line.
    ts_pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]"
    )
    voltage_pattern = re.compile(r"\bVoltage:\s*(?P<v>-?\d+)", re.IGNORECASE)
    voltage_load_pattern = re.compile(
        r"\bVoltage\s+load:\s*(?P<vl>-?\d+)", re.IGNORECASE
    )
    consumed_pattern = re.compile(r"\bConsumed:\s*(?P<c>-?\d+)", re.IGNORECASE)
    temp_pattern = re.compile(r"\bTemperature:\s*(?P<t>-?\d+)", re.IGNORECASE)

    reports: list[VoltageReport] = []
    for line_no, line in enumerate(lines, start=1):
        if device_keyword not in line:
            continue
        if node_id and node_id not in line:
            continue
        if "seBatteryReport" not in line:
            continue
        if "Voltage:" not in line:
            continue

        ts_match = ts_pattern.search(line)
        v_match = voltage_pattern.search(line)
        if not ts_match or not v_match:
            continue

        try:
            ts = datetime.strptime(ts_match.group("ts"), TS_FORMAT)
        except ValueError:
            continue

        vl_match = voltage_load_pattern.search(line)
        c_match = consumed_pattern.search(line)
        t_match = temp_pattern.search(line)

        reports.append(
            VoltageReport(
                timestamp=ts,
                voltage=int(v_match.group("v")),
                voltage_load=int(vl_match.group("vl")) if vl_match else None,
                consumed=int(c_match.group("c")) if c_match else None,
                temperature=int(t_match.group("t")) if t_match else None,
                line_no=line_no,
            )
        )

    reports.sort(key=lambda r: r.timestamp)
    return reports


def find_voltage_hints(lines: Iterable[str], *, device_keyword: str) -> list[tuple[int, str]]:
    hints: list[tuple[int, str]] = []
    for line_no, line in enumerate(lines, start=1):
        if device_keyword not in line:
            continue
        lower = line.lower()
        if "(v)" in lower or " mv" in lower or "volt" in lower or " v" in lower:
            hints.append((line_no, line.strip()))
    return hints


def analyze_log(
    log_path: Path,
    *,
    device_keyword: str,
    node_id: str | None,
) -> tuple[list[BatteryReading], list[VoltageReport], list[tuple[int, str]]]:
    # Single streaming pass over the file.
    readings: list[BatteryReading] = []
    reports: list[VoltageReport] = []
    hints: list[tuple[int, str]] = []

    ts_pattern = re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]"
    )
    batt_pattern = re.compile(r"\bBattery:\s*(?P<batt>-?\d+)", re.IGNORECASE)
    voltage_pattern = re.compile(r"\bVoltage:\s*(?P<v>-?\d+)", re.IGNORECASE)
    voltage_load_pattern = re.compile(
        r"\bVoltage\s+load:\s*(?P<vl>-?\d+)", re.IGNORECASE
    )
    consumed_pattern = re.compile(r"\bConsumed:\s*(?P<c>-?\d+)", re.IGNORECASE)
    temp_pattern = re.compile(r"\bTemperature:\s*(?P<t>-?\d+)", re.IGNORECASE)

    with log_path.open("r", encoding="utf-8", errors="replace") as f:
        for line_no, line in enumerate(f, start=1):
            if device_keyword not in line:
                continue
            if node_id and node_id not in line:
                continue

            lower = line.lower()
            if "(v)" in lower or " mv" in lower or "volt" in lower:
                hints.append((line_no, line.strip()))

            ts_match = ts_pattern.search(line)
            if not ts_match:
                continue
            try:
                ts = datetime.strptime(ts_match.group("ts"), TS_FORMAT)
            except ValueError:
                continue

            if "appPeriodicStatus" in line and "Battery:" in line:
                batt_match = batt_pattern.search(line)
                if batt_match:
                    readings.append(
                        BatteryReading(
                            timestamp=ts,
                            battery=int(batt_match.group("batt")),
                            line_no=line_no,
                        )
                    )
                continue

            if "seBatteryReport" in line and "Voltage:" in line:
                v_match = voltage_pattern.search(line)
                if not v_match:
                    continue
                vl_match = voltage_load_pattern.search(line)
                c_match = consumed_pattern.search(line)
                t_match = temp_pattern.search(line)

                reports.append(
                    VoltageReport(
                        timestamp=ts,
                        voltage=int(v_match.group("v")),
                        voltage_load=int(vl_match.group("vl")) if vl_match else None,
                        consumed=int(c_match.group("c")) if c_match else None,
                        temperature=int(t_match.group("t")) if t_match else None,
                        line_no=line_no,
                    )
                )

    readings.sort(key=lambda r: r.timestamp)
    reports.sort(key=lambda r: r.timestamp)
    return readings, reports, hints


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Resumen de batería/voltaje desde ordered.log (MOK/AQUILA, etc.)"
    )
    parser.add_argument(
        "--log",
        type=Path,
        default=Path(
            r"UltraKibanaDownloader/logs/2479862_2026-01-26T10_20_11Z/ordered.log"
        ),
        help="Ruta al ordered.log",
    )
    parser.add_argument(
        "--node",
        type=str,
        default=None,
        help="ID del nodo (ej: 2DT4EP64). Si se omite, no filtra por nodo.",
    )
    parser.add_argument(
        "--radio",
        type=str,
        default="MOK",
        help="Keyword del dispositivo en el log (ej: MOK, AQUILA)",
    )

    args = parser.parse_args()
    log_path: Path = args.log
    node_id: str | None = args.node
    device_keyword: str = args.radio

    readings, reports, hints = analyze_log(
        log_path,
        device_keyword=device_keyword,
        node_id=node_id,
    )

    if not readings and not reports:
        extra = f" (node={node_id})" if node_id else ""
        print(
            f"No se encontraron lecturas de batería/voltaje para {device_keyword}{extra} en {log_path}"
        )
        return

    print(f"Archivo: {log_path}")
    if node_id:
        print(f"Nodo: {node_id}")
    print(f"Keyword: {device_keyword}")

    if readings:
        first = readings[0]
        last = readings[-1]
        min_item = min(readings, key=lambda r: r.battery)
        max_item = max(readings, key=lambda r: r.battery)
        unique = sorted({r.battery for r in readings})

        print("---")
        print(f"Lecturas appPeriodicStatus (Battery) encontradas: {len(readings)}")
        print(
            "Rango temporal: "
            f"{first.timestamp.isoformat(sep=' ')}  ->  {last.timestamp.isoformat(sep=' ')}"
        )
        print(
            f"Primera: Battery={first.battery} @ {first.timestamp.isoformat(sep=' ')} (línea {first.line_no})"
        )
        print(
            f"Última:  Battery={last.battery} @ {last.timestamp.isoformat(sep=' ')} (línea {last.line_no})"
        )
        print(
            f"Mínimo:  Battery={min_item.battery} @ {min_item.timestamp.isoformat(sep=' ')} (línea {min_item.line_no})"
        )
        print(
            f"Máximo:  Battery={max_item.battery} @ {max_item.timestamp.isoformat(sep=' ')} (línea {max_item.line_no})"
        )
        print(f"Valores únicos: {unique}")

        print("Ejemplos (primeras 2 y últimas 2):")
        sample = readings[:2] + (readings[-2:] if len(readings) > 2 else [])
        for r in sample:
            print(
                f"  {r.timestamp.isoformat(sep=' ')}  Battery={r.battery}  (línea {r.line_no})"
            )

    if reports:
        first_r = reports[0]
        last_r = reports[-1]
        min_v = min(reports, key=lambda r: r.voltage)
        max_v = max(reports, key=lambda r: r.voltage)

        print("---")
        print(f"Reportes seBatteryReport (Voltage) encontrados: {len(reports)}")
        print(
            "Rango temporal: "
            f"{first_r.timestamp.isoformat(sep=' ')}  ->  {last_r.timestamp.isoformat(sep=' ')}"
        )
        print(
            f"Primero: Voltage={first_r.voltage} @ {first_r.timestamp.isoformat(sep=' ')} (línea {first_r.line_no})"
        )
        print(
            f"Último:  Voltage={last_r.voltage} @ {last_r.timestamp.isoformat(sep=' ')} (línea {last_r.line_no})"
        )
        print(
            f"Mínimo:  Voltage={min_v.voltage} @ {min_v.timestamp.isoformat(sep=' ')} (línea {min_v.line_no})"
        )
        print(
            f"Máximo:  Voltage={max_v.voltage} @ {max_v.timestamp.isoformat(sep=' ')} (línea {max_v.line_no})"
        )

        print("Ejemplos (primeras 2 y últimas 2):")
        sample_r = reports[:2] + (reports[-2:] if len(reports) > 2 else [])
        for r in sample_r:
            extra_parts: list[str] = []
            if r.voltage_load is not None:
                extra_parts.append(f"VoltageLoad={r.voltage_load}")
            if r.consumed is not None:
                extra_parts.append(f"Consumed={r.consumed}")
            if r.temperature is not None:
                extra_parts.append(f"Temp={r.temperature}")
            extra = ("  " + ", ".join(extra_parts)) if extra_parts else ""
            print(
                f"  {r.timestamp.isoformat(sep=' ')}  Voltage={r.voltage}{extra}  (línea {r.line_no})"
            )

    print("---")
    if hints:
        print(
            f"Hints de voltios/mV para {device_keyword} encontrados en el archivo: {len(hints)} (mostrando hasta 5)"
        )
        for line_no, line in hints[:5]:
            short = line if len(line) <= 260 else (line[:257] + "...")
            print(f"  línea {line_no}: {short}")
    else:
        print(
            f"No vi en este archivo un mapeo explícito de {device_keyword} a V/mV (solo Battery: <n>), o no aplica."
        )


if __name__ == "__main__":
    main()
