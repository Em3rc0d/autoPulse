# Research boundary — PIDs, DTCs, and proprietary CAN data

## 1. Standard OBD-II PIDs

PIDs are parameter identifiers used with diagnostic services such as Service/Mode 01 to request current ECU data.

Examples already used by AutoPulse include RPM (`010C`), speed (`010D`), coolant (`0105`), calculated load (`0104`), throttle (`0111`), and control-module voltage (`0142`).

A standard PID can be defined while still being unsupported by a particular ECU.

## 2. Diagnostic Trouble Codes (DTCs)

DTCs are fault identifiers returned by diagnostic services such as stored, pending, or permanent-code requests. They are not live-data PIDs.

Kelley Blue Book is therefore registered here as a DTC reference source, not used to populate `mode01_pid_inventory.csv`.

For AutoPulse Check, the correct future relationship is:

`DTC -> code semantics -> freeze frame / monitor evidence -> related PID observations`

not:

`DTC == PID`.

## 3. Manufacturer/proprietary signals

The supplied pack also contains proprietary CAN DBC examples. Those are valuable for future research but must not be presented as standardized OBD-II support.

They require a separate quarry with explicit manufacturer/model provenance and licensing review.

## 4. Product invariant

Absence is not zero, catalog presence is not ECU support, and ECU support is not proof that a valid observation was captured in a session.
