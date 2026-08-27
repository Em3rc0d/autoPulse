# AutoPulse Check — Authoritative Design

Status: **DESIGN AUTHORITY — automated implementation through report integrity; physical Check certification pending**

## 1. Product boundary

AutoPulse has two related but deliberately separate product surfaces:

- **AutoPulse Live** answers: *What is happening while this vehicle is operating?*
- **AutoPulse Check** answers: *What was actually evaluated, what evidence was captured, what findings are supported, what did a professional review decide, and what remained outside scope?*

Check is not a prettier OBD scan screen. It is an evidence-governed vehicle-review workflow. It must never transform a successful connection, an empty DTC response, or partial electronic coverage into the claim that an entire vehicle is healthy or fully inspected.

## 2. Truth hierarchy

Check preserves three explicit claim classes:

1. **Observation** — directly captured or entered evidence with provenance. Example: the ECU returned DTC `P0302`; PID 01 reported MIL ON; a technician recorded a visible leak.
2. **Finding** — an interpretation linked to evidence. AutoPulse may propose deterministic findings, but system proposals remain reviewable and are never professional conclusions by themselves.
3. **Professional conclusion** — technician-reviewed judgment. AutoPulse must not independently author this class of claim.

The following are never synonyms:

- `UNKNOWN != SUPPORTED`
- `NO_DATA != HEALTHY`
- `UNAVAILABLE != PASS`
- `NOT ASSESSED != PASS`
- `CONNECTED != VEHICLE FULLY EVALUATED`
- `CI GREEN != PHYSICAL CHECK PASS`

## 3. Evaluation lifecycle

The existing domain state machine remains authoritative:

`DRAFT -> OPEN -> EVIDENCE_COLLECTION -> REVIEW_PENDING -> IN_REVIEW -> READY_FOR_SIGNATURE -> SIGNED -> DELIVERED`

Cancellation paths remain governed by the same state machine.

Key mutation rules:

- evidence may only be added in states allowed by the evidence policy;
- signed/delivered evaluations do not accept new evidence;
- a signed report is immutable;
- subsequent evidence requires a new evaluation or a separately governed superseding version workflow.

## 4. Check purposes

Initial Check planning recognizes:

- `PRE_PURCHASE`
- `PREVENTIVE`
- `WORKSHOP`
- `PRE_TRIP`
- `FLEET`
- `CUSTOM`

Purpose changes the mandatory evidence plan, not acquisition truth. For example, road telemetry is mandatory for purposes where road behavior is part of the requested scope, but a missing road window remains missing evidence rather than being inferred from idle data.

## 5. Deterministic Check plan

The ordered Check plan is:

1. Evaluation intake.
2. Visual/manual baseline.
3. Vehicle + adapter capability discovery.
4. Read stored DTC evidence when the service is available.
5. Read OBD monitor/readiness evidence when available.
6. Read freeze-frame trigger evidence when available/present.
7. Controlled idle telemetry evidence window.
8. Controlled road telemetry evidence window when required by purpose.
9. Professional review of observations and system-proposed findings.
10. Coverage assessment and immutable report finalization.

Electronic steps are classified from observed facts as:

- `AVAILABLE`
- `UNKNOWN`
- `UNAVAILABLE`
- `CONDITIONAL`

The plan is recalculated when capability facts are promoted by actual evidence.

## 6. Dedicated Check diagnostic channel

Check does not create a fake Live session simply to read diagnostics.

The physical path is:

`Check evaluation -> Check-only adapter probe -> retained BLE/GATT channel -> RealObdInitialization -> DiagnosticConnector -> read-only captures -> durable Check evidence`

The existing BLE/ELM acquisition implementation is reused, but Check consumes it through the hardware-neutral `DiagnosticConnector` boundary.

The first executable electronic capture set is deliberately narrow:

- standard stored-DTC request (`03`);
- Mode 01 PID 01 monitor-status capture (`0101`);
- Mode 02 PID 02 frame-00 trigger probe (`020200`);
- capability discovery using the already-proven initialization path.

Current semantic limits are explicit:

- stored-DTC `NO_DATA` may prove the read service responded; it does **not** prove the vehicle fault-free;
- PID 01 currently exposes MIL state and confirmed-DTC count only; detailed readiness-monitor breakdown is not yet claimed;
- Mode 02 currently captures trigger/frame evidence only; full freeze-frame PID reconstruction is not yet claimed.

## 7. Capability reconciliation

