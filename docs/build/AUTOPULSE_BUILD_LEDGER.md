# AutoPulse Build Ledger

**Lane:** Build
**Authority:** IMPLEMENTATION RECEIPT
**Repository:** `Em3rc0d/autoPulse`

This ledger records product-critical implementation changes tied to physical defects, release gates, branches, PRs and CI receipts. It is not a replacement for Git history.

## 1. Baseline product path

```text
Android / React Native
→ BLE transport
→ ELM-compatible adapter behavior
→ OBD request/response
→ decoder + source truth
→ Live cockpit / Driver Intelligence
→ acquisition events
→ BINARY_OBD2_V3 telemetry blocks
→ SQLite product persistence
→ History
→ reconstructed Session Summary
```

Off-Road phone sensors are a separate sidecar path and are never allowed to own the OBD connection lifecycle.

## 2. P0 / physical acquisition foundation

Implemented before the RC3/RC4 cycle:

- BLE adapter connection retained through initialization;
- ELM command/control path;
- real OBD protocol initialization;
- Mode 01 capability discovery;
- real telemetry polling;
- repeated `NO_DATA` operational retirement after preserving the third result;
- telemetry event mapping;
- telemetry block assembly and persistence;
- durable Live session repository;
- Session Summary builder;
- product database bootstrap/local context;
- adapter and vehicle capability evidence structures.

Invariant: `ATRV` adapter voltage and PID `0142` ECU/control-module voltage are separate signals.

## 3. RC2 / physical-truth corrections

Branch lineage included `fix/rc2-physical-truth-20260824`.

### ECU Live truth

`mobile-app/src/application/live/LiveEcuTruth.ts`

Implemented:

- WAITING_FOR_FIRST_ECU_SAMPLE;
- delayed ECU evidence;
- live ECU evidence;
- recording degradation/interruption presentation.

A valid ECU-origin OBD reading can unlock Live. Adapter-only AT/ATRV evidence cannot.

### Protocol truth

`ObdProtocolPresentation.ts` and real initialization code ensure:

- `A0` remains unresolved automatic-selection evidence initially;
- protocol evidence can be re-queried after real OBD exchange;
- user-facing protocol is humanized when justified;
- internal ECU unknown sentinel values do not leak to UI.

### Phone-sensor truth

Implemented:

- timestamps/accuracy;
- phone-relative vs vehicle-relative distinction;
- vehicle-scoped level calibration;
- honest altitude acquisition/unavailable state;
- no fake `0 m` when altitude is unresolved.

### Driver-mode truth

Required dimensions must actually be present/valid for READY. Degraded evidence remains PARTIAL rather than being promoted for visual convenience.

## 4. Lifecycle + History hardening

Branch: `fix/p1-lifecycle-history-recovery-20260824`
PR #32
Squash lineage: `7eaa1e0876e3b910ff2375b097aadfe059d0257f`

### Orphan recovery

`live-session.repository.ts` now reconciles stale CREATED/PREPARING/ACTIVE/STOPPING sessions from durable telemetry facts:

- block/event/reading counts;
- last committed sequence;
- last durable telemetry time;
- interruption reason `UNEXPECTED_APP_TERMINATION` unless stronger prior evidence exists;
- no claim that a killed process kept recording until reopen.

### Startup integration

Database lifecycle runs orphan reconciliation before product DB becomes READY.

### History

`HistoryScreen.tsx` replaced the placeholder with durable session history:

- vehicle;
- status;
- timestamp/duration;
- blocks/readings;
- termination reason;
- short session ID;
- reconstructed Summary navigation for eligible terminal sessions.

### Navigation

Session Summary Done routes to History through the real navigator path.

### Notable stabilization commits

- `9b88c6bc8b4fc9f2dd89a58bcb6d0d0629c25045` — orphan recovery update typing;
- `f1df83e8c8f8d203e962e286aff752db82e42076` — stable History test DB identity;
- `b8951544176b810841c8e793364e7f87697a735b` — completed summaries return to durable History;
- `050b51399e0580b5983db17c0a49295c2c9829ed` — interruption surfaced through Live error/terminal boundary.

## 5. P1 integration

PR #30: `feat(p1): Driver Intelligence + connector-aware runtime RC`

P1 combined:

- Driver Intelligence;
- connector-aware real runtime;
- physical-truth fixes;
- lifecycle persistence/history hardening;
- interruption semantics.

It was merged only after the final P1 head passed Mobile Verify and Android APK build.

## 6. RC3 — Android reconstruction + mobile cockpit

PR #36
Final relevant head: `6ac2fac8…`

### Hermes-safe persisted Summary reconstruction

Physical Logan failure:

```text
Failed to reconstruct session.
Property 'TextDecoder' doesn't exist
```

Root cause: the product codec path assumed ambient global `TextDecoder`, available in Node but absent in the tested Android/Hermes runtime.

RC3 implemented a runtime-safe UTF-8 text encoding/decoding path and regression coverage.

