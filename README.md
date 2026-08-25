# AutoPulse 🚗⚡

**Android vehicle intelligence and Live OBD telemetry — local-first, evidence-driven, read-only.**

AutoPulse connects an Android phone to a supported OBD adapter, discovers the actual adapter/vehicle capabilities, presents only evidence it can justify, records durable Live sessions and reconstructs honest History/Summaries.

The current product is **not** a Logan-specific dashboard and does **not** promise every car/every reader. Compatibility expands through physical evidence.

## Current v1 direction

```text
Vehicle ECU
   ↓ OBD-II
ELM-compatible adapter
   ↓ BLE (current Release-1 physical lane)
Android AutoPulse
   ├─ adapter/vehicle capability discovery
   ├─ Live ECU telemetry
   ├─ Driver Intelligence + modes
   ├─ phone-sensor Off-Road sidecar
   ├─ voice / color / haptic alerts
   ├─ BINARY_OBD2_V3 durable recording
   ├─ SQLite product persistence
   └─ History + reconstructed Session Summary
```

Core operation for v1 is local-first. The historical `backend/` and other experiments remain in the repository, but a cloud backend/MongoDB/WebSocket pipeline is **not a core dependency of the current AutoPulse Live v1 release path**.

## Product truth rules

AutoPulse treats data provenance as part of the product:

- missing data is not zero;
- invalid data is not valid telemetry;
- phone sensors are not ECU data;
- `ATRV` adapter voltage is not Mode 01 PID `0142` ECU/control-module voltage;
- adapter configuration success is not ECU-live proof;
- a valid ECU-origin OBD observation is required before healthy Live;
- `A0` is automatic/provisional protocol evidence until sufficient real exchange resolves the presentation;
- internal unknown sentinels such as ECU `-1` never belong in user UI;
- a successful test on one vehicle/adapter does not become a universal compatibility promise.

## Smartphone-first Live cockpit

AutoPulse is designed for a phone-sized screen.

Healthy driving state is intentionally quiet:

- vehicle + session context;
- compact Driver Mode selector;
- primary metrics such as RPM/speed/coolant where available;
- subtle healthy Live indicator;
- trends/details below primary telemetry.

Large colored status banners are reserved for waiting, degraded, interrupted or critical states.

### Attention model

- **Green:** healthy/available; usually silent.
- **Amber/orange:** waiting, partial evidence or attention.
- **Red:** critical/terminal/interrupted.
- **Voice:** short meaning/action-oriented messages, not continuous PID reading.
- **Haptics:** reinforce warning/critical transitions.

## Driver modes

Current mode family:

- Essential;
- Family / Daily;
- Performance;
- Off-Road;
- Diagnostic.

Modes change **priority and interpretation**, never the underlying truth of telemetry.

Off-Road combines ECU telemetry with phone-origin pitch/roll/altitude/heading. Phone sensors are a subordinate sidecar: they must never stop, restart or starve ECU acquisition.

## Live lifecycle

Conceptual state progression:

```text
CONNECTING
→ ADAPTER_READY
→ VEHICLE_READY
→ WAITING_FOR_FIRST_ECU_SAMPLE
→ LIVE_ECU
→ COMPLETED / INTERRUPTED / DEGRADED
```

Release-1 recording is foreground-only. Backgrounding an ACTIVE session becomes explicit `APP_BACKGROUND` interruption instead of silently claiming recording continued.

Abrupt Android process kill is recovered on the next boot from durable SQLite/telemetry evidence.

## Durable sessions

Live OBD events are assembled into telemetry blocks and persisted in the product database. History exposes completed/interrupted sessions and can reconstruct terminal summaries.

Summary integrity can be:

- COMPLETE;
- PARTIAL;
- DEGRADED;
- CORRUPTED;
- UNAVAILABLE.

A normal user Stop may end with a shorter final telemetry window. That expected final block does not by itself make the entire completed session PARTIAL.

## Physical evidence today

The physical program currently includes:

### Renault Logan 2014

Observed:

- BLE/ELM/vehicle initialization;
- real ECU telemetry;
- RPM/speed/coolant across the physical program;
- adapter voltage separately;
- phone-sensor Off-Road observations;
- explicit `APP_BACKGROUND` interruption;
- durable completed/interrupted History entries.

