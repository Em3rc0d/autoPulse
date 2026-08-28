# AutoPulse Check — Golden Contract Dataset V1

Status: **contract golden cases only; physical Check golden cases pending**.

These fixtures protect semantic truth. They do not prove a specific physical vehicle supports a service.

## GD-CHECK-001 — Unknown is not supported
Input:
- readiness capability = UNKNOWN.
Expected:
- readiness step = UNKNOWN;
- report cannot say readiness PASS.

## GD-CHECK-002 — Unsupported stays visible
Input:
- freeze-frame capability = UNSUPPORTED.
Expected:
- freeze-frame step = UNAVAILABLE;
- limitation preserved.

## GD-CHECK-003 — Supported freeze frame may still be absent
Input:
- freeze-frame capability = SUPPORTED.
Expected:
- step = CONDITIONAL;
- capability alone cannot claim a frame was captured.

## GD-CHECK-004 — Cross-vehicle evidence rejected
Input:
- evaluation vehicle A;
- Live session vehicle B.
Expected:
- promotion fails with vehicle mismatch.

## GD-CHECK-005 — No ECU sample means no ECU evidence
Input:
- validEcuSampleCount = 0.
Expected:
- promotion rejected.

## GD-CHECK-006 — Recovery gap is not synthetic telemetry
Input:
- valid Live ECU window;
- connectionRecoveryCount > 0;
- telemetryGapMs > 0.
Expected:
- promotion succeeds if other gates pass;
- gap metadata retained;
- `synthesizedTelemetry = false`.

## GD-CHECK-007 — Signed evidence boundary
Input:
- evaluation state SIGNED;
- new Live evidence request.
Expected:
- rejected.

## GD-CHECK-008 — System cannot author professional conclusion
Input:
- claim = PROFESSIONAL_CONCLUSION;
- author = SYSTEM.
Expected:
- rejected.

## GD-CHECK-009 — System finding remains reviewable
Input:
- claim = FINDING;
- author = SYSTEM.
Expected:
- allowed as SYSTEM_RULE finding;
- not promoted to professional conclusion.

## Physical candidates — not golden yet

The following require real Check workflow receipts before promotion:
- Logan preventive Check;
- Duster preventive Check;
- DTC capture;
- readiness capture;
- freeze-frame capture/absence semantics;
- adapter recovery during Check evidence capture;
- signed report reconstruction.
