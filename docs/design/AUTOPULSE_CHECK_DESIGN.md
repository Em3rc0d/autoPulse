# AutoPulse Check — Authoritative Design

Status: **DESIGN AUTHORITY — implementation in progress**

## 1. Product boundary

AutoPulse has two related but distinct product surfaces:

- **AutoPulse Live** answers: *What is happening while the vehicle is operating?*
- **AutoPulse Check** answers: *What condition was actually evaluated, what evidence was collected, what findings are supported, and what was not evaluated?*

Check is not a prettier OBD scan screen and is not allowed to convert incomplete electronic evidence into a claim that the entire vehicle was inspected.

## 2. Truth hierarchy

Check preserves three explicit claim classes:

1. **Observation** — a fact directly captured or entered with provenance. Examples: an ECU returned a DTC, coolant was observed at a value, a technician photographed a leak.
2. **Finding** — a structured interpretation supported by one or more evidence items. The system may propose deterministic findings, but they remain reviewable.
3. **Professional conclusion** — a technician-reviewed conclusion. AutoPulse must not independently author a professional conclusion.

Unknown, unsupported, unavailable and not-assessed are not PASS states.

## 3. Evaluation lifecycle

The existing domain state machine remains authoritative:

`DRAFT -> OPEN -> EVIDENCE_COLLECTION -> REVIEW_PENDING -> IN_REVIEW -> READY_FOR_SIGNATURE -> SIGNED -> DELIVERED`

Cancellation paths remain governed by the domain state machine. Signed evaluations are immutable with respect to new evidence.

## 4. Check purposes

Initial Check planning recognizes:

- `PRE_PURCHASE`
- `PREVENTIVE`
- `WORKSHOP`
- `PRE_TRIP`
- `FLEET`
- `CUSTOM`

Purpose changes the required evidence plan; it does not change telemetry truth or vehicle capability truth.

## 5. Deterministic Check plan

The initial ordered plan is:

1. Evaluation intake.
2. Visual/manual baseline.
3. Vehicle + adapter capability discovery.
4. Read DTCs when supported.
5. Read OBD readiness when supported.
6. Capture freeze frame when supported and present.
7. Controlled idle Live telemetry window.
8. Controlled road telemetry window when required by purpose.
9. Professional review of observations/findings.
10. Immutable report finalization.

Each electronic step is classified from observed capability facts as `AVAILABLE`, `UNKNOWN`, `UNAVAILABLE`, or `CONDITIONAL`.

## 6. Live -> Check bridge

Live sessions remain operational telemetry sessions. Check does not silently absorb an entire Live session.

A bounded Live window may be promoted as Check evidence only when:

- evaluation and Live session belong to the same vehicle;
- the evaluation state allows evidence mutation;
- the time window is valid and bounded;
- at least one valid ECU-origin sample exists;
- observed signal identities are recorded;
- sample counts are internally consistent.

Promoted evidence stores:

- Live session identity;
- exact relative time window;
- valid ECU sample count;
- total sample count;
- signal identities;
- connection recovery count;
- telemetry gap duration;
- source session status;
- explicit `synthesizedTelemetry: false` provenance.

A recovery gap is evidence about acquisition quality; it is never filled with invented vehicle data.

## 7. Capability and coverage semantics

Check coverage is constrained by the actual vehicle/adapter/runtime combination observed for the evaluation.

Examples:

- If readiness support is unknown, report `NOT ASSESSED / CAPABILITY UNKNOWN`, not PASS.
- If freeze-frame is supported but no applicable frame exists, report the distinction between capability and observed availability.
- If ABS, airbag or transmission modules are outside the current transport/capability scope, the final report must explicitly say they were not evaluated.

No brand-wide or adapter-family-wide compatibility claim is created from one successful evaluation.

## 8. Safety boundary

Current Check MVP is read-only relative to the vehicle.

Allowed examples:

- standard diagnostic reads;
- capability discovery;
- DTC reads;
- readiness reads;
- freeze-frame reads;
- Live Mode 01 telemetry observation;
- adapter-side configuration required for read-only communication.

Not introduced by this design:

- DTC clearing;
- actuator control;
- ECU reset;
- coding/programming;
- destructive service routines;
- vehicle write commands.

Any future write capability requires a separate design authority, explicit safety contract, capability proof and physical certification.

## 9. Persistence

Check evaluations and evidence are local-first durable product data in SQLite.

The initial persistent records are:

- `check_evaluations`
- `check_evidence_items`

Evaluation purpose is stored explicitly rather than reconstructed from prose. Evidence references existing durable Live session identity when promoted from Live.

## 10. Report integrity

A finalized/signed report is a snapshot of evidence and reviewed findings at a point in time.

Later evidence must create a new evaluation/report version or an explicitly governed superseding workflow. The system must never mutate an already signed report in place and present it as the original artifact.

## 11. UX principle

Check may be detailed because it is an inspection workflow, but it still follows phone-first interaction:

- one clear step at a time;
- visible evaluated / not evaluated boundaries;
- no raw protocol jargon unless the operator opens technical detail;
- no implication that a missing measurement equals zero;
- no requirement to interpret raw PIDs manually.

## 12. Current implementation slice

The first implementation slice contains:

- deterministic plan builder;
- AutoPulse Check application engine façade;
- existing evaluation state-machine enforcement;
- Live telemetry evidence promotion;
- same-vehicle and ECU-origin gates;
- claim-authority policy;
- SQLite evaluation/evidence schema;
- SQLite repository;
- regression tests.

DTC/readiness/freeze-frame execution, Check screens, findings engine, report assembly/signature UI and field certification are subsequent slices and must not be described as already implemented.