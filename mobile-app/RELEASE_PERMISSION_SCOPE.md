# AutoPulse V1 — Android permission scope

This file is part of the release contract. The effective manifest of the built APK is authoritative; `app.json` or the source manifest alone are not sufficient evidence.

## Required / justified for the current V1 lane

- `android.permission.BLUETOOTH` / `BLUETOOTH_ADMIN` on legacy Android versions.
- `android.permission.BLUETOOTH_CONNECT` and `BLUETOOTH_SCAN` for the validated BLE adapter lane.
- foreground coarse/fine location for the Off-Road phone-sensor sidecar and Android BLE compatibility where required. AutoPulse must not open a new location permission dialog while an active Live ECU session is running.
- `android.permission.POST_NOTIFICATIONS` because the current Live screen starts a visible Android foreground service while the session is active. This is a local session notification, not push messaging.
- `android.permission.FOREGROUND_SERVICE` for that active Live-session service. V1 remains foreground-only at the product/session-policy level; this permission does not upgrade AutoPulse into background recording.
- `android.permission.WAKE_LOCK` for foreground-session/keep-awake behavior.
- `android.permission.INTERNET` as platform/network capability; Live V1 remains local-first and does not treat cloud connectivity as a recording dependency.
- `android.permission.VIBRATE` for haptic driver advisories.
- media-library access needed by Garage document-photo attachment and the current Mechanic Chat image attachment flow. Legacy storage permissions may remain only where the supported Android version actually requires them and must be reviewed from the built APK.

## Not required by current V1 product behavior

The following must not be present merely because an unused native dependency contributes them:

- `android.permission.CAMERA`: current image flows open the media library; they do not capture a photo from the camera, so the app manifest explicitly removes this merged permission.
- `android.permission.RECEIVE_BOOT_COMPLETED`: V1 does not restart acquisition on boot.
- FCM/C2DM receive permission: push messaging is not a current V1 capability.
- launcher badge vendor permissions: push/local badge management is not a current V1 capability.

`ACTIVITY_RECOGNITION` requires explicit dependency ownership and a V1 use case before it may be accepted. Legacy `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` remain under review because the current media-library flows support older Android versions; they must not be removed solely for cosmetic manifest reduction without compatibility evidence.

## Dependency ownership

- `@supersami/rn-foreground-service` is a runtime dependency because `LiveSessionScreen` starts/stops it directly.
- `expo-image-picker` is a runtime dependency because Garage and Mechanic Chat open the system media library.
- `expo-notifications` is not required: AutoPulse requests `POST_NOTIFICATIONS` directly for the Live foreground-service notification and does not currently use Expo push/local-notification APIs.

## Runtime-prompt rule

A user-visible Android permission prompt and an APK manifest declaration are different facts. Release review records both. A permission that does not display a prompt is not automatically harmless or justified.

## Release evidence

The Android APK pipeline must archive the effective permission dump produced from the exact built APK. Permission cleanup is accepted only when the rebuilt artifact demonstrates the expected reduction and all functional/DB/OBD tests still pass.
