# AutoPulse V1 — Android permission scope

This file is part of the release contract. The effective manifest of the built APK is authoritative; `app.json` or the source manifest alone are not sufficient evidence.

## Required / justified for the current V1 lane

- `android.permission.BLUETOOTH` / `BLUETOOTH_ADMIN` on legacy Android versions.
- `android.permission.BLUETOOTH_CONNECT` and `BLUETOOTH_SCAN` for the validated BLE adapter lane.
- foreground coarse/fine location only for the Off-Road phone-sensor sidecar and Android BLE compatibility where required. AutoPulse must not open a new permission dialog while an active Live ECU session is running.
- `android.permission.INTERNET` as platform/network capability; Live V1 remains local-first and does not treat cloud connectivity as a recording dependency.
- `android.permission.VIBRATE` for haptic driver advisories.
- non-dangerous platform bookkeeping permissions may remain only when their owning dependency is part of the shipped V1 runtime and their purpose is documented by the effective-manifest review.

## Not required by current V1 product behavior

The following must not be present merely because an unused native dependency contributes them:

- `android.permission.CAMERA`;
- legacy `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`;
- `android.permission.FOREGROUND_SERVICE` (V1 does not claim background recording);
- `android.permission.RECEIVE_BOOT_COMPLETED`;
- `android.permission.POST_NOTIFICATIONS` unless a real V1 notification feature is implemented and tested;
- FCM/C2DM receive permission when push messaging is not a V1 capability;
- launcher badge vendor permissions when notifications/badges are not a V1 capability.

`WAKE_LOCK` and `ACTIVITY_RECOGNITION` require explicit dependency ownership and a V1 use case before they may be accepted.

## Runtime-prompt rule

A user-visible Android permission prompt and an APK manifest declaration are different facts. Release review records both. A permission that does not display a prompt is not automatically harmless or justified.

## Release evidence

The Android APK pipeline must archive the effective permission dump produced from the exact built APK. Permission cleanup is accepted only when the rebuilt artifact demonstrates the expected reduction and all functional/DB/OBD tests still pass.
