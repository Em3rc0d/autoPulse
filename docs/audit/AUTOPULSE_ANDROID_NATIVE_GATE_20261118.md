# AutoPulse — Android native and release integration audit (2026-11-18)

**Status:** G0 SOURCE / automated tests PASS after code fix; **G1 HOLD**, G2 NO-GO until Android physical retest. This report does **not** certify all possible runtime paths or all vehicle models.

## Inputs and evidence
- Repository: `Em3rc0d/autoPulse`, PR #98, branch `fix/rc005-g0-blockers-20261117`.
- Baseline after physical report: `0082beed153767b1b48558231877ab8a83435b14`; G1 screenshot reported `SESSION INTERRUPTED / FOREGROUND_SERVICE_START_FAILED` and `TELEMETRY LOST`.
- Prior physical artifact SHA-256 `e3448f389a73de143ab733f0d566ea4b8dc9ef068dd65e804b69037cf02678cd` (built from earlier JS source): **not** validated for driving.
- Automated source test at baseline: 139/139 Jest suites, 726 PASS, 2 skipped; TypeScript PASS. Previous Android native build succeeded with 907 Gradle tasks, but it did **not** validate the foreground service starting on a device.
- Inventory at baseline: 460 `mobile-app/src` TS/TSX files, 139 test suites; 20 tracked Android Java/Kotlin/manifest/build files. Number of tests is not coverage percentage.
- No local Android SDK/networked npm cache is available in the assistant runtime; **cannot run device E2E/Gradle locally**. CI may verify TypeScript/Jest; APK compilation remains on authorized Windows machine. Do not use GitHub Actions for APK generation by default.

## Verified root cause — P1
- `LiveForegroundService.start()` originally omitted `ServiceType` from `@supersami/rn-foreground-service`.
- Installed dependency's Java native module rejects the config when `ServiceType` is absent; Android manifest correctly declares `connectedDevice`.
- Fixed by explicitly passing `ServiceType: 'connectedDevice'`, with a type-safe contract and Jest regression.
- Add static *installed dependency* contract tests covering package JS + native Java + Android manifest + application registration, because Jest mocks hid the mismatch. No claim of real-device PASS yet.

## Further pre-release fault prevention
- Gemini: `EXPO_PUBLIC_GEMINI_API_KEY` was set during earlier user's local build. Any Expo client-exposed credential is unsafe for distribution; app's `aiService.ts` refers to it, even though `MechanicChatScreen` is not a registered main navigation screen. Its presence in the actual binary has not been proved or disproved. Treat old APK as private-only; do not share. Rotate actual exposed credentials as appropriate.
- Local builder and Android workflows now reject nonempty `EXPO_PUBLIC_GEMINI_API_KEY` from process environment or Expo production dotenv sources **before packaging**. Tests assert detection and no values in errors.
- Existing Android manifest allows Bluetooth scan/connect + `FOREGROUND_SERVICE_CONNECTED_DEVICE` and current release APK reported 16 effective permissions within policy, but only a real device can establish that Android grants permission and allows service start.
- `RealLiveSessionController`: fail-closed interruption upon foreground failure; subscription cleanup, BLE lease protection, bounded recovery, persistence and SQLite paths have automated tests.
- Check: current bounded planner and executor prohibit mutating Mode 04/08 and enforce canonical descriptor/read-only transport. Existing parser/replay/physical transport tests exercise bounded semantics, not all possible ECUs.
- UI: screenshot shows fail-safe interruption rather than fabricated healthy data; this is only UI evidence, not proof of ECU acquisition correctness.
- Physical proof missing: device OS/version, notification permission and FGS lifecycle, BLE real adapter/ECU sample, lock/unlock and manufacturer battery policy, 2–5-minute stored session, real Check report, Android SAF export, and G2 telemetry/motion.

