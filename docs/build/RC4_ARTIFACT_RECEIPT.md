# RC4 CI Artifact Receipt

**Purpose:** freeze the exact Android binary to be used for Q-003 Duster physical validation.

## Source

- Repository: `Em3rc0d/autoPulse`
- PR: #37 — `fix(rc4): isolate Off-Road phone sensors from ECU acquisition`
- Branch: `fix/rc4-offroad-sidecar-isolation-20260824`
- Commit: `4f463a0925cc069b5e835a430132da9e9b9ab092`
- Android workflow: `AutoPulse Android APK PR Build`
- Workflow run ID: `32801577080`
- Workflow result: **SUCCESS**
- Mobile Verify result for same head: **SUCCESS**

## GitHub artifact

- Artifact ID: `9546933827`
- Artifact name: `autopulse-android-internal-apk`
- Artifact size: `47,154,597` bytes (archive metadata)
- Artifact created: `2026-08-25T02:41:54Z`
- Artifact archive digest: `sha256:7aec6c135a972bf4e76b70f4b0ed170ce11fdf581a2a115a2bd75d24edc87015`
- Extracted member: `app-release.apk`
- Extracted APK size: `90,086,045` bytes
- Extracted APK SHA-256: `437181487c0591e3083364accf1e38129af219b1a90227c8612026fbee4ee493`

## Test-target rule

Q-003 should use this exact APK unless PR #37 changes before the physical run.

If any source change is added after `4f463a09…`:

1. do not reuse this receipt as the target;
2. wait for new Mobile Verify + APK build;
3. record the new artifact ID/archive digest/APK SHA-256;
4. update Q-003 build metadata;
5. test only the new exact artifact.

## What this receipt proves

- source head compiled through the Android PR workflow;
- automated verification completed successfully;
- a standalone APK artifact was produced;
- the exact artifact identity is reproducible/verifiable.

## What this receipt does not prove

- Off-Road physical stability;
- Duster compatibility beyond prior RC3 evidence;
- BLE unplug behavior;
- abrupt process-kill recovery;
- public release readiness.

Those require physical and release-gate receipts.
