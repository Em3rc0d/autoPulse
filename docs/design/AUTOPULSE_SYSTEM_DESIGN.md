# AutoPulse System Design Authority

**Lane:** Design
**Authority:** DESIGN AUTHORITY
**Applies to:** AutoPulse Live v1 and RC stabilization work unless a later design explicitly supersedes a section

## 1. Product boundary

AutoPulse Live v1 is a local-first Android application that connects to a supported read-only OBD path, discovers what the adapter/vehicle combination can genuinely provide, records durable telemetry, presents driver-oriented information and reconstructs session history honestly.

The system is not designed around a single Renault model. The current physical evidence happens to include Renault Logan 2014 and Renault Duster 2014; those are certification inputs, not architectural assumptions.

## 2. Layered truth model

Every visible signal must retain source semantics.

### 2.1 ECU-origin data

Examples:

- Mode 01 RPM (`010C`);
- vehicle speed (`010D`);
- coolant temperature (`0105`);
- control-module voltage (`0142`) when actually supported;
- other verified OBD parameters.

Rules:

- a valid ECU-origin OBD sample can unlock ECU-live state;
- a standard PID definition alone cannot unlock Live or imply vehicle support;
- timeout, malformed adapter response, adapter error and `NO_DATA` are distinct outcomes;
- unavailable values remain unavailable, never fabricated as zero.

### 2.2 Adapter-origin data

Example: `ATRV`.

`ATRV` measures adapter-observed supply voltage. It is not PID `0142` and must be labeled adapter-origin.

Adapter-origin telemetry cannot be used as proof that ECU telemetry is live.

### 2.3 Phone-origin data

Examples:

- raw device pitch/roll/rotation vector;
- GNSS/location-derived altitude;
- heading where available.

Rules:

- phone-origin data is not ECU data;
- availability must include permission/sensor state;
- missing altitude is not rendered as `0 m`;
- phone sensors may enrich a mode but must never control the OBD connection lifecycle.

### 2.4 Derived/calculated data

Derived values must be labeled as derived/estimated and retain provenance to their inputs. No derived value may be displayed as ECU-direct.

## 3. Vehicle capability truth

AutoPulse separates four evidence classes:

1. `STANDARD_DEFINITION` — AutoPulse has a verified definition/formula for the service/PID.
2. `CAPABILITY_ADVERTISED` — vehicle/ECU advertised support through standard discovery.
3. `PROBE_RESULT` — AutoPulse actually issued a request and observed a result.
4. `LIVE_OBSERVATION` — the signal produced usable observations during Live acquisition.

No later class may be inferred solely from an earlier class.

## 4. Adapter compatibility truth

Reported identity such as `ATI`/firmware text is evidence, not authority.

Compatibility is behavioral. Required properties include reliable command transmission, reconstructable response completion, observable failures and a read-only OBD request/response path.

Preferred formatting commands may fail without making an adapter unusable if AutoPulse can normalize behavior safely.

## 5. Protocol presentation

ELM automatic selection code `A0` means automatic/provisional protocol selection evidence. It must not be presented to the user as if `A0` were the final physical vehicle protocol.

After a real OBD exchange, AutoPulse may re-query protocol information and persist the resolved evidence available from the adapter.

Unknown internal ECU sentinels, including `-1`, are implementation details and must never become user-facing identifiers.

## 6. Live lifecycle state model

Conceptual flow:

```text
CONNECTING
    ↓
ADAPTER_READY
    ↓
VEHICLE_READY
    ↓
WAITING_FOR_FIRST_ECU_SAMPLE
    ↓
LIVE_ECU
    ↓
DEGRADED / RECOVERING / TERMINAL
```

The current presentation layer condenses these into user-oriented states, but the semantic boundary remains.

### 6.1 Waiting for ECU

Initialization/configuration can succeed before a usable ECU measurement arrives.

During this interval:

- adapter can be connected;
- protocol/capability discovery may already have completed;
- `ATRV` may be present;
- the app must still say it is waiting for valid ECU evidence.

### 6.2 ECU Live unlock

Any valid ECU-direct OBD reading may establish `LIVE_ECU`; RPM is not privileged as the only unlock signal.

Adapter-only data does not establish ECU Live.

