# ROAD TEST-001 — Logan field evidence reconciliation (2026-11-16)

**Decision: PRE-APK AUTOMATED VALIDATION ONLY.** No QA APK generation, new G1 pass, road GO, or `main` merge is authorized by this document.

## Input evidence

- User-supplied sanitized `autopulse-roadtest-20261018-132244968Z.json` from October 18, 2026.
- 24 screenshots in `autopulse imagenes 18_10 8_20am.pdf`, previously reviewed in the pilot conversation; the JSON is not raw ECU bytes.
- Previously generated QA APK: `71aac7781a0192dc15db66ae4a86b7005e4a8d53`, SHA-256 `a58ab05ceee7f6ce69305d595a179bdc5b89d1123902dfd582e2f7149cabd535`.

## Measured contrast

The export describes `COMPLETED`, 13/13 valid decoded blocks, 100/100 events, 100/100 readings, no integrity issues. However, the 80 eligible Mode 01 attempts (`010D`, `010C`, `0104`, `0111` at 20 each) all reported `SUCCESS` and **0** attributed valid responses/values. The other 20 samples include adapter evidence and must not become ECU PID `0142`; `0105` and `0142` had **0** eligible attempts. Do not interpret a zero-attempt PID as a failed decoder or a measured zero.

## Root cause in source

`RealTelemetryPoller` issues Mode 01 request `010C` with **expected response service `41`**, which `ObdAcquisitionMapper` persists as reading.service `41`; the Binary V3 mapper/codec preserves this as `41`. `RoadTestMetrics.matchingReadings()` incorrectly required **service `01`**, causing every valid reading to be excluded from observability despite being present in SQLite/Session Summary. The test fixtures previously used `01`, so automated checks did not reproduce production semantics.

## Patch scope

1. Accept ONLY ECU response service `41` for bounded Mode 01 response attribution; preserve exact PID, OBD2 origin, valid quality, finite number, safe timestamp and command SUCCESS requirements.
2. Count a successful attributed response only when its actual reading survives all gates; a SUCCESS with persistently decoded readings but none correlating is now `UNMATCHED_SUCCESS_READINGS` and degrades metrics trust rather than silently declaring `COMPLETE`.
3. Update real-V3/SQLite test fixtures to service `41` and add an October-Logan-shaped synthetic 100-event / 80-eligible regression, including adapter segregation and negative correlation tests. This is **representative synthetic replay**, not recovery of private raw ECU data.
4. No changed native Android code, polling requests, BLE transport, driver warnings, database migration or production signing. Prior QA APK retains its original SHA and its known metrics defect; this patch requires a **separately authorized and tested** future APK to change the installed runtime.

## Still open / not promoted to PASS

- `0105` absence is consistent with the bounded Live planner selecting the discovered signal subset rather than probing all six when any bounded signal is discovered. We have no frozen capability snapshot proving why `0105` was omitted in this exact run; **do not force an unadvertised thermal PID** or claim the underlying cause is closed.
- `BUS INIT: ERROR` initial connection and persistent STARTUP UI remain observations for targeted follow-up, not proved defects in the modified component.
- Physical Bluetooth recovery, Android TTS, foreground/background behavior, prolonged soak, and 2–5 min G1 stationary qualification have not been certified on the corrected future candidate.
- Automated PASS checks source invariants and replay/SQLite contracts only; physical GO remains HOLD.
