# AutoPulse Flight Recorder — Physical Debug Runbook

**Purpose:** correlate Android/runtime lifecycle with AutoPulse session, persistence and abnormal OBD transport events without adding raw ECU payloads to the structured trace.

## 1. What is recorded

Structured events are emitted with the prefix:

```text
[AUTOPULSE_TRACE]
```

Categories currently include:

- `FOREGROUND_SERVICE`
- `SESSION`
- `BLUETOOTH`
- `OBD_TRANSPORT`
- `PERSISTENCE`
- `CHECK`

The in-app recorder is a bounded ring buffer. The Android console mirror is the durable debugging path when ADB logcat is being captured.

The structured recorder intentionally does **not** store raw ELM responses, VIN, plate, GPS/location, route, tokens or payloads. Sensitive detail keys are redacted defensively.

Existing `DiagnosticsBuffer` remains the command-level OBD diagnostic buffer. Existing persisted telemetry remains the source for RoadTest metrics.

## 2. Capture setup

Before reproducing a physical issue:

```powershell
adb devices
adb logcat -c
adb logcat -v threadtime > autopulse-android.log
```

For a narrow live view in another PowerShell:

```powershell
adb logcat -v threadtime | Select-String "AUTOPULSE_TRACE|AndroidRuntime|ForegroundService|ReactNativeJS"
```

Do not clear app data or uninstall merely to collect logs.

## 3. Expected healthy sequence

A normal Live start should contain a sequence broadly like:

```text
SESSION START_REQUESTED
FOREGROUND_SERVICE START_REQUESTED
FOREGROUND_SERVICE STARTED
SESSION RECORDING_STARTED
...
SESSION TERMINALIZATION_STARTED
FOREGROUND_SERVICE STOP_REQUESTED
FOREGROUND_SERVICE STOPPED
SESSION COMPLETED
```

Exact timestamps and unrelated Android messages will differ.

## 4. Foreground-service failure

Look for:

```text
FOREGROUND_SERVICE FAILURE
SESSION FOREGROUND_SERVICE_UNAVAILABLE
SESSION TERMINALIZATION_STARTED
SESSION INTERRUPTED
```

Correlate the same timestamp with Android native logcat. The AutoPulse trace identifies the application state transition; native logcat remains authoritative for Android service exceptions.

## 5. Transport recovery

Expected recoverable path:

```text
BLUETOOTH DEVICE_DISCONNECTED
or
OBD_TRANSPORT TRANSPORT_STALLED

SESSION RECOVERY_STARTED
SESSION RECOVERY_ATTEMPT
...
SESSION RECOVERY_SUCCEEDED
```

Exhaustion:

```text
SESSION RECOVERY_EXHAUSTED
SESSION TERMINALIZATION_STARTED
SESSION INTERRUPTED
```

A recovery event does not imply that missing telemetry was reconstructed. Gaps must remain gaps.

## 6. Persistence failure

Relevant events:

```text
PERSISTENCE COMMIT_RETRY
PERSISTENCE COMMIT_FAILED
PERSISTENCE COMMIT_EXCEPTION
PERSISTENCE BACKPRESSURE_OVERFLOW
PERSISTENCE DRAIN_TIMEOUT
SESSION INTERRUPTED
```

Correlate these with the durable session/History result. Never treat a visible Live screen as proof that persistence succeeded.

## 7. OBD transport anomalies

The flight recorder logs abnormal command outcomes such as timeout, disconnect, write failure, invalid response or ELM error.

Normal successful polling is not duplicated into the recorder. `NO_DATA` is also not treated as a transport anomaly by itself.

For command-by-command detail, use existing Diagnostics logs/DiagnosticsBuffer and persisted telemetry.

## 8. Evidence handling

For a physical certification run retain:

- exact APK SHA-256 / matching receipt;
- full local logcat file;
- relevant sanitized `AUTOPULSE_TRACE` excerpt;
- session/check identifiers;
- screenshots/video only when they support visible behavior;
- hashes for evidence files used in a formal receipt.

Do not commit raw private logs blindly. Inspect/sanitize before source-control publication.

## 9. Interpretation rule

```text
AUTOPULSE_TRACE
= application structured state evidence

ADB LOGCAT
= Android/native runtime evidence

DIAGNOSTICS BUFFER
= command/pipeline evidence

SQLITE / SESSION SUMMARY
= durable persisted evidence
```

A strong diagnosis correlates these layers by timestamp rather than trusting one source in isolation.


## 10. Check observability

The Check path emits structured events for:

```text
CHECK COMMAND_STARTED
CHECK COMMAND_COMPLETED
CHECK COMMAND_FAILED
CHECK REPORT_SEALED
CHECK REPORT_REOPEN_VERIFIED
CHECK REPORT_INTEGRITY_MISMATCH
```

These events intentionally omit raw diagnostic payloads. The immutable Check report remains the evidence authority for diagnostic content; the flight recorder exists to correlate execution and integrity lifecycle with Android/runtime logs.
