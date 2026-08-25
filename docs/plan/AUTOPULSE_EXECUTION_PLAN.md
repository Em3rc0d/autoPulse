# AutoPulse Execution Plan

**Lane:** Plan
**Authority:** EXECUTION AUTHORITY
**Current focus:** RC4 Duster Off-Road stabilization and lifecycle certification

## 1. Planning principle

AutoPulse advances by evidence gates. A gate closes only when its required implementation and validation receipts exist.

The project must not confuse:

- code complete with physically proven;
- physical acquisition with lifecycle complete;
- one vehicle with broad compatibility;
- one adapter with connector-family support;
- screenshot evidence with raw diagnostic corpus evidence.

## 2. Current project state

### Foundation / P0

Status: **CLOSED in code**.

Established:

- local product database;
- durable Live sessions;
- telemetry block persistence;
- BINARY_OBD2_V3 product format;
- OBD request/response pipeline;
- source-aware voltage semantics;
- capability/discovery foundation;
- PID retirement semantics;
- test/CI baseline.

### P1 / Driver Intelligence + reusable Live system

Status: **implemented and merged through RC3; RC4 stabilization pending physical retest**.

Proven/implemented areas include:

- smartphone-first Live cockpit;
- Driver Modes;
- real ECU truth gating;
- voice/color/haptic direction;
- Off-Road phone sensors;
- History;
- reconstructed Summary;
- interruption/recovery plumbing;
- compatibility discovery on more than one vehicle observation.

## 3. Immediate RC4 gate

Purpose: close the Duster defect where entering Off-Road could destabilize ECU acquisition and correct clean-stop Summary semantics.

### Frozen RC4 test artifact

- Commit: `4f463a0925cc069b5e835a430132da9e9b9ab092`
- PR: #37 — `fix(rc4): isolate Off-Road phone sensors from ECU acquisition`
- Mobile Verify: **SUCCESS**
- Android APK PR Build: **SUCCESS**
- Workflow run: `32801577080`
- GitHub artifact ID: `9546933827`
- Artifact name: `autopulse-android-internal-apk`
- Artifact archive digest: `sha256:7aec6c135a972bf4e76b70f4b0ed170ce11fdf581a2a115a2bd75d24edc87015`
- Extracted APK filename in artifact: `app-release.apk`
- Extracted APK SHA-256: `437181487c0591e3083364accf1e38129af219b1a90227c8612026fbee4ee493`

This exact APK is the preferred Q-003 physical target. If code changes before the retest, a new artifact identity must replace it and the test target resets.

### RC4 implementation acceptance

- [x] Off-Road must never request location permission during ACTIVE Live.
- [x] Location unavailable/permission missing must degrade only location-derived Off-Road features.
- [x] Native motion sampling reduced from the prior more aggressive cadence.
- [x] JS-side phone motion observation throttled.
- [x] Driver Intelligence phone-sensor publication rate limited.
- [x] Phone sensor sidecar cannot own or mutate OBD connection lifecycle.
- [x] Expected final short block on clean Stop does not automatically downgrade entire session to PARTIAL.
- [x] Regression tests added.
- [x] Mobile Verify green on final RC4 head.
- [x] Final Android APK workflow green on final RC4 head.
- [x] Exact CI artifact retained for physical test.

### RC4 Duster physical acceptance

Using Renault Duster 2014 + same known adapter:

1. Start Live and wait for real ECU values.
2. Observe Essential for at least ~15 seconds.
3. Observe Performance for at least ~15 seconds.
4. Enter Off-Road and remain there 30–60 seconds.
5. Confirm RPM continues to update.
6. Confirm speed continues when vehicle is moving.
7. Confirm coolant remains available.
8. Confirm no reinitialization screen.
9. Confirm no permission popup during Live.
10. Confirm pitch/roll update if rotation sensor is available.
11. Confirm altitude/heading if permission/data are already available; otherwise show honest unavailable state.
12. Return to Essential or Performance and confirm ECU stream remains alive.
13. Stop normally.
14. Summary should reconstruct and report COMPLETE when no other evidence degradation exists.
15. History should reopen the same persisted Summary.

Fail conditions:

- Off-Road causes ECU values to freeze/disappear;
- BLE/ELM is disconnected by mode selection;
- entering mode triggers Android permission UI during ACTIVE Live;
- session silently restarts;
- clean stop is mislabeled because of the expected final flush alone;
- persisted summary fails to reconstruct.

## 4. Full lifecycle certification gate

After RC4 Off-Road retest, run the remaining destructive lifecycle cases on a release-candidate-equivalent build.

### Normal path

```text
connect
→ wait for first ECU evidence
→ Live
→ record
→ Stop
→ Summary
→ History
→ app restart
→ same History entry
→ same reconstructed Summary
```

### Physical BLE disconnect

Expected:

- explicit terminal interruption;
- reason connected to physical device loss (`DEVICE_DISCONNECTED` or equivalent approved presentation);
- timer frozen;
- active controls removed;
- committed telemetry survives;
- Summary/History remain available where evidence exists.

### App background

Current release policy is foreground-only.

Expected:

- explicit `APP_BACKGROUND` interruption;
- voice/haptic notification according to alert policy;
- no silent background-recording claim;
- committed telemetry survives;
- reconstructed Summary remains honest.

### Process kill

Expected after relaunch:

