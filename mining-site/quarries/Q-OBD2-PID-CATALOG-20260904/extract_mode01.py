#!/usr/bin/env python3
"""Rebuild the normalized AutoPulse Mode 01 quarry from obd2-pack-v5.zip.

Usage:
    python extract_mode01.py /path/to/obd2-pack-v5.zip output_dir
"""
from __future__ import annotations
import csv, hashlib, io, re, sys, zipfile
from collections import defaultdict
from pathlib import Path

NESTED = "obd2-dbc/obd-dbc-files-v4.3.zip"
DBC = "obd2-dbc-files/regular-version/OBD-v4.3.dbc"
TIER1 = {"04","05","0B","0C","0D","0F","10","11","1F","42"}
SUPPORT = {"00","20","40","60","80","A0","C0","E0"}

SIGNAL_RE = re.compile(
    r'^\s*SG_\s+(S01PID([0-9A-Fa-f]{2})_([A-Za-z0-9_]+))\s+'
    r'(?:m\d+\s*:\s*)?(\d+)\|(\d+)@([01])([+-])\s+'
    r'\(([^,]+),([^)]+)\)\s+\[([^|]*)\|([^\]]*)\]\s+"([^"]*)"',
    re.M,
)

def f(x):
    try: return float(x)
    except ValueError: return None

def width(row):
    lo, hi = f(row["min"]), f(row["max"])
    return -1 if lo is None or hi is None else hi - lo

def main(src: Path, out: Path):
    raw = src.read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw)) as outer:
        nested = outer.read(NESTED)
    with zipfile.ZipFile(io.BytesIO(nested)) as inner:
        dbc_bytes = inner.read(DBC)
    dbc = dbc_bytes.decode("utf-8", errors="strict")

    declarations = []
    for m in SIGNAL_RE.finditer(dbc):
        declarations.append({
            "signal": m.group(1),
            "pid_hex": m.group(2).upper(),
            "field_name": m.group(3),
            "bit_length": int(m.group(5)),
            "factor": m.group(8),
            "offset": m.group(9),
            "min": m.group(10),
            "max": m.group(11),
            "unit": m.group(12),
        })

    by_signal = defaultdict(list)
    for row in declarations:
        by_signal[row["signal"]].append(row)

    signals = sorted(
        (max(v, key=width) for v in by_signal.values()),
        key=lambda r: (int(r["pid_hex"], 16), r["signal"]),
    )

    by_pid = defaultdict(list)
    for row in signals:
        by_pid[row["pid_hex"]].append(row)

    out.mkdir(parents=True, exist_ok=True)
    with (out / "mode01_signal_inventory.csv").open("w", newline="", encoding="utf-8") as fp:
        fields = ["service","pid_hex","request_id","dbc_signal","field_name",
                  "bit_length","factor","offset","min","max","unit"]
        w = csv.DictWriter(fp, fieldnames=fields)
        w.writeheader()
        for row in signals:
            w.writerow({
                "service":"01", "pid_hex":row["pid_hex"],
                "request_id":"01"+row["pid_hex"], "dbc_signal":row["signal"],
                "field_name":row["field_name"], "bit_length":row["bit_length"],
                "factor":row["factor"], "offset":row["offset"], "min":row["min"],
                "max":row["max"], "unit":row["unit"],
            })

    with (out / "mode01_pid_inventory.csv").open("w", newline="", encoding="utf-8") as fp:
        fields = ["service","pid_hex","pid_decimal","request_id","signal_count",
                  "signal_names","units","support_bitmap","current_autopulse_tier1",
                  "evidence_status"]
        w = csv.DictWriter(fp, fieldnames=fields)
        w.writeheader()
        for pid in sorted(by_pid, key=lambda x: int(x,16)):
            items = by_pid[pid]
            w.writerow({
                "service":"01", "pid_hex":pid, "pid_decimal":int(pid,16),
                "request_id":"01"+pid, "signal_count":len(items),
                "signal_names":"|".join(sorted({r["field_name"] for r in items})),
                "units":"|".join(sorted({r["unit"] for r in items if r["unit"]})),
                "support_bitmap":"YES" if pid in SUPPORT else "NO",
                "current_autopulse_tier1":"YES" if pid in TIER1 else "NO",
                "evidence_status":"DBC_OBSERVED",
            })

    print("archive_sha256", hashlib.sha256(raw).hexdigest())
    print("nested_sha256", hashlib.sha256(nested).hexdigest())
    print("dbc_sha256", hashlib.sha256(dbc_bytes).hexdigest())
    print("raw_declarations", len(declarations))
    print("normalized_signals", len(signals))
    print("unique_pids", len(by_pid))

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_mode01.py INPUT_ZIP OUTPUT_DIR")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