Physical closure evidence appeared later on the Duster: a real persisted RC3 Session Summary opened successfully.

### Terminal Live behavior

RC3 changed terminal sessions so that the UI cannot continue pretending to record:

- interruption is explicit;
- timer freezes;
- active Stop/mode controls are removed/terminalized;
- Summary/History actions are exposed;
- interruption uses voice/haptic feedback.

### Phone-first cockpit

RC3 implemented:

- compact horizontal Driver Mode selector;
- much less explanatory chrome above telemetry;
- primary Live values prioritized on a phone-sized viewport;
- compact Off-Road presentation;
- trends as supporting information;
- no large persistent healthy `LIVE · ECU DATA` band;
- subtle healthy indicator;
- banners reserved for waiting/degraded/interrupted states.

Rule encoded in product direction: **healthy is quiet; exceptions are loud**.

## 7. Duster RC3 physical defect → RC4

Q-002 Duster evidence showed:

- Essential/Family/Performance continued to receive ECU data;
- Off-Road selection could destabilize the ECU/session path;
- normal Stop reconstructed Summary successfully;
- clean USER_INITIATED Stop could still be labeled `Session PARTIAL`.

Because the same Duster + adapter worked in the other modes, this was classified as an Off-Road cross-subsystem defect, not basic vehicle incompatibility.

## 8. RC4 — Off-Road sidecar isolation

Branch: `fix/rc4-offroad-sidecar-isolation-20260824`
PR #37
Final tested head: `4f463a0925cc069b5e835a430132da9e9b9ab092`

### No Android permission UI during ACTIVE Live

Before RC4, entering Off-Road could request location permission while recording.

Risk: Android permission UI can cause lifecycle state changes, and release-1 intentionally terminalizes ACTIVE recording when the app leaves foreground.

RC4:

- checks existing permission only during Live;
- never launches location permission UI from the Active Off-Road path;
- missing permission degrades only location/altitude capability;
- permission setup belongs outside timing-critical Live acquisition.

### Native phone motion budget

Rotation-vector delivery was reduced from the prior more aggressive UI-rate path to a lower native cadence.

### JS/context throttling

RC4 adds:

- JS-side motion sampling budget;
- low-rate Driver Intelligence phone-sensor publication (approximately once per second in current design);
- local Off-Road visuals decoupled from ECU transport ownership.

Invariant: phone-sensor workload/failure must never stop, restart or starve ELM/ECU acquisition.

### Regression coverage

Added coverage for:

- phone sensor budgets;
- Active Live never requesting location permission;
- Off-Road sidecar behavior.

## 9. RC4 — clean Stop Summary integrity semantics

Duster physical Summary showed:

```text
Session PARTIAL
Reason: USER_INITIATED
```

Investigation found:

- `TelemetryBlockAssembler.flush()` intentionally closes the final fixed-duration window as a shorter `isPartial` block when Stop occurs between window boundaries;
- `SessionSummaryBuilder` previously downgraded the whole session whenever any partial block existed.

RC4 now allows session integrity `COMPLETE` when all of these are true:

- session status is normal completed/user-initiated;
- no corruption;
- no unsupported block;
- no sequence gap/overlap;
- no expected/found block mismatch;
- only the expected final shorter flush is partial.

The final partial block remains visible in detailed evidence; it simply no longer falsely means the entire session is incomplete.

Interrupted sessions and anomalous partial patterns remain PARTIAL.

## 10. RC4 final CI and artifact receipt

For head `4f463a0925cc069b5e835a430132da9e9b9ab092`:

- **AutoPulse Mobile Verify:** SUCCESS;
- **AutoPulse Android APK PR Build:** SUCCESS;
- Android workflow run ID: `32801577080`;
- artifact ID: `9546933827`;
- artifact name: `autopulse-android-internal-apk`;
- artifact archive digest: `sha256:7aec6c135a972bf4e76b70f4b0ed170ce11fdf581a2a115a2bd75d24edc87015`;
- extracted APK: `app-release.apk`;
- APK size: `90,086,045` bytes;
- APK SHA-256: `437181487c0591e3083364accf1e38129af219b1a90227c8612026fbee4ee493`.

Canonical artifact receipt: `RC4_ARTIFACT_RECEIPT.md`.

RC4 physical Duster retest is still **PENDING**. CI SUCCESS is not physical PASS.

PR #37 remains open at this documentation point pending physical confirmation/merge decision.

## 11. Future-build invariants

Future implementation must preserve:

- no fake zero for absent signals;
- source-aware labels;
- no adapter-only Live unlock;
- no internal sentinel leakage;
- no Driver Mode selection mutating connection lifecycle;
- Off-Road phone sensors remain subordinate to ECU acquisition;
- bounded terminalization/persistence drain;
- durable History;
- boot-time orphan recovery;
- healthy state visual silence;
- alert/voice rate limiting;
- clean final flush not mislabeled as whole-session failure;
- release claims bounded by physical evidence.
