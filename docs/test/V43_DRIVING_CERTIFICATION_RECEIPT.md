# AutoPulse V1 — v4.3 Driving & Physical Certification Receipt

**Status:** PRECOMMITTED — NOT EXECUTED  
**Authority:** `docs/release/AUTOPULSE_V1_CLOSURE_AUTHORITY.md`  
**Rule:** acceptance criteria are frozen before the drive. Results may not redefine them afterward.

## 0. Exact artifact identity

Fill from the final green internal-build receipt before installing:

- closure PR: #91
- source HEAD: `<freeze>`
- CI-tested SHA: `<freeze>`
- workflow run: `<freeze>`
- APK SHA-256: `<freeze>`
- APK size: `<freeze>`
- JS bundle SHA-256: `<freeze>`
- package-lock SHA-256: `<freeze>`
- signing class: expected `ANDROID_DEBUG` for internal physical certification only
- permission contract: must be PASS

If the installed APK hash differs, the run is `INVALID_EVIDENCE`.

## Safety boundary

The driver must not operate AutoPulse while the vehicle is moving.

Preferred setup:

- one licensed driver;
- one passenger/test operator observing AutoPulse.

If testing alone:

- configure/start the session while safely parked;
- mount/secure the phone;
- do not touch or read detailed UI while moving;
- stop and park before interacting with Check, History, Summary, settings or connection controls.

Never deliberately create an overheating, oil-pressure, fire-risk, braking, steering or other hazardous vehicle condition to test an alert. Critical alert logic is exercised through automated/replay tests, not by inducing danger on-road.

BLE unplug/reconnect, process kill, recovery exhaustion and Live/Check handoff tests are stationary tests.

## 1. Pre-drive parked gate

Vehicle / adapter / Android identity:

- vehicle:
- year/engine if known:
- adapter:
- adapter firmware/identity evidence:
- Android device:
- Android version:
- detected OBD protocol:

Required:

- [ ] clean install or documented upgrade path succeeds;
- [ ] Garage vehicle opens correctly;
- [ ] adapter connects without developer intervention;
- [ ] Live does not claim ECU-live before a valid ECU-origin observation;
- [ ] adapter voltage remains distinguishable from PID 0142;
- [ ] run one direct Check while parked;
- [ ] Check is descriptor-gated/read-only;
- [ ] Check completes only after immutable persistence succeeds;
- [ ] sealed Check reopens with identical SHA-256.

Result: `PASS | FAIL | BLOCKED | INVALID_EVIDENCE`

## 2. Driving Live gate

Start Live while parked, then drive normally. The test should be long enough to exercise repeated stop/move transitions; about 10 minutes or more is useful when traffic/road conditions safely allow it, but safety overrides duration.

Required observations:

- [ ] RPM remains plausible when available;
- [ ] speed remains plausible when available;
- [ ] coolant remains plausible when available;
- [ ] no missing/stale value becomes synthetic zero/current data;
- [ ] low-distraction UI activates with trusted motion evidence;
- [ ] detailed controls are not required while moving;
- [ ] voice alerts remain short/event-driven rather than continuously reading PIDs;
- [ ] normal telemetry remains quiet rather than alarm-like.

### Motion-data interruption case

During a naturally occurring speed-evidence dropout, if one occurs:

- [ ] other valid ECU telemetry keeps the session alive;
- [ ] AutoPulse does not label the whole ECU path dead merely because speed is unavailable;
- [ ] the driving surface uses a limited/unknown motion state such as `MOTION DATA LIMITED` when appropriate;
- [ ] recovered speed evidence restores normal motion presentation without a new session.

If no natural dropout occurs, mark this subcase `NOT_EXERCISED`; do not create unsafe conditions to force it.

Result: `PASS | FAIL | BLOCKED | NOT_EXERCISED | INVALID_EVIDENCE`

## 3. Background / screen-lock continuity

May be exercised by the passenger/operator while moving, or while stationary.

Required:

