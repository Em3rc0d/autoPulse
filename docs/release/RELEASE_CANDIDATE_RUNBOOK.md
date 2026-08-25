# AutoPulse v1 — Release Candidate Runbook

**Authority:** RELEASE CONTRACT / FINAL CANDIDATE GATE

A candidate may be tagged only when every required row below is `PASS` and its evidence is linked. `BLOCKED`, `NOT RUN`, verbal confirmation, a screenshot of one successful drive, or green CI alone are not passes.

## Candidate identity

Record before testing:

- candidate version and Android `versionCode`;
- Git commit SHA;
- build profile and build ID;
- exact APK/AAB SHA-256;
- GitHub Actions run/artifact ID where applicable;
- signing-certificate SHA-256 fingerprint for production candidate;
- tester/date;
- Android device/model/version;
- adapter commercial model and reported firmware/identity;
- adapter compatibility grade;
- vehicle make/model/year/engine;
- detected/resolved protocol evidence;
- relevant permissions granted before Live.

The exact same artifact must be used for the candidate matrix. Any P0/P1 truth/acquisition/persistence/lifecycle fix creates a new candidate and resets affected physical certification.

## Documentation provenance

Before accepting a candidate, evidence must be represented consistently in:

- `docs/test/AUTOPULSE_TEST_LEDGER.md`;
- applicable `docs/mining-site/quarries/Q-*.md`;
- `docs/golden-dataset/AUTOPULSE_GOLDEN_DATASET_V1.md`;
- `docs/release/AUTOPULSE_LIVE_V1_RELEASE_PLAN.md`;
- compatibility matrix/contract.

Brainstorming is not release evidence.

## Automated gate

From a clean checkout/CI candidate:

```sh
npm ci
npm run verify
```

Required:

- TypeScript green;
- intended Jest suites green;
- `AutoPulse Mobile Verify` green for exact candidate head;
- Android standalone build green;
- React Native bundle packaged;
- exact build artifact retained and hashed.

The automated suite/corpus must cover, as it becomes available:

- 11-bit OBD;
- 29-bit OBD;
- ECU negative response;
- high-range telemetry;
- mixed/fragmented adapter response behavior;
- ISO-TP/DTC fail-closed behavior;
- truncated/corrupt persisted data;
- unsupported codec version;
- sequence gap/overlap behavior;
- clean final Stop flush semantics;
- Off-Road sensor budget/permission invariants.

## Installation and persistence

| ID | Scenario | Required result |
|---|---|---|
| I-01 | Clean install | App opens without test credentials, internal tooling or seeded production-looking facts. |
| I-02 | Upgrade from last distributed build | Schema migration completes and existing Garage, History and summaries remain readable. |
| I-03 | Restart after vehicle creation | Vehicle selection and metadata persist. |
| I-04 | Restart after completed Live session | History and reconstructed Summary agree with persisted evidence. |
| I-05 | Corrupt/truncated diagnostic block fixture | App remains usable and marks affected Summary degraded/incomplete; completeness is never invented. |
| I-06 | Orphaned active session after process kill | Startup reconciliation produces one honest interrupted/recovered state and no permanently active session. |
| I-07 | Interrupted session reopen | Committed blocks remain readable; missing tail is not fabricated. |

## Adapter and vehicle discovery

| ID | Scenario | Required result |
|---|---|---|
| D-01 | Known-good adapter | Identity is evidence; behavioral probe produces justified compatibility. |
| D-02 | Generic adapter | Required behaviors determine `COMPATIBLE` or a more conservative grade. |
| D-03 | Deliberately degraded/unsupported adapter case | Limitation is explicit; Live is blocked only when minimum reliable behavior is absent. |
| D-04 | Vehicle initialization | Protocol/capability evidence is retained truthfully. |
| D-05 | Unsupported/unavailable PID | UI shows unavailable/not observed; no fake zero/support. |
| D-06 | Repeated OBD `NO_DATA` | Third result is preserved before operational retirement; capability history is unchanged. |
| D-07 | Transport timeout/adapter error | Result does not become vehicle `NO_DATA`. |
| D-08 | Voltage sources | Adapter `ATRV` and ECU `0142` remain separate signals and labels. |
| D-09 | First ECU truth | Adapter/configuration evidence does not unlock healthy Live; valid ECU-origin reading does. |
| D-10 | Protocol automatic selection | `A0` is not presented as a resolved human vehicle protocol without sufficient evidence. |

## Live lifecycle

| ID | Scenario | Required result |
|---|---|---|
| L-01 | 2–5 minute normal session | Available values update; stale, invalid and unavailable states remain distinct. |
| L-02 | User stop | Exactly one terminal state, bounded persistence drain and reopenable Summary. |
| L-03 | Clean final flush | One expected shorter final block does not by itself downgrade a completed USER_INITIATED session to PARTIAL. |
| L-04 | Physical BLE loss | Exactly one explicit connection-related interruption; no later callback changes it. |
| L-05 | App background | Foreground-only v1 policy produces `INTERRUPTED / APP_BACKGROUND`. |
| L-06 | Abrupt process kill | Reconciliation passes I-06 and persisted evidence remains honest. |
| L-07 | Cancel before Live | No ghost session appears in History. |
| L-08 | Persistence drain timeout fixture | Session becomes interrupted/degraded according to defined timeout semantics, never COMPLETE. |
| L-09 | Terminal Live UI | Timer freezes, Stop/mode controls no longer imply active recording, Summary/History actions are available. |