## Release gates and what each proves
| Gate | Status | Evidence and limitation |
| --- | --- | --- |
| TypeScript and Jest | PASS at baseline, rerun for changed HEAD | Does not call native Android APIs |
| Installed package ABI contract | Added | Source-level check for required FGS config; not runtime |
| Native Kotlin/Gradle | Prior build PASS, not yet rerun on the final JS changes | Same Android native source as prior compiled APK |
| Android package signature / permissions / bundle | PASS for previous artifact only | Not transferable to a future SHA |
| Client-secret packaging | New fail-closed gate; CI to validate | Does not prove no other secret or code exposure exists |
| Security advisories | Last reported 0 critical, 48 high, 15 moderate, 1 low for production tree | Fresh audit and reachability review still required for public release |
| G1 parked | FAIL on old APK; RETEST REQUIRED | Blocking FGS start |
| G2 driving | NO-GO | No motion trial before G1 PASS |
| Public Play Store | NO-GO | No public threat model/signing/dependency/physical certification |

## Rule for subsequent builds
Do **not** loop APKs without preflight. Require CI green on the final code, `npm run apk:check` (now also checks for client-readable Gemini credential), no critical production vulnerabilities, clean native contract tests, and an explicit QA build decision. After generating one artifact, record its commit+SHA-256, verify signature/bundle/permissions, then G1 parked and only G2 if G1 passes. Keep troubleshooting logs local and redact raw ELM/VIN/routes/secrets before external sharing.

## Open limitations
Testing all source paths with Jest does not equate to 100% code coverage or proof on Android. No smartphone, BLE ELM327 or live vehicle is attached to this environment, so native lifecycle and true ECU evidence remain outside automated certification. A real Android smoke test is indispensable; untested paths must remain OPEN.

## Follow-up — OBD negotiation repair (2026-11-18)

- A raw response (including a negative response) without a valid `41 00` bitmap no longer terminates protocol fallback. A decoded bitmap from a valid correlated frame is required.
- Mode 01 discovery/probes now explicitly carry `expectedPid` to the transport parser.
- Exhausting the forced protocols restores `ATSP0` before direct signal probes. The first such probe has a 15-second search budget rather than the normal 4 seconds.
- Successful direct-signal recovery clears the earlier capability-discovery failure and refreshes protocol evidence when absent.
- Regression tests cover raw responses without a bitmap, incomplete frames, bounded fallback, restored automatic protocol and per-request PID/time budgets.
- Final local verification: TypeScript PASS; Jest 142/142 suites, 735 passed, 2 skipped. `git diff --check` PASS.
- `npm run apk:check`: BLOCKED because Android SDK `platforms/android-36` is absent. No APK was generated and no Actions APK build was requested. Physical adapter/ECU interoperability remains unverified. These changes address reproducible source defects; they do not establish the cause of Car Scanner failing on the same vehicle.

## Physical retest follow-up — artifact 25cb46a3a8a6 (2026-11-18)

User screenshots show repeated `FOREGROUND_SERVICE_NATIVE_ERROR` in Live, and a later initialization failure `NO_VALID_MODE_01_CAPABILITY_BITMAP`. Check separately displays KWP, coolant/RPM/speed and an inconclusive capability map. This does not establish the correctness of every Check value (raw frames were not provided), but contradicts a blanket claim that no ECU path exists.

### Confirmed native dependency defect

Installed `@supersami/rn-foreground-service@2.2.5` maps `connectedDevice` to literal 32 in both native dispatchers. This is the media-projection type, not the connected-device type declared by the application. Replace both with `android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE` via a versioned patch-package patch. Prior static tests only checked that the string case existed and missed the wrong return value. New regression requires the SDK constant in both dispatchers. Patch application verified using the installed patch-package executable. Real-device startup remains pending; no Android SDK is available here.

### Acquisition correction

Before abandoning any candidate protocol whose 0100 bitmap is unavailable, try a bounded, correlated RPM request. If directly decoded RPM proves a path, preserve that protocol, refresh its identity, and continue the existing bounded core-signal probes. Do not require a capability bitmap as the sole proof of communication. All failed candidates remain bounded and do not manufacture supported PIDs. Added a KWP regression with no bitmap but a valid RPM reply. This is a source-level repair, not proof of the exact cause of the user's bitmap failure.

G1 remains FAIL for the tested artifact. G2/public release remain unvalidated. A native rebuild is necessary for the Java dependency patch; a JavaScript-only update cannot carry it.

Validation after both repairs: TypeScript PASS; Jest 142/142 suites, 737 PASS, 2 skipped; patch-package applies both project patches successfully; git diff --check PASS. No device test or native build was executed in this environment.
