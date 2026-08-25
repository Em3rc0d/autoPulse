# R1 — Renault Logan Physical Release Gate

**Gate status:** PARTIAL PHYSICAL PASS / NOT CLOSED
**Evidence quarry:** `../mining-site/quarries/Q-001_RENAULT_LOGAN_2014.md`
**Test ledger:** `../test/AUTOPULSE_TEST_LEDGER.md`

This gate cannot be closed by simulation, replay, MF4 data or unit tests. It certifies the complete Android + BLE + adapter + ELM + vehicle + persistence path.

The physical program has now produced meaningful Logan evidence, but the gate remains open because the destructive lifecycle matrix is incomplete on the current stabilized candidate.

## Evidence-status legend

- `[x]` physically observed or otherwise directly evidenced for this gate scope;
- `[~]` partially observed, fixed later, or needs current-build revalidation;
- `[ ]` not yet physically closed;
- `N/A` not naturally available in the observed run and must be exercised through another valid path/fixture.

## Preconditions

For the next closure run, record before starting:

- [ ] date/time;
- [ ] exact branch and commit SHA;
- [ ] exact APK/build artifact and SHA-256;
- [ ] Android device model/version;
- [ ] adapter commercial name/model;
- [ ] adapter reported firmware/identity;
- [ ] Renault Logan engine if known;
- [ ] clean install vs upgrade;
- [ ] relevant Android permissions before Live.

Earlier Logan evidence lacks some of this metadata, so it remains useful quarry evidence but is not the final certification receipt.

## A. Clean-install / initialization vertical

- [~] Clean install / clear application data — earlier physical run proves app/DB/vehicle path works, but final closure should explicitly record install state.
- [x] Launch AutoPulse without observed database-blocking error.
- [x] Garage/vehicle flow reached selected Logan.
- [x] Renault Logan selected and identified as 2014 in UI.
- [x] Physical adapter connection initiated.
- [x] BLE adapter connected.
- [x] ELM-compatible adapter identified.
- [x] Adapter configuration completed.
- [x] Vehicle protocol detection stage completed sufficiently to continue.
- [x] Supported-signal/capability discovery stage reached/completed.
- [x] Transport connection retained into Live in the successful path.
- [x] Entered Live without fabricated ECU-live claim before first valid ECU sample in corrected build lineage.

### A decision

**Physical acquisition gate:** PASS.

**Full R1:** still open because acquisition alone is insufficient.

## B. Normal Live session

Earlier field observations prove real telemetry; final closure still needs one current stabilized build run through restart/reopen.

Observe where actually supported:

- [x] RPM physically observed in Logan program.
- [x] Vehicle speed physically observed in Logan program.
- [x] Coolant temperature physically observed in Logan program.
- [x] `ATRV` adapter voltage physically observed and presented as adapter measurement.
- [~] `0142` ECU/control-module voltage remains a distinct signal; physical availability is not assumed when unavailable.
- [x] unavailable/unresolved data truth corrections implemented; no internal `ECU -1` should be user-facing.
- [x] first valid ECU sample explicitly identified.
- [x] healthy Live presentation revised to quiet state after first ECU truth.

Then:

- [x] normal Stop physically produced a persisted completed History entry in earlier Logan evidence.
- [~] Stop boundedness has implementation/automated evidence; final current-build physical timing should be recorded.
- [x] session metadata became COMPLETED in earlier History receipt.
- [~] Summary path attempted on Logan but failed in that build due to Android/Hermes `TextDecoder` defect.
- [x] TextDecoder defect fixed in RC3 implementation and later Summary reconstruction physically succeeded on Duster RC3.
- [ ] current stabilized Logan Summary opens successfully.
- [ ] current stabilized Logan Summary counts/duration/integrity captured.
- [ ] close application completely.
- [ ] relaunch.
- [ ] same current-build Logan session appears in History.
- [ ] rebuilt Summary matches original terminal facts.

### B known historical defect

Earlier Logan build produced:

```text
Failed to reconstruct session.
Property 'TextDecoder' doesn't exist
```

This is retained as a negative regression case, not erased from gate history.

## C. PID degradation semantics

Most rows are strongly automated but still require a suitable physical/controlled evidence case for complete release certification where practical.

- [~] First `NO_DATA` preserved — automated evidence.
- [~] Second `NO_DATA` preserved — automated evidence.
- [~] Third `NO_DATA` preserved — automated evidence.
- [~] After third consecutive `NO_DATA`, operational poll set retires PID — automated evidence.
- [~] `PID_RETIRED_NO_DATA`/retirement evidence remains distinct from vehicle capability truth — automated/design evidence.
- [~] successful response resets consecutive counter — automated evidence.
- [~] TIMEOUT does not become permanent vehicle unsupported evidence — automated/design evidence.
- [~] adapter/ELM error does not become vehicle `NO_DATA` — automated/design evidence.
- [~] connection loss does not retire individual PIDs as vehicle capability fact — automated/design evidence.

