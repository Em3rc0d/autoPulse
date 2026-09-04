# AutoPulse Check — Dependency Graph and Closure Ledger

**Lane:** Plan  
**Authority:** EXECUTION AUTHORITY  
**Updated through:** CHECK-MK0 + Research Waves A/B/C  
**Status:** PRE-HAMMER CLOSED

## Legend

```text
CLOSED
= decision/research semantics sufficiently closed for declared scope

SEMANTICS_CLOSED_FIXTURES_OPEN
= architecture/meaning closed; live runtime still waits for fixtures/evidence

SEMANTICS_CLOSED_CATALOG_OPEN
= model/provenance contract closed; reviewed knowledge catalog pending

SEMANTICS_CLOSED_RULE_CORPUS_OPEN
= correlation semantics closed; versioned rule fixtures pending

HARDENING_IMPLEMENTED_SOURCE_REGEN_OPEN
= tooling hardened; exact frozen source pack rerun pending

OPEN_IMPLEMENTATION
= design closed; code not built yet

DEFERRED_BY_CONTRACT
= intentionally outside Check Core V1
```

## 1. Product graph

```text
LIVE ───────────────► live acquisition / driver intelligence

SESSION REPORT ─────► immutable reconstruction of one Live session

CHECK ──────────────► active read-only ECU diagnostic interrogation
                         │
                         ▼
                 DiagnosticScanEngine
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
  characterization    Core DTC         enrichment
       │                 │                 │
 connector/protocol   03 / 07 / 0A     readiness
 endpoints            MIL / 0101       freeze frame
 capabilities                           PID support
                                       Mode06 / Service09
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ▼
                     evidence
                         ▼
                     concerns
                         ▼
                  immutable report
                         │
                         └──── optional correlation with separately labeled Live history
```

## 2. Closed architecture decisions

| Node | Status | Frozen decision |
|---|---|---|
| Product boundary | CLOSED | Live, Session Report and Check remain separate. |
| Connector abstraction | CLOSED | Reuse `DiagnosticConnector`; no second BLE/ELM stack. |
| Endpoint attribution | CLOSED | Evidence/capability remains source-scoped where provable; UNATTRIBUTED is valid. |
| ECU role | CLOSED | Address does not imply role; UNKNOWN is valid. |
| Evidence truth | CLOSED | `REFERENCE_DEFINED != ECU_ADVERTISED != QUERIED != OBSERVED`. |
| DTC/PID relation | CLOSED | DTC/monitor → concern → evidence requirements → supported targeted PIDs. |
| PID strategy | CLOSED | Support bitmap discovery; no blind 114-PID sweep. |
| Zero-DTC semantics | CLOSED | No reported DTCs is coverage-bounded, never universal health. |
| Readiness semantics | CLOSED | supported and complete are separate; `NOT_READY != FAILED`. |
| Freeze-frame semantics | CLOSED | frozen ECU context != current PID != Live history. |
| Confidence | CLOSED | event, condition and cause confidence are separate. |
| Safety | CLOSED | default deny; exact `READ_ONLY_PROVEN` descriptor required. |
| Scan scheduling | CLOSED | serial-first, bounded retries/backpressure/cancel. |
| Partial failure | CLOSED | successful evidence retained; LIMITED is first-class. |
| Persistence | CLOSED | `DiagnosticScan` independent from `LiveSession`. |
| Report history | CLOSED | completed report immutable/versioned. |
| Coverage UI | CLOSED | explicit coverage; no health percentage. |
| UX | CLOSED | one primary Run Check action; complexity behind surface. |
| Mutating diagnostics | DEFERRED_BY_CONTRACT | clear/reset/control/coding/write forbidden in Core V1. |
| Enhanced diagnostics | DEFERRED_BY_CONTRACT | architecture-ready, not Core V1 claim. |

## 3. Research closure matrix

| Quarry/node | Status | Remaining evidence before live promotion |
|---|---|---|
| Q-CHECK-001 DTC services | SEMANTICS_CLOSED_FIXTURES_OPEN | service-aware raw KWP/CAN fixtures |
| Q-CHECK-002 PID support | SEMANTICS_CLOSED_FIXTURES_OPEN | bitmap fixtures + exact PID pack regeneration |
| Q-CHECK-003 readiness | SEMANTICS_CLOSED_FIXTURES_OPEN | verified bit table + spark/compression fixtures |
| Q-CHECK-004 freeze frame | SEMANTICS_CLOSED_FIXTURES_OPEN | raw positive/no-frame/malformed fixtures |
| Q-CHECK-005 Mode06 | SEMANTICS_CLOSED_FIXTURES_OPEN | verified decode reference + fixtures |
| Q-CHECK-006 vehicle info | SEMANTICS_CLOSED_FIXTURES_OPEN | reassembly/privacy/mismatch fixtures |
| Q-CHECK-007 ECU attribution | SEMANTICS_CLOSED_FIXTURES_OPEN | KWP/CAN source-attribution fixtures |
| Q-CHECK-008 safety | SEMANTICS_CLOSED_FIXTURES_OPEN | exact descriptors + adversarial suite |
| Q-CHECK-009 DTC knowledge | SEMANTICS_CLOSED_CATALOG_OPEN | reviewed/provenanced catalog |
| Q-CHECK-010 correlation | SEMANTICS_CLOSED_RULE_CORPUS_OPEN | versioned rule corpus + positive/negative/insufficient fixtures |
| Q-CHECK-011 transport | SEMANTICS_CLOSED_FIXTURES_OPEN | completion/timing fixtures per protocol/adapter |
| Q-OBD2-PID-CATALOG hardening | HARDENING_IMPLEMENTED_SOURCE_REGEN_OPEN | rerun exact pack; prove zero conflicts and frozen counts |

