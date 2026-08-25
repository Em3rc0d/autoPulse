# AutoPulse Documentation System

**Status:** active documentation authority
**Scope:** AutoPulse repository knowledge, product decisions, implementation evidence, physical validation and release truth
**Last major evidence update:** 2026-08-24 / 2026-08-25 UTC boundary

AutoPulse documentation is organized as an evidence pipeline rather than a flat folder of notes.

```text
brainstorming
    ↓ promote an idea explicitly
design
    ↓ turn accepted design into executable work
plan
    ↓ implementation receipts
build
    ↓ automated + physical validation
test
    ↓ raw evidence preservation
mining-site/quarries
    ↓ normalize only approved facts
golden-dataset
    ↓ defines certified claims and remaining gates
release
```

The arrows indicate **promotion**, not automatic inheritance. A statement in an earlier lane is not automatically true in a later lane.

## 1. Documentation authority model

### `docs/brainstorming/`

Purpose: preserve exploratory product and engineering ideas.

Authority: **NON-AUTHORITATIVE**.

Brainstorming may contain hypotheses, alternatives, product ideas, speculative UX, future transport support, prediction ideas or research directions. Nothing in this directory is considered implemented, planned, supported or certified unless it is explicitly promoted into Design and/or Plan.

This rule is intentional. AutoPulse must never silently convert a brainstorm into a compatibility promise.

### `docs/design/`

Purpose: describe accepted product architecture, technical boundaries, state semantics, mobile UX rules and invariants.

Authority: **DESIGN AUTHORITY**.

A Design document answers: *How is AutoPulse supposed to behave?*

Design must distinguish ECU-origin data, adapter-origin data, phone-origin data, derived/calculated data and unavailable evidence. It also defines user-facing semantics such as voice/color/haptic policy.

### `docs/plan/`

Purpose: convert Design into ordered gates, acceptance criteria, dependencies and stop/go decisions.

Authority: **EXECUTION AUTHORITY**.

A Plan document answers: *What do we do next, in what order, and what evidence closes the step?*

A plan is not proof that work exists.

### `docs/build/`

Purpose: maintain an implementation ledger tied to branches, PRs, commits and code paths.

Authority: **IMPLEMENTATION RECEIPT**.

A Build document answers: *What was actually changed in source code?*

Every significant compatibility, lifecycle or user-truth fix should be traceable from an observed defect to code and then to tests.

### `docs/test/`

Purpose: record automated and physical validation, including failures.

Authority: **VALIDATION RECEIPT**.

A Test document answers: *What was actually exercised and what happened?*

CI green is not a substitute for physical evidence. Physical acquisition success is not a substitute for lifecycle success. A screenshot observation is not a raw bus trace.

### `docs/mining-site/quarries/`

Purpose: preserve raw or minimally interpreted evidence gathered from real vehicles, adapters, screenshots, logs, captures and field sessions.

Authority: **SOURCE EVIDENCE**, not universal product truth.

A quarry record should identify its provenance and explicitly distinguish observation from inference. A successful Duster result, for example, proves a Duster observation under the tested conditions; it does not prove all Renault vehicles or all adapters.

### `docs/golden-dataset/`

Purpose: store the normalized, reviewed cases that are safe to use as regression and compatibility truth.

Authority: **APPROVED EVIDENCESET**.

Only quarry evidence that is sufficiently identified, reproducible and reviewed may be promoted here. Golden records must retain provenance back to a quarry, test, commit/build and product version.

The Golden Dataset is broader than numeric fixtures: it can include approved lifecycle cases, compatibility cases, UI truth cases and byte-level diagnostic fixtures. Byte-level diagnostic fixtures require raw diagnostic evidence; screenshots alone are insufficient.

### `docs/release/`

Purpose: define the currently permitted release promise, runbooks, support envelope and certification gates.

Authority: **RELEASE CONTRACT**.