### 6.3 Quiet healthy state

Once valid ECU telemetry is flowing, the phone should not waste a large banner saying `LIVE · ECU DATA`. The active Live screen itself plus a subtle healthy indicator is sufficient.

Large status banners are reserved for states such as:

- waiting for ECU data;
- ECU data delayed;
- recording degraded;
- session interrupted;
- other actionable abnormal/transitional states.

## 7. Smartphone-first cockpit

### 7.1 Design goal

The smartphone is a glance surface and alert endpoint, not a dense scan-tool table.

Priority order:

```text
critical/attention alert
→ vehicle + session context
→ primary live metrics
→ selected-mode supporting information
→ trend/detail
→ technical evidence/history
```

### 7.2 Healthy screen behavior

Healthy state should be quiet and stable.

Preferred traits:

- compact driver-mode selector;
- vehicle name + timer;
- subtle green live evidence indicator;
- 2-column primary metric cards where screen width supports them;
- only genuinely available signals;
- compact trends below primary telemetry;
- no duplicated “you are in Live” banner;
- Stop remains reachable without covering most of telemetry.

### 7.3 Driver modes

Modes change prioritization and decision dimensions, never source truth.

#### Essential

Prioritize minimum current vehicle state.

#### Family / Daily

Prioritize engine health, driving state and practical reminders.

#### Performance

Prioritize engine/thermal/load-oriented dimensions where supported.

#### Off-Road

Prioritize vehicle telemetry plus phone-origin terrain context.

#### Diagnostic

Prioritize diagnostic evidence and fault/capability visibility.

No mode may make an unavailable signal appear supported.

## 8. Color, voice and haptic policy

### 8.1 Severity language

- **Green:** healthy/available/normal; visually calm; usually silent.
- **Amber/orange:** waiting, partial evidence, degradation or attention; visual emphasis; optional voice based on actionability.
- **Red:** interruption, critical condition or terminal recording failure; strong visual emphasis plus haptic/voice where safe and useful.

Color is never the sole carrier of meaning; text/state semantics remain present.

### 8.2 Voice policy

Voice is event-driven and meaning-oriented.

Speak on:

- meaningful state transition;
- serious driver warning;
- diagnostic warning requiring attention;
- unexpected session interruption;
- important recovery;
- concise startup briefing when evidence is mature enough.

Do not speak:

- every telemetry sample;
- minor numeric fluctuation;
- repeated unchanged warning without rate limiting;
- speculative diagnosis without evidence.

Voice examples must remain short and action-oriented.

### 8.3 Haptics

Haptics reinforce severity:

- short/single attention pattern for warning;
- stronger/double pattern for critical or unexpected terminal events.

Haptics must not create a false critical state merely because a sensor is unavailable.

## 9. Cold-start observation design

At vehicle startup, transient measurements can be legitimate. AutoPulse should collect sufficient stable evidence before escalating normal warm-up behavior.

The product may show `STARTUP OBSERVATION` / `COLD-START OBSERVATION` while maturity is still developing.

The design preference is delayed confidence over premature diagnosis.

## 10. Off-Road architecture

Off-Road has a strict priority rule:

> ECU acquisition owns the critical request/response timing. Phone sensors are optional sidecar inputs.

Architecture:

```text
BLE / ELM / ECU request-response loop
               │
               ├── durable telemetry
               ├── Live UI
               └── driver intelligence

Phone rotation/location sensors
               │
               └── throttled sidecar observations
                        ├── local Off-Road UI
                        └── low-rate driver-intelligence context
```

### 10.1 Permission rule

Entering Off-Road during an ACTIVE Live session must not launch an Android permission dialog.

If location permission is already granted, consume it.

If not granted:

- report location/altitude capability as unavailable/permission-required;
- preserve ECU acquisition;
- allow permission setup outside the timing-critical Live path.

### 10.2 Sensor-budget rule

High-frequency phone sensor events must be throttled before producing expensive React/context work.

The RC4 design uses lower native motion delivery plus JS/context throttling so orientation updates cannot starve ELM timing.

### 10.3 Vehicle-relative calibration

Raw phone orientation is device-relative.

Off-Road vehicle-relative attitude requires:

