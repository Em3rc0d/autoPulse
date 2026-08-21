# AutoPulse v1 — Release Candidate Runbook

This runbook is the release authority for the first public Android build. A candidate may be tagged only when every required row below is `PASS` and its evidence is linked. `BLOCKED`, `NOT RUN`, and verbal confirmation are not passes.

## Candidate identity

Record before testing:

- candidate version and Android `versionCode`;
- Git commit SHA;
- build profile and build ID;
- signed AAB SHA-256;
- signing-certificate SHA-256 fingerprint;
- tester, date, Android device/model/version;
- adapter model, firmware/identity and compatibility grade;
- vehicle make/model/year/engine and detected protocol.

The exact same signed artifact must be used for every candidate test. Any P0/P1 fix creates a new candidate and restarts the full matrix.

## Automated gate

Run from a clean checkout:

```sh
npm ci
npm run verify
```

Required result: the GitHub Actions `AutoPulse Mobile Verify` workflow is green for the candidate commit. Attach the workflow URL and commit SHA.

The automated suite must include the frozen Golden Diagnostic Corpus: 11-bit, 29-bit, ECU negative response, high-range telemetry, mixed bus, ISO-TP/DTC fail-closed behavior and truncated persisted data.

## Installation and persistence

| ID | Scenario | Required result |
|---|---|---|
| I-01 | Clean install | App opens without test credentials, internal tools or seeded product data. |
| I-02 | Upgrade from last distributed build | Schema migration completes and existing Garage, History and summaries remain readable. |
| I-03 | Restart after vehicle creation | Vehicle selection and metadata persist. |
| I-04 | Restart after completed Live session | History and the reconstructed summary agree with persisted evidence. |
| I-05 | Corrupt/truncated diagnostic block fixture | App remains usable and marks the affected summary degraded/incomplete; it never invents completeness. |
| I-06 | Orphaned active session after process kill | Startup reconciliation produces one honest terminal/recovered state and no permanently active session. |

## Adapter and vehicle discovery

| ID | Scenario | Required result |
|---|---|---|
| D-01 | Known-good adapter | Identity is evidence; behavioral probe produces a justified grade. |
| D-02 | Generic adapter | Required behaviors determine `COMPATIBLE` or a more conservative grade. |
| D-03 | Deliberately degraded/unsupported adapter case | Limitation is explicit and Live is blocked only when minimum reliable behavior is absent. |
| D-04 | Vehicle initialization | Detected protocol and capability snapshot are persisted. |
| D-05 | Unsupported PID | UI shows unavailable/not observed; no zero or fabricated support. |
| D-06 | Repeated OBD `NO_DATA` | Third result is preserved before operational retirement; capability history is unchanged. |
| D-07 | Transport timeout/adapter error | Result does not become vehicle `NO_DATA`. |
| D-08 | Voltage sources | Adapter `ATRV` and ECU `0142` remain separate signals and labels. |

## Live lifecycle

| ID | Scenario | Required result |
|---|---|---|
| L-01 | 2–5 minute normal session | Available values update; stale, invalid and unavailable states remain distinct. |
| L-02 | User stop | Exactly one terminal state, bounded persistence drain and reopenable summary. |
| L-03 | Physical BLE loss | Exactly one `INTERRUPTED / DEVICE_DISCONNECTED`; no later callback changes it. |
| L-04 | App background | Foreground-only v1 policy produces `INTERRUPTED / APP_BACKGROUND`. |
| L-05 | Abrupt process kill | Reconciliation passes I-06 and persisted evidence remains honest. |
| L-06 | Cancel before Live | No ghost session appears in History. |
| L-07 | Persistence drain timeout fixture | Session becomes `INTERRUPTED / TELEMETRY_DRAIN_TIMEOUT`, never complete. |

## Product usability

A tester unfamiliar with ELM, CAN and PIDs must complete:

`Garage → Vehicle → Connect → Adapter compatibility → Vehicle capabilities → Live → Stop → Summary → History`

Pass only if no AT command, CAN identifier or raw PID configuration is required; primary actions remain reachable on the smallest certified screen; and every empty/loading/degraded/interrupted state gives a useful next action.

## Minimum physical certification set

Release requires evidence from:

- more than one Android device family;
- multiple vehicle families, including the existing Logan and Duster evidence where candidate-equivalent;
- a known-good adapter, a generic adapter and a degraded/unsupported case;
- both 11-bit and 29-bit evidence across physical or frozen corpus coverage;
- normal stop, BLE loss, background and kill/recovery.

Existing evidence may be reused only when it identifies the tested commit/build and still exercises unchanged release behavior. Missing interruption or device-family rows must be executed; a successful normal drive does not imply those rows passed.

## Release decision

The release owner records one decision:

- `ACCEPTED`: every required row is `PASS`, artifact identity is complete, and no open P0/P1 defect exists;
- `REJECTED`: any required row fails; open a defect, create a new candidate and rerun the complete matrix.

Only an `ACCEPTED` candidate may receive the `v1.0.0` tag or be submitted to a store track.
