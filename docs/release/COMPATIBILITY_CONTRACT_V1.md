# AutoPulse Live v1 — Compatibility Contract

**Authority:** RELEASE CONTRACT
**Evidence sources:** Test ledger + Quarries + Golden Dataset

## Principle

AutoPulse does not promise that every vehicle exposes the same signals or that every OBD reader behaves identically.

Release 1 promises that, inside its certified support envelope, AutoPulse will discover the diagnostic path, distinguish adapter/transport failures from vehicle capability, and present only data it can justify.

## Release-1 support envelope

### Platform

- Android only.

### Certified transport direction

- BLE GATT is the Release-1 physical path currently under certification.

Other transports may exist in research/development but are not part of the public v1 compatibility promise until separately implemented and certified.

### Adapter dialect

- ELM-compatible behavior is the first certified dialect family.
- Reported `ATI`/firmware identity is evidence, not proof of compatibility.
- Generic adapters are graded from observed behavior.

### Adapter compatibility grades

#### CERTIFIED

A known adapter model/firmware + declared support context has passed the required physical compatibility/lifecycle matrix.

#### COMPATIBLE

Behavioral discovery proves Release-1 required capabilities in the tested combination. Optional behaviors may differ from a reference ELM implementation.

#### DEGRADED

Basic diagnostics/Live operation is reliable, but one or more non-essential behaviors are unavailable or unstable. AutoPulse must explain the limitation.

#### UNSUPPORTED

AutoPulse cannot establish the minimum reliable request/response path or cannot safely distinguish valid diagnostic data from adapter/transport failure.

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

AutoPulse keeps these claims separate:

1. `STANDARD_DEFINITION` — the service/PID exists in AutoPulse's verified standard catalog.
2. `CAPABILITY_ADVERTISED` — the vehicle/ECU advertised support through the applicable capability mechanism.
3. `PROBE_RESULT` — AutoPulse actually requested the parameter and observed a concrete outcome.
4. `LIVE_OBSERVATION` — the parameter continued to produce usable values during a Live session.

A catalog definition never implies vehicle support.

A single failed probe never proves permanent vehicle non-support if the result was timeout, adapter error, connection loss or malformed transport data.

## Source-truth rules

- Missing data is not zero.
- Invalid data is not valid telemetry.
- Estimated/calculated data must never be labeled ECU-direct.
- Phone sensors are not ECU sensors.
- `ATRV` adapter voltage and Mode 01 PID `0142` control-module voltage are different signals.
- TIMEOUT, adapter/ELM error, connection loss, negative ECU response and OBD `NO_DATA` are different facts.
- Operational PID retirement after repeated `NO_DATA` must not rewrite historical capability evidence.
- A Summary is COMPLETE only if persisted evidence supports completeness.
- A normal final short telemetry flush block does not by itself make the whole completed session PARTIAL.

## Live-state compatibility truth

Initialization success is not ECU-live proof.

The path is conceptually:

```text
adapter connected/configured
→ vehicle/protocol ready
→ waiting for first valid ECU sample
→ valid ECU-origin observation
→ healthy Live
```

`ATRV` or other adapter-only evidence cannot unlock ECU Live.

Automatic protocol code `A0` is provisional/automatic selection evidence until sufficient real exchange/resolution evidence exists; it is not a human vehicle protocol name by itself.

## Off-Road compatibility boundary

Off-Road combines two independent evidence families:

```text
ECU/OBD telemetry            phone sensors
RPM/speed/coolant/...        pitch/roll/altitude/heading
          \                    /
           \                  /
            driver-mode view
```

Phone sensors are an optional subordinate sidecar.

Compatibility rules:

- entering Off-Road must not stop/restart/starve ECU acquisition;
- missing location permission must degrade location-derived features only;
- ACTIVE Live must not launch an Android permission dialog merely because Off-Road was selected;
- pitch/roll require correct phone/vehicle calibration semantics;
- altitude/heading availability comes from phone/location evidence, not ECU support.

RC3 Duster physical evidence exposed an Off-Road interference defect. RC4 implements isolation; physical closure is pending the RC4 Duster retest.

## Current physical evidence matrix

This table is an evidence snapshot, not the final public matrix.

| Vehicle | Year | Adapter | Physical ECU acquisition | Observed ECU signals | Summary | Off-Road | Lifecycle evidence |
|---|---:|---|---|---|---|---|---|
| Renault Logan | 2014 | primary tested BLE ELM-compatible adapter | PASS observed | RPM, speed, coolant; adapter voltage separately observed | historical TextDecoder failure on older build; RC3 code fix exists and later runtime closure evidenced on Duster | phone pitch/roll/altitude/heading observed | APP_BACKGROUND interruption + completed/interrupted History observed; current-build BLE unplug/process kill pending |
| Renault Duster | 2014 | same adapter | PASS observed | RPM, speed, coolant | RC3 physical Summary reconstruction PASS | RC3 FAIL: mode could destabilize acquisition; RC4 code+CI fixed, physical retest pending | normal Stop observed; destructive lifecycle matrix pending |

### Meaning of the two-vehicle result

Using the same adapter on a second vehicle is valuable because it changes the vehicle while controlling one hardware variable.

It supports the narrow conclusion that AutoPulse is not merely replaying/hardcoding one Logan result.

It does **not** prove:

- all Renault vehicles;
- all engines/ECUs in those model lines;
- all protocol variants;
- all adapter clones;
- cross-manufacturer compatibility.

## Current adapter evidence limitation

Physical adapter diversity remains narrow because the project currently has one primary adapter available for field testing.

Therefore:

- vehicle evidence can expand with the current adapter;
- adapter compatibility certification remains limited;
- broad “all connectors/readers” statements are prohibited.

When another adapter/connector becomes available, certification should hold vehicle/context as constant where practical and characterize the new adapter behavior independently.

## User-facing compatibility language

Allowed after applicable evidence:

> AutoPulse detected your adapter and vehicle protocol. These standard signals were observed on this vehicle.

> Live telemetry is available with limited adapter compatibility. Some diagnostic behaviors are not certified for this reader.

> Oil temperature is not available through this vehicle's discovered standard OBD capabilities.

Allowed for current internal evidence description:

> AutoPulse has physically acquired standard ECU telemetry from the tested 2014 Renault Logan and 2014 Renault Duster using the project's tested BLE ELM-compatible adapter path. Broader adapter and manufacturer certification is still in progress.

Not allowed:

> Works with every OBD reader.

> Works with all Renaults.

> Reads every car parameter.

> No fault codes found — when the relevant diagnostic service was not actually queried and completed.

> Off-Road is certified — before the RC4 physical isolation retest passes.

## Certification dimensions

Release certification collects evidence across:

- exact APK/build/commit;
- adapter model/firmware;
- Android device/version;
- vehicle make/model/year/engine when known;
- detected protocol;
- CAN addressing mode where applicable;
- standard capability discovery;
- actual Live observations;
- normal Live lifecycle;
- Driver Mode transitions;
- Off-Road isolation where included;
- interruption/recovery lifecycle;
- session integrity result;
- persisted History/Summary reconstruction.

This matrix becomes the authority for the public compatibility statement.

## Evidence promotion rule

The compatibility contract reads evidence only after the following chain is respected:

```text
physical source/quarry
→ test interpretation
→ golden normalized case
→ compatibility claim
```

A design intention or green CI run cannot by itself create a physical compatibility claim.
