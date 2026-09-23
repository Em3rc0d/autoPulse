# AutoPulse Check — Pre-Hammer Closure Matrix

**Lane:** Plan  
**Authority:** EXECUTION AUTHORITY  
**Status:** FINAL PRE-HAMMER MATRIX  
**Decision date:** 2026-09-04

This matrix is the authoritative answer to: **what may be built now, what may be wired to replay, and what may touch a real ECU?**

## 1. Hammer levels

```text
H0 — DOCUMENTATION / RESEARCH
May modify docs, quarries, fixtures, generators.

H1 — STRUCTURAL HAMMER
May implement pure domain models, parsers, safety policy, planners,
repositories, migrations, report builders, replay connectors and UI shells.
Must not introduce new live diagnostic traffic.

H2 — REPLAY HAMMER
May execute complete Check flows against deterministic replay/golden fixtures.
Still no new vehicle traffic.

H3 — LIVE DIAGNOSTIC HAMMER
May connect an individually promoted READ_ONLY_PROVEN descriptor to the real
DiagnosticConnector after all descriptor-specific gates pass.

H4 — PHYSICAL CERTIFICATION
May claim physical PASS only for the tested vehicle/adapter/protocol/build matrix.
```

## 2. Global architecture closure

| Node | Status | Hammer consequence |
|---|---|---|
| Live / Session Report / Check boundary | CLOSED | H1 authorized |
| Check state machine | CLOSED | H1 authorized |
| Diagnostic endpoint model | CLOSED | H1 authorized |
| ECU role semantics | CLOSED | UNKNOWN role is valid; H1 authorized |
| Evidence truth vocabulary | CLOSED | H1 authorized |
| DTC model | CLOSED | H1 authorized |
| Evidence graph model | CLOSED | H1 authorized |
| Concern/confidence model | CLOSED | H1 authorized |
| Coverage semantics | CLOSED | H1 authorized |
| Persistence boundary | CLOSED | H1 authorized |
| Report immutability/versioning | CLOSED | H1 authorized |
| Check UX hierarchy | CLOSED | H1 authorized |
| Default-deny safety architecture | CLOSED | H1 authorized |
| Serial-first scan scheduling | CLOSED | H1 authorized |
| Partial/LIMITED behavior | CLOSED | H1 authorized |
| Mutating diagnostics | DEFERRED_BY_CONTRACT | forbidden in Core V1 |
| Manufacturer-enhanced diagnostics | DEFERRED_BY_CONTRACT | not a Core V1 promise |

## 3. Research closure

| Research node | Semantic status | Evidence still open | H1 | H2 | H3 |
|---|---|---|:---:|:---:|:---:|
| Q-CHECK-001 DTC services | CLOSED | raw/transport fixtures | YES | after fixtures | per descriptor |
| Q-CHECK-002 PID support | CLOSED | bitmap fixtures + pack regeneration | YES | after fixtures | per descriptor |
| Q-CHECK-003 readiness | CLOSED | verified bit table + fixtures | YES | after fixtures | per descriptor |
| Q-CHECK-004 freeze frame | CLOSED | raw fixtures | YES | after fixtures | per descriptor |
| Q-CHECK-005 Mode 06 | CLOSED | encoding reference + fixtures | YES | after fixtures | later/enrichment |
| Q-CHECK-006 vehicle info | CLOSED | reassembly/privacy fixtures | YES | after fixtures | optional enrichment |
| Q-CHECK-007 ECU attribution | CLOSED | KWP/CAN attribution fixtures | YES | after fixtures | with transport gate |
| Q-CHECK-008 safety | CLOSED | exact descriptors + adversarial suite | YES | YES when suite exists | absolute gate |
| Q-CHECK-009 DTC knowledge | CLOSED | reviewed catalog | YES | YES | descriptions only after catalog |
| Q-CHECK-010 correlation | CLOSED | versioned rule corpus | YES | after rule fixtures | not required for DTC Core |
| Q-CHECK-011 transport | CLOSED | exact timing/completion fixtures | YES | after fixtures | absolute gate |
| PID quarry hardening | IMPLEMENTED | rerun exact source pack / zero conflicts | YES | parsers can use frozen Tier1 only | expanded PID activation blocked |

