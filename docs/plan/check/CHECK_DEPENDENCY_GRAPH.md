# AutoPulse Check — Dependency Graph and Closure Ledger

**Lane:** Plan  
**Authority:** EXECUTION AUTHORITY  
**Purpose:** make every architectural/research dependency explicit before implementation.

## 1. Graph legend

```text
CLOSED
= design/decision is sufficiently specified for downstream work

OPEN_RESEARCH
= evidence/research required before downstream promotion

OPEN_IMPLEMENTATION
= architecture is closed; code does not exist yet

DEFERRED_BY_CONTRACT
= intentionally outside Check Core V1

BLOCKED
= downstream node cannot start
```

## 2. Top-level graph

```text
                         CHECK PRODUCT
                              │
                 ┌────────────┴────────────┐
                 │                         │
          PRODUCT BOUNDARY             SAFETY
                 │                         │
                 └────────────┬────────────┘
                              ▼
                     DIAGNOSTIC DOMAIN
                              │
             ┌────────────────┼────────────────┐
             │                │                │
       ECU ATTRIBUTION   SERVICE MODEL    EVIDENCE MODEL
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                     RESEARCH PROMOTION
                              │
       ┌──────────────┬───────┼───────┬──────────────┐
       │              │       │       │              │
      DTC         READINESS FREEZE  MODE06      PID SUPPORT
       │              │       │       │              │
       └──────────────┴───────┼───────┴──────────────┘
                              ▼
                      PARSER / FIXTURES
                              │
                              ▼
                       SAFETY + PLANNER
                              │
                              ▼
                    DIAGNOSTIC SCAN ENGINE
                              │
                              ▼
                         CORE CHECK
                              │
                 ┌────────────┴─────────────┐
                 │                          │
           PERSISTENCE                 CHECK UX
                 │                          │
                 └────────────┬─────────────┘
                              ▼
                       PHYSICAL PILOT
                              │
                              ▼
                      RELEASE CONTRACT
```

## 3. Architecture decisions — closed

| Node | Status | Decision |
|---|---|---|
| Product boundary | CLOSED | Live, Session Report and Check are separate products/surfaces. |
| Check purpose | CLOSED | Active read-only ECU diagnostic interrogation with evidence-aware explanation. |
| Existing BLE stack reuse | CLOSED | Check reuses `DiagnosticConnector` and existing RealObd/ELM path. |
| Transport abstraction | CLOSED | Check depends on `DiagnosticConnector`, not BLE/ELM implementation details. |
| Endpoint attribution | CLOSED | Capability/evidence is preserved per observed endpoint/source address. |
| ECU role inference | CLOSED | Address does not imply role; UNKNOWN is valid until evidence exists. |
| Capability truth | CLOSED | REFERENCE_DEFINED != ECU_ADVERTISED != QUERIED != OBSERVED. |
| PID strategy | CLOSED | Support bitmap discovery + targeted acquisition; no full blind sweep. |
| DTC/PID relationship | CLOSED | DTC -> concern -> evidence requirements -> supported targeted PIDs. |
| Zero-DTC semantics | CLOSED | No reported codes != healthy vehicle. |
| Readiness semantics | CLOSED | NOT_READY != FAILED. |
| Freeze-frame semantics | CLOSED | Freeze-frame values remain separate from current PID values. |
| Cause semantics | CLOSED | Event confidence and root-cause confidence are separate. |
| Safety model | CLOSED | Default deny; only READ_ONLY_PROVEN requests execute in Core V1. |
| Scan concurrency | CLOSED | Serial by default per diagnostic session. |
| Failure model | CLOSED | Partial successful evidence is retained; LIMITED is first-class. |
| Persistence boundary | CLOSED | DiagnosticScan is independent from LiveSession. |
| Report history | CLOSED | Completed report immutable + versioned; reinterpretation creates new artifact. |
| Coverage UI | CLOSED | Explicit coverage, never universal health score. |
| UX entry | CLOSED | Single primary Run Check action; complexity stays behind the surface. |
| Enhanced diagnostics | DEFERRED_BY_CONTRACT | Supported by architecture, not promised by Core V1. |
| Mutating diagnostics | DEFERRED_BY_CONTRACT | Clear/reset/coding/actuation excluded from Core V1. |

## 4. Existing code nodes

| Node | Current state | Program action |
|---|---|---|
| `DiagnosticConnector` | IMPLEMENTED | retain/evolve compatibly |
| `ElmBleDiagnosticConnector` | IMPLEMENTED | retain; harden through Check fixtures |
| `DiagnosticDiscovery` | IMPLEMENTED | reuse/refactor into Check characterization stage |
| `EcuCapabilityDiscovery` | IMPLEMENTED | evolve from probe observations to endpoint capability model |
| `DiagnosticServiceCharacterization` | IMPLEMENTED | reuse; expand only through promoted research |
| DTC byte-pair decoder 43/47/4A | IMPLEMENTED_INITIAL | migrate to pure parser fixture coverage |
| `CompatibilitySnapshot` | IMPLEMENTED | reuse as characterization evidence or adapt to endpoint model |
| `RuntimeCompatibilityCharacterization` | IMPLEMENTED | refactor into reusable characterizer; do not duplicate |
| Check Lite Session Report | IMPLEMENTED_PHYSICAL | relocate to History/Session Report |
| DiagnosticScan aggregate | OPEN_IMPLEMENTATION | CHECK-MK3 |
| Safety policy | OPEN_IMPLEMENTATION | CHECK-MK5 |
| Scan planner/budget | OPEN_IMPLEMENTATION | CHECK-MK5 |
| Diagnostic replay connector | OPEN_IMPLEMENTATION | CHECK-MK6 |
| Real Check UX | OPEN_IMPLEMENTATION | CHECK-MK12 |