Release documentation must be conservative. “Observed” is not “supported”; “supported” is not “certified”; “certified on one vehicle/adapter combination” is not “works everywhere.”

## 2. Current canonical documents

- Brainstorming: `brainstorming/AUTOPULSE_PRODUCT_BRAINSTORM.md`
- Design: `design/AUTOPULSE_SYSTEM_DESIGN.md`
- Plan: `plan/AUTOPULSE_EXECUTION_PLAN.md`
- Build ledger: `build/AUTOPULSE_BUILD_LEDGER.md`
- Test ledger: `test/AUTOPULSE_TEST_LEDGER.md`
- Quarry index: `mining-site/quarries/README.md`
- Logan quarry: `mining-site/quarries/Q-001_RENAULT_LOGAN_2014.md`
- Duster quarry: `mining-site/quarries/Q-002_RENAULT_DUSTER_2014.md`
- Golden Dataset: `golden-dataset/AUTOPULSE_GOLDEN_DATASET_V1.md`
- Release plan: `release/AUTOPULSE_LIVE_V1_RELEASE_PLAN.md`
- Compatibility contract: `release/COMPATIBILITY_CONTRACT_V1.md`
- Logan lifecycle gate: `release/R1_RENAULT_LOGAN_PHYSICAL_GATE.md`

## 3. Product truth invariants

These invariants are promoted and must remain consistent across Design, Build, Test and Release documentation:

1. AutoPulse is read-only for the current release scope.
2. `ATRV` is adapter voltage. Mode 01 PID `0142` is ECU/control-module voltage. They are never interchangeable.
3. Phone sensors are not ECU data.
4. Missing or unresolved values are never rendered as numeric zero merely to fill UI.
5. A vehicle standard definition does not prove that a vehicle supports the signal.
6. `A0` is automatic/provisional ELM protocol evidence until a real exchange resolves sufficient protocol evidence; it is not a final human protocol name by itself.
7. Internal unknown sentinels such as ECU `-1` must not leak into product UI.
8. A Live session becomes ECU-live only after a valid ECU-origin OBD sample. Adapter-only data cannot unlock ECU Live.
9. Healthy driving state should be visually quiet. Transitional, degraded and critical states should be progressively louder.
10. Voice describes meaning and action, not a continuous reading of raw PIDs.
11. Off-Road phone sensors are a subordinate sidecar. They must never destabilize, stop or starve ECU acquisition.
12. Release-1 recording is foreground-only. Backgrounding an ACTIVE session becomes explicit interruption unless a separately designed and certified background mode is introduced later.
13. A clean user stop is not a failed or partial session merely because the final fixed-duration telemetry window is shorter.
14. Process termination cannot be synchronously intercepted with certainty; orphan recovery occurs on next boot and must preserve only durable evidence.
15. A public compatibility claim is bounded by the physical compatibility matrix, never by aspiration.

## 4. Evidence-state vocabulary

Use these words consistently:

- **IDEA** — brainstorming only.
- **DESIGNED** — accepted intended behavior.
- **PLANNED** — scheduled/ordered execution with acceptance criteria.
- **IMPLEMENTED** — source code exists.
- **AUTOMATED PASS** — relevant deterministic tests/CI passed.
- **PHYSICALLY OBSERVED** — seen on a real vehicle/device combination.
- **PHYSICAL PASS** — explicit physical gate criteria passed.
- **GOLDEN** — approved and normalized into the Golden Dataset.
- **CERTIFIED** — required release matrix/gate is satisfied for the stated scope.
- **DEFERRED** — intentionally outside current release scope.
- **UNKNOWN** — insufficient evidence; never reinterpret as PASS.

## 5. Promotion rule

Every important fact should be able to travel through this chain:

```text
idea/hypothesis
→ accepted design
→ executable gate
→ source-code implementation
→ automated evidence
→ physical quarry receipt
→ normalized golden record
→ compatibility/release claim
```

If a link is missing, documentation must say so instead of skipping it.
