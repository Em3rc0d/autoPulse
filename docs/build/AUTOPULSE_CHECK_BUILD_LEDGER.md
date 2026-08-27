# AutoPulse Check — Build Ledger

This ledger records implementation facts. It does **not** certify physical vehicle behavior. Automated-green branches remain distinct from field-certified product behavior.

## 1. Recovered domain foundation

Before the current Check integration, the repository already contained the generic evaluation domain:

- Evaluation state machine.
- Capture state machine.
- Evidence policy.
- Coverage policy/model.
- Finding model.
- Professional review model.
- Report draft/version state machines.
- Signature policy.
- Audit/event models.

Current Check work extends these contracts rather than replacing them with a second evaluation system.

---

## CHECK-BUILD-001 — Deterministic evaluation planning

Primary file:
- `mobile-app/src/application/check/AutoPulseCheckPlan.ts`

Behavior:
- purpose-aware Check plan;
- `SUPPORTED / UNSUPPORTED / UNKNOWN` capability facts;
- `AVAILABLE / UNKNOWN / UNAVAILABLE / CONDITIONAL` step availability;
- road-window requirement for PRE_PURCHASE/PRE_TRIP/FLEET;
- limitations derived from unproven/unsupported capabilities.

Stack ownership:
- PR #40 — `feat/check-evaluation-engine-20260826`.

Automated status:
- Mobile Verify #260: **PASS** at the foundation head recorded by PR #40.

---

## CHECK-BUILD-002 — Live evidence promotion

Primary file:
- `mobile-app/src/application/check/TelemetryEvidencePromotion.ts`

Hard gates:
- evaluation state permits evidence mutation;
- evaluation/session vehicle identities match;
- valid finite time window;
- at least one valid ECU-origin sample;
- consistent sample counts;
- at least one signal identity.

Promoted evidence records:
- source Live session;
- exact time window;
- capture context (`IDLE`, `ROAD_TEST`, etc.);
- valid/total sample counts;
- signal identities;
- recovery count;
- telemetry-gap duration;
- source session status;
- `synthesizedTelemetry: false`.

Stack ownership:
- PR #40.

---

## CHECK-BUILD-003 — Claim authority

Primary file:
- `mobile-app/src/application/check/CheckClaimAuthority.ts`

Policy:
- system/technician may record provenance-backed observations;
- system may propose deterministic reviewable findings;
- system cannot author a professional conclusion;
- technician may provide professional conclusion/review within the governed workflow.

Stack ownership:
- PR #40 foundation, consumed by PR #42 review workflow.

---

## CHECK-BUILD-004 — Application engine

Primary file:
- `mobile-app/src/application/check/AutoPulseCheckEngine.ts`

Behavior:
- creates Check DRAFT evaluation;
- derives scope from deterministic plan;
- persists explicit Check purpose/capabilities alongside generic Evaluation;
- uses existing evaluation transition state machine;
- promotes Live evidence through evidence policy;
- captures diagnostic evidence through the hardware-neutral connector boundary;
- updates capability facts only from observed evidence.

---

## CHECK-BUILD-005 — Evaluation/evidence SQLite persistence

Initial schema:
- `check_evaluations`
- `check_evidence_items`

Key files:
- `mobile-app/src/infrastructure/database/product/schema/evaluation.ts`
- `mobile-app/src/infrastructure/database/product/migrations/0008_autopulse_check_evaluations.sql`
- `mobile-app/src/infrastructure/database/product/repositories/check-evaluation.repository.ts`

Persistence includes:
- workspace/vehicle/operator identity;
- purpose;
- capability snapshot;
- state/scope/limitations/symptoms;
- coverage when assessed;
- lifecycle timestamps;
- Live session evidence references;
- evidence origin/type/state;
- exact telemetry window;
- metadata/provenance.

---

## CHECK-BUILD-006 — Dedicated Check-only adapter handoff

Primary UI:
- `mobile-app/src/screens/check/CheckConnectObdScreen.tsx`
- `mobile-app/src/screens/check/CheckDiagnosticCaptureScreen.tsx`

Infrastructure reused:
- `BleCompatibilityProbe`
- `ActiveBleConnectionController`
- `RealObdController`
- `RealObdInitialization`
- `ElmBleDiagnosticConnector`

