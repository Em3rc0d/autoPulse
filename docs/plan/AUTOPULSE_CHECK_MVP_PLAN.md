# AutoPulse Check — MVP Execution Plan

Status: **ACTIVE PLAN**

## Goal

Deliver a defensible, local-first vehicle evaluation workflow that turns observed vehicle evidence into a traceable review/report without claiming systems that were not evaluated.

## Gate C0 — Recover existing evaluation domain

Acceptance:
- existing evaluation/capture/evidence/finding/report state machines remain authoritative;
- no parallel replacement domain is created.

State: **PASS**.

## Gate C1 — Evaluation engine + plan

Build:
- purpose-aware deterministic Check plan;
- capability support tri-state (`SUPPORTED`, `UNSUPPORTED`, `UNKNOWN`);
- evaluation creation through existing domain states;
- durable Check purpose metadata.

Acceptance:
- PRE_PURCHASE requires road evidence;
- unsupported/unknown electronic steps remain explicit limitations;
- freeze-frame capability does not imply a frame exists.

State: **IMPLEMENTED — CI pending/active**.

## Gate C2 — Live evidence promotion

Build:
- bounded Live telemetry window -> Check EvidenceItem;
- same-vehicle gate;
- valid ECU-origin sample requirement;
- telemetry gap/recovery metadata;
- signed-evaluation mutation protection.

Acceptance:
- phone/adapter-only evidence cannot satisfy ECU evidence requirement;
- cross-vehicle promotion fails;
- zero valid ECU samples fails;
- gaps are preserved and never synthesized.

State: **IMPLEMENTED — CI pending/active**.

## Gate C3 — Durable local persistence

Build:
- `check_evaluations`;
- `check_evidence_items`;
- migration registration;
- CheckEvaluationRepository.

Acceptance:
- evaluation survives process restart;
- purpose survives transitions;
- evidence retains Live session reference and exact time window;
- signed evaluation rejects subsequent promotion through application/domain policy.

State: **IMPLEMENTED — integration certification pending**.

## Gate C4 — Read-only diagnostic capture executors

Build:
- DTC read capture;
- readiness capture;
- freeze-frame read when available;
- capability-driven command selection;
- evidence serialization with raw/canonical provenance.

Acceptance:
- no clear/reset/write command;
- unsupported service/PID becomes explicit unavailable evidence, not failure masquerading as PASS;
- negative ECU responses remain distinguishable from transport failures.

State: **NEXT**.

## Gate C5 — Check mobile workflow

Screens:
- Check home / evaluations;
- new evaluation intake;
- step runner;
- evidence review;
- findings review;
- report preview.

Acceptance:
- one primary action per frame;
- user can always see evaluated vs not evaluated;
- operator never needs to interpret raw PID hex for normal workflow.

State: **PENDING**.

## Gate C6 — Deterministic findings

Build initial conservative rules only where evidence contracts exist.

Rules must output:
- evidence references;
- observation/finding distinction;
- severity;
- confidence;
- limitations.

System-generated findings remain proposed/reviewable. AutoPulse cannot author a professional conclusion.

State: **PENDING**.

## Gate C7 — Report snapshot + review/signature

Build:
- immutable report draft inputs;
- professional review boundary;
- signed report snapshot;
- superseding-version path.

Acceptance:
- signed report cannot silently change;
- report explicitly lists unavailable/not-assessed systems;
- evidence IDs/time windows remain traceable.

State: **PENDING**.

## Gate C8 — Physical Check certification

Minimum physical fixtures:
- Renault Logan 2014;
- Renault Duster 2014;
- later: non-Renault vehicle;
- later: second adapter family.

Physical scenarios:
- preventive Check;
- normal idle evidence promotion;
- road evidence promotion;
- intermittent adapter recovery during evidence window;
- unsupported/unknown capability;
- stop/restart/reopen evaluation;
- report reconstruction.

A successful Logan/Duster pair does not establish universal Renault support.

State: **PENDING**.

## Release boundary

AutoPulse Check MVP is not release-ready until C1–C8 applicable MVP gates have evidence receipts. `IMPLEMENTED` and `CI GREEN` are intermediate statuses, not release claims.