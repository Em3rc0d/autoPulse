# AutoPulse Build Ledger

**Lane:** Build
**Authority:** IMPLEMENTATION RECEIPT
**Repository:** `Em3rc0d/autoPulse`

This document records major implementation changes tied to observable defects and release gates. It is not a changelog of every commit; it is a traceable engineering ledger for product-critical work.

## 1. Baseline architecture before RC stabilization

The mobile application is React Native/TypeScript with Android native integrations where required. The release-1 physical path is:

```text
Android app
→ BLE transport
→ ELM-compatible adapter behavior
→ OBD request/response
→ decoder
→ Live presentation
→ telemetry event/block persistence
→ SQLite product history
→ reconstructed Session Summary
```

Separate side paths include phone sensors for Off-Road and driver-intelligence advisory evaluation.

## 2. P0 / physical acquisition foundation

Implemented before the RC3/RC4 cycle:

- BLE adapter connection and retention into initialization;
- ELM command/control pipeline;
- real OBD protocol initialization;
- Mode 01 capability discovery;
- real telemetry poller;
- repeated `NO_DATA` operational retirement after preserving the third `NO_DATA` event;
- telemetry event mapping;
- block assembly/persistence;
- durable Live session repository;
- summary builder;
- product database bootstrap and local context;
- adapter and vehicle capability evidence structures.

Important preserved invariant:

- `ATRV` adapter voltage and Mode 01 `0142` ECU/control-module voltage remain separate.

## 3. Physical truth correction batch

Branch history included `fix/rc2-physical-truth-20260824`, merged into the P1 feature stream.

### 3.1 Real ECU truth gate

File: `mobile-app/src/application/live/LiveEcuTruth.ts`

Implemented user-facing state around:

- waiting for first ECU sample;
- delayed ECU evidence;
- live ECU evidence;
- recording degradation/interruption.

Key rule:

- a valid ECU-origin OBD reading unlocks Live;
- ELM AT commands and adapter voltage do not.

### 3.2 Protocol presentation

File: `mobile-app/src/application/diagnostics/ObdProtocolPresentation.ts`

Implemented:

- `A0` treated as unresolved automatic-selection evidence rather than final vehicle protocol;
- human-readable protocol presentation;
- internal unknown ECU sentinel suppression.

### 3.3 Real initialization protocol evidence

File: `mobile-app/src/infrastructure/ble/real/RealObdInitialization.ts`

Implemented:

- automatic protocol code remains provisional initially;
- protocol evidence re-queried after real OBD exchange;
- only resolved evidence is promoted/persisted as final protocol presentation.

### 3.4 Phone-sensor truth

Files include sensor hooks and `PhoneSensorBridge.tsx`.

Implemented:

- accuracy/timestamps;
- vehicle-scoped level calibration;
- distinction between phone-relative raw orientation and vehicle-relative calibrated pitch/roll;
- altitude acquisition/unavailable semantics instead of fake `0 m`.

### 3.5 Driver mode evidence dimensions

Mode readiness requires required dimensions to be present and valid. Degraded evidence cannot be promoted to READY simply to keep a mode green.

## 4. Lifecycle + History hardening

Branch: `fix/p1-lifecycle-history-recovery-20260824`
PR: #32 into P1 feature stream
Squash merge lineage: `7eaa1e0876e3b910ff2375b097aadfe059d0257f`

### 4.1 Orphan session recovery

File: `mobile-app/src/infrastructure/database/product/repositories/live-session.repository.ts`

Changed recovery to:

- inspect stale CREATED/PREPARING/ACTIVE/STOPPING sessions;
- reconcile durable block count/event count/reading count;
- use real `lastCommittedSequence` rather than stale/wrong naming;
- derive recovery end time from last durable telemetry block when possible;
- classify orphan as `INTERRUPTED`;
- record `UNEXPECTED_APP_TERMINATION` unless stronger reason already exists;
- append recovery event/evidence;
- never pretend the killed session continued until app reopen.

### 4.2 Startup recovery integration

File: `mobile-app/src/infrastructure/database/product/lifecycle.ts`

Recovery executes during product DB initialization before the database is reported READY.

This implements the correct process-kill model: reconcile from durable storage on the next process start rather than relying on an impossible guaranteed synchronous kill callback.

### 4.3 Real History screen

File: `mobile-app/src/screens/HistoryScreen.tsx`

Replaced placeholder History with persisted-session UI:

- recent sessions from product SQLite;
- vehicle alias;
- status;
- timestamps;
- duration;
- blocks/readings;
- termination reason;
- short session ID;
- reopen reconstructed Summary for eligible terminal sessions;
- pull-to-refresh/focus refresh.

### 4.4 Summary navigation

`SessionSummaryScreen` Done action now routes to History rather than an invalid/nonexistent stack target.

### 4.5 CI fixes during lifecycle batch

Notable commits:

- `9b88c6bc8b4fc9f2dd89a58bcb6d0d0629c25045` — align orphan recovery update typing;
- `f1df83e8c8f8d203e962e286aff752db82e42076` — stable mocked product DB identity in History tests;
- `b8951544176b810841c8e793364e7f87697a735b` — durable completed summaries return to History;
- `050b51399e0580b5983db17c0a49295c2c9829ed` — surface terminal interruptions through existing Live error boundary.

## 5. P1 integration into main

PR #30: `feat(p1): Driver Intelligence + connector-aware runtime RC`

P1 contained:

- driver intelligence;
- connector-aware real runtime;
- physical truth fixes;
- lifecycle persistence/history hardening;
- interruption semantics.

The branch was merged into `main` only after its final P1 RC head passed Mobile Verify and Android APK build.

## 6. RC3 — smartphone cockpit + Android summary portability