- [ ] Android connected-device foreground notification/service is active;
- [ ] backgrounding or locking the screen does not silently kill healthy acquisition when the service remains healthy;
- [ ] returning to AutoPulse preserves the same session identity;
- [ ] telemetry gaps, if any, remain gaps rather than fabricated continuity;
- [ ] a foreground-service error, if observed, produces an explicit terminal reason rather than false background health.

Result: `PASS | FAIL | BLOCKED | NOT_EXERCISED | INVALID_EVIDENCE`

## 4. Parked Stop / persistence gate

After the driving portion, park safely before interaction.

Required:

- [ ] user Stop reaches one terminal outcome;
- [ ] healthy user Stop reconstructs as `COMPLETE` when the expected short final block is the only partial block;
- [ ] History shows the same session;
- [ ] Summary reopens from durable blocks;
- [ ] app restart preserves History/Summary;
- [ ] no stale timer/Stop control remains after terminalization.

Record:

- sessionId:
- blocks:
- readings:
- Summary integrity:
- screenshots/notes:

Result: `PASS | FAIL | BLOCKED | INVALID_EVIDENCE`

## 5. Stationary transport recovery gate

Vehicle parked.

### Recoverable interruption

- [ ] begin Live and establish valid ECU evidence;
- [ ] induce a safe adapter/BLE interruption;
- [ ] bounded recovery runs;
- [ ] successful recovery resumes the same session;
- [ ] missing interval is not fabricated;
- [ ] no duplicate monitor/controller behavior appears.

### Recovery exhaustion

- [ ] when recovery cannot succeed, exactly one explicit terminal outcome is produced;
- [ ] reason ends in the documented recovery failure class;
- [ ] already committed evidence remains reconstructable.

### NO_DATA distinction

- [ ] unsupported/intermittent PID `NO_DATA` does not independently trigger transport recovery;
- [ ] PID quarantine/reprobe does not rewrite historical capability truth.

Result: `PASS | FAIL | BLOCKED | INVALID_EVIDENCE`

## 6. Stationary process-kill gate

Vehicle parked.

- [ ] establish Live and allow at least one durable block;
- [ ] kill the Android process without Stop;
- [ ] relaunch;
- [ ] orphan session becomes `INTERRUPTED`;
- [ ] reason is `UNEXPECTED_APP_TERMINATION` unless stronger durable evidence exists;
- [ ] recovered `endedAt` derives from durable evidence rather than relaunch time;
- [ ] committed blocks remain reconstructable.

Result: `PASS | FAIL | BLOCKED | INVALID_EVIDENCE`

## 7. Live -> Check -> Live handoff

Vehicle parked.

Repeat at least three times without killing AutoPulse:

```text
Live
→ terminal Stop
→ Check
→ sealed report reopen
→ Live
```

Required:

- [ ] no stale ElmAccumulator/receive monitor survives the prior workflow;
- [ ] Check may perform at most the documented bounded transport rebuild;
- [ ] Check terminal state releases its BLE lease;
- [ ] the next Live establishes fresh ECU truth;
- [ ] no duplicate samples/commands indicate multiple active controllers.

Result: `PASS | FAIL | BLOCKED | INVALID_EVIDENCE`

## 8. Multi-vehicle scope

Run the same exact APK without code changes.

| Vehicle | Adapter | Protocol | Live | Driving | Stop/Summary | Check seal/reopen | Recovery | Result |
|---|---|---|---|---|---|---|---|---|
| Renault Logan | | | | | | | | |
| Renault Duster | | | | | | | | |
| Additional vehicle | | | | | | | | |

A PASS on one row never certifies another row.

## 9. Final physical verdict

Allowed values:

- `PASS`: all mandatory exercised gates for the claimed scope pass on the exact artifact.
- `FAIL`: a mandatory exercised behavior contradicts its acceptance rule.
- `BLOCKED`: a prerequisite/evidence item was unavailable.
- `INVALID_EVIDENCE`: artifact identity or evidence chain cannot be proven.

Final result:

```text
V43 PHYSICAL CERTIFICATION: <PASS | FAIL | BLOCKED | INVALID_EVIDENCE>
```

If FAIL: create a narrow defect, fix it, generate a new APK hash, and rerun every gate whose behavior/artifact identity could have changed.