## Off-Road isolation gate

Off-Road is included in the Live v1 product direction only if it is subordinate to ECU acquisition.

| ID | Scenario | Required result |
|---|---|---|
| O-01 | Enter Off-Road with permission already granted | ECU RPM/speed/coolant continue; phone pitch/roll/location data may enrich UI. |
| O-02 | Enter Off-Road without location permission | No Android permission dialog during ACTIVE Live; location-derived features show honest unavailable/permission-required state; ECU continues. |
| O-03 | Stay Off-Road 30–60s | No session reset, BLE disconnect, reinitialization or telemetry starvation caused by phone sensor load. |
| O-04 | Return to Essential/Performance | Same session and ECU stream continue. |
| O-05 | Vehicle-relative attitude | Before/after calibration semantics remain explicit; phone-origin values are not mislabeled ECU data. |
| O-06 | Altitude unavailable | UI never substitutes `0 m` merely because evidence is unresolved. |

RC3 Duster field evidence failed the Off-Road stability behavior; RC4 is the corrective candidate. The gate is physically closed only after a new quarry/test receipt passes.

## Smartphone cockpit usability

A tester unfamiliar with ELM, CAN and PIDs must complete:

`Garage → Vehicle → Connect → Adapter compatibility → Vehicle capabilities → Live → Stop → Summary → History`

Required:

- primary actions reachable on the smallest certified screen;
- no need to configure AT commands/CAN IDs/raw PIDs;
- healthy state visually quiet;
- no redundant permanent `LIVE · ECU DATA` banner after real Live is obvious;
- primary telemetry receives screen priority over explanation/mode chrome;
- driver modes are compact and do not obscure primary data;
- waiting/degraded/interrupted states have explicit next action;
- terminal session does not look active;
- unavailable data is understandable rather than blank/fake zero.

## Voice, color and haptic gate

The driver should not have to stare at the phone for important conditions.

### Normal/healthy

- green/healthy indicators may be present but should be calm;
- normal telemetry does not trigger repetitive voice;
- no continuous spoken RPM/speed reading.

### Attention / amber

- waiting, partial evidence or noncritical degradation uses amber/orange semantics;
- voice is used only when meaning/action justify interruption;
- warning text does not overstate diagnosis.

### Critical / red

- serious/terminal conditions use strong visual semantics;
- appropriate haptic pattern occurs;
- concise voice explains what happened and what the driver should do/know;
- rate limiting prevents repeated spam.

### Interruption example acceptance

For adapter loss/background termination, acceptable behavior is conceptually:

```text
SESSION INTERRUPTED
<reason in human language>
Recorded evidence was saved where durable.
```

with short voice/haptic feedback and no implication that recording continues.

## Document/vehicle reminder coexistence

CITV/SOAT/GNV-style reminders, when present, must not dominate over a critical active vehicle warning.

Check:

- reminder is visible but not mistaken for ECU fault;
- critical engine/session warning can supersede visual priority;
- reminder source/manual evidence is not labeled ECU-derived.

## Minimum physical certification set

Public release requires evidence from:

- more than one Android device family;
- multiple vehicle families, not only one model;
- at least one non-Renault/manufacturer-diverse case before broad multi-brand language;
- known-good adapter plus additional generic/degraded evidence appropriate to claimed support;
- second adapter/connector family before claiming broad reader/connector compatibility;
- 11-bit and 29-bit evidence across physical or frozen corpus coverage where included in support;
- normal Stop;
- BLE loss;
- app background;
- kill/recovery;
- Off-Road isolation if shipped enabled;
- History/reconstructed Summary after restart.

Existing evidence may be reused only when it identifies the tested build closely enough and behavior has not materially changed. A successful normal drive never implies interruption rows passed.

## Current pre-RC evidence snapshot

At the RC4 documentation point:

- Logan 2014 physical acquisition: observed PASS;
- Duster 2014 physical acquisition: observed PASS;
- Duster RC3 Summary reconstruction: observed PASS;
- Logan APP_BACKGROUND persistence: observed PASS;
- History durable completed/interrupted sessions: observed PASS;
- RC3 Off-Road Duster stability: observed FAIL;
- RC4 Off-Road code/CI: automated PASS, physical retest PENDING;
- RC4 clean Stop COMPLETE semantics: automated PASS, physical retest PENDING;
- physical BLE unplug on stabilized candidate: PENDING;
- process kill recovery on stabilized candidate: PENDING;
- public RC: NOT READY.

## Release decision

The release owner records one decision:

- `ACCEPTED`: every required row for the declared support envelope is PASS, artifact identity is complete, evidence chain is updated, and no open P0/P1 defect exists;
- `REJECTED`: any required row fails; preserve the failure quarry, fix, create a new candidate and rerun affected/full matrix according to severity.

Only an `ACCEPTED` candidate may receive the `v1.0.0` tag or be submitted to a production store track.
