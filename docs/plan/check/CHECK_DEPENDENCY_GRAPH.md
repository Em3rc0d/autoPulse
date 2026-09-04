# AutoPulse Check — Dependency Graph and Closure Ledger

**Lane:** Plan  
**Authority:** EXECUTION AUTHORITY  
**Updated through:** Research Wave B  
**Purpose:** keep every pre-runtime dependency explicit and prevent hidden implementation decisions.

## Legend

```text
CLOSED
= decision/research evidence is sufficient for its declared downstream scope

SEMANTICS_CLOSED_FIXTURES_OPEN
= architecture/domain semantics are closed; runtime remains blocked by fixtures/evidence

HARDENING_IMPLEMENTED_SOURCE_REGEN_OPEN
= research tooling is hardened; exact frozen source must still be rerun

OPEN_RESEARCH
= material evidence/semantic work remains

OPEN_IMPLEMENTATION
= design is closed but code does not exist

DEFERRED_BY_CONTRACT
= intentionally outside Check Core V1

BLOCKED
= downstream promotion is not authorized
```

## Top-level graph

```text
CHECK PRODUCT CONTRACT ─────────────── CLOSED
        │
        ├── Safety Architecture ────── CLOSED
        ├── Endpoint Model ─────────── CLOSED
        ├── Evidence Truth Model ───── CLOSED
        ├── State Machine ──────────── CLOSED
        ├── Persistence Boundary ───── CLOSED
        └── UX Semantics ───────────── CLOSED
                     │
                     ▼
               RESEARCH GATES
                     │
     ┌───────────────┼─────────────────────┐
     │               │                     │
   Core DTC       Enrichment            Intelligence
     │               │                     │
001 DTC          002 PID Support       005 Mode06
007 Attribution  003 Readiness         009 DTC Knowledge
008 Safety       004 Freeze Frame      010 Correlation
011 Transport    006 Vehicle Info
     │               │                     │
     └───────────────┼─────────────────────┘
                     ▼
             GOLDEN FIXTURES
                     ▼
        DOMAIN / PARSER / SAFETY CODE
                     ▼
             REPLAY CERTIFICATION
                     ▼
             PHYSICAL PILOT
                     ▼
             RELEASE CONTRACT
```

## Architecture decisions

| Node | Status | Frozen decision |
|---|---|---|
| Live vs Session Report vs Check | CLOSED | Separate products/surfaces. |
| Check scope | CLOSED | Active read-only diagnostic interrogation. |
| Connector abstraction | CLOSED | Reuse `DiagnosticConnector`; no second BLE stack. |
| Endpoint attribution | CLOSED | Preserve source evidence per endpoint; unattributed is valid. |
| ECU role | CLOSED | Address does not imply module role. |
| Evidence truth | CLOSED | `REFERENCE_DEFINED != ECU_ADVERTISED != QUERIED != OBSERVED`. |
| DTC/PID relation | CLOSED | DTC/monitor → concern → evidence requirements → supported targeted PIDs. |
| Support strategy | CLOSED | Bitmap discovery, not blind catalog sweep. |
| Zero-DTC wording | CLOSED | No reported DTCs is coverage-bounded, not “healthy”. |
| Readiness wording | CLOSED | `NOT_READY != FAILED`. |
| Freeze-frame context | CLOSED | Frozen ECU context is separate from current PID and Live history. |
| Safety | CLOSED | Default deny; only exact `READ_ONLY_PROVEN` descriptors can execute. |
| Scan concurrency | CLOSED | Serial by default per diagnostic session. |
| Partial evidence | CLOSED | Retain successful evidence; `LIMITED` is first-class. |
| Persistence | CLOSED | `DiagnosticScan` independent from `LiveSession`. |
| Report mutation | CLOSED | Completed report immutable/versioned. |
| Health score | CLOSED | No universal health percentage. |
| Enhanced diagnostics | DEFERRED_BY_CONTRACT | Architecture-ready, not Core V1 claim. |
| Mutating diagnostics | DEFERRED_BY_CONTRACT | Clear/reset/control/coding excluded from Core V1. |

## Existing implementation assets

| Node | Current state | Planned treatment |
|---|---|---|
| `DiagnosticConnector` | IMPLEMENTED | retain/evolve compatibly |
| `ElmBleDiagnosticConnector` | IMPLEMENTED | reuse behind safety/planner |
| `DiagnosticDiscovery` | IMPLEMENTED | reuse/refactor as Check characterization stage |
| `EcuCapabilityDiscovery` | IMPLEMENTED | evolve to endpoint capability evidence |
| `DiagnosticServiceCharacterization` | IMPLEMENTED | expand only through promoted research |
| DTC pair decoder | IMPLEMENTED_INITIAL | replace/contain behind service-aware fixtures |
| `ObdFrameParser` PID-shaped model | KNOWN_LIMITATION | cannot be final DTC-list parser; CAN count-byte hazard recorded |
| `CompatibilitySnapshot` | IMPLEMENTED | reuse/adapt as characterization evidence |
| Check Lite | IMPLEMENTED_PHYSICAL | relocate to History → Session Report |
| DiagnosticScan aggregate | OPEN_IMPLEMENTATION | CHECK-MK3 |
| Safety policy / planner | OPEN_IMPLEMENTATION | CHECK-MK5 |
| Replay connector | OPEN_IMPLEMENTATION | CHECK-MK6 |
| Real Check UX | OPEN_IMPLEMENTATION | CHECK-MK12 |

