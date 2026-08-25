# AutoPulse Test Ledger

**Lane:** Test
**Authority:** VALIDATION RECEIPT

This ledger records what was actually exercised. It deliberately includes failures because failures are part of the product evidence chain.

## 1. Evidence classes

### Automated

Includes TypeScript, Jest/unit/integration tests and GitHub Actions build verification.

Automated PASS proves deterministic code paths under the test environment. It does not prove Android/Hermes/native/vehicle behavior unless the test explicitly exercises that environment.

### Physical

Includes real Android device + adapter + vehicle observations.

Physical evidence is scoped to the tested combination. It does not automatically generalize across manufacturers, adapters, Android devices or protocols.

### Screenshot-level evidence

Screenshots can prove visible UI state and displayed observations. They do not prove raw CAN/OBD bytes, exact adapter timing or absence of hidden transport errors.

### Raw capture evidence

Raw adapter logs, OBD responses, diagnostic traces or byte fixtures provide stronger parser/protocol evidence. Where absent, the ledger says so.

## 2. Automated regression baseline

The mobile verification workflow runs:

```text
npm ci
→ npm run verify
→ TypeScript noEmit
→ Jest --runInBand
```

The Android PR workflow additionally builds a standalone internal APK and verifies the React Native bundle is packaged.

### RC3 verification

RC3 smartphone/lifecycle batch reached a green automated state before physical Duster validation.

Covered areas included:

- Hermes-safe text encoding fallback;
- History;
- session reconstruction;
- Live ECU truth;
- controller terminal outcomes;
- mobile cockpit/mode UI;
- voice policy;
- orphan recovery;
- protocol presentation;
- physical truth semantics.

### RC4 final-head Mobile Verify

Head: `4f463a0925cc069b5e835a430132da9e9b9ab092`

Result: **SUCCESS**.

Observed workflow totals on the RC4 series included:

- 71 test suites passed;
- 314 tests passed;
- 2 skipped;
- 316 total;
- TypeScript passed.

New/important RC4 suites include:

- Off-Road sensor policy;
- phone driving sensor hook behavior;
- Live screen behavior;
- Driver Mode context/selector;
- Real Live Session Controller;
- Session Summary Builder;
- Hermes text encoding polyfill;
- orphan recovery;
- telemetry block/session persistence.

Known workflow hygiene note:

- checkout cleanup has historically warned about a `kotlin-obd-api` submodule URL inconsistency;
- dependency audit has reported vulnerabilities requiring separate production hardening review;
- neither warning is treated as proof that physical release gates pass.

## 3. Physical Test P-001 — Renault Logan 2014 / RC3 lineage

### Objective

Validate real acquisition, phone-first Live behavior, Off-Road sensors, foreground interruption persistence and Summary/History reconstruction.

### Observed initialization

Visible initialization progressed through:

- BLE adapter connected;
- ELM327 identified;
- adapter configured;
- vehicle protocol detection;
- supported-signal checking;
- Live preparation.

Result: **PASS for physical acquisition chain**.

### First ECU truth

The app entered the connected/waiting state until real ECU-origin data was observed, then showed first ECU sample received and Live telemetry.

Observed real telemetry included examples of:

- engine RPM;
- vehicle speed in prior Logan evidence;
- engine coolant;
- adapter voltage around mid-14 V range.

Result: **PASS** for first ECU truth gate.

### Healthy-state UI

RC3 removed the redundant large healthy `LIVE · ECU DATA` band after review. A subtle green live indicator is the intended healthy-state presentation.

Result: design correction implemented after observation.

### Off-Road phone sensors

Observed:

- calibrated vehicle-relative pitch/roll;
- altitude around 309 m in the tested phone/location context;
- heading values;
- recalibration changing the relative attitude baseline.

Interpretation:

- calibration mechanism visibly responded;
- large attitude changes can reflect phone repositioning relative to calibration;
- this observation does not prove IMU absolute vehicle-attitude accuracy.

### Background interruption

Observed real UI:

```text
SESSION INTERRUPTED
... (APP_BACKGROUND)
Persisted evidence remains available in Session Summary.
```

History later showed an `INTERRUPTED` session with `APP_BACKGROUND` termination and retained blocks/readings.

Result: **PASS** for explicit foreground-only interruption persistence semantics.

### Terminal Live UI defect observed

After interruption, screenshots showed that the screen could still look operational in parts: timer progression and/or active-looking controls remained visible.

Classification: **FAIL / UX truth defect**.

Fix: RC3 terminal-state UI hardening freezes/terminalizes the screen and exposes Summary/History actions.

### Session reconstruction defect observed

Physical failure:

```text
Failed to reconstruct session.
Property 'TextDecoder' doesn't exist
```

Classification: **FAIL / Android-Hermes runtime portability blocker**.

Root cause: ambient `TextDecoder` assumption in persisted telemetry codec path.

Fix: RC3 Hermes-safe text decoding/polyfill.

Physical closure evidence: later Duster RC3 Summary reconstructed successfully, proving the former runtime crash is no longer universal on the tested Android runtime/build lineage.

### History persistence

Logan History screenshot showed two persisted sessions:

- completed/user-initiated session;
- interrupted/APP_BACKGROUND session;
- blocks/readings retained.

Result: **PASS** for durable session list/persistence.

## 4. Physical Test P-002 — Renault Duster 2014 / RC3

### Purpose

Change the vehicle while keeping the adapter path constant. This helps separate vehicle compatibility from adapter behavior.

