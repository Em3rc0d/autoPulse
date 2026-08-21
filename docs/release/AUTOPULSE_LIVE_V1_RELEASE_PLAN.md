# AutoPulse Live v1 — Release Plan

**Target:** first public Android release
**Product boundary:** AutoPulse Live v1, local-first
**Branch:** `release/v1-readiness`

## Release promise

A user can install AutoPulse on Android, create/select a vehicle, connect a supported OBD adapter, let AutoPulse discover the connection and vehicle capabilities, view only signals that are genuinely available, record a Live session, stop or recover safely from interruption, and reopen an honest persisted summary after restart.

Release 1 does **not** promise every PID on every vehicle or every adapter ever produced. It promises adaptive discovery and truthful degradation inside the certified support envelope.

## Scope frozen for v1

Included:

- Android.
- Local-first product database.
- Garage and vehicle selection.
- BLE OBD adapter discovery/probe.
- ELM-compatible Release-1 dialect support.
- Vehicle protocol initialization.
- Standard OBD capability discovery.
- AutoPulse Live telemetry.
- Persistent BINARY_OBD2_V3 sessions.
- History and reconstructed summaries.
- Explicit unsupported/degraded/invalid states.
- Automated verification and compatibility evidence.

Deferred from v1:

- AutoPulse Check and signed professional reports.
- OEM/Mode 22 catalog expansion.
- Proprietary DBC runtime support.
- iOS.
- Broad Bluetooth Classic/Wi-Fi/USB support.
- Cloud sync/accounts as a core dependency.
- Active/destructive ECU commands.
- Background recording.

## Gates

### R0 — Foundation baseline — CLOSED in code

Acceptance:

- P0 stabilization is present on `main`.
- Product DB bootstrap/reconciliation is retained.
- `BINARY_OBD2_V3` is the product recording format.
- third `NO_DATA` is preserved before operational PID retirement.
- TIMEOUT/adapter errors do not mutate vehicle capability history.
- `ATRV` and `0142` remain distinct signals.

### R1 — Renault Logan physical vertical — PENDING PHYSICAL EVIDENCE

Run the full clean-install → vehicle → adapter → initialization → Live → stop → summary → restart chain on the Renault Logan and execute the interruption matrix.

Canonical runbook: `R1_RENAULT_LOGAN_PHYSICAL_GATE.md`.

### R2 — Live lifecycle and integrity — IN PROGRESS

Release-1 policy:

- Live recording is foreground-only.
- app background while ACTIVE becomes explicit `INTERRUPTED / APP_BACKGROUND`.
- persistence drain is bounded; timeout becomes `INTERRUPTED / TELEMETRY_DRAIN_TIMEOUT`.
- missing/corrupt/unsupported blocks may degrade a summary but can never be presented as complete.
- session stop/disconnect races have one terminal state.

Exit:

- unit/integration suite green;
- physical interruption matrix green;
- no indefinite ACTIVE/STOPPING/FLUSHING state.

### R3 — Golden Diagnostic Corpus — PENDING

Create an offline fixture pipeline derived from approved diagnostic captures. Required regression families:

1. standard 11-bit OBD;
2. extended 29-bit OBD;
3. ISO-TP multi-frame DTC;
4. negative response;
5. high dynamic range telemetry;
6. mixed real-world bus;
7. corrupt/truncated block recovery.

The corpus must exercise the product parser/decoder/block/SQLite/summary path without putting MF4/DBC tooling inside the mobile runtime.

### R4 — Adapter Discovery v1 — PENDING

Introduce behavioral adapter capability discovery. Identity strings are evidence, not authority.

Minimum snapshot:

- transport;
- reported identity/firmware;
- dialect candidate;
- prompt reliability;
- echo/space/header/linefeed behavior;
- multiline/fragmentation behavior;
- command latency;
- supported required/preferred/optional initialization behaviors;
- observed quirks;
- compatibility grade.

Grades:

- CERTIFIED;
- COMPATIBLE;
- DEGRADED;
- UNSUPPORTED.

### R5 — Vehicle Capability Discovery v1 — PENDING

Separate four kinds of truth:

- `STANDARD_DEFINITION`;
- `CAPABILITY_ADVERTISED`;
- `PROBE_RESULT`;
- `LIVE_OBSERVATION`.

Implement progressive standard PID range discovery (`0100`, `0120`, `0140`, ...), stopping according to advertised continuation support.

### R6 — Standard OBD Catalog v1 — PENDING

Release tiers:

- Tier 0: capability discovery ranges.
- Tier 1: RPM, speed, coolant, calculated load, MAP, intake temperature, MAF, throttle, runtime, ECU voltage and adapter voltage where supported.
- Tier 1.5 only after evidence: fuel trims, fuel level, barometric pressure, oil temperature, fuel rate.

Every decoder requires deterministic golden vectors. No formula is copied automatically from research material.

### R7 — Product UX completion — PENDING

The normal user must never configure AT commands, CAN IDs or raw PIDs.

Core path:

`Garage → Vehicle → Connect → Adapter compatibility → Vehicle capabilities → Live → Stop → Summary → History`

All visible states must be truthful: loading, empty, supported, unavailable, degraded, interrupted, corrupted and recoverable error.

### R8 — Compatibility certification — PENDING

Build evidence across:

- multiple adapters (known good, generic, degraded);
- multiple vehicles/manufacturers/years;
- CAN 11-bit and 29-bit;
- ISO-TP cases;
- multiple Android devices/versions.

The public compatibility promise is the tested support envelope, never “every reader/every car”.

### R9 — Production hardening — IN PROGRESS

Required before RC:

- GitHub Actions `npm ci → npm run verify` gate;
- all intended Jest suites included;
- production/dev feature separation;
- no test login bypass in production;
- replay/benchmark/internal tooling unavailable in production UX;
- minimal Android permissions;
- cleartext restricted to non-production needs;
- DB migration/upgrade/corruption tests;
- privacy and diagnostic limitation text;
- reproducible signed release build.

### R10 — Release Candidate and v1.0 — PENDING

Freeze the RC and rerun the complete test matrix. Any P0/P1 defect rejects the candidate and requires a new RC.

## Governance rule

Until AutoPulse Live v1.0 ships:

> No feature enters the product unless it closes one of R1–R10 or fixes a defect discovered by those gates.

## Current execution order

`R0 CLOSED → R1 physical evidence + R2 hardening → R3 corpus → R4 adapter discovery → R5 vehicle discovery → R6 catalog → R7 UX → R8 compatibility → R9 production hardening → R10 RC → v1.0`
