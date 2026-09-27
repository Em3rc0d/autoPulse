# AutoPulse Check — Diagnostic Safety Contract

**Lane:** Design  
**Authority:** DESIGN AUTHORITY  
**Status:** CHECK-MK0 / mandatory pre-implementation contract

## 1. Safety objective

AutoPulse Check Core V1 is a **read-only diagnostic subsystem**. It may interrogate supported diagnostic state but must not intentionally mutate vehicle state, clear evidence, trigger actuators, program modules, reset learned values or enter privileged sessions.

This contract is stronger than “we do not currently call mutating commands.” It requires architectural prevention.

## 2. Default-deny rule

Every command that can reach a diagnostic connector is classified before execution.

```text
READ_ONLY_PROVEN
READ_ONLY_EXPECTED
UNKNOWN
MUTATING
```

Check Core V1 executes **only `READ_ONLY_PROVEN`** requests.

```text
READ_ONLY_EXPECTED → blocked until promoted
UNKNOWN            → blocked
MUTATING           → blocked
```

The policy is allowlist-based. A blacklist is insufficient.

## 3. Safety boundary placement

The safety check sits above every connector implementation:

```text
DiagnosticScanEngine
        ↓
DiagnosticScanPlanner
        ↓
DiagnosticCommandSafetyPolicy
        ↓ ALLOW only
DiagnosticConnector
        ↓
ELM / STN / Wi-Fi / USB / future transport
```

No UI, parser, evidence planner or manufacturer profile may bypass the policy by calling the connector directly from Check.

## 4. Core read-only allowlist families

The initial allowlist may contain only reviewed commands required for:

- adapter identification and protocol introspection;
- standard OBD reachability/capability discovery;
- supported-PID bitmap reads;
- current-data reads;
- freeze-frame reads;
- stored DTC reads;
- pending DTC reads;
- readiness/monitor reads;
- vehicle-information reads;
- permanent DTC reads;
- explicitly reviewed read-only enhanced requests in future profiles.

Each concrete request family must have a documented semantic contract and parser fixture before promotion.

## 5. Explicitly prohibited classes

Check Core V1 must reject requests whose purpose can include:

```text
clear DTC / emissions information
ECU reset
actuator output control
routine control with side effects
coding / programming
write-data-by-identifier
adaptation reset
service reset
security access / seed-key unlock
memory write/erase
module reconfiguration
immobilizer/key programming
calibration write
```

The exact wire command is transport/protocol specific; the product rule is semantic.

## 6. Special protection for raw requests

`DiagnosticConnector` supports raw diagnostic requests for architectural flexibility. Check must treat arbitrary raw payloads as `UNKNOWN` unless a reviewed safety descriptor maps the payload to `READ_ONLY_PROVEN`.

Therefore:

```text
supportsRawDiagnosticRequests == true
```

does **not** imply:

```text
Check may execute arbitrary raw payloads
```

## 7. Manufacturer/enhanced diagnostics

Enhanced profiles are disabled by default in Check Core.

A future `EnhancedDiagnosticProfile` may add commands only when it contains:

```text
profile id + version
vehicle applicability evidence
request semantics
safety classification
expected positive/negative responses
parser fixtures
transport/session prerequisites
source provenance
physical validation scope
```

No manufacturer-specific request enters the runtime allowlist from a forum post, opaque scanner trace or unreviewed DBC alone.

## 8. Scan budget and ECU load

Read-only does not mean harmless at any frequency. Check therefore uses a command budget.

Budget dimensions:

```text
maximum requests per stage
minimum inter-command delay
per-request timeout
retry count
retry backoff
stage deadline
overall scan deadline
maximum consecutive hard failures
```

Budgets may vary by observed protocol and connector quality. ISO 14230/KWP must not be treated as if it were a high-throughput CAN transport.

## 9. Concurrency rule

Default Check execution is serial per active diagnostic transport session.