Behavior:
- probes/accepts an adapter using the same transport evidence used by Live;
- retains the BLE/GATT connection under a Check-specific handle;
- **does not create a Live session**;
- hands the connection to Check diagnostic capture;
- releases the retained connection when capture finishes.

Stack ownership:
- PR #41 — `feat/check-capability-reconciliation-20260827`.

Automated status:
- Mobile Verify #261: **PASS** on PR #41 head `529621eeb3a4bc2333625a65763a08260b4b4eb2`.

---

## CHECK-BUILD-007 — Read-only diagnostic evidence capture

Primary application files:
- `mobile-app/src/application/check/CheckDiagnosticCapture.ts`
- `mobile-app/src/infrastructure/diagnostics/ElmBleDiagnosticConnector.ts`

Current bounded requests:
- stored DTC: `03`;
- monitor status: `0101`;
- freeze-frame trigger probe: `020200`;
- capability discovery from `RealObdInitialization`.

Evidence semantics:
- raw/execution status retained;
- source ECU list retained when available;
- DTC codes retained when decoded;
- PID 01 retains MIL + confirmed-DTC count only;
- freeze-frame retains frame/trigger evidence only;
- `vehicleWritePerformed: false` recorded.

No clear/reset/actuator/coding/programming command was added.

---

## CHECK-BUILD-008 — Capability reconciliation

Primary file:
- `mobile-app/src/application/check/CheckCapabilityReconciliation.ts`

Rules include:
- successful capability discovery can prove OBD support;
- a valid DTC service response can prove DTC-read capability even when the response is legitimately `NO_DATA`;
- `NO_DATA` does not become a vehicle-health finding;
- readiness becomes supported only when actual monitor-status data exists;
- freeze-frame evidence requires an actual trigger payload;
- failed initialization/capture does not automatically become `UNSUPPORTED`;
- positively proven support is not silently downgraded by weaker later evidence.

Stack ownership:
- PR #41.

---

## CHECK-BUILD-009 — Primary Check mobile workflow

Current screens:
- `CheckHomeScreen`
- `NewCheckScreen`
- `CheckEvaluationScreen`
- `CheckConnectObdScreen`
- `CheckDiagnosticCaptureScreen`
- `CheckFindingsScreen`
- `CheckReportRecoveryScreen`
- `CheckReportScreen`

Navigation:
- Check is a first-class bottom-tab product surface.
- Report route is recovery-gated before the normal report UI renders.

---

## CHECK-BUILD-010 — Durable deterministic findings

Schema/migration:
- `check_findings`
- `0009_autopulse_check_findings.sql`

Primary files:
- `CheckFindingEngine.ts`
- `check-finding.repository.ts`
- `CheckFindingsScreen.tsx`

Current system proposal triggers:
- actual stored DTC code(s);
- actual MIL=ON;
- actual freeze-frame trigger evidence.

Non-triggers by design:
- empty DTC list;
- DTC `NO_DATA`;
- MIL OFF;
- absent freeze-frame;
- failed/missing evidence.

System findings remain `PROPOSED` and cite evidence IDs.

Stack ownership:
- PR #42 — `feat/check-findings-review-20260827`.

Automated status:
- Mobile Verify #262: **PASS** on PR #42 head `267455729451999ad1e73aeb71e5cd87bd85f00d`.

---

## CHECK-BUILD-011 — Professional review

Professional review persists:
- technician identity;
- final status;
- final severity/confidence;
- comment/justification;
- review timestamp.

Current UI decisions:
- CONFIRM;
- REJECT;
- INCONCLUSIVE.

The review engine requires the existing `IN_REVIEW` evaluation state. Opening a screen does not silently invent professional authority.

---

## CHECK-BUILD-012 — Coverage assessment

Primary file:
- `mobile-app/src/application/check/CheckCoverageAssessment.ts`

Coverage values:
- `HIGH`
- `PARTIAL`
- `LIMITED`
- domain `NOT_ASSESSED` before assessment.

Coverage is based on mandatory plan steps and actual evidence. It is recalculated at signing time.

Important behavior:
- missing required visual/road/electronic evidence remains visible;
- unavailable/unknown steps produce explicit reasons;
- signing does not upgrade PARTIAL/LIMITED coverage.