Historical defects found through this run included Android/Hermes `TextDecoder` Summary reconstruction and terminal Live UI truth; RC3 implemented fixes.

### Renault Duster 2014

Using the same adapter, RC3 physically observed:

- initialization;
- waiting → first ECU sample → healthy Live;
- RPM;
- vehicle speed;
- coolant;
- Essential/Family/Performance mode continuity;
- successful persisted Session Summary reconstruction.

The Duster exposed two RC3 defects:

- Off-Road could destabilize the ECU/session path;
- a clean USER_INITIATED Stop could be mislabeled `Session PARTIAL`.

RC4 addresses both and is waiting for the focused physical retest.

## RC4 test artifact

Current frozen RC4 candidate for the Duster retest:

- commit: `4f463a0925cc069b5e835a430132da9e9b9ab092`;
- PR: #37;
- Mobile Verify: **SUCCESS**;
- Android APK PR Build: **SUCCESS**;
- APK SHA-256: `437181487c0591e3083364accf1e38129af219b1a90227c8612026fbee4ee493`.

CI success does not mean Off-Road physical PASS; that result must be recorded in Q-003 after the vehicle run.

## Development setup

### Mobile app

```bash
cd mobile-app
npm ci
npm run verify
```

For Android native execution/build use the repository Android/React Native workflow rather than Expo Go for BLE/native functionality.

The CI workflows are the preferred reproducibility authority for candidate verification and APK production.

## Documentation architecture

Start here:

[`docs/README.md`](docs/README.md)

AutoPulse knowledge is intentionally separated into:

```text
docs/
├─ brainstorming/        # ideas only; non-authoritative
├─ design/               # accepted system/product invariants
├─ plan/                 # ordered gates and acceptance criteria
├─ build/                # implementation / PR / artifact receipts
├─ test/                 # automated + physical validation ledger
├─ mining-site/
│  └─ quarries/          # raw/minimally interpreted field evidence
├─ golden-dataset/       # normalized approved/candidate evidence
└─ release/              # compatibility and release contracts
```

Important entries:

- `docs/design/AUTOPULSE_SYSTEM_DESIGN.md`
- `docs/plan/AUTOPULSE_EXECUTION_PLAN.md`
- `docs/build/AUTOPULSE_BUILD_LEDGER.md`
- `docs/build/RC4_ARTIFACT_RECEIPT.md`
- `docs/test/AUTOPULSE_TEST_LEDGER.md`
- `docs/mining-site/quarries/Q-001_RENAULT_LOGAN_2014.md`
- `docs/mining-site/quarries/Q-002_RENAULT_DUSTER_2014.md`
- `docs/mining-site/quarries/Q-003_RENAULT_DUSTER_2014_RC4_RETEST.md`
- `docs/golden-dataset/AUTOPULSE_GOLDEN_DATASET_V1.md`
- `docs/release/AUTOPULSE_LIVE_V1_RELEASE_PLAN.md`
- `docs/release/COMPATIBILITY_CONTRACT_V1.md`
- `docs/release/RELEASE_CANDIDATE_RUNBOOK.md`

## Release status

```text
P0 foundation                         ✅ code closed
Real Logan ECU acquisition            ✅ physically observed
Real Duster ECU acquisition           ✅ physically observed
RC3 Android Summary reconstruction    ✅ physically observed on Duster
Phone-first cockpit                   ✅ implemented
Voice/color/haptic direction          ✅ implemented/in validation
RC4 Off-Road isolation                ✅ code + CI
RC4 clean Stop Summary semantics      ✅ code + CI
RC4 Duster physical retest            ⏳ next
Physical BLE-unplug lifecycle         ⏳ pending
Abrupt process-kill recovery          ⏳ pending
Broader adapter/manufacturer matrix   ⏳ pending
Public v1                             🔒 not yet certified
```

## Release philosophy

> Observed ≠ universal. Implemented ≠ physically passed. CI green ≠ release ready. Unknown ≠ PASS.

AutoPulse v1 ships only when the declared support envelope is backed by the repository evidence chain.
