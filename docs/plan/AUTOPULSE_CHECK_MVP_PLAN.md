# AutoPulse Check — MVP Execution Plan

Status: **ACTIVE PLAN — C1–C6 automated gates green; C7 implementation active; C8 physical certification pending**

## Goal

Deliver a defensible, local-first vehicle evaluation workflow that turns observed vehicle evidence into a traceable review/report without claiming systems that were not evaluated.

The execution rule is:

`DESIGN -> BUILD -> AUTOMATED GATE -> PHYSICAL EVIDENCE -> QUARRY -> GOLDEN PROMOTION -> RELEASE CLAIM`

No earlier stage substitutes for a later one.

## Gate C0 — Recover existing evaluation domain

Acceptance:
- existing evaluation/capture/evidence/finding/report state machines remain authoritative;
- no parallel replacement domain is created.

State: **PASS**.

## Gate C1 — Evaluation engine + deterministic plan

Build:
- purpose-aware Check plan;
- capability support tri-state (`SUPPORTED`, `UNSUPPORTED`, `UNKNOWN`);
- evaluation creation through existing domain states;
- durable Check purpose and capability metadata.

Acceptance:
- PRE_PURCHASE/PRE_TRIP/FLEET scope can require road evidence;
- unsupported/unknown electronic steps remain explicit limitations;
- freeze-frame capability does not imply that a frame exists;
- purpose changes requested evidence, never telemetry truth.

State: **AUTOMATED PASS** on PR #40 foundation; physical workflow evidence still belongs to C8.

## Gate C2 — Live evidence promotion

Build:
- bounded Live telemetry window -> Check `EvidenceItem`;
- same-vehicle gate;
- valid ECU-origin sample requirement;
- explicit capture context (`IDLE`, `ROAD_TEST`, etc.);
- telemetry-gap/recovery metadata;
- signed-evaluation mutation protection.

Acceptance:
- phone/adapter-only evidence cannot satisfy ECU evidence requirement;
- cross-vehicle promotion fails;
- zero valid ECU samples fails;
- gaps are preserved and never synthesized;
- road evidence cannot be relabeled from an idle window.

State: **AUTOMATED PASS** on PR #40 foundation; real promoted-window fixture remains part of C8.

## Gate C3 — Durable Check persistence

Build:
- `check_evaluations`;
- `check_evidence_items`;
- durable purpose/capability/scope/coverage metadata;
- CheckEvaluationRepository;
- migration registration.

Acceptance:
- evaluation reconstructs from SQLite;
- purpose/capability facts survive state transitions;
- evidence retains source identity and exact time window;
- signed evaluation rejects subsequent evidence mutation.

State: **AUTOMATED IMPLEMENTATION PASS**. Actual Android process-kill/restart reconstruction remains a C8 physical requirement.

## Gate C4 — Dedicated read-only diagnostic capture

Build:
- Check-only BLE/adapter handoff; no fake Live session;
- real capability discovery;
- stored DTC service capture;
- Mode 01 PID 01 monitor-status capture;
- narrow Mode 02 freeze-frame-trigger capture;
- hardware-neutral `DiagnosticConnector` execution;
- evidence-driven capability reconciliation.

Acceptance:
- no clear/reset/write command;
- `NO_DATA` on stored DTC does not become a healthy-vehicle claim;
- readiness is promoted only from an actual PID 01 monitor payload;
- freeze-frame support is promoted only when actual trigger evidence exists;
- failed initialization does not become an `UNSUPPORTED` vehicle claim;
- retained BLE connection is released after capture.

State: **AUTOMATED PASS — PR #41 / Mobile Verify #261**.

Known scope limits:
- detailed readiness monitor breakdown not yet decoded;
- full freeze-frame PID set not yet captured.

## Gate C5 — Check mobile workflow

Screens/workflow:
- Check tab/home;
- vehicle + purpose intake;
- durable evaluation dossier;
- dedicated adapter connection;
- read-only electronic capture progress/result;
- human-readable evidence dossier;
- findings/review entry point;
- report-readiness/integrity entry point.

Acceptance:
- Check never starts a hidden Live session as a substitute;
- evaluated vs unknown/unavailable remains visible;
- ordinary users do not need to decode raw PID hex;
- electronic evidence is durable before it is presented as captured.

State: **AUTOMATED PASS for implemented workflow through PR #41; report UI extends under C7**.

## Gate C6 — Deterministic findings + professional review