### Initialization

Observed successful stages:

- BLE adapter connected;
- ELM identified;
- configured;
- protocol detection;
- supported-signal discovery;
- Live started.

Result: **PASS**.

### First ECU sample

Visible waiting state transitioned into real telemetry.

Observed values across screenshots included approximately:

- RPM: 924–1955 rpm examples;
- speed: 6–24 km/h examples;
- coolant: 78–84 °C examples.

These are screenshot-level observations, not raw diagnostic frame fixtures.

Result: **PASS** for real Duster ECU acquisition with the tested adapter.

### Driver modes

Observed working without obvious connection failure:

- Essential;
- Family / Daily;
- Performance.

RPM trends continued and telemetry changed with vehicle operation.

Result: **PASS for these mode transitions in the observed run**.

### Off-Road defect

User observed that entering Off-Road caused the system/ECU connection to break or lose data, while other modes worked.

Because the same Duster + adapter produced healthy ECU telemetry in other modes, classification is:

**FAIL / cross-subsystem Off-Road integration defect**, not sufficient evidence for Duster incompatibility.

Likely/identified code risks:

1. Off-Road could request Android location permission during ACTIVE Live, potentially triggering a lifecycle transition that Release-1 intentionally treats as interruption.
2. phone rotation/location events could create excessive native→JS→React/context work and compete with time-sensitive ELM request/response processing.

Fix: RC4 Off-Road sidecar isolation.

Physical closure: **PENDING RC4 Duster retest**.

### Summary reconstruction

After Stop, Session Summary opened successfully instead of producing the prior `TextDecoder` runtime crash.

Result: **PASS** for RC3 persisted Summary reconstruction on the tested Duster session.

### Summary semantic defect

The visible Summary reported:

```text
Session PARTIAL
Reason: USER_INITIATED
```

Code inspection showed a normal final Stop flush is intentionally a shorter telemetry block and was counted `isPartial`; Summary logic then incorrectly downgraded the entire session.

Classification: **FAIL / session-level semantics defect, not evidence loss**.

Fix: RC4 clean Stop Summary integrity rule.

Physical closure: **PENDING RC4 retest**.

## 5. RC4 physical test P-003 — planned Duster retest

Target build: exact final CI APK from RC4 head after Android workflow SUCCESS.

### Preconditions

- AutoPulse Location permission granted before starting Live if altitude/heading are to be tested;
- same known adapter when possible;
- Duster selected correctly;
- record APK SHA/build identifier.

### Sequence

1. Start Live.
2. Wait for first ECU sample.
3. Essential ~15 seconds.
4. Performance ~15 seconds.
5. Off-Road 30–60 seconds.
6. Confirm ECU RPM continues updating.
7. Confirm vehicle speed continues when moving.
8. Confirm coolant remains available.
9. Confirm no Android permission popup appears during Live.
10. Confirm no initialization reset/session restart.
11. Observe pitch/roll.
12. Observe altitude/heading if permission/data available; otherwise verify truthful unavailable presentation.
13. Return to another driver mode and confirm ECU stream remains alive.
14. Stop normally.
15. Confirm Summary reconstructs.
16. Confirm session-level integrity is COMPLETE if no actual degradation occurred.
17. Done → History.
18. Reopen the same Summary.

### Required failure capture

If Off-Road still destabilizes the session, capture:

- exact mode-selection moment;
- whether a system permission sheet appeared;
- whether timer stopped;
- whether status banner changed;
- whether BLE icon/system state changed;
- whether RPM/speed/coolant disappeared simultaneously or individually;
- terminal reason in History/Summary;
- any log if available.

## 6. Remaining lifecycle physical matrix

### Physical BLE disconnect

Status: **PENDING on current stabilized build**.

Acceptance:

- explicit interruption;
- no indefinite Live state;
- persisted evidence survives;
- reason reflects device disconnect;
- Summary/History available.

### App background

Status: **PHYSICALLY OBSERVED PASS on earlier Logan RC lineage**, but should be rechecked on current final candidate after terminal UI changes.

### Abrupt process kill

Status: **PENDING PHYSICAL CERTIFICATION**.

Acceptance after relaunch:

- orphan recovery executes;
- no stale ACTIVE session;
- recovered session becomes interrupted;
- committed blocks retained;
- missing tail not invented;
- History/Summary honest.

## 7. Compatibility conclusions allowed from current tests

Allowed:

- the tested adapter has successfully acquired real standard ECU telemetry from Renault Logan 2014 and Renault Duster 2014 in observed sessions;
- Duster RC3 produced RPM/speed/coolant and persisted Summary reconstruction;
- Off-Road mode exposed an integration defect independent of basic Duster ECU acquisition;
- background interruption/persistence has been observed physically on Logan;
- History durability has been observed physically.

Not allowed yet:

- “AutoPulse supports all Renaults”;
- “AutoPulse supports all cars”;
- “AutoPulse supports all ELM327 adapters”;
- “Off-Road is physically certified” before RC4 retest;
- “full lifecycle certified” before BLE disconnect + process kill and current-build normal lifecycle evidence;
- “public release ready.”

## 8. Test promotion rule

A physical observation is promoted to the Golden Dataset only after:

- vehicle/build/adapter context is identified sufficiently;
- result is not contradicted by unresolved evidence;
- the scope of the claim is explicit;
- any known defect is retained rather than edited out;
- the normalized record links back to its quarry/test receipt.