- bootstrap orphan recovery;
- no indefinitely ACTIVE session;
- recovered session marked interrupted;
- reason `UNEXPECTED_APP_TERMINATION` unless a stronger prior terminal reason exists;
- committed blocks retained;
- missing tail never invented.

## 5. Vehicle compatibility progression

### Vehicle #1 — Renault Logan 2014

Role: original physical vertical.

Current evidence:

- BLE → ELM → ECU acquisition observed;
- RPM/speed/coolant observed;
- adapter voltage observed separately;
- Off-Road phone sensors observed;
- background interruption observed and persisted;
- History persistence observed;
- prior Summary reconstruction defect identified and fixed in RC3.

Remaining for full Logan lifecycle certification:

- revalidate current build normal Summary/History after fixes;
- physical BLE unplug;
- process kill recovery;
- any remaining gate rows in release runbook.

### Vehicle #2 — Renault Duster 2014

Role: second vehicle with same adapter; vehicle variable changes while adapter is controlled.

Current evidence:

- initialization succeeds;
- first ECU sample succeeds;
- RPM observed;
- speed observed;
- coolant observed;
- Essential/Family/Performance operate;
- persisted Summary reconstructs on RC3;
- Off-Road exposed runtime-interference defect;
- normal Stop exposed Summary semantics defect.

Next: RC4 retest using the frozen artifact above.

### Vehicle #3 — non-Renault

Status: **desired after lifecycle stabilization**.

Purpose:

- reduce manufacturer/platform bias;
- exercise different ECU/protocol/capability behavior;
- prove adaptation is not Renault-specific.

Do not block RC4 on obtaining this vehicle, but do not call cross-manufacturer compatibility certified until evidence exists.

## 6. Adapter/connector compatibility progression

Current physical adapter diversity: **one primary adapter path**.

Therefore:

- vehicle compatibility evidence can expand now;
- adapter compatibility evidence remains narrow;
- no claim of “all connectors/readers” is allowed.

When a second adapter/connector family becomes available:

1. preserve a vehicle as control if possible;
2. run adapter behavioral discovery;
3. record identity/firmware as evidence only;
4. characterize prompt/echo/formatting/latency/fragmentation;
5. run normal Live;
6. run interruption cases;
7. classify CERTIFIED/COMPATIBLE/DEGRADED/UNSUPPORTED for that tested combination.

## 7. Golden Diagnostic Corpus plan

The product needs two related but distinct datasets.

### 7.1 Physical compatibility Golden Dataset

Stores normalized approved cases such as:

- Logan + tested adapter + Android build;
- Duster + same adapter + Android build;
- lifecycle outcomes;
- available signal observations;
- known negative/unavailable cases.

### 7.2 Raw diagnostic corpus

Requires actual raw/canonical diagnostic captures or deterministic fixtures.

Required families remain:

- standard 11-bit OBD;
- extended 29-bit OBD;
- ISO-TP multi-frame DTC;
- negative response;
- dynamic telemetry;
- mixed real-world response shapes;
- corrupt/truncated persisted block recovery.

Screenshots alone cannot populate byte-level golden fixtures.

## 8. Driver UX hardening plan

After lifecycle/Off-Road stability is closed, audit the mobile cockpit under actual driving conditions.

Acceptance topics:

- primary metrics visible without excessive scrolling;
- normal state quiet;
- alerts use correct severity color;
- voice happens on meaningful transitions, not continuously;
- haptics distinguish warning/critical appropriately;
- warning copy is short, understandable and action-oriented;
- driver mode changes do not reset connection/session;
- terminal session removes active controls;
- large document reminder does not obscure critical live alerts;
- accessibility: text/state not color-only.

## 9. Compatibility discovery plan

Continue strengthening adaptive behavior:

- progressive standard PID support ranges;
- clear supported/partial/unavailable representation;
- distinguish advertised capability from live observation;
- retain adapter behavior snapshot;
- retire repeatedly unsupported PIDs operationally without rewriting vehicle evidence;
- avoid assuming all vehicles expose the Logan/Duster signal set.

## 10. Production hardening plan

Before public release:

- final dependency/security review;
- address or explicitly risk-accept dependency audit findings;
- Android permission minimization;
- reproducible signed production build;
- crash/recovery test on more than one Android device/version;
- upgrade/migration test from prior app data;
- privacy/support/limitations copy current;
- internal tooling absent from production UX;
- compatibility matrix published conservatively.

## 11. Release milestones

### Milestone A — RC4 Off-Road stabilization

Exit: Duster physical retest passes.

### Milestone B — Full lifecycle certified on current primary physical vertical

Exit: normal + background + BLE disconnect + process kill + restart/history evidence all pass on current build.

### Milestone C — Internal beta

Exit:

- lifecycle certified;
- current RC stable;
- no known P0/P1 truth/persistence defect;
- compatibility language bounded.

### Milestone D — Compatibility expansion

Exit target:

- multiple vehicles including non-Renault;
- second adapter/connector evidence when hardware becomes available;
- multiple Android device/version observations.

### Milestone E — Public v1 RC

Exit:

- release plan R1–R10 requirements satisfied for declared support envelope;
- golden corpus/regressions adequate;
- security/production hardening accepted;
- exact release artifact certified.

## 12. Stop-work rule

Until v1.0:

> New feature work should not outrun unresolved acquisition, persistence, lifecycle, source-truth or compatibility defects.

A new feature is justified when it closes a release gate or fixes a defect discovered by a gate. Exploratory ideas belong in Brainstorming until promoted.
