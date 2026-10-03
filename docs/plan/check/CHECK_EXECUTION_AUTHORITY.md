# AutoPulse Check — Execution Authority

**Lane:** Plan  
**Authority:** EXECUTION AUTHORITY  
**Status:** CHECK-MK0 / pre-hammer execution plan

## 1. Goal

Turn the accepted Check design into an ordered, auditable implementation program with explicit promotion gates. No implementation stage may skip a research or safety dependency simply because a partial parser already exists.

## 2. Program boundary

The implementation program has two product milestones:

```text
CHECK CORE V1
= safe standard OBD diagnostic scan

CHECK INTELLIGENCE V1
= correlation of DTC/monitor/freeze-frame/current-PID/history evidence into explainable concerns
```

Manufacturer-enhanced diagnostics are a later program unless separately scoped and certified.

## 3. Existing implementation assets

The program begins from current repository foundations:

- hardware-neutral `DiagnosticConnector`;
- `ElmBleDiagnosticConnector` over the proven BLE/ELM pipeline;
- environment/protocol discovery;
- endpoint-attributed capability observations;
- safe standard service characterization for `0100`, `0101`, `03`, `07`, `0900`, `0A`;
- initial DTC byte-pair decoding for `43`, `47`, `4A`;
- compatibility snapshots and persistence;
- Live telemetry persistence/replay patterns that can inform diagnostic evidence storage.

These are inputs, not proof that Check Core V1 is complete.

## 4. Workstream sequence

```text
CHECK-MK0  Documentation freeze
CHECK-MK1  PID quarry hardening
CHECK-MK2  Diagnostic research pack
CHECK-MK3  Domain contracts
CHECK-MK4  Golden diagnostic fixtures + parsers
CHECK-MK5  Safety policy + scan planner + command budget
CHECK-MK6  DiagnosticScanEngine + replay
CHECK-MK7  DTC Core physical path
CHECK-MK8  Readiness + freeze frame + supported-PID enrichment
CHECK-MK9  Mode 06 enrichment when research gate closes
CHECK-MK10 Evidence graph + correlation engine
CHECK-MK11 Persistence + immutable reports
CHECK-MK12 Check UX + Session Report relocation
CHECK-MK13 Physical pilot matrix
CHECK-MK14 Release/certification contract
```

## 5. CHECK-MK0 — documentation freeze

Deliverables:

- Check Design Authority;
- Diagnostic Safety Contract;
- Execution Authority;
- Dependency Graph;
- Research Matrix;
- Definition of Done.

Exit gate:

```text
No open architectural decision materially changes:
- product boundary
- diagnostic endpoint model
- safety boundary
- evidence semantics
- persistence boundary
- high-level state machine
- implementation order
```

Open evidence/research tasks are permitted, but they must be explicit nodes with owners/artifacts and cannot be hidden assumptions.

## 6. CHECK-MK1 — PID quarry hardening

Target: `Q-OBD2-PID-CATALOG-20260904`.

Required changes before runtime promotion:

1. rename research `DBC_OBSERVED` semantics to `DBC_DEFINED`/equivalent;
2. preserve decode-relevant fields: start bit, length, byte order, signedness, factor, offset, min/max, unit;
3. detect non-equivalent duplicate signal definitions instead of silently selecting one;
4. verify source/archive/DBC SHA-256 values fail-closed;
5. assert expected extraction counts for the frozen pack;
6. regenerate derived inventory and compare deterministically;
7. retain the statement `114 PIDs derived from OBD-v4.3.dbc`, not “complete universal PID catalog”.

Exit gate: reproducible quarry with no unresolved normalization conflict.

## 7. CHECK-MK2 — diagnostic research pack

Research quarries required:

```text
Q-CHECK-001  OBD_DTC_SERVICES
Q-CHECK-002  SUPPORTED_PID_DISCOVERY
Q-CHECK-003  READINESS_MONITORS
Q-CHECK-004  FREEZE_FRAME
Q-CHECK-005  MODE06
Q-CHECK-006  VEHICLE_INFORMATION
Q-CHECK-007  ECU_ATTRIBUTION
Q-CHECK-008  DIAGNOSTIC_SAFETY
Q-CHECK-009  DTC_KNOWLEDGE
Q-CHECK-010  DTC_PID_CORRELATION
Q-CHECK-011  TRANSPORT_BEHAVIOR
```

