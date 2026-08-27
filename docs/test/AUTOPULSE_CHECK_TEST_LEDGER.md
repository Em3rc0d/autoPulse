# AutoPulse Check — Test Ledger

Status: **AUTOMATED C1–C6 GREEN; C7 exact-head verification active; physical C8 pending**

This ledger separates:

- domain/unit fixture PASS;
- CI/mobile verification PASS;
- Android physical behavior;
- physical vehicle evidence;
- Golden Dataset promotion.

A result in an earlier layer does not imply a later layer.

## 1. Automated foundation fixtures

### CHECK-T001 — Unsupported/unknown coverage stays explicit
Expected:
- supported DTC step => AVAILABLE;
- unknown readiness => UNKNOWN;
- unsupported freeze frame => UNAVAILABLE;
- limitations emitted.

Status: **PASS**.

### CHECK-T002 — Purpose changes evidence requirements
Expected:
- PRE_PURCHASE/PRE_TRIP/FLEET require road telemetry;
- PREVENTIVE may keep road evidence optional.

Status: **PASS**.

### CHECK-T003 — Freeze-frame capability is conditional
Expected:
- supported freeze-frame capability does not imply that an applicable frame exists.

Status: **PASS**.

### CHECK-T004 — Same-vehicle evidence only
Expected:
- Live telemetry from vehicle B cannot enter evaluation for vehicle A.

Status: **PASS**.

### CHECK-T005 — ECU-origin requirement
Expected:
- zero valid ECU samples rejects promotion;
- adapter/phone-only data cannot satisfy this gate.

Status: **PASS**.

### CHECK-T006 — Evidence-gap truth
Expected:
- recovery count and telemetry gap persist in metadata;
- `synthesizedTelemetry` remains false.

Status: **PASS**.

### CHECK-T007 — Signed evaluation immutability
Expected:
- evidence promotion rejected after SIGNED.

Status: **PASS**.

### CHECK-T008 — Evaluation lifecycle authority
Expected:
- illegal DRAFT -> SIGNED transition fails;
- legal transitions use existing state machine.

Status: **PASS**.

### CHECK-T009 — Professional conclusion authority
Expected:
- SYSTEM professional conclusion rejected;
- technician conclusion allowed;
- system deterministic finding remains reviewable `SYSTEM_RULE`.

Status: **PASS**.

## 2. Dedicated diagnostic-capture fixtures

### CHECK-T010 — Stored DTC `NO_DATA` does not imply healthy vehicle
Expected:
- service/capture evidence may be committed;
- DTC-read capability may be proven when the service responds legitimately;
- no positive health finding is produced.

Status: **PASS**.

### CHECK-T011 — Readiness support requires actual monitor payload
Expected:
- only actual PID 01 monitor status promotes readiness/monitor capability;
- missing/failed payload leaves truth unresolved rather than fabricating support.

Status: **PASS**.

### CHECK-T012 — Freeze-frame support requires trigger evidence
Expected:
- actual trigger/frame payload may promote observed support;
- `NO_DATA` does not become freeze-frame-present evidence.

Status: **PASS**.

### CHECK-T013 — Failed initialization does not become UNSUPPORTED vehicle
Expected:
- transport/adapter/timeout failure remains failure/unknown;
- vehicle capability is not inferred from acquisition failure.

Status: **PASS**.

### CHECK-T014 — Check connector remains independent from Live session creation
Expected:
- Check adapter handoff retains a diagnostic connection;
- it does not create a hidden Live session.

Status: **implemented/TypeScript verified on PR #41; physical verification pending C8**.

## 3. Findings/review fixtures

### CHECK-T015 — DTC-positive evidence may propose a finding
Expected:
- only actual returned code(s) create the rule-backed proposal;
- evidence IDs are linked;
- finding remains `PROPOSED`.

Status: **PASS**.

### CHECK-T016 — MIL ON may propose attention finding
Expected:
- actual PID 01 MIL ON drives the proposal;
- MIL OFF does not create a healthy-vehicle finding.

Status: **PASS**.

### CHECK-T017 — Freeze-frame trigger proposal is scope-limited
Expected:
- actual trigger may generate an informational/evidence proposal;
- full freeze-frame capture is not claimed.

Status: **PASS**.

### CHECK-T018 — No evidence-backed finding != healthy vehicle
Expected:
- empty result set is presented as “no rule-backed finding proposed from available evidence”;
- not “vehicle healthy” or “no faults.”

Status: **PASS by rule/UI contract**.

### CHECK-T019 — Professional review state gate
Expected:
- professional review only accepted in `IN_REVIEW`;
- review outcome/comment/justification persists.

Status: **PASS**.

## 4. Coverage/report/signature fixtures

### CHECK-T020 — Coverage follows mandatory evidence
Expected:
- missing mandatory evidence reduces coverage;
- failed mandatory evidence remains not covered;
- pre-purchase missing road window cannot be HIGH.

Status: **PASS**.

### CHECK-T021 — Coverage recalculated at signature time
Expected:
- signing evaluates latest dossier rather than trusting stale persisted coverage.

Status: **implemented; exact C7 head verification required**.

### CHECK-T022 — Empty evaluation cannot be signed
Expected:
- zero `COMMITTED` evidence => `CHECK_NO_COMMITTED_EVIDENCE`;
- no report version created.

