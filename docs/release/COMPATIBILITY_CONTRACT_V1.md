# AutoPulse Live v1 — Compatibility Contract

## Principle

AutoPulse does not promise that every vehicle exposes the same signals or that every OBD reader behaves identically.

Release 1 promises that, inside its certified support envelope, AutoPulse will discover the diagnostic path, distinguish adapter/transport failures from vehicle capability, and present only data it can justify.

## Release-1 support envelope

### Platform

- Android only.

### Transport

- BLE GATT is the certified Release-1 transport.

Other transports may exist in research/development but are not part of the public v1 compatibility promise until separately certified.

### Adapter dialect

- ELM-compatible behavior is the first certified dialect family.
- Reported `ATI`/firmware identity is evidence, not proof of compatibility.
- Generic adapters are graded from observed behavior.

### Adapter compatibility grades

#### CERTIFIED

A known adapter model/firmware combination has passed the AutoPulse physical compatibility matrix.

#### COMPATIBLE

Behavioral discovery proves all Release-1 required capabilities. Optional behaviors may differ from a reference ELM implementation.

#### DEGRADED

Basic diagnostics/Live operation is reliable, but one or more non-essential behaviors are unavailable or unstable. AutoPulse must explain the limitation.

#### UNSUPPORTED

AutoPulse cannot establish the minimum reliable request/response path or cannot safely distinguish valid diagnostic data from adapter failure.

## Required vs preferred adapter behavior

### Required

- reliable command transmission;
- reconstructable response completion;
- ability to issue standard read-only OBD requests through an AutoPulse-supported vehicle protocol;
- failures/timeouts observable by AutoPulse;
- connection loss observable or inferable without inventing vehicle `NO_DATA`.

### Preferred

- echo control;
- space control;
- linefeed control;
- header control;
- automatic protocol selection;
- protocol description query.

Failure of a preferred formatting command does not by itself make an adapter unsupported if AutoPulse can normalize the behavior safely.

### Optional

- vendor-specific ST/extended commands;
- advanced flow-control tuning;
- proprietary adapter diagnostics;
- higher sustained polling rates.

## Vehicle capability truth model

AutoPulse must keep these claims separate:

1. `STANDARD_DEFINITION` — the service/PID exists in AutoPulse's verified standard catalog.
2. `CAPABILITY_ADVERTISED` — the vehicle/ECU advertised support through the applicable capability mechanism.
3. `PROBE_RESULT` — AutoPulse actually requested the parameter and observed a concrete outcome.
4. `LIVE_OBSERVATION` — the parameter continued to produce usable values during a Live session.

A catalog definition never implies vehicle support.

A single failed probe never proves permanent vehicle non-support if the result was timeout, adapter error, connection loss or malformed transport data.

## Data truth rules

- Missing data is not zero.
- Invalid data is not valid telemetry.
- Estimated/calculated data must never be labeled ECU-direct.
- `ATRV` adapter voltage and Mode 01 PID `0142` control-module voltage are different signals.
- TIMEOUT, adapter/ELM error, connection loss, negative ECU response and OBD `NO_DATA` are different facts.
- Operational PID retirement after repeated `NO_DATA` must not rewrite historical capability evidence.
- A summary is COMPLETE only if persisted evidence supports completeness.

## User-facing compatibility language

Allowed:

> AutoPulse detected your adapter and vehicle protocol. 18 standard signals are available on this vehicle.

> Live telemetry is available with limited adapter compatibility. Long diagnostic responses are not certified for this reader.

> Oil temperature is not available through this vehicle's discovered standard OBD capabilities.

Not allowed:

> Works with every OBD reader.

> Reads every car parameter.

> No fault codes found — when the relevant diagnostic service was not actually queried and completed.

## Certification dimensions

Release certification should collect evidence across:

- adapter model/firmware;
- Android device/version;
- vehicle make/model/year/engine when known;
- detected protocol;
- CAN addressing mode where applicable;
- standard capability discovery;
- normal Live lifecycle;
- interruption/recovery lifecycle;
- session integrity result.

This matrix becomes the authority for the public compatibility statement.
