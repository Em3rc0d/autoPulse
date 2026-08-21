# AutoPulse v1 — Privacy, Support and Diagnostic Limitations

This document defines the Release-1 product behavior and provides the source text for store listing and in-app disclosures.

## Data and privacy behavior

AutoPulse v1 is local-first. Vehicle profiles, discovered capabilities, Live telemetry, session history and summaries are stored on the Android device for product operation. A cloud account is not required for the Release-1 core flow.

The Release-1 application does not upload diagnostic sessions or vehicle telemetry as part of the core flow. Crash analytics is not enabled unless a later candidate adds a named provider, documents its collected fields and retention, and receives a separate privacy review.

Uninstalling the app removes app-managed local data according to Android behavior. Android backup is disabled for the production application, so AutoPulse does not promise cloud restoration of local diagnostic history. Users should treat deletion/uninstallation as irreversible unless an explicit export feature is added and certified.

Bluetooth permissions are used to discover and communicate with a nearby supported OBD adapter. On Android versions where the platform requires location permission for Bluetooth discovery, AutoPulse requests it only for adapter discovery; Release 1 does not provide a location-tracking feature.

## Diagnostic limitations

AutoPulse is an informational, read-only telemetry product. It is not a substitute for professional inspection, manufacturer service information or safety-critical instrumentation.

- Signal availability varies by vehicle, ECU, protocol and adapter.
- Missing, stale, invalid or unavailable data must not be interpreted as zero.
- A connection or adapter failure does not prove that a vehicle parameter is unsupported.
- Release 1 does not claim to read every PID, every vehicle or every OBD adapter.
- Release 1 does not clear faults, code ECUs or send active/destructive commands.
- A displayed value reflects the diagnostic evidence available to AutoPulse; it is not a guarantee of mechanical condition.
- Do not interact with the phone or app while driving. Stop safely before changing a connection or reviewing details.

## Supported hardware statement

Release 1 supports Android with certified BLE GATT OBD adapters exhibiting the required ELM-compatible behaviors documented in `COMPATIBILITY_CONTRACT_V1.md`. Reported adapter identity alone is not proof of compatibility.

Compatibility grades mean:

- `CERTIFIED`: the model/firmware combination passed the physical release matrix;
- `COMPATIBLE`: behavioral discovery proved the minimum reliable Release-1 path;
- `DEGRADED`: basic operation is reliable but a documented non-essential behavior is limited;
- `UNSUPPORTED`: AutoPulse could not establish a sufficiently reliable and distinguishable diagnostic path.

Bluetooth Classic, Wi-Fi, USB, iOS, OEM/Mode 22 expansion and background recording are outside the public Release-1 promise unless explicitly added to a later certified matrix.

## Approved short disclosure

> AutoPulse reads supported standard OBD telemetry through a compatible BLE adapter. Availability varies by vehicle and reader. Data stays on this device in Release 1. AutoPulse is informational, does not replace professional diagnosis, and must not be operated while driving.