```text
raw phone orientation
→ user level calibration for selected vehicle
→ calibration reference persisted/scoped to that vehicle
→ vehicle-relative pitch/roll
```

Before calibration, the UI must not pretend values are vehicle-relative.

After substantial phone repositioning, recalibration may be needed; future design may detect this explicitly.

## 11. Recording and persistence architecture

### 11.1 Release-1 background policy

Recording is foreground-only.

If an ACTIVE Live session leaves foreground, AutoPulse terminates recording as explicit interruption with reason such as `APP_BACKGROUND`.

This is not a crash workaround; it is current product policy. True background recording would be a separate capability requiring explicit design, Android service behavior and certification.

### 11.2 Telemetry blocks

Live OBD acquisition events are assembled into fixed-duration blocks and persisted using the current product codec (`BINARY_OBD2_V3`).

The final block is flushed on stop. It may naturally cover less than a full fixed window.

### 11.3 Terminal-state truth

Normal stop:

```text
ACTIVE
→ STOPPING
→ final flush + bounded persistence drain
→ COMPLETED
```

Unexpected event:

```text
ACTIVE
→ interruption reason
→ final available flush/drain
→ INTERRUPTED
```

Examples of interruption reasons:

- `APP_BACKGROUND`;
- `DEVICE_DISCONNECTED`;
- `UNEXPECTED_APP_TERMINATION` after boot-time orphan recovery;
- telemetry persistence/drain failure.

After terminal state:

- timer freezes;
- active driver-mode controls disappear/disable;
- Stop disappears;
- UI offers Summary/History navigation;
- last telemetry may remain visible as recorded evidence but must not look live.

## 12. Process-kill recovery design

Android process kill cannot be reliably handled synchronously by JavaScript.

Therefore the correct design is durable recovery on next boot:

1. app starts;
2. product DB migrations/bootstrap run;
3. orphan CREATED/PREPARING/ACTIVE/STOPPING sessions are inspected;
4. durable telemetry blocks determine recoverable counters/sequence/end evidence;
5. session is reconciled to `INTERRUPTED` with `UNEXPECTED_APP_TERMINATION` unless stronger prior reason exists;
6. missing tail data is not invented;
7. History can reopen surviving evidence.

## 13. Summary integrity semantics

Session integrity is about persisted evidence, not only how the session ended.

Possible verdicts include COMPLETE, PARTIAL, DEGRADED, CORRUPTED and UNAVAILABLE.

### COMPLETE

A normal completed session with matching expected/found blocks, no corruption, no sequence gaps and only the expected final shorter flush block may be COMPLETE.

The final flush block can remain counted as a partial *block* without downgrading the entire normal session.

### PARTIAL

Appropriate for interrupted sessions or anomalous partial evidence where a complete lifecycle is not supported.

### DEGRADED

Appropriate when evidence contains block mismatch, sequence gaps, unsupported codec block(s) or corruption that still leaves some readable evidence.

### CORRUPTED

Appropriate when persisted block evidence is unusable to the defined corruption threshold.

### UNAVAILABLE

No usable persisted blocks/evidence for reconstruction.

## 14. History design

History is a durable evidence surface, not a placeholder.

It should show:

- vehicle;
- session status;
- time/date;
- duration;
- blocks/readings;
- termination reason;
- short session identifier;
- ability to reconstruct eligible terminal summaries.

Completed and interrupted sessions remain visible after app restart.

## 15. Diagnostic/compatibility degradation

A missing optional PID or unavailable phone sensor should degrade only the capability/dimension that depends on it.

A driver mode should never globally appear READY if its required dimensions rely on degraded/missing evidence.

Operational PID retirement after repeated `NO_DATA` is a polling optimization; it does not rewrite historical capability truth.

## 16. Release safety boundaries

Current v1 design is read-only.

Deferred unless separately designed/certified:

- destructive/active ECU commands;
- broad OEM proprietary control;
- background acquisition;
- universal Bluetooth Classic/Wi-Fi/USB claims;
- iOS;
- universal connector promise;
- cloud dependency for core Live operation.

## 17. Design acceptance rule

A future code change is conformant only if it preserves the source/evidence/lifecycle invariants above. A visually attractive behavior that weakens truth semantics is a regression.
