# AutoPulse V1 — Android Permission Contract

Status: **FROZEN FOR V1 INTERNAL CERTIFICATION**

The effective manifest of the exact built APK is authoritative. `app.json`, `AndroidManifest.xml`, package declarations, runtime prompts, and developer intent are supporting evidence only.

A permission is accepted into V1 only when it has:

1. a known owner;
2. a concrete V1 use case or an explicitly documented compatibility reason;
3. evidence in the exact APK manifest;
4. a CI rule preventing silent expansion of the permission surface.

## Required permissions

These permissions are required by the current V1 implementation and are enforced by the Android APK pipeline.

| Permission | Owner / capability | V1 justification |
| --- | --- | --- |
| `android.permission.BLUETOOTH` | Android / OBD transport | Legacy Android Bluetooth compatibility. |
| `android.permission.BLUETOOTH_ADMIN` | Android / OBD transport | Legacy Android Bluetooth compatibility. |
| `android.permission.BLUETOOTH_CONNECT` | BLE runtime | Connect to the validated BLE adapter lane on modern Android. |
| `android.permission.BLUETOOTH_SCAN` | BLE runtime | Discover the validated BLE adapter lane on modern Android. |
| `android.permission.ACCESS_COARSE_LOCATION` | `expo-location` / BLE compatibility | Foreground location capability used by the phone-sensor sidecar and older Android BLE requirements. |
| `android.permission.ACCESS_FINE_LOCATION` | `expo-location` | Foreground location, altitude and heading used by Off-Road phone sensors. |
| `android.permission.POST_NOTIFICATIONS` | Live foreground-service flow | Visible local notification while the current Live foreground service is active. This is not push messaging. |
| `android.permission.FOREGROUND_SERVICE` | `@supersami/rn-foreground-service` | Current Live screen starts/stops an Android foreground service during an active session. |
| `android.permission.WAKE_LOCK` | `@supersami/rn-foreground-service` | Declared by the foreground-service runtime dependency. Retained for this V1 candidate to avoid a lifecycle refactor before physical certification. |
| `android.permission.INTERNET` | Platform/network stack | Network-capable surfaces exist, while Live acquisition remains local-first and does not depend on cloud connectivity. |
| `android.permission.VIBRATE` | Live advisories | Haptic notification for driver/session advisories. |

Release-1 acquisition policy remains **foreground-only**. `RealLiveSessionController` interrupts an active recording with `APP_BACKGROUND` when the application leaves the active state. The current foreground service must not be interpreted as permission to claim background recording.

## Conditionally allowed permissions

These permissions may be present in the V1 APK but are not considered core AutoPulse capabilities.

| Permission | Current owner | Decision |
| --- | --- | --- |
| `android.permission.READ_EXTERNAL_STORAGE` | `expo-file-system` / media-file compatibility | Temporarily allowed for legacy Android compatibility. Do not remove until Garage/media-library behavior is validated on the oldest supported Android lane. |
| `android.permission.WRITE_EXTERNAL_STORAGE` | `expo-file-system` / media-file compatibility | Temporarily allowed for legacy Android compatibility. Same gate as above. |
| `android.permission.ACCESS_NETWORK_STATE` | ExoPlayer dependency chain | Allowed as dependency bookkeeping; it is not an AutoPulse evidence or acquisition capability. Candidate for removal when non-V1 AV/AI surfaces are pruned. |
| `com.em3rc0dth.autopulse.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Android/merged app manifest | App-internal receiver protection permission. No user prompt and no external data capability. |

`expo-file-system` is source-reachable from DB benchmark/internal tooling and the non-navigable Mechanic AI media path. Its legacy external-storage declarations are therefore not treated as proof that external storage is essential to Live V1.

## Explicitly forbidden in V1

The following permissions must not appear in the effective APK manifest. The Android manifest merge or dependency tree must block/remove them.

- `android.permission.CAMERA` — current V1 Garage flow selects existing media; no shipped V1 flow requires camera capture.
- `com.google.android.providers.gsf.permission.READ_GSERVICES` — inherited from SmartLocation; no AutoPulse V1 use case.
- `com.google.android.gms.permission.ACTIVITY_RECOGNITION` — inherited from SmartLocation; AutoPulse does not perform activity recognition or geofencing in V1.
- `android.permission.RECEIVE_BOOT_COMPLETED` — no boot-resident acquisition.
- `com.google.android.c2dm.permission.RECEIVE` — no FCM/C2DM push capability in V1.
- `android.permission.RECORD_AUDIO` — Mechanic Chat audio is not part of the current V1 navigation surface.
- vendor launcher/badge permissions — no badge-management capability in V1.

`expo-location@17.0.1` depends on `io.nlopez.smartlocation:library:3.3.3`. SmartLocation's generic manifest declares `READ_GSERVICES` and `ACTIVITY_RECOGNITION`, but current AutoPulse location usage is limited to foreground position/altitude/heading. AutoPulse therefore removes those permissions during manifest merge.

## Dependency ownership findings

Manifest-merger and source-reachability evidence established the following ownership:

- `FOREGROUND_SERVICE` / `WAKE_LOCK` → `@supersami/rn-foreground-service`.
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` → `expo-file-system` merged manifest.
- `ACCESS_NETWORK_STATE` → ExoPlayer dependency chain.
- `READ_GSERVICES` / `ACTIVITY_RECOGNITION` → `io.nlopez.smartlocation:library:3.3.3` pulled by `expo-location`.
- `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` → AutoPulse + `expo-location`; additional SDK-23 declarations may be contributed by the BLE stack.

## Runtime prompt rule

A user-visible Android permission prompt and an APK manifest declaration are different facts.

- A permission that does not display a prompt is not automatically harmless or justified.
- A runtime prompt does not prove that the owning dependency is necessary.
- Release review records both the effective manifest and the runtime behavior.

## CI enforcement

The PR Android APK workflow must:

1. build the standalone release-internal APK;
2. prove the React Native bundle is packaged;
3. dump permissions from that exact APK using Android build tools;
4. extract a normalized unique permission set;
5. fail if any permission is outside the V1 allowlist;
6. fail if any required permission is missing;
7. archive the effective permission dump, allowlist, required list, unexpected/missing reports, manifest-merger blame, Gradle runtime dependency graph and their hashes;
8. record `permissionContractPassed` and `apkPermissionsSha256` in the immutable artifact receipt.

The permission contract is not complete merely because source configuration looks correct. **Only a green build whose exact APK satisfies the effective-manifest gate may be used for V1 certification.**

## Change-control rule

Any future change that adds a permission must include, in the same PR:

- the owning dependency or native component;
- the exact product capability requiring it;
- an update to this contract;
- regenerated APK evidence;
- a green permission-contract gate.

No dependency is allowed to expand the Android permission surface silently.
