# AutoPulse Check — Test Ledger

## Automated foundation fixtures

### CHECK-T001 — Unsupported/unknown coverage stays explicit
Expected:
- supported DTC step => AVAILABLE;
- unknown readiness => UNKNOWN;
- unsupported freeze frame => UNAVAILABLE;
- limitations are emitted.

### CHECK-T002 — Purpose changes evidence requirements
Expected:
- PRE_PURCHASE requires ROAD_TELEMETRY;
- PREVENTIVE may keep road evidence optional.

### CHECK-T003 — Freeze-frame capability is conditional
Expected:
- supported freeze-frame capability does not imply that an applicable frame exists.

### CHECK-T004 — Same-vehicle evidence only
Expected:
- Live telemetry from vehicle B cannot enter evaluation for vehicle A.

### CHECK-T005 — ECU-origin requirement
Expected:
- zero valid ECU samples rejects promotion;
- adapter/phone-only data cannot satisfy this gate.

### CHECK-T006 — Evidence gap truth
Expected:
- recovery count and telemetry gap are persisted in metadata;
- `synthesizedTelemetry` remains false.

### CHECK-T007 — Signed evaluation immutability
Expected:
- evidence promotion is rejected after SIGNED.

### CHECK-T008 — Evaluation lifecycle authority
Expected:
- illegal DRAFT -> SIGNED transition fails;
- DRAFT -> OPEN succeeds through existing state machine.

### CHECK-T009 — Professional conclusion authority
Expected:
- SYSTEM professional conclusion rejected;
- technician conclusion allowed;
- system deterministic finding remains reviewable SYSTEM_RULE.

## Persistence tests to complete before C3 PASS

Required:
- migration 0008 on clean product database;
- migration 0008 on existing database through 0007;
- create/reload evaluation;
- transition/reload while purpose remains stable;
- append/reload Live evidence;
- exact time window and metadata round-trip;
- process restart durability.

## Physical tests to complete before Check release claims

- create an evaluation against a real vehicle;
- capability discovery snapshot;
- idle evidence capture and promotion;
- road evidence capture and promotion;
- adapter recovery inside a promoted window;
- deliberate unsupported/unknown step;
- app process restart and evaluation reopen;
- final report reconstruction.

## Evidence rule

A green automated suite certifies implementation contracts only. It does not certify vehicle compatibility, workshop suitability, or report correctness on a physical car.