## 4. Code that is authorized NOW

The following work is **READY / H1 AUTHORIZED** immediately:

```text
CHECK-MK3 — pure domain contracts
- DiagnosticScan
- DiagnosticEndpoint
- DiagnosticTroubleCode
- DiagnosticReadiness
- DiagnosticFreezeFrame
- DiagnosticMonitorResult
- DiagnosticEvidence
- DiagnosticConcern
- DiagnosticCoverage
- DiagnosticReport
- version identifiers

CHECK-MK4 — pure parser architecture
- service-aware response envelope
- DTC byte-pair primitive
- stored/pending/permanent service decoders
- PID support bitmap decoder
- readiness decoder interfaces
- freeze-frame decoder interfaces
- Service09 decoder interfaces
- Mode06 decoder interfaces
- NO_DATA / malformed / negative-response result types
No new real requests.

CHECK-MK5 — safety/planner structure
- DiagnosticCommandDescriptor
- DiagnosticCommandSafetyPolicy
- default-deny validator
- scan state machine
- command budget model
- retry/cancel policy model
- exact descriptor registry infrastructure
Descriptor may not become live unless promoted.

CHECK-MK6 — replay and orchestration
- DiagnosticReplayConnector
- DiagnosticScanEngine orchestration against replay
- deterministic scan receipts
- partial/LIMITED lifecycle
- cancellation/disconnect simulations

CHECK-MK10 — persistence/integrity scaffolding
- diagnostic scan storage boundary
- immutable evidence/report schema
- version metadata
- integrity hash contract

CHECK-MK11 — UI scaffolding
- Check Home
- Check Running
- Check Report
- Concern Detail
- Technical Evidence
- Session Evidence Report relocation plan
UI must be driven by replay/mock domain state until H3.
```

## 5. Code that is NOT authorized yet

The following remains blocked until descriptor-specific H3 gates close:

```text
- issuing new Mode 02 requests to real vehicles
- issuing new Mode 06 requests to real vehicles
- expanded support-bitmap chain beyond already proven runtime behavior
- new readiness requests/decoding claims beyond existing proven subset
- new Service09 identity enrichment against physical cars
- any raw/vendor/UDS command generated dynamically
- any manufacturer-specific module scan
- any clear/reset/control/write operation
```

Existing currently-proven compatibility probes are not retroactively invalidated by this plan, but the new Check Engine may not expand their semantics silently.

## 6. H3 descriptor promotion checklist

Each live request descriptor receives its own receipt:

```text
Descriptor ID
semantic request
expected positive service/PID or response family
allowed protocols/connectors
safety = READ_ONLY_PROVEN
transport completion rule
command timeout/budget
positive fixture
zero-result/unsupported fixture
malformed/error fixture
endpoint attribution expectation
golden test receipt
adversarial safety receipt
review SHA
```

Only after all fields close may the descriptor be enabled in the real scan planner.

## 7. First DTC Core critical path

```text
H1 DOMAIN/PARSER/SAFETY/REPLAY
        ↓
Wave A + readiness golden fixtures
        ↓
service-aware parser PASS
        ↓
exact 03 / 07 / 0A / 0101 descriptors
        ↓
safety adversarial PASS
        ↓
replay full-scan PASS
        ↓
H3 individual descriptor promotion
        ↓
Logan physical pilot
        ↓
Duster physical pilot
        ↓
ISO15765/CAN physical pilot
```

The first physical Check can be bounded to DTC Core. Mode 06, broad correlation and enhanced diagnostics do not block it.

## 8. Start-building decision

```text
ARCHITECTURAL OPEN NODES          0
HIDDEN PRODUCT DECISIONS          0
STRUCTURAL HAMMER                AUTHORIZED
REPLAY HAMMER                    AUTHORIZED AS FIXTURES LAND
LIVE DIAGNOSTIC HAMMER           DESCRIPTOR-GATED
MUTATING DIAGNOSTIC HAMMER       FORBIDDEN / OUT OF SCOPE
```

**Decision:** the project is ready to begin implementation at CHECK-MK3. If implementation discovers a new material semantic/safety question, work stops at that boundary and a new graph node is created rather than deciding silently in code.
