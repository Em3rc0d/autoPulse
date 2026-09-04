# Q-OBD2-PID-CATALOG-20260904 — OBD-II PID research quarry

**Status:** `MINED_NOT_CANONICAL`  
**Captured:** 2026-09-04  
**Runtime impact:** none

## Purpose

Preserve a reproducible research inventory of standardized OBD-II data that AutoPulse may encounter while discovering an ECU.

This quarry is intentionally broader than the current runtime decoder. It is evidence for future `ECU discovery -> PID support -> decoder expansion -> Check` work; it is **not** a claim that every listed PID exists on every vehicle.

## What was ingested

The user-supplied `obd2-pack-v5.zip` contains CSS Electronics OBD2 examples, MF4 recordings, a Mode 01 OBD2 DBC, DTC DBCs, and manufacturer/proprietary CAN DBC material.

For this quarry we use only the standardized OBD2 DBC evidence:

- archive SHA-256: `97156b4ea5361f309b49ad14428fe175b0b2614d68e7b0d102007b17a2765c6a`
- nested OBD2 DBC archive SHA-256: `20c946bb1ef86e03b2b8186e422e36ce8a0816608627305c0600a5e290e87bc2`
- `OBD-v4.3.dbc` SHA-256: `b85e1417bed177d7b36c40e736001c2216fb8259496f26ec0fb40594554718c1`
- normalized Service 01 PIDs: **114**
- normalized signal definitions: **145**
- raw repeated DBC signal declarations: **580**

The raw 100+ MB pack, MF4 recordings, and proprietary manufacturer DBCs are **not** committed. Their presence is recorded only as provenance because they belong to separate evidence lanes.

## Files

- `mode01_pid_inventory.csv` — one row per discovered standardized Mode 01 PID in the supplied DBC, including aggregated signal/subfield names and units.
- `extract_mode01.py` — deterministic extractor that regenerates both the PID inventory and the 145-row signal-level inventory from the original pack.
- `sources.json` — provenance, hashes, source roles, normalization counts, and explicit boundaries.
- `RESEARCH_BOUNDARY.md` — PID vs DTC vs manufacturer/proprietary data boundary.

The signal-level CSV is intentionally generated on demand from the hashed source pack rather than committed as a second derived snapshot; this avoids drift between the PID aggregate and its lower-level expansion.

## Important interpretation rule

`STANDARD_DEFINED != VEHICLE_SUPPORTED != OBSERVED`.

A standard/catalog entry means “this request has a defined interpretation.” It does **not** mean the connected ECU supports it.

AutoPulse must continue to distinguish:

1. **defined by catalog/reference**
2. **advertised/supported by ECU**
3. **queried**
4. **validly observed**
5. **unavailable / invalid / not observed**

This matches the evidence semantics already used by Check.

## Existing AutoPulse runtime relation

The current `STANDARD_OBD_TIER_1` contains 10 Mode 01 PIDs:

`04, 05, 0B, 0C, 0D, 0F, 10, 11, 1F, 42`.

All **10/10** are present in this quarry. The remaining quarry entries are research candidates only. No runtime decoder, polling policy, or safety logic is expanded by this commit.

## Supported-PID discovery

The supplied DBC contains support bitmap requests for:

`0100, 0120, 0140, 0160, 0180, 01A0, 01C0`.

These requests are discovery evidence: their bitmap responses indicate support for subsequent PID blocks. AutoPulse should prefer that evidence over blind polling of the full catalog.

## Source roles

- **OBD2 Data Pack v5 / CSS Electronics** — machine-readable extraction source supplied by the user.
- **Wikipedia — OBD-II PIDs** — secondary reference for services, PID semantics and formulas.
- **Kelley Blue Book — OBD-II Code List** — DTC lookup/reference source only.

The KBB source is deliberately kept outside the PID table because DTCs and PIDs are different concepts.

## Promotion gate

Nothing in this quarry is automatically promoted to runtime or `golden-dataset`.

A candidate PID should move toward product use only after:

`reference definition -> decoder contract -> fixtures -> automated tests -> ECU support discovery -> physical evidence -> reviewed promotion`
