# ROAD TEST-001 — Measurement definitions and data availability

**State:** PRECOMMITTED FOR PILOT · NONE OF THE BELOW ARE MEASURED RESULTS
**Source references:** `ObdAcquisitionEvent.ts`, `ObdAcquisitionMapper.ts`, `SessionSummaryBuilder.ts`, `LiveObdPollingPolicy.ts`, `MotionStatePolicy.ts`, `LiveEcuTruth.ts`.

## 1. Observation units and segmentation

Record at least these phase windows: `STATIONARY_PREFLIGHT`, `DRIVING`, `STATIONARY_POSTFLIGHT`, `PARKED_FAILURE_INJECTION`. Do not aggregate a long parked Check into Live driving rates.

A valid ECU observation is a finite numeric decoded reading from an **OBD** command and evidence-provenance origin `OBD2`, with `quality=GOOD`; adapter-only `ATRV`, GNSS/phone sensors, missing or invalid readings do not qualify. Preserve the source ECU address when known and `unattributed` otherwise.

The source stores `ObdAcquisitionEvent` records with `command`, `requestedAt`, `completedAt`, `latencyMs`, `status`, `decodedReadings`, and `sequenceNumber`. It stores block and event counts for reconstructed Session Summary, but the app currently **does not expose an approved bulk export or calculated percentile screen**. Until there is a verified read-only analysis/extraction path, mark event-level metrics `MEASUREMENT_BLOCKED` rather than infer them from screenshots.

## 2. Metrics frozen before the physical trial

| ID | Metric | Definition and denominator | Authority | Pilot decision rule |
|---|---|---|---|---|
| M01 | Valid decoded PID observations | Count finite, GOOD, ECU-origin readings by `0105/010D/010C/0104/0111/0142` | Persisted events; observed `signalId`, quality, origin | Report each PID; three core Logan PIDs required in preflight; unsupported others `N/A` |
| M02 | Per-PID response outcome | For each command: `SUCCESS`, `NO_DATA`, `TIMEOUT`, `ERROR`, `PARTIAL`, etc., as separate counts divided by **attempts for that command** | Persisted acquisition events | Never merge `NO_DATA` with transport disconnect; zero attempts = `NOT_OBSERVED` |
| M03 | Valid-response yield | `valid decoded ECU responses / issued attempts`, per PID and phase | Persisted events | Baseline only; no invented universal percentage target |
| M04 | Acquisition latency | p50/p95/max `latencyMs` from completed persisted events per PID, nearest-rank quantiles with sample `n` | Persisted event `latencyMs` | Exploratory hardware baseline; if no event export, `MEASUREMENT_BLOCKED` |
| M05 | Update interval / freshness | p50/p95/max time delta between consecutive valid `observedAt` values for same signal **within the same phase/session**; count intervals | Persisted readings | Baseline; `n<2` => `INSUFFICIENT` |
| M06 | Evidence-stale UI truth | Compare UI displayed state with available timestamps/quality; do not label last-known value current | UI screenshots/video + event timestamps | **Zero confirmed false-current/fake-zero cases** |
| M07 | Motion classification | During natural transitions compare observed `MOVING/PARKED/UNKNOWN` with trusted speed/phone evidence; log conflict/unknown | UI + timestamped motion evidence | **Zero unsafe PARKED promotions** when credible moving evidence exists |
| M08 | Session continuity | Count session IDs created, unexpected terminal events, recoveries, duplicate active owners across phase | Session metadata, event/CI evidence | **Zero duplicate/phantom active sessions** |
| M09 | Durable integrity | Compare expected vs found blocks, unsupported/corrupt blocks, sequence gaps and same Summary before/after restart | `SessionSummaryResult` | For healthy clean Stop: equal expected/found, 0 corrupt, 0 unsupported, 0 gaps, `COMPLETE`; expected short last partial block allowed |
| M10 | Voice/distraction | Count unsolicited repeated spoken alerts per same stable condition; validate English/Spanish only parked via nonhazardous trigger | Operator notes + approved device evidence | No unbounded/repetitive voice; no driver interaction while moving |
| M11 | Check scope/evidence | Command list, protocol, DTC result kind, target selected/executed, seal verification | Sealed Check report | Read-only, scope limited, no fabricated negative DTC findings, seal unchanged |
| M12 | Recovery | Recovery outcome, same session ID, interruption gap, at most configured retry attempts, one terminal reason on exhaustion | Session/log/device observations | Parked only; bounded outcome; no invented continuity |

### Fixed implementation thresholds (not empirical results)

- Motion evidence freshness policy: **5,000 ms**; movement candidate **350 ms**; parked candidate **1,200 ms**; motion state policy is source of truth.
- Aggregate ECU-live stale presentation: **15,000 ms since last valid ECU-origin sample**; this is **not** a per-PID refresh SLA.
- Live requests use protocol/ELM-dependent serial polling with request timeouts (typically Mode 01 **1,500 ms**, adapter query **1,200 ms**); these are **timeout settings**, not certified observed latencies.
- Configured BLE recovery: bounded `[0,1500,3500]` ms attempt delays with connect timeout `3500` ms; these values do **not** guarantee an end-to-end duration when native promises misbehave.
- A different device/adapter/protocol can have different observed performance. Establish a baseline per hardware tuple before proposing hard p95-latency limits.

### Metrics NOT currently provable by this app

- Native BLE RF/GATT **packet loss percentage** (app-level `NO_DATA` or TIMEOUT is not radio packet loss).
- ECU internal sampling frequency or accuracy relative to a calibrated external sensor.
- Actual delivered voice volume, driver auditory comprehension, or Android audio route from Jest/Kotlin compile alone.
- Road-position ground truth when no independent synchronized reference was captured.
- Manufacturer-wide compatibility from a Logan/Duster trace.

These are either `MEASUREMENT_BLOCKED`, `NOT_EXERCISED` or require explicitly approved instrumentation/independent evidence. Do not place an invented percent in a report.

## 3. Calculation rules for future offline review

For each PID and phase: sort its records by `completedAt` then `sequenceNumber` (preserve ties), filter invalid timestamps and log exclusions. Define `p50(x)` and `p95(x)` via ascending sorted values at nearest-rank index `ceil(p*n)-1` (minimum index 0), and always show `n`. Timestamp gaps come from adjacent valid `observedAt` only, never from interpolation; periods with zero events are not represented as synthetic observations.

`valid-response yield` is a **command-level delivery metric**, not a vehicle capability certification. Since one command can decode multiple signals, do not divide total readings by total commands and call that per-command success. Data with no trustworthy ECU/protocol provenance are retained as `UNATTRIBUTED` or `INSUFFICIENT`, not dropped silently.

Record min/max as descriptive context, **not** a mechanical diagnostic threshold or engine-health verdict. No change to the Live polling architecture is permitted solely to inflate metric counts.

## 4. Acceptance vs characterization

The ROAD GO/PASS safety gates use explicit zero-tolerance invariants (fabrication, ownership, corrupt clean-stop persistence, forbidden writes, distracted-driving interaction). Response-yield/latency/gap distributions are **baseline characterization** in ROAD TEST-001, not fabricated hard pass thresholds. If event-level data cannot be extracted in the current QA candidate, the session may demonstrate UI/History behavior but **cannot claim a quantitative performance benchmark**. That is a measurement HOLD, not an ECU failure.

A second, independently reviewed hardware run is required before setting stringent numeric performance SLAs.
