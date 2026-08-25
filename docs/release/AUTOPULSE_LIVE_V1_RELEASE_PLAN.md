# AutoPulse Live v1 — Release Plan

**Target:** first public Android release
**Product boundary:** AutoPulse Live v1, local-first
**Documentation status date:** 2026-08-24 / 2026-08-25 UTC boundary

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
- Driver modes with source-truthful prioritization.
- Phone-first cockpit.
- voice/color/haptic attention policy for meaningful conditions.
- Off-Road phone-sensor sidecar where supported.
- Persistent BINARY_OBD2_V3 sessions.
- History and reconstructed summaries.
- Explicit unsupported/degraded/invalid/interrupted states.
- Automated verification and compatibility evidence.

Deferred from v1 unless separately promoted/certified:

- AutoPulse Check and signed professional reports.
- OEM/Mode 22 catalog expansion.
- Proprietary DBC runtime support.
- iOS.
- broad Bluetooth Classic/Wi-Fi/USB support.
- cloud sync/accounts as a core dependency.
- active/destructive ECU commands.
- background recording.
- universal TPMS receiver integration/prediction.

## Current evidence summary

Physical field evidence exists for:

- Renault Logan 2014 + the project's primary tested BLE ELM-compatible adapter;
- Renault Duster 2014 + the same adapter;
- real RPM/speed/coolant observations across the physical program;
- adapter-origin voltage observation on Logan;
- waiting-for-first-ECU truth transition;
- Off-Road phone sensor observations on Logan;
- APP_BACKGROUND interruption persistence on Logan;
- durable History entries;
- persisted Session Summary reconstruction on Duster RC3.

Open physical defects/gates at this documentation cut:

- RC4 Duster Off-Road sidecar isolation retest;
- RC4 normal Stop session-level COMPLETE semantics retest;
- physical adapter unplug terminal behavior on stabilized candidate;
- abrupt process-kill recovery on stabilized candidate;
- current-build complete normal restart/reopen receipt;
- broader vehicle/manufacturer/adapter/Android compatibility matrix.

## Gates

### R0 — Foundation baseline — CLOSED in code

Acceptance retained:

- P0 stabilization is present on `main`.
- product DB bootstrap/reconciliation is retained.
- `BINARY_OBD2_V3` is the product recording format.
- third `NO_DATA` is preserved before operational PID retirement.
- TIMEOUT/adapter errors do not mutate vehicle capability history.
- `ATRV` and `0142` remain distinct signals.

### R1 — Renault Logan physical vertical — PARTIAL PHYSICAL PASS / NOT CLOSED

Physical evidence now proves substantial portions of the vertical:

- BLE adapter connection observed;
- ELM-compatible initialization observed;
- vehicle initialization/capability path observed;
- real ECU telemetry observed;
- Off-Road phone sensor/calibration behavior observed;
- APP_BACKGROUND explicit interruption observed;
- completed/interrupted History persistence observed.

Defects found during this gate:

- Android/Hermes Summary reconstruction failed on missing global TextDecoder — fixed in RC3 and later physically shown not to reproduce on Duster Summary;
- terminal Live UI could remain operational-looking after interruption — fixed in RC3 implementation.

Still required before R1 closes:

- current stabilized build normal Stop → Summary → History → restart → same Summary;
- physical adapter disconnect;
- abrupt process kill + boot recovery;
- current-build terminal UI recheck;
- evidence attached/recorded with exact build/APK metadata.

Canonical runbook: `R1_RENAULT_LOGAN_PHYSICAL_GATE.md`.

Quarry: `../mining-site/quarries/Q-001_RENAULT_LOGAN_2014.md`.

### R2 — Live lifecycle and integrity — IN PROGRESS / AUTOMATED STRONG

Release-1 policy:

- Live recording is foreground-only.
- app background while ACTIVE becomes explicit `INTERRUPTED / APP_BACKGROUND`.
- persistence drain is bounded; timeout becomes interrupted/degraded according to durable outcome.
- missing/corrupt/unsupported blocks may degrade a summary but can never be presented as complete.
- session stop/disconnect races have one terminal state.
- terminal UI freezes active behavior and exposes Summary/History rather than pretending to continue.
- clean USER_INITIATED Stop may remain COMPLETE when the only partial block is the expected final shorter flush and no other integrity defect exists.

Current evidence:

- automated lifecycle/recovery/summary tests green;
- APP_BACKGROUND physical persistence observed;
- History persistence observed;
- RC3 Summary reconstruction physically observed on Duster;
- BLE disconnect/process kill still need final physical certification.

### R3 — Golden Diagnostic Corpus — STARTED / RAW CORPUS PENDING

Documentation/evidence architecture now includes:

- `docs/mining-site/quarries/` for source physical evidence;
- `docs/golden-dataset/AUTOPULSE_GOLDEN_DATASET_V1.md` for normalized approved/candidate physical cases.

The raw byte-level diagnostic corpus remains incomplete.

Required regression families:

1. standard 11-bit OBD;
2. extended 29-bit OBD;
3. ISO-TP multi-frame DTC;
4. negative response;
5. high dynamic range telemetry;
6. mixed real-world bus/adapter response shapes;
7. corrupt/truncated block recovery;
8. timeout vs `NO_DATA` vs adapter-error distinction;
9. sequence gap/overlap persistence cases.