---

## CHECK-BUILD-013 — Report persistence

Migration:
- `0010_autopulse_check_reports.sql`

Durable tables:
- `check_report_drafts`
- `check_report_manifests`
- `check_report_versions`

Evaluation schema also persists `coverage_json`.

Primary repository:
- `mobile-app/src/infrastructure/database/product/repositories/check-report.repository.ts`

Report version stores:
- evaluation identity;
- version number;
- version state;
- manifest identity;
- integrity hash;
- signer;
- signed timestamp;
- optional superseded version/void reason.

---

## CHECK-BUILD-014 — Canonical manifest + SHA-256

Application:
- `mobile-app/src/application/check/CheckReportIntegrity.ts`
- `mobile-app/src/application/check/CheckReportFinalization.ts`

Hasher:
- `mobile-app/src/infrastructure/check/PureJsReportIntegrityHasher.ts`
- compatibility export `ExpoReportIntegrityHasher.ts` now routes to pure-JS SHA-256.

Why pure JS:
- the installed Expo SDK's `expo-crypto` TypeScript surface did not expose the digest APIs used by newer Expo examples;
- an initial PR #43 CI run caught this at compile time;
- the dependency was removed from report hashing rather than bypassing type safety.

Hasher properties:
- uses the existing Hermes-safe UTF-8 encoder;
- no required global `TextEncoder`;
- known empty-string and `abc` SHA-256 vectors are regression fixtures.

Canonicalization:
- recursive object-key sort;
- stable omission of undefined fields;
- array order preserved.

---

## CHECK-BUILD-015 — Signature/finalization engine

Primary file:
- `CheckReportFinalization.ts`

Hard gates:
- evaluation must be in a legal review/pre-signature state;
- at least one committed evidence item;
- zero unresolved PROPOSED findings;
- coverage assessed from latest evidence;
- limitations present;
- existing domain signature policy passes.

Final manifest freezes:
- vehicle snapshot;
- technician;
- scope;
- coverage;
- reviewed findings;
- evidence;
- limitations;
- optional recommendations;
- engine/catalog version;
- generated timestamp.

Signing creates:
- canonical payload;
- SHA-256 fingerprint;
- durable manifest;
- durable immutable `ReportVersion`;
- evaluation `SIGNED` state with original signing timestamp.

Local operator attribution + SHA-256 is explicitly **not represented as a qualified/statutory digital signature**.

---

## CHECK-BUILD-016 — Process-death signature reconciliation

Risk addressed:
- process can die after durable report-version insertion but before the evaluation row reaches `SIGNED`.

Recovery implementation:
- `CheckReportFinalizationEngine.reconcileInterruptedSignature()`;
- `CheckReportRecoveryScreen` runs recovery before rendering report UI.

Recovery accepts only:
- existing durable report version;
- evaluation still `READY_FOR_SIGNATURE`;
- report version itself `SIGNED`;
- report signer matches evaluation technician;
- stored manifest hash matches report-version hash;
- recomputed SHA-256 matches the stored canonical payload.

On success:
- evaluation becomes `SIGNED` with the **existing version's original `signedAt`**;
- existing manifest/version is reused;
- no version 2 is generated.

On integrity/state mismatch:
- recovery blocks;
- no overwrite/regeneration occurs;
- UI surfaces the inconsistency.

---

## Branch / PR integration stack

The Check stack intentionally remains layered above the RC5 field candidate so Check work does not alter the already-frozen RC5 driving APK during its physical certification lane.

Stack:

1. PR #40 — Check evaluation/evidence foundation.
2. PR #41 — dedicated read-only diagnostics + capability reconciliation.
3. PR #42 — findings + professional review.
4. PR #43 — coverage + immutable report/signing/integrity/recovery.

PRs remain draft while the full Check gate stack and physical certification are incomplete.

---

## Not certified by this build ledger

Do not infer completion of:
- physical AutoPulse Check on Logan/Duster;
- visual/manual/photo evidence capture UI;
- detailed readiness-monitor breakdown;
- full freeze-frame PID reconstruction;
- legal/PKI signature;
- PDF/export/delivery certification;
- non-powertrain proprietary module coverage;
- universal vehicle or adapter compatibility.