Each quarry must define sources, boundary, positive/negative examples, unresolved questions and promotion criteria.

Exit gate for Core V1 does not require every future enhanced-diagnostic question to be solved. It requires all nodes used by Core V1 to be closed or explicitly deferred.

## 8. CHECK-MK3 — domain contracts

Implement pure domain types without transport/UI side effects:

```text
DiagnosticScan
DiagnosticScanState
DiagnosticEndpoint
DiagnosticServiceObservation
DiagnosticTroubleCode
DiagnosticReadiness
DiagnosticFreezeFrame
DiagnosticMonitorResult
DiagnosticPidSupport
DiagnosticEvidenceFact
DiagnosticEvidenceRelation
DiagnosticConcern
DiagnosticCoverage
DiagnosticReport
DiagnosticSafetyClassification
```

Requirements:

- endpoint attribution preserved;
- UNKNOWN is first-class;
- no health-score field;
- no implicit role inference;
- current vs historical evidence distinguishable;
- immutable report/version metadata represented.

Exit gate: unit tests cover state/semantic invariants.

## 9. CHECK-MK4 — golden diagnostic fixtures + parsers

Create a separate diagnostic fixture lane.

Minimum fixture families:

```text
NO_DTC
STORED_SINGLE
STORED_MULTI
PENDING_ONLY
PERMANENT_ONLY
SAME_DTC_MULTI_STATUS
MULTI_ECU
NO_DATA
TIMEOUT
PARTIAL
MALFORMED
DISCONNECT
KWP_RESPONSE
CAN_RESPONSE
ELM_CLONE_NOISE
READINESS
SUPPORTED_PID_BITMAP
FREEZE_FRAME
MODE06_WHEN_PROMOTED
VEHICLE_INFORMATION
```

Parsers must be pure and deterministic.

Exit gate: all parser claims can be replayed without physical hardware.

## 10. CHECK-MK5 — safety + planner

Implement:

```text
DiagnosticCommandSafetyPolicy
DiagnosticRequestDescriptor
DiagnosticScanPlanner
CommandBudget
RetryPolicy
StageDeadlinePolicy
```

Required properties:

- default deny;
- only `READ_ONLY_PROVEN` reaches connector;
- serial execution by default;
- bounded retries;
- protocol-aware timing;
- partial evidence retained;
- no raw unregistered request path.

Exit gate: adversarial tests prove mutating/unknown requests are blocked.

## 11. CHECK-MK6 — DiagnosticScanEngine

The engine orchestrates existing and new components through `DiagnosticConnector`.

Stages:

```text
characterize connector/environment
→ discover endpoints
→ discover standard capabilities
→ scan Core services
→ build partial scan evidence
→ optional enrichment plan
→ seal terminal result
```

First connector target: `DiagnosticReplayConnector` / deterministic replay.

Exit gate: one complete deterministic replay scan and several partial/failure scans reproduce identical results.

## 12. CHECK-MK7 — DTC Core physical path

Enable the smallest real Check that provides diagnostic value:

```text
protocol evidence
endpoint discovery
MIL / confirmed DTC count
stored DTCs
pending DTCs
permanent DTCs where supported
basic service coverage
```

Do not add Mode 06/freeze-frame complexity merely to expand feature count.

Physical order:

1. Renault Logan known KWP path;
2. Renault Duster;
3. one ISO 15765 CAN vehicle.

Exit gate: DTC Core results are stable, attributable and read-only on the declared matrix.

## 13. CHECK-MK8 — readiness + freeze frame + targeted PIDs

Implement only after corresponding research/parser gates.

Supported-PID discovery is chained per endpoint. Targeted PID acquisition is generated by evidence requirements and intersected with endpoint-advertised support.

No blind 114-PID sweep.

Exit gate: replay and physical evidence demonstrate correct support semantics and no substitution of unavailable signals.