Build:
- durable `check_findings` model;
- deterministic evidence-bound proposal engine;
- professional review screen and repository;
- existing evaluation review state machine.

Current proposal sources:
- actual stored DTC(s);
- actual MIL=ON evidence;
- actual freeze-frame trigger evidence.

Hard truth rules:
- no finding from empty DTC list;
- no health claim from `NO_DATA`;
- no health claim from MIL OFF;
- no root-cause claim merely because a DTC exists;
- all system proposals remain `PROPOSED` until professional review;
- professional conclusion cannot be system-authored.

Review outcomes currently exposed:
- `CONFIRMED`
- `REJECTED`
- `INCONCLUSIVE`

State: **AUTOMATED PASS — PR #42 / Mobile Verify #262**.

Still future within this area:
- technician-created freeform findings UI;
- richer modification UI for severity/confidence.

## Gate C7 — Coverage + immutable report integrity

Build:
- purpose/evidence-driven coverage assessment (`HIGH`, `PARTIAL`, `LIMITED`);
- signing-time coverage recalculation;
- zero-committed-evidence hard stop;
- existing signature-policy enforcement;
- durable report draft, manifest and immutable version records;
- canonical stable JSON payload;
- Hermes-safe SHA-256 fingerprint;
- report-version/signer/timestamp receipt;
- signed-report reopen verification;
- process-death reconciliation between durable version creation and final evaluation `SIGNED` state;
- integrity-blocking UI when reconciliation detects contradiction/tampering.

Acceptance:
- a PARTIAL/LIMITED report remains PARTIAL/LIMITED after signing;
- no empty evaluation can be signed;
- no unresolved `PROPOSED` finding can be signed;
- signed report contents do not silently mutate;
- reopening a signed report returns the same manifest/version/hash;
- canonical payload hash and report-version hash must agree;
- tampered canonical payload yields integrity failure;
- process death after version persistence but before evaluation-state persistence recovers the existing version rather than creating version 2;
- failed recovery integrity blocks advancement and does not overwrite evidence;
- signature UI states clearly that local operator attribution + SHA-256 is not a PKI-qualified/statutory digital signature.

State: **IMPLEMENTED ON PR #43 — latest exact-head CI must be green before automated PASS is declared.**

## Gate C8 — Physical AutoPulse Check certification

Minimum initial physical fixtures:
- Renault Logan 2014;
- Renault Duster 2014;
- later: non-Renault vehicle;
- later: second adapter family.

Minimum first end-to-end physical scenario:
1. Open Check tab.
2. Create a preventive evaluation for a real vehicle.
3. Connect through the dedicated Check adapter path.
4. Capture capability discovery.
5. Capture stored-DTC evidence.
6. Capture PID 01 monitor evidence when available.
7. Capture freeze-frame trigger evidence when available.
8. Return to dossier and verify all evidence reconstructs.
9. Generate deterministic findings from actual positive evidence only.
10. Perform professional review of every proposed finding.
11. Open report readiness and confirm coverage/limitations.
12. Sign immutable report snapshot.
13. Record version + SHA-256.
14. Kill/restart the Android app.
15. Reopen the same evaluation/report.
16. Confirm identical manifest/version/hash and `INTEGRITY VERIFIED`.

Additional physical scenarios:
- electronic capability unavailable/unknown;
- adapter interruption during Check capture;
- Check capture failure without false `UNSUPPORTED` claim;
- real Live idle window promotion;
- road-window promotion for a purpose requiring it;
- report with legitimate PARTIAL/LIMITED coverage;
- process kill at or near finalization when practically reproducible.

A successful Logan/Duster pair does not establish universal Renault support.

State: **PENDING PHYSICAL EVIDENCE**.

## Gate C9 — Report export/delivery (post-MVP certification lane)

Potential scope:
- PDF or shareable export;
- delivery receipt;
- superseding version UX;
- privacy/redaction rules;
- optional remote synchronization.

This is intentionally separate from integrity signing. A signed local manifest can be valid before an export format exists.

State: **NOT STARTED / NOT REQUIRED TO PROVE C7**.

## Release boundary

AutoPulse Check must not be called physically certified or release-ready until the applicable MVP gates have evidence receipts.

Current shorthand:

`C0 PASS -> C1 PASS -> C2 PASS -> C3 automated -> C4 PASS -> C5 PASS -> C6 PASS -> C7 active -> C8 physical pending`

`IMPLEMENTED` and `CI GREEN` remain intermediate states, not field/release claims.