## Research closure ledger

| Node | Status | Pre-runtime result |
|---|---|---|
| PID quarry provenance | CLOSED | Frozen pack hashes/counts recorded. |
| PID quarry hardening | HARDENING_IMPLEMENTED_SOURCE_REGEN_OPEN | Fail-closed extractor implemented; exact pack rerun still required. |
| Q-CHECK-001 DTC services | SEMANTICS_CLOSED_FIXTURES_OPEN | DTC-list/no-PID/status/zero-code/CAN-envelope constraints closed. |
| Q-CHECK-002 supported PID discovery | SEMANTICS_CLOSED_FIXTURES_OPEN | Endpoint bitmaps/continuation/planner semantics closed. |
| Q-CHECK-003 readiness | SEMANTICS_CLOSED_FIXTURES_OPEN | Support/completion, engine-layout and time-horizon semantics closed; exact bit-table verification open. |
| Q-CHECK-004 freeze frame | SEMANTICS_CLOSED_FIXTURES_OPEN | Current-vs-frozen/DTC-association/no-frame semantics closed. |
| Q-CHECK-005 Mode 06 | OPEN_RESEARCH | Wave C. |
| Q-CHECK-006 vehicle information | OPEN_RESEARCH | Wave C. |
| Q-CHECK-007 endpoint attribution | SEMANTICS_CLOSED_FIXTURES_OPEN | Source-vs-role/unattributed/per-message provenance closed. |
| Q-CHECK-008 safety evidence | SEMANTICS_CLOSED_FIXTURES_OPEN | Mode04/08/raw default block + exact descriptor model closed. |
| Q-CHECK-009 DTC knowledge | OPEN_RESEARCH | Wave C. |
| Q-CHECK-010 correlation | OPEN_RESEARCH | Wave C. |
| Q-CHECK-011 transport | SEMANTICS_CLOSED_FIXTURES_OPEN | Completion/NO DATA/pending/serial/budget-shape semantics closed. |

## Wave A result

```text
DTC service semantics             CLOSED
endpoint attribution semantics    CLOSED
diagnostic safety semantics       CLOSED
transport semantics               CLOSED
fixtures / timing / physical proof OPEN
```

## Wave B result

```text
supported PID semantics           CLOSED
readiness domain semantics        CLOSED
freeze-frame semantics            CLOSED
PID hardening implementation      DONE
PID exact-source regeneration      OPEN
fixtures / normative bit proof     OPEN
```

## Runtime critical path

```text
CHECK-MK0 architecture CLOSED
        ↓
Wave A semantics CLOSED
        ↓
Wave B semantics CLOSED
        ↓
Wave C semantics
        ↓
Pre-Hammer Closure Matrix
        ↓
Golden fixture corpus
        ↓
exact READ_ONLY_PROVEN descriptors
        ↓
CHECK-MK3 domain contracts
        ↓
CHECK-MK4 service-aware parsers
        ↓
CHECK-MK5 safety/planner adversarial PASS
        ↓
CHECK-MK6 replay PASS
        ↓
physical Logan / Duster / CAN validation
```

## Current hammer authorization

```text
documentation/research hammer      AUTHORIZED
pure domain modeling hammer        NOT YET — wait for Wave C/pre-hammer matrix
new diagnostic runtime requests    BLOCKED
physical Check Core pilot          BLOCKED
```

Architecture is no longer the blocker. Remaining pre-hammer work is explicit research evidence and fixture closure.

## Runtime request gate

One concrete request/service becomes implementation-ready only when:

```text
source/provenance CLOSED
+ semantic boundary CLOSED
+ exact safety descriptor CLOSED
+ parser fixture CLOSED
+ failure/negative semantics CLOSED
+ endpoint attribution fixture CLOSED where relevant
+ transport fixture/budget CLOSED
= REQUEST READY
```

## No-hidden-decision rule

If implementation discovers a material ambiguity, add/reopen a graph node. Never decide silently in code whether:

- a request mutates state;
- bytes form a PID or service payload;
- a response belongs to one endpoint;
- absence means zero, unsupported or no-data;
- a monitor is unsupported vs incomplete;
- a value is current vs frozen vs historical;
- a causal statement exceeds evidence.

## Next closure wave

```text
Q-CHECK-005 Mode 06
Q-CHECK-006 vehicle information
Q-CHECK-009 DTC knowledge/provenance
Q-CHECK-010 DTC/PID correlation
Diagnostic Golden Dataset contract
Pre-Hammer Closure Matrix
```