## 4. Existing implementation assets

```text
DiagnosticConnector                 IMPLEMENTED / REUSE
ElmBleDiagnosticConnector           IMPLEMENTED / REUSE
DiagnosticDiscovery                 IMPLEMENTED / REUSE
EcuCapabilityDiscovery              IMPLEMENTED / EVOLVE
DiagnosticServiceCharacterization   IMPLEMENTED / EVOLVE
CompatibilitySnapshot               IMPLEMENTED / REUSE/ADAPT
RuntimeCompatibilityCharacterization IMPLEMENTED / REFACTOR, NOT DUPLICATE
Check Lite / session reconstruction IMPLEMENTED_PHYSICAL / MOVE TO SESSION REPORT
```

Known limitation:

```text
ObdFrameParser is PID-shaped.
Mode03/07/0A are DTC-list services, not PID responses.
A service-aware envelope/parser is required before DTC Core promotion,
especially because CAN and legacy envelopes may differ.
```

## 5. Implementation graph

```text
CHECK-MK3  DOMAIN CONTRACTS              READY
    ↓
CHECK-MK4  PURE SERVICE-AWARE PARSERS    READY
    ↓
CHECK-MK5  SAFETY + PLANNER STRUCTURE    READY
    ↓
CHECK-MK6  REPLAY SCAN ENGINE            READY AS FIXTURES LAND
    ↓
CHECK-MK7  DTC CORE LIVE WIRING           DESCRIPTOR-GATED
    ↓
CHECK-MK8  EVIDENCE ENRICHMENT            DESCRIPTOR-GATED
    ↓
CHECK-MK9  CORRELATION ENGINE             RULE-CORPUS-GATED
    ↓
CHECK-MK10 PERSISTENCE / INTEGRITY        READY STRUCTURALLY
    ↓
CHECK-MK11 CHECK UX                       READY AGAINST REPLAY/MOCK DOMAIN
    ↓
CHECK-MK12 PHYSICAL PILOT                 BLOCKED UNTIL H3 DESCRIPTORS
```

## 6. Hammer authorization

```text
H0 DOCUMENTATION/RESEARCH        AUTHORIZED
H1 STRUCTURAL IMPLEMENTATION     AUTHORIZED
H2 REPLAY IMPLEMENTATION         AUTHORIZED AS FIXTURES LAND
H3 NEW LIVE ECU REQUESTS         DESCRIPTOR-GATED
H4 PHYSICAL CERTIFICATION        GATE-BASED
MUTATING REQUESTS                FORBIDDEN
```

H1 explicitly includes domain types, pure parsers, safety-policy implementation, planner structure, persistence schemas, replay connector, report builder and UI driven by replay/mock data.

H3 requires the exact descriptor-specific checklist in `CHECK_PRE_HAMMER_MATRIX.md` and the Golden Diagnostic Dataset contract.

## 7. First real Check critical path

```text
MK3 domain PASS
→ DTC/readiness golden fixtures
→ MK4 service-aware parser PASS
→ exact 03 / 07 / 0A / 0101 read-only descriptors
→ MK5 adversarial safety PASS
→ MK6 full replay scan PASS
→ descriptor H3 promotion
→ Logan physical DTC Core
→ Duster physical DTC Core
→ ISO15765/CAN physical DTC Core
```

Mode06, broad correlation and manufacturer-specific diagnostics do not block the earliest real DTC Core.

## 8. No-hidden-decision rule

If implementation reveals a material unresolved question about safety, response ownership, transport completion, unsupported/no-data/zero-result semantics, current-vs-historical evidence, privacy or claim strength, that implementation node stops and a new Design/Research graph node is created.

## 9. Final pre-build state

```text
MATERIAL ARCHITECTURE NODES OPEN     0
STRUCTURAL IMPLEMENTATION BLOCKERS   0
EVIDENCE/FIXTURE GATES               EXPLICIT
STRUCTURAL_HAMMER                     AUTHORIZED
LIVE_DIAGNOSTIC_HAMMER                PER-DESCRIPTOR ONLY
```

The documentation panorama is sufficient to start CHECK-MK3 without leaving major architectural decisions for implementation time.
