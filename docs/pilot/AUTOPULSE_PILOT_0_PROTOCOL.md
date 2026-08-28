# AutoPulse Pilot 0 — Evidence-first validation protocol

## Purpose

Pilot 0 validates whether AutoPulse can turn one bounded, read-only vehicle observation into evidence that another person understands and considers useful enough to pay for. It is not a mechanical certification program and it is not an open beta.

## Entry gate

No external client session counts until all of the following are true:

- the unified V1 software candidate has Mobile Verify PASS and Android APK Build PASS;
- the exact candidate APK is identified by SHA-256 in this protocol;
- Android Permission Contract V1 passes for that APK;
- the candidate completes the internal physical A4 checklist on a known adapter/vehicle lane;
- clean Stop produces a COMPLETE session when evidence is complete;
- controlled interruption/recovery behavior is observed as specified by RC5;
- Check Lite can reconstruct the durable session and Report V0 verifies its own SHA-256.

Until the candidate is frozen, use:

`PILOT_APK_SHA256 = NOT_PINNED`

A test with a different APK does not count toward Pilot 0.

## Safety boundary

AutoPulse Pilot 0 is read-only relative to the vehicle ECU. It must not clear DTCs, command actuators, reset ECUs or perform write services.

Prefer stationary tests. If a test genuinely requires vehicle movement, the vehicle must be driven legally by a licensed adult while a separate observer operates or observes AutoPulse. The driver must not interact with the app while driving.

## Phase A — internal dry run

Target: 3–5 vehicles before external users.

For every vehicle:

1. verify installed APK SHA-256;
2. record vehicle identity only to the level actually known;
3. record adapter identity;
4. create one REAL_BLE Live session;
5. observe first ECU sample before calling the session ECU-live;
6. exercise the bounded V1 signal inventory;
7. verify Off-Road phone-sensor provenance remains separate from ECU data;
8. use clean Stop;
9. open History/Summary and confirm integrity state;
10. generate Check Lite;
11. open Report V0 and record its SHA-256;
12. retain the Pilot Session Receipt.

At least one controlled internal run must additionally test the RC5 recovery lane. Do not manufacture unsafe road conditions to do this; use a controlled/stationary setup where practical.

## Phase B — accompanied external pilot

Target: first 5–10 external users/inspectors, then expand toward 20–30 vehicle checks only if the workflow is stable.

AutoPulse is operated as an accompanied product. Do not distribute it as an unsupported public APK yet.

The observer should avoid teaching the user what to say about the report. After delivery, ask what they think it says before explaining terminology.

## Success evidence

A client test counts only when the chain can be reconstructed:

`git/head → APK SHA-256 → adapter → vehicle → sessionId → durable telemetry → checkId → report SHA-256 → client feedback`

The test is invalid for commercial learning if any of the following is missing:

- APK identity;
- session identity;
- report identity/hash;
- whether the session was COMPLETE or INTERRUPTED/PARTIAL;
- limitations shown to the client;
- the client's answer to the payment question.

## Commercial question

Do not use “¿te gusta?” as the primary signal.

Ask after the client has seen the report:

> “Si estuvieras evaluando este vehículo para comprarlo, venderlo o inspeccionarlo, ¿pagarías por recibir este reporte y esta evidencia? ¿Por qué? ¿Cuánto te parecería razonable?”

For professional users, also ask:

> “¿En cuántas evaluaciones reales por semana podrías usar algo así si fuera confiable?”

Record the answer verbatim or as a faithful paraphrase. Do not convert a vague positive reaction into willingness to pay.

## Product metrics

Track at minimum:

- connection success on certified/known adapter lane;
- time from connect to first valid ECU sample;
- session completion/interruption reason;
- Check generation success;
- Report verification success;
- observed coverage percentage;
- number of client clarification questions;
- whether the report changed or supported a decision/workflow;
- willingness to pay: yes / conditional / no;
- proposed price or buying model;
- repeat-use intent for professional users.

## Stop conditions

Pause external testing and return to product hardening if:

- the same reproducible crash occurs twice;
- a report fails integrity verification;
- a session displays stale/missing telemetry as current truth;
- adapter voltage is presented as ECU voltage;
- a recovery gap is hidden as continuous telemetry;
- the candidate APK identity cannot be established;
- a permission outside Android Permission Contract V1 appears;
- client confusion reveals that AutoPulse is being interpreted as a full mechanical certification rather than a bounded evidence report.

## V1 scope statement for participants

AutoPulse observes a bounded set of data available through the connected diagnostic path and records what was actually observed. It does not prove that every vehicle system was evaluated, and an unavailable or unevaluated signal is not treated as healthy, faulty or zero.
