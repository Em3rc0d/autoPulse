#!/usr/bin/env python3
"""Rebuild the normalized AutoPulse Mode 01 quarry from obd2-pack-v5.zip.

Usage:
    python extract_mode01.py /path/to/obd2-pack-v5.zip output_dir

This extractor is fail-closed for the frozen v5 evidence pack:
- source hashes must match the recorded provenance;
- extraction counts must match the frozen baseline;
- repeated declarations may normalize only when their decoding semantics agree.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

NESTED = "obd2-dbc/obd-dbc-files-v4.3.zip"
DBC = "obd2-dbc-files/regular-version/OBD-v4.3.dbc"

EXPECTED_ARCHIVE_SHA256 = "97156b4ea5361f309b49ad14428fe175b0b2614d68e7b0d102007b17a2765c6a"
EXPECTED_NESTED_SHA256 = "20c946bb1ef86e03b2b8186e422e36ce8a0816608627305c0600a5e290e87bc2"
EXPECTED_DBC_SHA256 = "b85e1417bed177d7b36c40e736001c2216fb8259496f26ec0fb40594554718c1"
EXPECTED_RAW_DECLARATIONS = 580
EXPECTED_NORMALIZED_SIGNALS = 145
EXPECTED_UNIQUE_PIDS = 114

TIER1 = {"04", "05", "0B", "0C", "0D", "0F", "10", "11", "1F", "42"}
EXPECTED_TIER1_PRESENT = 10
SUPPORT = {"00", "20", "40", "60", "80", "A0", "C0", "E0"}

SIGNAL_RE = re.compile(
    r'^\s*SG_\s+(S01PID([0-9A-Fa-f]{2})_([A-Za-z0-9_]+))\s+'
    r'(?:m\d+\s*:\s*)?(\d+)\|(\d+)@([01])([+-])\s+'
    r'\(([^,]+),([^)]+)\)\s+\[([^|]*)\|([^\]]*)\]\s+"([^"]*)"',
    re.M,
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require_equal(label: str, actual, expected) -> None:
    if actual != expected:
        raise RuntimeError(f"{label}_MISMATCH expected={expected} actual={actual}")


def canonical_number(value: str) -> str:
    return value.strip()


def decode_signature(row: dict) -> tuple:
    return (
        row["pid_hex"],
        row["field_name"],
        row["start_bit"],
        row["bit_length"],
        row["byte_order"],
        row["signedness"],
        canonical_number(row["factor"]),
        canonical_number(row["offset"]),
        canonical_number(row["min"]),
        canonical_number(row["max"]),
        row["unit"],
    )


def main(src: Path, out: Path) -> None:
    raw = src.read_bytes()
    require_equal("archive_sha256", sha256(raw), EXPECTED_ARCHIVE_SHA256)

    with zipfile.ZipFile(io.BytesIO(raw)) as outer:
        nested = outer.read(NESTED)
    require_equal("nested_sha256", sha256(nested), EXPECTED_NESTED_SHA256)

    with zipfile.ZipFile(io.BytesIO(nested)) as inner:
        dbc_bytes = inner.read(DBC)
    require_equal("dbc_sha256", sha256(dbc_bytes), EXPECTED_DBC_SHA256)

    dbc = dbc_bytes.decode("utf-8", errors="strict")

    declarations = []
    for m in SIGNAL_RE.finditer(dbc):
        declarations.append(
            {
                "signal": m.group(1),
                "pid_hex": m.group(2).upper(),
                "field_name": m.group(3),
                "start_bit": int(m.group(4)),
                "bit_length": int(m.group(5)),
                "byte_order": "LITTLE_ENDIAN" if m.group(6) == "1" else "BIG_ENDIAN",
                "signedness": "SIGNED" if m.group(7) == "-" else "UNSIGNED",
                "factor": m.group(8).strip(),
                "offset": m.group(9).strip(),
                "min": m.group(10).strip(),
                "max": m.group(11).strip(),
                "unit": m.group(12),
            }
        )

    require_equal("raw_declarations", len(declarations), EXPECTED_RAW_DECLARATIONS)

    by_signal = defaultdict(list)
    for row in declarations:
        by_signal[row["signal"]].append(row)

    signals = []
    conflicts = []
    for signal_name, variants in sorted(by_signal.items()):
        signatures = {decode_signature(row) for row in variants}
        if len(signatures) != 1:
            conflicts.append(
                {
                    "signal": signal_name,
                    "variant_count": len(variants),
                    "signature_count": len(signatures),
                }
            )
            continue
        signals.append(variants[0])

    if conflicts:
        details = "; ".join(
            f'{item["signal"]}:variants={item["variant_count"]},signatures={item["signature_count"]}'
            for item in conflicts
        )
        raise RuntimeError(f"NORMALIZATION_CONFLICT {details}")

    signals.sort(key=lambda row: (int(row["pid_hex"], 16), row["signal"]))
    require_equal("normalized_signals", len(signals), EXPECTED_NORMALIZED_SIGNALS)

    by_pid = defaultdict(list)
    for row in signals:
        by_pid[row["pid_hex"]].append(row)

    require_equal("unique_pids", len(by_pid), EXPECTED_UNIQUE_PIDS)
    tier1_present = len(TIER1.intersection(by_pid.keys()))
    require_equal("tier1_present", tier1_present, EXPECTED_TIER1_PRESENT)

    out.mkdir(parents=True, exist_ok=True)

    signal_path = out / "mode01_signal_inventory.csv"
    with signal_path.open("w", newline="", encoding="utf-8") as fp:
        fields = [
            "service", "pid_hex", "request_id", "dbc_signal", "field_name",
            "start_bit", "bit_length", "byte_order", "signedness",
            "factor", "offset", "min", "max", "unit", "evidence_status",
        ]
        writer = csv.DictWriter(fp, fieldnames=fields)
        writer.writeheader()
        for row in signals:
            writer.writerow({
                "service": "01",
                "pid_hex": row["pid_hex"],
                "request_id": "01" + row["pid_hex"],
                "dbc_signal": row["signal"],
                "field_name": row["field_name"],
                "start_bit": row["start_bit"],
                "bit_length": row["bit_length"],
                "byte_order": row["byte_order"],
                "signedness": row["signedness"],
                "factor": row["factor"],
                "offset": row["offset"],
                "min": row["min"],
                "max": row["max"],
                "unit": row["unit"],
                "evidence_status": "DBC_DEFINED",
            })

    pid_path = out / "mode01_pid_inventory.csv"
    with pid_path.open("w", newline="", encoding="utf-8") as fp:
        fields = [
            "service", "pid_hex", "pid_decimal", "request_id", "signal_count",
            "signal_names", "units", "support_bitmap", "current_autopulse_tier1",
            "evidence_status",
        ]
        writer = csv.DictWriter(fp, fieldnames=fields)
        writer.writeheader()
        for pid in sorted(by_pid, key=lambda value: int(value, 16)):
            items = by_pid[pid]
            writer.writerow({
                "service": "01",
                "pid_hex": pid,
                "pid_decimal": int(pid, 16),
                "request_id": "01" + pid,
                "signal_count": len(items),
                "signal_names": "|".join(sorted({r["field_name"] for r in items})),
                "units": "|".join(sorted({r["unit"] for r in items if r["unit"]})),
                "support_bitmap": "YES" if pid in SUPPORT else "NO",
                "current_autopulse_tier1": "YES" if pid in TIER1 else "NO",
                "evidence_status": "DBC_DEFINED",
            })

    print("archive_sha256", sha256(raw))
    print("nested_sha256", sha256(nested))
    print("dbc_sha256", sha256(dbc_bytes))
    print("raw_declarations", len(declarations))
    print("normalized_signals", len(signals))
    print("unique_pids", len(by_pid))
    print("tier1_present", tier1_present)
    print("normalization_conflicts", 0)
    print("pid_inventory", pid_path)
    print("signal_inventory", signal_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_mode01.py INPUT_ZIP OUTPUT_DIR")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
