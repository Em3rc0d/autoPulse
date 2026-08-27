# RC5 Physical Certification Receipt

**Status:** PRECOMMITTED — NOT EXECUTED  
**Purpose:** close AutoPulse Live V1 physical claims against one exact frozen internal artifact.  
**Authority:** acceptance semantics are defined by `AUTOPULSE_V1_VALIDATION_PROTOCOL.md`. Results must not redefine these criteria after execution.

## 1. Frozen A3 artifact identity

| Field | Value |
|---|---|
| Repository | `Em3rc0d/autoPulse` |
| PR | `#39` |
| PR head SHA | `f7cd24ee9e8ccca695e0899020f7913668e1a525` |
| PR base SHA | `ee37f77e23eeb05a0f9fa93fcd235d32b495f2ed` |
| CI-tested PR merge SHA | `abbf795d9043c365db4272cf1aae29d2321bb690` |
| Mobile Verify run | `33126179765` — SUCCESS |
| Android APK run | `33126179846` — SUCCESS |
| Actions artifact ID | `9668722732` |
| Actions ZIP digest | `sha256:89a4b19e40e6890dbc237d41ff092977da5dbbb668a989265809b759c7ec62e3` |
| APK file | `app-release.apk` |
| APK size | `90088723` bytes |
| APK SHA-256 | `cfb3e75de9b2db4eacbe9a50f39133b741915cfe3f6ad3eefcb2ef6d11fc4434` |
| Standalone JS bundle check | PASS |
| Intended assurance before this receipt | A3 internal artifact only |

**Hard rule:** if the installed APK SHA-256 differs, stop. The run is `BLOCKED_WRONG_ARTIFACT` and cannot certify RC5.

## 2. Physical tuple — fill before execution

```text
receiptId:
executedAtUtc:
operatorRole:
vehicleMake:
vehicleModel:
vehicleYear:
vehicleIdentifierSanitized:
adapterMakeModel:
adapterFingerprint:
transport: BLE
androidDeviceModel:
androidVersion:
autoPulseVersion: 1.0.0
apkSha256: cfb3e75de9b2db4eacbe9a50f39133b741915cfe3f6ad3eefcb2ef6d11fc4434
sessionId:
observedProtocol:
firstEcuSampleAt:
```

Do not place VIN, account identifiers, private signed URLs, exact personal location, or unrelated private metadata in the public repository receipt.

## 3. Safety boundary

- AutoPulse V1 validation is read-only relative to the ECU.
- No DTC clear, actuator command, ECU reset or destructive/write service is part of this receipt.
- App interaction and connection-recovery exercises must be performed while the vehicle is stationary.
- If a separate test requires vehicle motion, a licensed adult driver must operate the vehicle legally while a separate operator/passenger observes; the driver must not interact with the phone.

## 4. Precommitted test results

Allowed result values: `PASS`, `FAIL`, `BLOCKED`, `NOT_EXECUTED`.

### V1-P01 — First ECU truth gate

**Result:** `NOT_EXECUTED`

PASS only if Live does not become ECU-live until at least one valid ECU-origin sample is decoded.

Evidence to attach:
- initialization state reference;
- first valid ECU-origin observation timestamp;
- session/persistence reference.

Notes:

### V1-P02 — Healthy baseline acquisition

**Result:** `NOT_EXECUTED`

PASS only if supported Tier-1 signals produce real valid samples and missing signals remain unavailable rather than becoming synthetic zero.

Observed signals:

```text
RPM:
Vehicle speed:
Coolant:
ECU voltage:
Adapter voltage:
Other:
```

Notes:

### V1-P03 — Driver-mode continuity

**Result:** `NOT_EXECUTED`

Sequence under observation: `Essential → Performance → Off-Road → non-Off-Road`.

PASS only if ECU acquisition remains alive, Off-Road does not launch a permission prompt during ACTIVE Live, and phone-sensor evidence never replaces ECU evidence.

Notes:

### V1-P04 — Clean user Stop semantics

**Result:** `NOT_EXECUTED`

PASS only if a healthy `COMPLETED / USER_INITIATED` session reconstructs as `COMPLETE` when the expected final short flush is the only partial block.

Summary integrity:

Notes:

### V1-P05A — Bounded transport recovery succeeds

**Result:** `NOT_EXECUTED`

Execute stationary.

PASS only if an induced transport interruption:
1. enters explicit recovering state;
2. keeps the same session;
3. preserves already committed evidence;
4. performs bounded retries;
5. resumes only after adapter/vehicle path is re-proven;
6. does not fabricate samples for the missing interval.

Session ID before:

Session ID after:

Recovery evidence:

Notes:

### V1-P05B — Recovery exhaustion is explicit

**Result:** `NOT_EXECUTED`

Execute stationary.

PASS only if exhaustion produces exactly one explicit terminal `<reason>_RECOVERY_FAILED` outcome and previously committed evidence remains reconstructable.

Notes:

### V1-P06 — `NO_DATA` is not transport loss

**Result:** `NOT_EXECUTED`

Automated regression exists; physical observation may strengthen but does not broaden the claim.

PASS only if `NO_DATA` affects PID availability/retirement without independently triggering transport recovery.

Notes:

### V1-P07 — STALE truth

**Result:** `NOT_EXECUTED`

Automated regression exists; visual confirmation may strengthen presentation evidence.

PASS only if expired telemetry is explicitly stale and the old numeric sample is not represented as a current value.

Notes:

### V1-P08 — Foreground/background policy

**Result:** `NOT_EXECUTED`

PASS only if leaving foreground during active V1 acquisition creates the documented interruption outcome and preserves already committed evidence. V1 must not appear to continue background recording.

Notes:

### V1-P09 — Process-loss reconciliation

**Result:** `NOT_EXECUTED`

PASS only if the next launch reconciles an orphaned active session from durable SQLite/telemetry evidence and does not misrepresent it as a clean uninterrupted completion.

Notes:

## 5. Evidence manifest

Every attached evidence object gets its own content hash.

| Evidence ID | Class | SHA-256 | Private/Public | What it supports |
|---|---|---|---|---|
| | | | | |

Allowed classes include:
- `RAW_VEHICLE_CAPTURE`
- `PERSISTED_SESSION_RECORD`
- `SCREENSHOT_OBSERVATION`
- `APK_ARTIFACT`
- `CI_RECEIPT`
- `TEST_OPERATOR_NOTE`

A copied screenshot with an already-recorded content hash is the same evidence object, not an additional observation.

## 6. Final verdict

```text
artifactIdentityVerified: NOT_EXECUTED
physicalTupleComplete: NOT_EXECUTED
requiredEvidenceComplete: NOT_EXECUTED
P01:
P02:
P03:
P04:
P05A:
P05B:
P06:
P07:
P08:
P09:
overall: NOT_EXECUTED
limitations:
```

### Verdict rule

- `PASS`: every mandatory physical case for the claimed V1 scope passes and required evidence exists.
- `FAIL`: at least one mandatory exercised criterion contradicts the acceptance rule.
- `BLOCKED`: required evidence or precondition is missing; never equivalent to PASS.

This receipt can establish A4 evidence only for the exact tuple recorded above. It cannot establish universal vehicle, adapter, Android, manufacturer or protocol compatibility.