Evaluations begin conservatively. Electronic capabilities can be `UNKNOWN` before a Check connects to the vehicle.

Evidence may promote capability truth, for example:

- successful OBD capability discovery -> OBD path `SUPPORTED`;
- valid stored-DTC service response, including a legitimate `NO_DATA` response -> DTC read service `SUPPORTED`;
- actual PID 01 monitor payload -> readiness/monitor capture `SUPPORTED` at the currently decoded level;
- actual freeze-frame trigger payload -> freeze-frame trigger evidence `SUPPORTED`/observed.

A failed capture does not automatically convert an unknown capability into `UNSUPPORTED`. Transport failure, adapter failure and vehicle capability are distinct facts.

Once support is positively proven it must not be silently downgraded to `UNKNOWN` by a later weak capture.

## 8. Live -> Check evidence promotion

Live remains operational telemetry. Check does not silently absorb an entire Live session.

A bounded Live window may be promoted into Check only when:

- evaluation and Live session belong to the same vehicle;
- the evaluation state accepts evidence;
- the requested interval is valid and bounded;
- at least one valid ECU-origin sample exists;
- signal identities and sample counts are internally consistent.

Promoted evidence preserves:

- source Live session identity;
- exact relative time window;
- capture context such as `IDLE` or `ROAD_TEST`;
- valid ECU sample count;
- total sample count;
- observed signal identities;
- connection-recovery count;
- telemetry-gap duration;
- source session state;
- explicit `synthesizedTelemetry: false` provenance.

A connection gap remains a gap. AutoPulse never manufactures samples to make the Check appear continuous.

## 9. Findings engine

System findings are evidence-bound proposals.

Current deterministic proposals are intentionally limited to positive observations such as:

- stored DTC code(s) actually returned;
- MIL actually reported ON;
- an actual freeze-frame trigger returned.

The engine intentionally does **not** produce a positive health finding from:

- empty DTC arrays;
- `NO_DATA`;
- MIL OFF;
- absent freeze-frame data;
- missing or failed captures.

Each system finding:

- remains `PROPOSED` until reviewed;
- cites its evidence IDs;
- carries severity/confidence within the rule's actual evidence boundary;
- must not present a DTC as proof of root cause.

## 10. Professional review

Professional review operates only in `IN_REVIEW`.

The operator may currently:

- `CONFIRM`
- `REJECT`
- mark `INCONCLUSIVE`

with professional comment/justification persisted alongside the finding.

A material professional modification changes the authority provenance to hybrid rather than pretending the original system rule authored the final professional conclusion.

A report cannot be signed while any finding remains `PROPOSED`.

## 11. Coverage assessment

Coverage represents **what the evaluation actually covered**, not what the vehicle or adapter might theoretically support.

Coverage levels are:

- `HIGH`
- `PARTIAL`
- `LIMITED`
- `NOT_ASSESSED` before assessment

Coverage is derived from the purpose-specific mandatory plan and the committed evidence set.

Examples:

- missing visual/manual baseline prevents a fully high-coverage review when that step is mandatory;
- pre-purchase/pre-trip/fleet scope requiring road evidence remains partial when the road window is missing;
- a failed mandatory electronic capture remains not covered;
- unavailable/unknown mandatory systems remain explicit limitations.

Coverage is recalculated at signature time so a stale assessment cannot survive later dossier changes.

A PARTIAL or LIMITED report may be signed **as PARTIAL or LIMITED** when the remaining signature requirements are satisfied. Signing never upgrades coverage.

## 12. Signature gate

AutoPulse Check report finalization is blocked when any of the following is true:

- zero committed evidence exists;
- any finding remains `PROPOSED`;
- evidence remains in an uncommitted staging state;
- coverage is not assessed;
- limitations are absent;
- the evaluation is not in a legal pre-signature state.

The application adds a permanent scope limitation to signed reports:

> This report is limited to the documented evaluation scope and evidence actually captured. Systems outside that scope were not evaluated.

This text is an integrity rule, not decorative disclaimer copy.

## 13. Report manifest

A signed report freezes a canonical `ReportManifest` containing:

- vehicle snapshot;
- technician/operator identity;
- evaluation scope;
- coverage assessment;
- reviewed findings;
- selected evidence;
- limitations;
- optional professional recommendations;
- Check engine version;
- OBD catalog version;
- generation timestamp.

Vehicle protocol is included only when actual resolved evidence exists. Provisional `A0` is not promoted into signed vehicle-protocol truth.

## 14. Canonicalization and SHA-256 integrity