Physical natural reproduction is desirable but must not be fabricated if the tested vehicle does not expose a convenient unsupported PID path.

## D. Interruption matrix

Run each as a separate session on the current stabilized build.

### D1 — Physical adapter disconnect

Status: **PENDING**.

- [ ] start recording;
- [ ] physically disconnect/power-off adapter;
- [ ] UI does not remain indefinitely active;
- [ ] explicit interruption state shown;
- [ ] reason corresponds to physical device/connection loss;
- [ ] timer frozen;
- [ ] Stop/active controls removed or terminalized;
- [ ] voice/haptic alert occurs according to policy without spam;
- [ ] committed blocks survive;
- [ ] Summary/History remain honest;
- [ ] restart verifies no orphan recovery is needed for an already terminalized disconnect session.

### D2 — App background

Release-1 policy is foreground-only.

Earlier Logan physical evidence:

- [x] start recording;
- [x] send app to background;
- [x] session transitions to `INTERRUPTED / APP_BACKGROUND`;
- [x] app does not silently claim supported background recording at persistence level;
- [x] committed data/session metadata survives in History;
- [~] earlier terminal UI still looked partially active — RC3 implementation fixed; current-build physical recheck needed;
- [~] Summary reconstruction was blocked by TextDecoder in that earlier build — runtime fix exists; current-build recheck needed.

Current-build closure:

- [ ] repeat APP_BACKGROUND on final candidate;
- [ ] timer freezes;
- [ ] active controls disappear;
- [ ] voice/haptic behavior correct;
- [ ] Summary reconstructs;
- [ ] History/reopen succeeds.

### D3 — Abrupt process kill

Status: **PENDING PHYSICAL CERTIFICATION**.

- [ ] start recording and allow at least one telemetry block to commit;
- [ ] kill app/process without normal stop;
- [ ] relaunch;
- [ ] startup orphan recovery executes;
- [ ] no indefinitely ACTIVE session remains;
- [ ] recovered session is INTERRUPTED;
- [ ] reason `UNEXPECTED_APP_TERMINATION` unless stronger prior reason exists;
- [ ] durable block/event/reading/sequence evidence retained;
- [ ] missing tail is not invented;
- [ ] History opens recovered session;
- [ ] reconstructed Summary is honest/available according to surviving blocks.

### D4 — Cancel before Live

- [ ] start connection flow;
- [ ] cancel before valid Live session begins;
- [ ] no ghost ACTIVE/PREPARING session remains after restart.

## E. Off-Road/phone-sensor truth observations

Although Off-Road is not the central reason R1 exists, Logan physical evidence contributed to Release-1 UX truth.

- [x] phone-origin attitude data observed;
- [x] vehicle-relative calibration interaction observed;
- [x] altitude observed as real acquired value rather than initial fake zero in corrected path;
- [x] heading observed;
- [x] recalibration visibly changes vehicle-relative reference;
- [~] current RC4 sidecar isolation requires Duster retest because Duster exposed an Off-Road acquisition interference defect not seen as clearly in the earlier Logan observation.

Phone sensor evidence is not ECU evidence.

## F. Evidence to attach to final gate decision

Final closure package must include:

- exact commit SHA;
- exact APK artifact/hash;
- device + Android version;
- adapter commercial identity + reported firmware where possible;
- detected/resolved protocol presentation;
- capability summary;
- normal-session ID;
- BLE-disconnect session ID;
- background session ID;
- process-kill recovered session ID;
- screenshots or logs for terminal states;
- Summary/History receipts;
- PASS/FAIL per section;
- every defect with reproduction steps;
- quarry/golden-dataset updates.

## Gate decision

### Current decision

```text
Physical BLE → ELM → ECU acquisition       PASS
Real Logan telemetry                       PASS
Off-Road phone sensor observation          PASS WITH SCOPE LIMITS
APP_BACKGROUND persistence                 PASS
History durability                         PASS
Historical Summary reconstruction          FAIL → code-fixed later
Current-build Summary/restart               PENDING
Physical BLE disconnect                     PENDING
Abrupt process kill recovery                PENDING
Full R1 gate                                NOT CLOSED
```

R1 closes only when the remaining B/D rows pass on a release-candidate-equivalent artifact and the exact evidence is preserved.

A failure is never waived merely because normal telemetry works. The gate exists to prove both happy path and failure path.
