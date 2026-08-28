# AutoPulse Check — Build Ledger

This ledger records implementation facts. It does not certify physical vehicle behavior.

## Existing recovered foundation

The repository already contained the generic evaluation domain before this Check integration slice:

- Evaluation state machine.
- Capture state machine.
- Evidence policy.
- Coverage policy.
- Findings models.
- Professional review model.
- Report draft/version state machines.
- Signature policy.
- Audit/event models.

This slice extends that foundation instead of replacing it.

## CHECK-BUILD-001 — Deterministic evaluation planning

Added:
- `mobile-app/src/application/check/AutoPulseCheckPlan.ts`

Behavior:
- purpose-aware plan;
- tri-state capability facts;
- explicit AVAILABLE / UNKNOWN / UNAVAILABLE / CONDITIONAL step status;
- PRE_PURCHASE/PRE_TRIP/FLEET road-window requirement;
- limitations derived from unproven/unsupported capabilities.

## CHECK-BUILD-002 — Live evidence promotion

Added:
- `mobile-app/src/application/check/TelemetryEvidencePromotion.ts`

Hard gates:
- evaluation state allows evidence;
- evaluation/session vehicle identities match;
- valid finite time window;
- at least one valid ECU-origin sample;
- consistent sample counts;
- at least one signal identity.

Promoted evidence records recovery count, telemetry gap duration and explicitly records that telemetry was not synthesized.

## CHECK-BUILD-003 — Claim authority

Added:
- `mobile-app/src/application/check/CheckClaimAuthority.ts`

Policy:
- system/technician may create provenance-backed observations;
- system may propose deterministic reviewable findings;
- system cannot author a professional conclusion;
- technician may author professional conclusion after review.

## CHECK-BUILD-004 — Application engine

Added:
- `mobile-app/src/application/check/AutoPulseCheckEngine.ts`

Behavior:
- creates Check DRAFT evaluation;
- derives scope from deterministic plan;
- persists explicit Check purpose alongside generic Evaluation;
- uses existing evaluation transition state machine;
- promotes Live evidence through the evidence policy rather than bypassing it.

## CHECK-BUILD-005 — SQLite persistence

Added schema:
- `check_evaluations`
- `check_evidence_items`

Files:
- `mobile-app/src/infrastructure/database/product/schema/evaluation.ts`
- `mobile-app/src/infrastructure/database/product/migrations/0008_autopulse_check_evaluations.sql`
- migration journal/loader registration
- schema barrel export

Repository:
- `mobile-app/src/infrastructure/database/product/repositories/check-evaluation.repository.ts`

Persistence keeps:
- workspace/vehicle/operator identity;
- Check purpose;
- evaluation state/scope/limitations/symptoms;
- lifecycle timestamps;
- Live session evidence references;
- evidence origin/type/state;
- exact telemetry window;
- metadata JSON and provenance.

## Branch / integration strategy

Feature branch:
- `feat/check-evaluation-engine-20260826`

Base:
- exact RC5 field-candidate branch.

Reason:
- Check work must not modify or invalidate the already-built RC5 physical certification APK.

PR:
- #40, draft while the Check foundation is under CI/integration construction.

## Not implemented by this ledger entry

Do not infer these are complete:
- Check UI;
- DTC capture executor;
- readiness capture executor;
- freeze-frame capture executor;
- visual/photo capture persistence;
- deterministic finding rules;
- report renderer;
- signature UI;
- physical Check certification.
