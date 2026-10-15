# AutoPulse local internal Android APK — 2026-10-15

This process produces an **internal QA APK** with a fully embedded Expo/React Native JS bundle. The Expo entrypoint is `mobile-app/index.js`, which registers the native foreground service before the React Native root component. It must not be published on Google Play or represented as physically certified.

## Prerequisites

- Clone or switch to the hardened AutoPulse branch.
- Node.js 22 LTS, JDK 17, Android SDK API 36, Android SDK build-tools and NDK required by android/build.gradle, Gradle wrapper included in repository.
- Set ANDROID_HOME to the Android SDK folder.
- Download `autopulse_icon_assets_approved.zip` from the approved conversation artifact, extract it outside the repo (contains `mobile-app/assets` and native Android `mipmap-*` icons). Do not regenerate or substitute these images.

## Steps

From `mobile-app/`:

```bash
npm run icon:apply -- --source /absolute/path/to/autopulse_icon_ready
npm run apk:check
npm run apk:internal
```

On Windows PowerShell replace the Unix absolute path with the corresponding Windows path. `apk:check` is a preflight and does not install dependencies. `apk:internal` runs `npm ci`, TypeScript and Jest verification, then `gradlew :app:assembleRelease` with `AUTOPULSE_INTERNAL_RELEASE=true`.

APK: `mobile-app/dist/autopulse-internal-<sha-prefix>.apk` alongside JSON provenance (SHA-256). The build **fails closed** if the approved artwork is absent or modified. No GitHub Actions or remote build service is used.

## Hard stops

- If npm dependencies cannot be retrieved or npm verify fails, no release certification can be claimed.
- If Android SDK API 36, Java or Gradle dependencies are missing, install them locally; do not enable GitHub Actions as a workaround.
- A green build is not proof of safety. Stationary checks and physical vehicle certification remain mandatory before a driving pilot.
- Do not use internal debug signing for Google Play production releases. Production AAB signing follows the separate production release contract.
- The approved image binaries are **not yet committed to GitHub**; this script loads them from the approved artifact and validates hashes before compilation.
