# AutoPulse Check — Documentation Index

**Status:** CHECK-MK0 documentation freeze candidate  
**Base evidence line:** `research/obd2-pid-quarry-20260904`

This directory defines the accepted product/system design for the future real AutoPulse Check. The implementation must follow the repository documentation authority model: Design constrains Plan; Plan does not prove implementation; physical evidence remains separate.

## Canonical Check documents

### Design authority

- `CHECK_DESIGN_AUTHORITY.md` — product boundary, domain model, endpoint/capability semantics, DTC/evidence model, persistence and UX architecture.
- `CHECK_SAFETY_CONTRACT.md` — default-deny read-only diagnostic safety policy and physical-validation safety boundary.

### Execution authority

- `../../plan/check/CHECK_EXECUTION_AUTHORITY.md` — ordered MK0–MK14 implementation program.
- `../../plan/check/CHECK_DEPENDENCY_GRAPH.md` — graph nodes, closure states and runtime hammer gates.
- `../../plan/check/CHECK_RESEARCH_MATRIX.md` — Q-CHECK-001…011 research program and promotion artifacts.
- `../../plan/check/CHECK_DEFINITION_OF_DONE.md` — automated, replay, physical and release DoD.

## Frozen product separation

```text
Live
→ current driving acquisition / driver intelligence

History → Session Report
→ immutable reconstruction of a Live session

Check
→ active read-only diagnostic ECU scan

AutoPulse Intelligence
→ correlation of current Check evidence with historical Live evidence
```

The existing Check Lite V1 is retained as the proven Session Evidence Report implementation and must eventually move under History/Session. It is not the final Check product contract.

## Current closure state

Architecture decisions required before research/runtime decomposition are **CLOSED by CHECK-MK0**.

The next unresolved wave is evidence/research, not product architecture:

```text
PID quarry hardening
Q-CHECK-001 DTC services
Q-CHECK-002 supported PID discovery
Q-CHECK-003 readiness
Q-CHECK-004 freeze frame
Q-CHECK-005 Mode 06
Q-CHECK-006 vehicle information
Q-CHECK-007 ECU attribution
Q-CHECK-008 diagnostic safety evidence
Q-CHECK-009 DTC knowledge
Q-CHECK-010 DTC/PID correlation
Q-CHECK-011 transport behavior
```

No new diagnostic runtime request should be promoted merely because this design is frozen. Each service must independently close its research, parser and safety gates.