Parallel request execution is forbidden unless a future connector explicitly certifies safe independent channels.

Never implement patterns such as:

```text
Promise.all(allSupportedPids)
```

against one ECU transport.

## 10. Priority order under a bounded scan

When budget is constrained, preserve diagnostic value in this order:

```text
connection + protocol evidence
→ endpoint discovery
→ stored/pending/permanent DTC evidence
→ MIL/readiness
→ freeze-frame evidence
→ targeted current PIDs
→ Mode 06 enrichment
→ optional vehicle/enhanced enrichment
```

An interrupted scan should retain the most actionable evidence already captured.

## 11. Retry semantics

A retry is permitted only when:

- the request itself is `READ_ONLY_PROVEN`;
- the failure class is retryable;
- retry budget remains;
- connector/session health has not crossed the abort threshold.

`NO_DATA` is generally a semantic result, not a reason for unbounded retries.

`INVALID_RESPONSE`, timeout and disconnect remain distinct.

## 12. Recovery and cancellation

User cancellation stops issuance of new commands as soon as safely possible. Evidence already received is retained.

Disconnect or transport loss transitions the scan to `DISCONNECTED` or `LIMITED` according to completed evidence; AutoPulse must not reconnect and resume privileged/enhanced sequences implicitly.

## 13. Vehicle-motion policy

Check is designed primarily for a stationary user workflow unless a specific evidence task requires engine-running state.

The product must not ask the user to manipulate the phone or initiate interactive diagnostic workflows while actively driving.

If current PID enrichment can safely run while the vehicle is operating, it remains background read-only acquisition with the same request budget and no interactive user demand.

## 14. Physical validation safety

Physical QA must not create faults by dangerous means solely to test Check.

Do not intentionally provoke:

- overheating;
- misfire through unsafe mechanical intervention;
- fuel starvation;
- unsafe sensor disconnection while driving;
- braking/ABS/SRS faults;
- actuator movement.

Abnormal cases are validated through replay, synthetic fixtures, existing naturally occurring DTC evidence or controlled bench environments.

## 15. Evidence preservation

Check never clears DTCs as part of a scan. A diagnostic scan must not destroy the very evidence it is intended to observe.

This invariant applies even if a connected tool or adapter exposes a convenience “clear” function.

## 16. Safety auditability

Each executed diagnostic request must be attributable to:

```text
scanId
planner stage
request semantic id
safety classification
endpoint target / attribution evidence
start/end time
result status
```

The immutable technical receipt must make it possible to prove which requests were issued during a physical validation run.

## 17. Parser isolation

A parser may interpret a response but cannot choose a mutating follow-up command directly. Follow-up acquisition requests are proposed to the planner, reclassified by the safety policy and budgeted before execution.

This prevents a malicious or buggy parser path from becoming a command path.

## 18. UI safety language

User-facing Check language must distinguish:

- `NO DTCs REPORTED` from `vehicle healthy`;
- `NOT READY` from `failed monitor`;
- `UNSUPPORTED` from `normal`;
- `NOT EVALUATED` from `no issue`;
- `possible cause` from `confirmed cause`.

No visual green state may silently convert incomplete coverage into a health certification.

## 19. Safety gate for implementation

No Check runtime PR may begin issuing new diagnostic commands until:

1. the request has a research source and semantic definition;
2. the request is classified `READ_ONLY_PROVEN`;
3. positive and negative response fixtures exist;
4. failure semantics are defined;
5. the planner budget is defined;
6. automated tests prove blocked commands cannot reach the connector.

## 20. V1 safety Definition of Done

The safety subsystem is ready for physical Check QA only when deterministic tests prove:

```text
unknown request → BLOCKED
mutating request → BLOCKED
raw unregistered request → BLOCKED
allowed read request → EXECUTED
retry budget exhausted → STOP
hard failure threshold → STOP
cancel → no new requests
partial evidence → retained
```

Any failure of these rules blocks the hammer for the affected Check stage.