Status: **fixture implemented; exact C7 head verification required**.

### CHECK-T023 — Unresolved finding blocks signature
Expected:
- any `PROPOSED` finding => signature failure;
- no report version created.

Status: **fixture implemented; exact C7 head verification required**.

### CHECK-T024 — PARTIAL/LIMITED report remains explicit
Expected:
- a scoped report may be signed with PARTIAL/LIMITED coverage if all other gates pass;
- signing does not upgrade it to HIGH or full-vehicle inspection;
- limitations are frozen into the manifest.

Status: **fixture implemented; exact C7 head verification required**.

### CHECK-T025 — Canonical report serialization is deterministic
Expected:
- object key insertion order does not change canonical payload;
- array order remains unchanged.

Status: **fixture implemented; exact C7 head verification required**.

### CHECK-T026 — SHA-256 known vectors
Expected:
- empty string => `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
- `abc` => `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`;
- UTF-8 hashing does not require a global TextEncoder.

Status: **fixture implemented; exact C7 head verification required**.

### CHECK-T027 — Signed reopen is idempotent
Expected:
- reopening/signing an already signed evaluation returns the same version + manifest;
- no version 2 is generated merely by reopening.

Status: **fixture implemented; exact C7 head verification required**.

### CHECK-T028 — Tamper detection
Expected:
- altered canonical payload no longer matches signed fingerprint;
- `integrityVerified = false`;
- signed data is not silently regenerated/overwritten.

Status: **fixture implemented; exact C7 head verification required**.

### CHECK-T029 — Interrupted-signature recovery
Simulated failure point:
- durable SIGNED `ReportVersion` exists;
- evaluation row is still `READY_FOR_SIGNATURE` because process died before final state write.

Expected after restart/reconciliation:
- load same report version;
- verify manifest hash == version hash;
- recompute SHA-256 successfully;
- signer matches evaluation technician;
- evaluation becomes `SIGNED` with the original report version's `signedAt`;
- version count remains exactly one.

Status: **fixture implemented; exact C7 head verification required**.

### CHECK-T030 — Interrupted-signature tamper blocks recovery
Expected:
- tampered durable canonical payload causes explicit recovery failure;
- evaluation remains `READY_FOR_SIGNATURE`;
- no second report version is created;
- no overwrite occurs.

Status: **fixture implemented; exact C7 head verification required**.

## 5. CI receipts

### PR #40 — Check foundation
- Branch: `feat/check-evaluation-engine-20260826`
- Mobile Verify run #260 / `33040220776`
- Result: **SUCCESS**.

### PR #41 — dedicated diagnostic capture
- Head: `529621eeb3a4bc2333625a65763a08260b4b4eb2`
- Mobile Verify run #261 / `33095494913`
- Result: **SUCCESS**.

### PR #42 — findings + professional review
- Head: `267455729451999ad1e73aeb71e5cd87bd85f00d`
- Mobile Verify run #262 / `33096510095`
- Result: **SUCCESS**.

### PR #43 — report integrity/signing
Historical expected-failure fixes during construction:
- older run caught unsupported `expo-crypto` digest typings; implementation was replaced rather than suppressing type safety;
- subsequent run caught literal-union narrowing in SHA-256 working state; numeric state typing was corrected.

Current authoritative status:
- **Do not mark C7 PASS until Mobile Verify succeeds on the exact latest PR #43 head containing report recovery + documentation commits.**

These historical CI failures are retained because they document why the final hashing implementation differs from the initial approach.

## 6. Physical tests required before Check field/release claims

### CHECK-P001 — Dedicated electronic Check on real vehicle
- create evaluation;
- connect real adapter through Check path;
- capability discovery;
- DTC capture;
- PID 01 capture;
- freeze-frame trigger capture if present;
- return to dossier;
- verify durable evidence.

State: **PENDING**.

### CHECK-P002 — Findings review from physical evidence
- generate only evidence-supported proposals;
- professionally review all proposals;
- verify no “healthy” conclusion is invented from empty/NO_DATA results.

State: **PENDING**.

### CHECK-P003 — Signed report + Android restart
- sign report;
- record version/hash;
- force-close/restart app;
- reopen same evaluation;
- verify same manifest/version/hash;
- integrity must show VERIFIED.

State: **PENDING**.

### CHECK-P004 — Physical partial-coverage truth
Deliberately leave one required evidence item unavailable/missing where safely possible.

Expected:
- report is PARTIAL/LIMITED;
- limitation survives signing/restart;
- no “full inspection” language appears.

State: **PENDING**.

### CHECK-P005 — Live telemetry promotion
- capture real idle Live window;
- promote explicitly as `IDLE` evidence;
- verify same vehicle and ECU sample provenance;
- repeat road window where purpose requires it.

State: **PENDING**.

### CHECK-P006 — Adapter interruption during Check evidence
Expected:
- failure/recovery semantics remain acquisition facts;
- failure does not become false `UNSUPPORTED` vehicle capability;
- only committed evidence enters the signed dossier.

State: **PENDING**.

## 7. Evidence rule

A green automated suite certifies implementation contracts only. It does not certify:

- physical vehicle compatibility;
- workshop suitability;
- legal inspection validity;
- report correctness on every car;
- qualified digital signature;
- universal Renault/ELM support.

Physical evidence enters the Mining Site first and becomes Golden only through explicit review/promotion.
