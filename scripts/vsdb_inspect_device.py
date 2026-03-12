#!/usr/bin/env python3
"""Inspect a CU SQLite DB (vsdb_cu.sqlite3) and print one device row with column names.

Usage:
  python scripts/vsdb_inspect_device.py --db /path/to/vsdb_cu.sqlite3 --serial 2DQDHDHN

It also prints a quick diff-like view for numeric "flag" columns when you pass a second serial.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from typing import Any, Iterable


def get_table_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    rows = conn.execute(f"PRAGMA table_info({table});").fetchall()
    # row: (cid, name, type, notnull, dflt_value, pk)
    return [r[1] for r in rows]


def list_tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
    return {r[0] for r in rows}


def fetch_by_label(conn: sqlite3.Connection, table: str, label: str) -> dict[str, Any] | None:
    cols = get_table_columns(conn, table)
    if not cols:
        return None

    if "label" not in cols:
        return None

    row = conn.execute(f"SELECT * FROM {table} WHERE label = ? LIMIT 1", (label,)).fetchone()
    if row is None:
        return None
    return dict(zip(cols, row))


def fetch_many_by_column(conn: sqlite3.Connection, table: str, column: str, value: str) -> list[dict[str, Any]] | None:
    cols = get_table_columns(conn, table)
    if not cols or column not in cols:
        return None
    rows = conn.execute(f"SELECT * FROM {table} WHERE {column} = ?", (value,)).fetchall()
    return [dict(zip(cols, r)) for r in rows]


def pretty_print_row(title: str, row: dict[str, Any] | None) -> None:
    print(f"=== {title} ===")
    if row is None:
        print("(not found)")
        return
    print(json.dumps(row, indent=2, ensure_ascii=False, default=str))


def pretty_print_rows(title: str, rows: list[dict[str, Any]] | None) -> None:
    print(f"=== {title} ===")
    if not rows:
        print("(none)")
        return
    print(json.dumps(rows, indent=2, ensure_ascii=False, default=str))


def fetch_one_device(conn: sqlite3.Connection, serial: str) -> dict[str, Any] | None:
    cols = get_table_columns(conn, "devices")
    if not cols:
        raise RuntimeError("No columns returned for table 'devices'. Is this the right DB?")

    # Try common serial column names first; fall back to scan.
    serial_col_candidates = [c for c in cols if c.lower() in ("serial", "serial_number", "serialnumber", "device_serial")]
    where_clause = None
    params: tuple[Any, ...] = ()

    for c in serial_col_candidates:
        where_clause = f"{c} = ?"
        params = (serial,)
        row = conn.execute(f"SELECT * FROM devices WHERE {where_clause} LIMIT 1", params).fetchone()
        if row is not None:
            return dict(zip(cols, row))

    # If we don't know the serial column name, brute-force by checking all TEXT-ish columns.
    # This is safe because it just tries equality matches.
    for c in cols:
        try:
            row = conn.execute(f"SELECT * FROM devices WHERE {c} = ? LIMIT 1", (serial,)).fetchone()
        except sqlite3.OperationalError:
            continue
        if row is not None:
            return dict(zip(cols, row))

    return None


def pretty_print_device(device: dict[str, Any]) -> None:
    print(json.dumps(device, indent=2, ensure_ascii=False, default=str))


def numeric_flag_candidates(device: dict[str, Any]) -> list[str]:
    candidates: list[str] = []
    for k, v in device.items():
        if isinstance(v, int) and 0 <= v <= 1024:
            # Heuristic: many flag/bitmask fields are smallish integers.
            candidates.append(k)
    return candidates


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True, help="Path to vsdb_cu.sqlite3")
    ap.add_argument("--serial", required=True, help="Device serial to inspect (e.g., 2DQDHDHN)")
    ap.add_argument("--serial2", help="Optional second serial to compare")
    ap.add_argument(
        "--related",
        nargs="*",
        default=["mok", "lock", "keyfob", "mappings"],
        help="Related tables to print when present (default: mok lock keyfob mappings)",
    )
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = None

    try:
        tables = list_tables(conn)
        device1 = fetch_one_device(conn, args.serial)
        if device1 is None:
            raise SystemExit(f"Device with serial '{args.serial}' not found in devices")

        pretty_print_row("devices row (serial1)", device1)

        related_tables: list[str] = [t for t in args.related if t in tables]
        for t in related_tables:
            if t == "mappings":
                related_rows = fetch_many_by_column(conn, "mappings", "device_label", args.serial)
                pretty_print_rows("mappings rows (serial1)", related_rows)
            else:
                related = fetch_by_label(conn, t, args.serial)
                pretty_print_row(f"{t} row (serial1)", related)

        if args.serial2:
            device2 = fetch_one_device(conn, args.serial2)
            if device2 is None:
                raise SystemExit(f"Device with serial '{args.serial2}' not found in devices")

            print()
            pretty_print_row("devices row (serial2)", device2)

            for t in related_tables:
                if t == "mappings":
                    related_rows = fetch_many_by_column(conn, "mappings", "device_label", args.serial2)
                    pretty_print_rows("mappings rows (serial2)", related_rows)
                else:
                    related = fetch_by_label(conn, t, args.serial2)
                    pretty_print_row(f"{t} row (serial2)", related)

            print("\n=== numeric differences (heuristic) ===")
            keys = sorted(set(numeric_flag_candidates(device1)) | set(numeric_flag_candidates(device2)))
            any_diff = False
            for k in keys:
                v1 = device1.get(k)
                v2 = device2.get(k)
                if v1 != v2:
                    any_diff = True
                    print(f"{k}: {v1} -> {v2}")
            if not any_diff:
                print("(no numeric diffs found by heuristic)")

    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