The corpus must exercise the product parser/decoder/block/SQLite/summary path without putting MF4/DBC tooling inside the mobile runtime.

Screenshots do not qualify as raw byte fixtures.

### R4 — Adapter Discovery v1 — IN PROGRESS / ONE PHYSICAL ADAPTER PATH

Behavioral adapter compatibility remains the design authority. Identity strings are evidence, not proof.

Minimum snapshot remains:

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

Current limitation:

- physical tests use the same primary adapter, so vehicle evidence has expanded faster than adapter diversity.
- no “all readers/connectors” claim is permitted.

### R5 — Vehicle Capability Discovery v1 — IN PROGRESS / PHYSICALLY EXERCISED ON TWO VEHICLES

Truth classes remain:

- `STANDARD_DEFINITION`;
- `CAPABILITY_ADVERTISED`;
- `PROBE_RESULT`;
- `LIVE_OBSERVATION`.

Progressive standard PID discovery and live observation are exercised in the current product path.

Physical vehicle observations now include Logan 2014 and Duster 2014 using the same adapter. This is meaningful but manufacturer diversity remains limited.

### R6 — Standard OBD Catalog v1 — IN PROGRESS

Release tiers:

- Tier 0: capability discovery ranges.
- Tier 1: RPM, speed, coolant, calculated load, MAP, intake temperature, MAF, throttle, runtime, ECU voltage and adapter voltage where genuinely supported.
- Tier 1.5 only after evidence: fuel trims, fuel level, barometric pressure, oil temperature, fuel rate.

RPM/speed/coolant are physically observed in current vehicle evidence. Optional Tier 1 presence still varies by vehicle and must be discovered rather than assumed.

Every decoder requires deterministic golden vectors. No formula is copied automatically from research material.

### R7 — Product UX completion — IN PROGRESS / RC3 PHONE-FIRST COCKPIT IMPLEMENTED

Core path:

`Garage → Vehicle → Connect → Adapter compatibility → Vehicle capabilities → Live → Stop → Summary → History`

RC3 product direction implemented:

- compact phone-first Driver Mode selector;
- primary telemetry prioritized over explanatory chrome;
- healthy Live state visually quiet;
- banners reserved for waiting/degraded/interrupted states;
- terminal session freezes active UI;
- voice/haptic interruption feedback;
- color severity language.

RC4 additionally protects Live acquisition from Off-Road phone-sensor workload/permission behavior.

Remaining UX validation:

- physical RC4 Off-Road retest;
- driving-context voice/haptic rate/clarity audit;
- accessibility and small-screen edge cases;
- alert hierarchy under simultaneous document/vehicle warnings.

### R8 — Compatibility certification — IN PROGRESS / NARROW MATRIX

Current physical matrix:

- Renault Logan 2014 + primary tested adapter;
- Renault Duster 2014 + same adapter.

This changes the vehicle while controlling the adapter and proves the code is not only a single-Logan demonstration, but it is not enough for broad compatibility certification.

Still needed:

- non-Renault vehicle(s);
- second adapter/connector family when hardware becomes available;
- additional Android device/version evidence;
- CAN 11-bit and 29-bit/ISO-TP matrix where applicable and captured;
- degraded/unsupported adapter examples.

The public compatibility promise is the tested support envelope, never “every reader/every car”.

### R9 — Production hardening — IN PROGRESS

Required before public RC:

- GitHub Actions `npm ci → npm run verify` gate;
- all intended Jest suites included;
- production/dev feature separation;
- no test login bypass in production;
- replay/benchmark/internal tooling unavailable in production UX;
- minimal Android permissions;
- cleartext restricted to non-production needs;
- DB migration/upgrade/corruption tests;
- privacy and diagnostic limitation text;
- reproducible signed release build;
- dependency/security audit review and explicit remediation/risk acceptance.

Known hygiene items include dependency audit findings and repository submodule cleanup warnings; they remain separate from physical gate truth.

### R10 — Release Candidate and v1.0 — PENDING

Freeze the RC only after lifecycle/Off-Road blockers are closed and the declared compatibility envelope is defensible.

Then rerun the complete matrix on the exact release artifact. Any P0/P1 truth/acquisition/persistence/lifecycle defect rejects the candidate and requires a new RC.

## Documentation/evidence governance

Canonical evidence architecture:

```text
brainstorming (non-authoritative)
→ design
→ plan
→ build
→ test
→ mining-site/quarries
→ golden-dataset
→ release claim
```

A fact may not skip evidence layers merely because it is plausible.

## Current execution order

```text
RC4 final APK
→ Duster Off-Road + clean-Stop retest
→ current-build normal lifecycle
→ BLE unplug
→ process-kill recovery
→ close primary lifecycle gate
→ internal beta readiness
→ non-Renault vehicle evidence
→ second adapter/connector when available
→ raw Golden Diagnostic Corpus expansion
→ production/security hardening
→ public RC freeze
→ v1.0
```

## Governance rule

Until AutoPulse Live v1.0 ships:

> No feature enters the release product merely because it was brainstormed. It must either close a release gate, fix a gate-discovered defect, or be explicitly promoted through Design and Plan with its own evidence burden.
