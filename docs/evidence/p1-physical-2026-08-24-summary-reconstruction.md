# P1 physical lifecycle evidence — 2026-08-24

Vehicle: Renault Logan 2014
Build family: P1 RC after PR #30 merge

Observed on physical Android device:

- BLE adapter connected.
- ELM327 identified.
- Adapter configuration completed.
- Vehicle protocol detection completed.
- Supported-signal discovery completed.
- Real ECU-origin data reached Live and promoted the session to `LIVE · ECU DATA`.
- Off-Road vehicle-relative calibration was active and produced pitch/roll/altitude/heading observations.
- Foreground-only policy visibly terminalized a session as `SESSION INTERRUPTED` with `APP_BACKGROUND` provenance.
- History persisted both an `INTERRUPTED / APP_BACKGROUND` session and a separate `COMPLETED / USER_INITIATED` session, including durable block and reading counts.
- Reconstructed Session Summary failed at runtime with `Property 'TextDecoder' doesn't exist`.

Interpretation:

The physical receipts prove ECU Live truth, Off-Road calibrated sensor presentation, background interruption provenance, and durable History persistence. They do **not** yet certify Session Summary reconstruction because Android/Hermes lacks the browser `TextDecoder` global assumed by `BinaryObd2V3Codec`.

Follow-up defect: `fix/android-textdecoder-summary-20260824` installs a portable UTF-8 encoding fallback before app modules load and includes a Hermes-style missing-global regression test.