## 14. CHECK-MK9 — Mode 06

Mode 06 remains a separately promoted capability.

Entry requires closed semantics for monitor/test identifiers, limits, negative responses and transport differences.

Exit gate: parser and interpretation are deterministic on approved fixtures; unsupported/unknown tests remain explicit.

## 15. CHECK-MK10 — evidence graph + correlation

Correlation is deterministic and evidence-first before any natural-language layer.

Flow:

```text
DTC/monitor observation
→ concern family
→ required evidence
→ available evidence graph
→ supported/contradicting facts
→ event confidence
→ cause-group confidence
```

Rules:

- absence of evidence is not contradictory evidence;
- cause hypotheses remain hypotheses;
- current and historical observations remain separately labeled;
- “bad fuel” and similar root-cause claims require explicit supporting evidence and normally remain candidate cause groups.

Exit gate: rule fixtures cover positive, negative and insufficient-evidence cases.

## 16. CHECK-MK11 — persistence + integrity

Persist Check independently from Live Session.

Minimum durable artifacts:

```text
scan metadata
endpoint inventory
request/service observations
DTC observations
readiness/freeze/monitor evidence
PID evidence used by Check
concerns
report version metadata
evidence hash
```

A completed report is immutable.

Exit gate: crash/restart reconstruction and integrity verification tests pass.

## 17. CHECK-MK12 — UX

Replace the current Check Lite product surface with real Check.

Move current session-derived report to:

```text
History → Session → Session Report
```

Check UI states:

```text
Check Home
Check Running
Check Report
Concern Detail
Technical Evidence
```

UX rules:

- one main `Run Check` action;
- no raw terminal by default;
- no health percentage;
- no `healthy` claim from zero DTCs;
- explicit LIMITED/UNSUPPORTED/NOT EVALUATED states;
- user explanation above technical evidence.

Exit gate: UI semantics match domain fixtures before physical QA.

## 18. CHECK-MK13 — physical pilot matrix

Physical validation does not intentionally create dangerous faults.

Required matrix:

```text
Logan      legacy ISO 14230/KWP evidence
Duster     second known physical vehicle
CAN car    ISO 15765 baseline
```

For each vehicle retain:

- exact app/build SHA;
- adapter identity;
- protocol evidence;
- endpoint inventory;
- issued request receipt;
- raw diagnostic evidence where permissible;
- decoded report;
- limitations;
- explicit PASS/FAIL per gate.

## 19. CHECK-MK14 — release contract

Only after physical evidence is sufficient define what can be publicly promised.

Example allowed claim form:

> AutoPulse Check can perform a read-only standard OBD diagnostic scan for stored/pending/permanent codes and supported evidence on certified adapter/vehicle paths.

Never claim universal module access until enhanced profiles/matrices prove it.

## 20. Branch/PR strategy

Preferred sequence:

```text
research/*
→ docs/check-mk0-*
→ feat/check-domain
→ feat/check-parsers
→ feat/check-safety-planner
→ feat/check-engine
→ feat/check-core-ui
→ pilot/check-core-v1
```

Keep PRs small enough that a failed gate does not obscure unrelated changes.

## 21. No-hammer rule

The hammer is authorized only when CHECK-MK0 is closed and the first implementation milestone has all upstream evidence nodes marked `CLOSED` or `DEFERRED_BY_CONTRACT`.

Specifically, CHECK-MK3 must not start while any of these remain ambiguous:

```text
product boundary
endpoint attribution model
safety classification boundary
Core V1 service scope
truth/evidence vocabulary
report immutability/versioning
zero-DTC semantics
unsupported/not-evaluated semantics
```

## 22. Stop conditions

Stop implementation and return to Design/Research if physical or fixture evidence reveals:

- a service thought read-only has side effects;
- source-address attribution is unreliable under a protocol/adapter combination;
- parser ambiguity can change DTC meaning;
- the planner requires a transport assumption not represented by `DiagnosticConnector`;
- a correlation rule cannot distinguish observation from speculation;
- a report state would force unknown evidence into PASS/FAIL.
