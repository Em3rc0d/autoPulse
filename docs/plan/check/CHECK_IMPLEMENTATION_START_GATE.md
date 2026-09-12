# AutoPulse Check — Implementation Start Gate

**Authority:** EXECUTION AUTHORITY  
**Gate:** CHECK-MK3 START  
**Status:** AUTHORIZED FOR STRUCTURAL IMPLEMENTATION

## 1. Start condition

CHECK-MK3 may start because all material architecture/product decisions required to define the domain are closed.

The implementation team/agent does not need to choose during coding:

- what Check is;
- whether Check is Live history;
- how endpoint attribution works conceptually;
- whether unsupported means healthy;
- whether DTC equals PID;
- whether readiness not-ready means failure;
- whether freeze frame is current data;
- whether cause confidence equals event confidence;
- whether reports mutate in place;
- whether Check may issue writes;
- whether all 114 PIDs should be swept blindly;
- whether concurrency is assumed safe.

Those decisions are frozen by CHECK-MK0 and Waves A–C.

## 2. First implementation branch

Recommended branch:

```text
feat/check-core-domain
```

Base it on the eventually integrated documentation/research stack, not directly on an older runtime SHA.

## 3. First PR scope — CHECK-MK3

Pure TypeScript/domain only. No UI wiring and no new adapter requests.

Expected files/concepts:

```text
mobile-app/src/domain/check/
  DiagnosticScan.ts
  DiagnosticEndpoint.ts
  DiagnosticTroubleCode.ts
  DiagnosticReadiness.ts
  DiagnosticFreezeFrame.ts
  DiagnosticMonitorResult.ts
  DiagnosticEvidence.ts
  DiagnosticConcern.ts
  DiagnosticCoverage.ts
  DiagnosticReport.ts
  DiagnosticScanState.ts
  DiagnosticVersioning.ts
  index.ts
```

Reuse existing `domain/diagnostics` contracts where they already represent the same truth. Do not create duplicate connector/protocol abstractions.

## 4. CHECK-MK3 acceptance criteria

```text
[ ] no import from React/React Native
[ ] no import from BLE implementation
[ ] no command string generation
[ ] no database implementation details
[ ] endpoint role may remain UNKNOWN
[ ] unattributed evidence representable
[ ] DTC status stored/pending/permanent representable
[ ] same DTC across statuses can be grouped without losing observations
[ ] current/freeze/Mode06/history evidence source classes distinct
[ ] event/condition/cause confidence distinct
[ ] LIMITED/CANCELLED/DISCONNECTED states representable
[ ] coverage cannot encode unsupported as healthy
[ ] reports carry schema/engine/knowledge/rules versions
[ ] unit tests cover invariants
[ ] TypeScript strict/CI PASS
```

## 5. Second implementation branch — CHECK-MK4

After MK3 review:

```text
feat/check-core-parsers
```

Build pure service-aware parser code against fixture interfaces. Do not wire new commands to physical connector.

Critical invariant:

```text
Mode 01 PID response parser
!=
Mode 03/07/0A DTC-list response parser
```

The existing PID-shaped `ObdFrameParser` may be reused for suitable PID services but must not be stretched into a universal service envelope by heuristics.

## 6. Third implementation branch — CHECK-MK5

```text
feat/check-core-safety-planner
```

Implement default-deny command safety and planner architecture.

A descriptor without `READ_ONLY_PROVEN` state is unexecutable. `UNKNOWN` means BLOCK.

## 7. Fourth implementation branch — CHECK-MK6

```text
feat/check-core-replay-engine
```

Implement orchestration entirely against replay/golden fixtures first.

Target outcome:

```text
Run Check
→ characterize replay connector
→ discover endpoint(s)
→ execute promoted replay descriptors
→ decode evidence
→ preserve partial failures
→ seal deterministic DiagnosticReport
```

## 8. Stop conditions

Implementation stops and returns to Design/Research if code reveals a material unresolved question about:

```text
safety
response ownership
transport framing/completion
standard vs manufacturer-specific semantics
unsupported vs zero-result vs no-data
current vs historical evidence
claim/confidence strength
privacy/identity handling
```

No silent design decisions in code.

## 9. Authorization receipt

```text
CHECK-MK3 STRUCTURAL IMPLEMENTATION    GO
CHECK-MK4 PURE PARSER IMPLEMENTATION   GO
CHECK-MK5 SAFETY/PLANNER STRUCTURE     GO
CHECK-MK6 REPLAY ORCHESTRATION         GO as fixtures are added
NEW REAL ECU REQUESTS                  NO — descriptor promotion required
MUTATING REQUESTS                      NO — Core V1 forbidden
```

This is the formal handoff from documentation closure to implementation.
