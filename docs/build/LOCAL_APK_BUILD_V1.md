# AutoPulse local internal Android APK — 2026-10-15

This process produces an **internal QA APK** with a fully embedded Expo/React Native JS bundle. The Expo entrypoint is `mobile-app/index.js`, which registers the native foreground service before the React Native root component. It must not be published on Google Play or represented as physically certified.

## Prerequisites

- Clone or switch to the hardened AutoPulse branch.
- Node.js 22 LTS, JDK 17, Android SDK API 36, Android SDK build-tools and NDK required by android/build.gradle, Gradle wrapper included in repository.
- Set ANDROID_HOME to the Android SDK folder.
- The exact approved `mobile-app/assets/approved-icon-assets.zip` is versioned in Git and its SHA-256 plus each extracted PNG SHA-256 is checked at build time. Nothing is fetched from external image services.

## Steps

From `mobile-app/`:

```bash
npm run icon:install
npm run apk:check
npm run apk:internal
```

A certification-candidate build now fails closed when the Git working tree contains tracked or untracked changes. Commit/stash first. `--allow-dirty` exists only for explicitly non-certifiable internal builds; its receipt records `certificationEligible: false`.

On Windows PowerShell replace the Unix absolute path with the corresponding Windows path. `apk:check` is a preflight and does not install dependencies. `apk:internal` runs `npm ci`, TypeScript and Jest verification, then `gradlew :app:assembleRelease` with `AUTOPULSE_INTERNAL_RELEASE=true`.

APK: `mobile-app/dist/autopulse-internal-<sha-prefix>.apk` alongside JSON provenance. The receipt records the APK SHA-256, source commit, source branch, clean/dirty source state, package-lock SHA-256, permission surface and certification eligibility. The build **fails closed** if the approved artwork is absent or modified. No GitHub Actions or remote build service is used.

## Hard stops

- If npm dependencies cannot be retrieved or npm verify fails, no release certification can be claimed.
- If Android SDK API 36, Java or Gradle dependencies are missing, install them locally; do not enable GitHub Actions as a workaround.
- A green build is not proof of safety. Stationary checks and physical vehicle certification remain mandatory before a driving pilot.
- Do not use internal debug signing for Google Play production releases. Production AAB signing follows the separate production release contract.
- The approved image archive is **committed as an exact Git blob**. The installer unpacks and verifies all Expo/Android icon assets before Gradle or APK signing.


## Verify the APK actually installed on the Android device

With exactly one authorized device connected through ADB:

```bash
npm run apk:identify
```

The verifier:

1. resolves `com.em3rc0dth.autopulse` on the connected device;
2. pulls the installed base APK to a temporary local path;
3. computes its SHA-256;
4. compares it against `dist/*.apk.json`;
5. reports the linked source commit/branch;
6. fails when the artifact is unknown or only has a non-certifiable receipt.

A screenshot, filename, version label, or recollection of which APK was installed is not accepted as artifact identity.

For an existing APK inspected with `--verify-only`, the script can verify the binary itself but cannot reconstruct source provenance; use the original build receipt.