Before signing, the manifest is converted to stable canonical JSON:

- object keys are recursively sorted;
- array order is preserved;
- `undefined` fields are omitted consistently.

The canonical payload receives a SHA-256 fingerprint.

The implementation uses a Hermes-safe pure-JS SHA-256 routine over the project's existing UTF-8 encoder because the installed Expo SDK's `expo-crypto` typings do not expose the digest API used by newer SDK documentation.

The SHA implementation is checked against known SHA-256 vectors and does not depend on a global `TextEncoder`.

The persisted integrity chain is:

`Evaluation -> ReportVersion -> Manifest ID -> canonical payload -> SHA-256`

The stored manifest hash and report-version hash must match, and recomputing SHA-256 over the canonical payload must reproduce the same fingerprint.

## 15. Signature semantics

The first release records:

- report version number;
- local operator/technician identity;
- signing timestamp;
- SHA-256 integrity fingerprint;
- immutable manifest relationship.

This is an **AutoPulse integrity snapshot and operator attribution mechanism**.

It must not be described as:

- a PKI-qualified electronic signature;
- a statutory digital signature;
- a government-certified inspection signature;
- a legal identity proof stronger than the actual local operator model.

Any future legal/qualified-signature feature requires a separate authority and implementation gate.

## 16. Process-death recovery during signing

There is a narrow persistence boundary after the immutable `ReportVersion` is durable but before the `Evaluation` row reaches `SIGNED`.

AutoPulse explicitly reconciles that state on report-route reopen:

1. Find the existing durable report version.
2. Load its manifest/canonical payload.
3. Verify that manifest hash == version hash.
4. Recompute SHA-256 and verify the payload.
5. Verify signer matches the evaluation technician.
6. Require evaluation state `READY_FOR_SIGNATURE`.
7. Promote the evaluation to `SIGNED` using the existing state machine and the original version's `signedAt`.
8. **Do not generate another manifest or version.**

If integrity fails or the durable state is contradictory, recovery stops and presents an explicit integrity/recovery error. AutoPulse does not overwrite the artifact to make the state look consistent.

## 17. Persistence model

Check is local-first durable product data in SQLite.

Current Check records include:

- `check_evaluations`
- `check_evidence_items`
- `check_findings`
- `check_report_drafts`
- `check_report_manifests`
- `check_report_versions`

Evaluation purpose, capability snapshot, scope, coverage, limitations and lifecycle timestamps are persisted rather than reconstructed from presentation text.

## 18. Vehicle safety boundary

Current Check MVP is read-only relative to the vehicle.

Allowed:

- standard diagnostic reads;
- capability discovery;
- DTC reads;
- readiness/monitor reads;
- freeze-frame reads/probes;
- Live Mode 01 observation;
- adapter-side AT configuration required for read communication.

Not introduced:

- DTC clearing;
- actuator control;
- ECU reset;
- coding/programming;
- destructive service routines;
- vehicle write commands.

Any future write capability requires a separate safety design, explicit capability proof and physical certification.

## 19. UX principle

Check can contain more detail than Live because it is an inspection workflow, but remains phone-first:

- one clear step at a time;
- explicit evaluated/not-evaluated boundaries;
- human summaries before raw protocol details;
- no missing measurement displayed as zero;
- no requirement for the user to manually interpret raw PIDs;
- signed reports expose coverage, limitations, version, hash and integrity state;
- an integrity failure is loud and blocks trust rather than being silently repaired.

## 20. Current implementation boundary

Implemented in the active stacked Check branches:

- deterministic Check plan;
- durable evaluation/evidence model;
- dedicated Check-only BLE/ELM handoff;
- capability discovery and reconciliation;
- DTC / PID 01 / freeze-frame-trigger read-only captures;
- Live evidence promotion contract;
- deterministic evidence-bound findings;
- professional review;
- coverage assessment;
- report draft/manifest/version persistence;
- canonical report payload;
- SHA-256 integrity fingerprint;
- immutable-version reopen verification;
- interrupted-signature reconciliation;
- report integrity UI.

Still outside proven product truth until separately completed/certified:

- physical end-to-end AutoPulse Check certification on a real vehicle;
- visual/manual baseline capture UI and media evidence;
- detailed readiness monitor breakdown;
- complete freeze-frame PID set capture;
- technician-created freeform findings UI;
- PDF/export/delivery certification;
- PKI/legal signature;
- non-powertrain proprietary module coverage unless separately proven.