## 5. Research dependency graph

```text
Q-OBD2-PID-CATALOG
        │
        ├── hardening ──────────────┐
        │                           │
        ▼                           ▼
Q-CHECK-002 PID SUPPORT       Q-CHECK-010 CORRELATION
        │                           │
        └──────────┬────────────────┘
                   ▼
             TARGETED PIDS

Q-CHECK-001 DTC SERVICES ──┐
Q-CHECK-003 READINESS ─────┤
Q-CHECK-004 FREEZE FRAME ──┤
Q-CHECK-005 MODE06 ────────┼──► PARSERS/FIXTURES
Q-CHECK-006 VEHICLE INFO ──┤
Q-CHECK-007 ECU ATTRIB ────┤
Q-CHECK-011 TRANSPORT ─────┘

Q-CHECK-008 SAFETY ─────────────► SAFETY POLICY / PLANNER
Q-CHECK-009 DTC KNOWLEDGE ───────► KNOWLEDGE BASE
Q-CHECK-010 CORRELATION ─────────► EVIDENCE PLANNER / REASONER
```

## 6. Research nodes and current closure

| Research node | Status | Core V1 dependency | Closure artifact |
|---|---|---:|---|
| PID quarry provenance | CLOSED | yes | existing PR #59 research pack |
| PID quarry hardening | OPEN_RESEARCH | before expanded PID runtime | hardened extractor + deterministic assertions |
| DTC standard services | OPEN_RESEARCH | yes | Q-CHECK-001 |
| Supported PID discovery semantics | OPEN_RESEARCH | yes for enrichment | Q-CHECK-002 |
| Readiness monitor decoding | OPEN_RESEARCH | yes | Q-CHECK-003 |
| Freeze-frame acquisition | OPEN_RESEARCH | enrichment | Q-CHECK-004 |
| Mode 06 semantics | OPEN_RESEARCH | no for earliest DTC Core; yes for Intelligence | Q-CHECK-005 |
| Vehicle information | OPEN_RESEARCH | optional Core enrichment | Q-CHECK-006 |
| ECU attribution/roles | OPEN_RESEARCH | endpoint attribution yes; role mapping may remain UNKNOWN | Q-CHECK-007 |
| Diagnostic command safety | OPEN_RESEARCH | yes | Q-CHECK-008 |
| DTC knowledge/provenance | OPEN_RESEARCH | yes for descriptions; code capture can precede full description coverage | Q-CHECK-009 |
| DTC/PID correlation | OPEN_RESEARCH | Intelligence V1 | Q-CHECK-010 |
| Transport behavior | OPEN_RESEARCH | yes | Q-CHECK-011 |

## 7. Critical-path graph for the first real Check

The earliest physically meaningful Check does **not** require every future feature.

```text
CHECK-MK0 docs CLOSED
        ↓
Q-CHECK-001 DTC services
Q-CHECK-003 basic readiness
Q-CHECK-007 endpoint attribution
Q-CHECK-008 safety
Q-CHECK-011 transport
        ↓
Domain contracts
        ↓
Golden fixtures / DTC parser
        ↓
Safety + planner
        ↓
DiagnosticScanEngine + replay
        ↓
Stored/Pending/Permanent + MIL
        ↓
LOGAN PHYSICAL DTC CORE
```

Mode 06, broad PID enrichment and correlation may continue afterward without weakening the first Core scan.

## 8. Hammer authorization graph

```text
                   CHECK-MK0
                       │
       ┌───────────────┼────────────────┐
       │               │                │
Product Contract    Safety Contract   Execution Plan
       │               │                │
       └───────────────┼────────────────┘
                       ▼
              Architecture Decisions
                       │
                   all CLOSED
                       │
                       ▼
              HAMMER AUTHORIZED
                 for CHECK-MK1/MK2
```

Important: this authorization means **research/documentation hardening work may proceed**. It does not authorize issuing new runtime diagnostic commands until the corresponding research/safety parser gates close.

## 9. Runtime hammer gate

Runtime implementation of a specific service is authorized only when:

```text
reference/source CLOSED
+ semantic boundary CLOSED
+ safety classification CLOSED
+ parser fixture CLOSED
+ negative/failure semantics CLOSED
+ endpoint attribution semantics CLOSED
= runtime node READY
```

## 10. No-hidden-decision rule

Any implementation PR that discovers a new material question must add a graph node rather than deciding silently in code.

Material questions include:

- whether a request may mutate state;
- whether a response belongs to a specific ECU;
- whether two bytes have ambiguous parsing;
- whether a service is standard vs manufacturer-specific;
- whether absence means unsupported vs no-data;
- whether a historical fact may be treated as current;
- whether a cause claim exceeds evidence.

## 11. Closure target before coding Core

Before CHECK-MK3 starts, the following graph nodes must be `CLOSED` or `DEFERRED_BY_CONTRACT`:

```text
Product boundary
State machine
Endpoint model
Evidence vocabulary
Coverage semantics
Persistence/immutability boundary
Safety architecture
Core service scope
No-code semantics
UX information hierarchy
```

These are now closed by CHECK-MK0 documentation.

Research nodes remain deliberately separate and become the next closure wave.