PR #36
Final relevant head before merge: `6ac2fac8…`

RC3 addressed defects exposed by real Logan physical use and the mobile UX review.

### 6.1 Hermes-safe text decoding

Observed physical failure:

```text
Failed to reconstruct session.
Property 'TextDecoder' doesn't exist
```

Root cause:

- `BinaryObd2V3Codec` depended on global `TextDecoder` available in Node/test environments but absent in the tested Android/Hermes runtime.

Implemented:

- runtime-safe UTF-8 text encoding/decoding support/polyfill path;
- regression coverage including execution without relying on ambient global TextDecoder behavior;
- preserved Unicode decoding requirements.

Physical result later observed on Duster RC3:

- Session Summary successfully reconstructed, confirming the former runtime crash was closed in the real app.

### 6.2 Terminal Live UI

Observed defect:

- after `APP_BACKGROUND`, persistence correctly terminalized the session but UI could continue to look operational.

Implemented:

- explicit interruption presentation;
- timer freeze on terminal outcome;
- active Stop/action controls removed or replaced;
- Summary/History action path;
- interruption voice/haptic feedback.

### 6.3 Smartphone-first cockpit

Implemented:

- large Driver Mode cards replaced by compact horizontal selector/chips;
- reduced repeated explanatory chrome;
- primary Live telemetry receives more viewport priority;
- Off-Road information compacted;
- trend/chart area reduced to supporting role;
- healthy-state large `LIVE · ECU DATA` banner removed;
- subtle healthy indicator retained;
- abnormal/transitional banners remain visible.

Design rule established in code:

> Healthy state is quiet; exceptions are loud.

### 6.4 Voice/haptic direction

RC3 integrated terminal/interruption voice and haptic behavior into the existing alert boundary rather than creating a second conflicting notification system.

## 7. Duster RC3 field defect → RC4

Physical Duster 2014 testing with the same adapter showed:

- Essential/Family/Performance continued to receive ECU data;
- entering Off-Road could destabilize the acquisition/session behavior;
- normal Stop Summary reconstructed successfully;
- clean user stop could still be labeled `Session PARTIAL`.

The defect was classified as a cross-subsystem integration problem, not vehicle incompatibility, because the ECU path worked in other modes using the same vehicle and adapter.

## 8. RC4 — Off-Road sidecar isolation

Branch: `fix/rc4-offroad-sidecar-isolation-20260824`
PR #37
Current final documentation head of code under test: `4f463a0925cc069b5e835a430132da9e9b9ab092`

### 8.1 No permission UI during ACTIVE Live

Before RC4, Off-Road could request Android location permission during an active OBD session.

Risk:

- Android permission UI can cause application lifecycle changes;
- current release policy intentionally interrupts recording when leaving foreground;
- therefore a mode selection could indirectly terminate the session.

RC4 behavior:

- Live Off-Road checks existing permission only;
- it does not launch location permission UI while recording;
- missing permission degrades only location-derived Off-Road capability;
- permission can be set before Live/outside timing-critical acquisition.

### 8.2 Native phone motion budget

Changed rotation vector delivery away from the previous more aggressive UI-rate path to a lower-rate native sensor cadence.

Purpose:

- reduce native→JS event pressure;
- protect ELM request/response timing.

### 8.3 JS/context throttling

Implemented:

- additional JS-side motion sampling budget;
- Driver Intelligence phone-sensor publication capped to a low rate (approximately once per second in current design);
- local Off-Road visuals remain independent from ECU transport ownership.

Invariant:

> Phone sensor sidecar failure or load must never stop/restart/starve ECU acquisition.

### 8.4 Regression tests

Added tests for:

- sensor update budgets;
- no location permission prompt from the Active Live Off-Road path;
- sidecar behavior expectations.

Final RC4 Mobile Verify result at documentation time: green.

## 9. RC4 — clean Stop Summary semantics

Duster screenshot exposed:

```text
Session PARTIAL
Reason: USER_INITIATED
```

Code investigation found:

- `TelemetryBlockAssembler.flush()` intentionally marks the final flushed time window `isPartial` because Stop commonly occurs before the next full fixed window boundary;
- `SessionSummaryBuilder` previously downgraded the entire session to PARTIAL whenever `partialBlocksCount > 0`.

That made a clean normal Stop look incomplete even when there was no loss/corruption/gap.

RC4 changed the session-level rule:

- normal `COMPLETED / USER_INITIATED` session;
- no corruption;
- no unsupported block;
- no sequence gap;
- no block-count mismatch;
- only the expected final short flush block is partial;

→ session integrity may remain `COMPLETE`.

The partial-block detail is still retained. Interrupted sessions and anomalous partial patterns remain PARTIAL.

Regression coverage was added to distinguish expected user-stop flush from genuinely partial lifecycle evidence.

## 10. Build/CI state at documentation cut

For RC4 head `4f463a0925cc069b5e835a430132da9e9b9ab092`:

- Mobile Verify: **SUCCESS**;
- Android APK PR Build: **in progress** at the time this documentation batch began/finalized;
- RC4 physical Duster retest: **not yet performed**;
- PR #37: **open** pending final artifact + physical validation policy decision.

Do not reinterpret this ledger as saying RC4 physical PASS until the quarry/test receipt is added.

## 11. Implementation invariants for future builds

Future code changes must preserve:

- no fake zero for absent signals;
- source-aware labels;
- no adapter-only Live unlock;
- no internal sentinel leakage;
- no mode selection mutating connection lifecycle;
- bounded terminalization/persistence drain;
- History durability;
- boot-time orphan recovery;
- healthy state visual silence;
- alert/voice rate limiting;
- clean final flush not mislabeled as whole-session failure;
- release promises remain bounded by physical evidence.
