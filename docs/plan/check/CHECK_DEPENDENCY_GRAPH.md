# AutoPulse Check — Dependency Graph and Closure Ledger

**Lane:** Plan  
**Authority:** EXECUTION AUTHORITY  
**Updated:** CHECK Core Research Wave A  
**Purpose:** make every architectural/research dependency explicit before implementation.

## 1. Graph legend

```text
CLOSED
= design/decision or full research node is sufficiently evidenced for downstream promotion

SEMANTICS_CLOSED_FIXTURES_OPEN
= semantic/design boundary is closed, but parser/replay/physical evidence still blocks runtime

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
| Endpoint attribution model | CLOSED | Capability/evidence is preserved per observed endpoint/source address where available. |
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
| Report history | CLOSED | Completed report immutable + versioned; reinterpretation creates a new artifact. |
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
| DTC byte-pair decoder 43/47/4A | IMPLEMENTED_INITIAL | migrate to service-aware parser fixture coverage |
| `ObdFrameParser` PID-shaped response model | KNOWN_LIMITATION | cannot be final DTC parser contract; CAN count-byte hazard recorded in Q-CHECK-001 |
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

| Research node | Status | Core V1 dependency | Closure artifact / remaining gate |
|---|---|---:|---|
| PID quarry provenance | CLOSED | yes | PR #59 research pack |
| PID quarry hardening | OPEN_RESEARCH | before expanded PID runtime | rename `DBC_OBSERVED`, preserve decode fields, conflict detection, deterministic assertions |
| DTC standard services | SEMANTICS_CLOSED_FIXTURES_OPEN | yes | Q-CHECK-001; service/zero-code/status/CAN-envelope constraints closed; fixture corpus open |
| Supported PID discovery semantics | OPEN_RESEARCH | enrichment | Q-CHECK-002 |
| Readiness monitor decoding | OPEN_RESEARCH | yes for complete Core readiness | Q-CHECK-003 |
| Freeze-frame acquisition | OPEN_RESEARCH | enrichment | Q-CHECK-004 |
| Mode 06 semantics | OPEN_RESEARCH | no for earliest DTC Core; yes if Intelligence claims Mode 06 | Q-CHECK-005 |
| Vehicle information | OPEN_RESEARCH | optional Core enrichment | Q-CHECK-006 |
| ECU attribution/roles | SEMANTICS_CLOSED_FIXTURES_OPEN | yes | Q-CHECK-007; endpoint/role/unattributed rules closed; transport fixtures open |
| Diagnostic command safety | SEMANTICS_CLOSED_FIXTURES_OPEN | absolute | Q-CHECK-008; service-family safety boundary closed; exact descriptors + adversarial tests open |
| DTC knowledge/provenance | OPEN_RESEARCH | descriptions | Q-CHECK-009 |
| DTC/PID correlation | OPEN_RESEARCH | Intelligence V1 | Q-CHECK-010 |
| Transport behavior | SEMANTICS_CLOSED_FIXTURES_OPEN | yes | Q-CHECK-011; completion/pending/budget shape closed; timings + fixtures open |

## 7. Wave A closure receipt

Wave A closes semantic ambiguity on the first runtime critical path without pretending fixture evidence exists.

```text
Q-CHECK-001 DTC SERVICES
semantic boundary        CLOSED
fixtures                 OPEN
runtime                  BLOCKED

Q-CHECK-007 ECU ATTRIBUTION
semantic boundary        CLOSED
fixtures                 OPEN
physical CAN proof       OPEN
runtime                  BLOCKED

Q-CHECK-008 SAFETY
semantic classification  CLOSED
exact descriptors        OPEN
adversarial tests        OPEN
runtime                  BLOCKED

Q-CHECK-011 TRANSPORT
semantic boundary        CLOSED
budget dimensions        CLOSED
timing values            OPEN
fixtures                 OPEN
runtime                  BLOCKED
```

## 8. Critical path for the first real Check

```text
CHECK-MK0 docs CLOSED
        ↓
Wave A semantics CLOSED
        ↓
Q-CHECK-003 basic readiness semantics
        ↓
Wave A + readiness fixture corpus
        ↓
Domain contracts
        ↓
service-aware DTC parser / golden fixtures
        ↓
exact read-only descriptors
        ↓
Safety + planner adversarial PASS
        ↓
DiagnosticScanEngine + replay PASS
        ↓
Stored/Pending/Permanent + MIL
        ↓
LOGAN PHYSICAL DTC CORE
```

Mode 06, freeze-frame enrichment, broad PID correlation and manufacturer-specific diagnostics do not block the earliest bounded DTC Core.

## 9. Hammer authorization graph

```text
CHECK-MK0 architecture           CLOSED
Wave A semantic boundaries       CLOSED
Wave A fixtures                  OPEN
Basic readiness research         OPEN
PID quarry hardening             OPEN

research/documentation hammer    AUTHORIZED
runtime diagnostic hammer        BLOCKED
```

The architecture is no longer the blocker. The blocker is now explicit evidence work.

## 10. Runtime hammer gate

Runtime implementation of a specific diagnostic request/service becomes READY only when:

```text
reference/source CLOSED
+ semantic boundary CLOSED
+ safety classification CLOSED
+ exact request descriptor CLOSED
+ parser fixture CLOSED
+ negative/failure semantics CLOSED
+ endpoint attribution fixture CLOSED where applicable
+ transport fixture/budget CLOSED
= runtime node READY
```

## 11. No-hidden-decision rule

Any implementation PR that discovers a material question adds a graph node rather than deciding silently in code.

Material questions include:

- whether a request may mutate state;
- whether a response belongs to a specific ECU;
- whether a service envelope differs by transport;
- whether absence means unsupported, no-data or zero-result;
- whether a historical fact may be treated as current;
- whether a cause claim exceeds evidence.

## 12. Next closure wave

Proceed before CHECK-MK3/MK4 runtime work:

```text
1. PID quarry hardening
2. Q-CHECK-003 readiness
3. Q-CHECK-002 supported PID discovery
4. Q-CHECK-004 freeze frame
5. diagnostic golden fixture skeleton
6. Wave A transport/parser fixtures
```

After those nodes close, reassess the runtime hammer gate rather than assuming it automatically opens.
