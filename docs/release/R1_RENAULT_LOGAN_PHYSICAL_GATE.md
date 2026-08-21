# R1 — Renault Logan Physical Release Gate

This gate cannot be closed by simulation, replay, MF4 data or unit tests. It certifies the complete Android + BLE + adapter + ELM + vehicle + persistence path.

## Preconditions

Record before starting:

- date/time;
- branch and commit SHA;
- APK/build profile and hash if available;
- Android device/model/version;
- adapter name/model/reported firmware;
- Renault Logan year/engine if known;
- whether the app was clean-installed or upgraded.

## A. Clean-install vertical

- [ ] Clean install / clear application data.
- [ ] Launch AutoPulse without database errors.
- [ ] Garage loads with truthful empty/ready state.
- [ ] Create/select Renault Logan.
- [ ] Start adapter scan.
- [ ] Select the physical OBD adapter.
- [ ] Adapter probe succeeds or yields an explicit degraded compatibility state.
- [ ] Transport connection is retained into initialization.
- [ ] Vehicle protocol is detected and recorded.
- [ ] Capability snapshot is created.
- [ ] Enter Live with no fabricated unsupported signals.

## B. Normal Live session

Record 2–5 minutes.

Observe where actually supported:

- [ ] RPM.
- [ ] Vehicle speed.
- [ ] Coolant temperature.
- [ ] `ATRV` adapter voltage.
- [ ] `0142` ECU/control-module voltage separately from `ATRV`.
- [ ] Signal unavailable states are not rendered as zero.
- [ ] Recording indicator/state is correct.

Then:

- [ ] Stop normally.
- [ ] Stop operation terminates within bounded time.
- [ ] Session becomes COMPLETED.
- [ ] Summary opens.
- [ ] Summary block/event/reading counts are plausible.
- [ ] Summary integrity is COMPLETE only if evidence supports it.
- [ ] Close the application completely.
- [ ] Relaunch.
- [ ] Same session appears in History.
- [ ] Rebuilt summary matches persisted facts from the original summary.

## C. PID degradation semantics

Using a naturally unsupported PID or controlled fixture/path when possible:

- [ ] First `NO_DATA` is preserved.
- [ ] Second `NO_DATA` is preserved.
- [ ] Third `NO_DATA` is preserved.
- [ ] After the third consecutive `NO_DATA`, only the operational poll set retires that PID.
- [ ] `PID_RETIRED_NO_DATA` is emitted separately.
- [ ] Vehicle capability history is not rewritten by the retirement.
- [ ] A successful response between failures resets the consecutive counter.
- [ ] TIMEOUT does not retire the PID.
- [ ] Adapter/ELM error does not retire the PID.
- [ ] Connection loss does not retire individual PIDs.

## D. Interruption matrix

Run each as a separate session.

### D1 — Physical adapter disconnect

- [ ] Start recording.
- [ ] Physically disconnect/power-off adapter.
- [ ] UI does not remain indefinitely active.
- [ ] Session becomes INTERRUPTED with a connection-related reason.
- [ ] Already committed blocks survive.
- [ ] Restart app and verify orphan recovery is not required for an already interrupted session.

### D2 — App background

Release-1 policy is foreground-only.

- [ ] Start recording.
- [ ] Send app to background / lock screen.
- [ ] Session transitions to INTERRUPTED / `APP_BACKGROUND`.
- [ ] App does not silently claim continuous recording.
- [ ] Return/relaunch and verify committed data and summary integrity.

### D3 — Abrupt process kill

- [ ] Start recording and allow at least one telemetry block to commit.
- [ ] Kill the app/process without normal stop.
- [ ] Relaunch.
- [ ] Recovery finds no indefinitely ACTIVE session.
- [ ] Recovered session is INTERRUPTED/reconciled.
- [ ] Confirmed blocks remain readable.
- [ ] Missing tail data is not invented.

### D4 — Cancel before Live

- [ ] Start connection flow.
- [ ] Cancel before a valid Live session begins.
- [ ] No ghost ACTIVE/PREPARING session remains.

## E. Evidence to attach to the gate issue

Attach or paste:

- commit SHA;
- build identifier/hash;
- device + Android version;
- adapter identity;
- detected vehicle protocol;
- capability summary;
- normal-session ID;
- interruption-session IDs;
- first/second launch logs for the normal session;
- logs around each interruption;
- screenshots of Live/summary/history where useful;
- final PASS/FAIL per section;
- every defect with reproduction steps.

## Gate decision

R1 closes only when sections A–D pass on a release-candidate-equivalent build and the evidence is attached to the tracking issue.

A failure does not get waived because the normal session works. The purpose of this gate is to prove both the happy path and the failure path.
