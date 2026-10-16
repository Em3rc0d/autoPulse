# Q-CHECK-001 — Standard OBD DTC services

**Status:** `SEMANTIC_BOUNDARY_CLOSED_FIXTURES_OPEN`  
**Captured:** 2026-09-04  
**Runtime impact:** none

## Purpose

Close the product/parser boundary for standard read-only Diagnostic Trouble Code acquisition before AutoPulse implements the real Check scanner.

Scope for Check Core:

```text
Mode 03 → STORED
Mode 07 → PENDING
Mode 0A → PERMANENT
```

Mode 01 PID 01 is related evidence (MIL + confirmed-DTC count), not itself a DTC-list service.

## Established semantics

### DTC list services have no PID byte

For Mode 03, the request is simply `03`; a positive response uses service `43`. The DTC data that follows is decoded in two-byte pairs. Zero pairs (`0000`) are padding and do not represent real DTCs.

The same architectural rule applies to the pending/permanent list families: the parser must be **service-aware**, not assume every positive response is `service + PID + payload`.

### Transport-specific response envelope matters

The ELM327 documentation explicitly notes that ISO 15765-4/CAN Mode 03 responses add an extra data byte after the response service indicating how many DTC data items follow.

This means a decoder cannot safely use one universal layout such as:

```text
43 <first-DTC-byte> <remaining-bytes>
```

for all protocols.

AutoPulse must normalize the transport/service envelope before DTC-pair decoding.

## Current repository hazard discovered

`mobile-app/src/infrastructure/ble/real/pipeline/ObdFrameParser.ts` currently uses a PID-shaped frame model:

```text
expected service
→ next byte assigned to `pid`
→ remaining bytes assigned to payload
```

`ElmBleDiagnosticConnector` then treats `frame.pid` as the first DTC data byte for response services `43`, `47`, and `4A`.

This can appear correct for a legacy-style example such as:

```text
43 01 33 00 00 00 00
```

but it is not a protocol-independent DTC contract. On ISO 15765/CAN the extra DTC-count byte can be mistaken for DTC data.

**Decision:** do not patch this ad hoc. CHECK-MK4 will introduce service-aware fixtures/parsers and the low-level frame normalizer will preserve enough structure to distinguish PID-bearing and non-PID services.

## DTC code representation

One DTC occupies two bytes. AutoPulse must preserve:

```text
system family: P | C | B | U
first numeric namespace digit
two remaining nibbles of first byte
high/low nibbles of second byte
```

The raw two-byte evidence must remain available even when a human description is unknown.

## Status is independent evidence

The same code may appear in more than one class:

```text
P0301 STORED
P0301 PENDING
P0301 PERMANENT
```

AutoPulse stores each observation/status/source, then may group them into one `DiagnosticConcern`. It must not discard status evidence during de-duplication.

## Multi-ECU rule

Functional OBD requests may receive replies from more than one ECU. A DTC is attributed to a `DiagnosticEndpoint` only when source evidence is available. Otherwise it remains `UNATTRIBUTED`.

No address is converted to `ENGINE`, `ABS`, etc. without separate role evidence.

## Result semantics

These are distinct outcomes:

```text
SUCCESS_WITH_CODES
SUCCESS_ZERO_CODES
NO_DATA
TIMEOUT
INVALID_RESPONSE
NEGATIVE_RESPONSE
DISCONNECTED
UNSUPPORTED
```

`SUCCESS_ZERO_CODES` means only that the successfully queried responder(s) returned no DTCs for that status class. It is not a vehicle-health verdict.

`NO_DATA` must not be translated into `0 codes`.

## Mode 01 PID 01 relation

PID `0101` provides per-module MIL state and confirmed/stored DTC count evidence. Multiple modules may reply. Therefore:

- MIL/count are endpoint-attributed where headers permit;
- a global UI count cannot be computed by blindly taking one reply;
- count evidence is a consistency/context signal, not a substitute for parsing Mode 03.

## Promotion contract

The semantic boundary is closed. Runtime promotion remains blocked until CHECK-MK4 fixtures exist for at least:

```text
legacy/KWP stored DTC response
ISO15765/CAN stored DTC response with count byte
zero-code response
multiple codes
0000 padding
pending code response
permanent code response
same code in several statuses
multiple responders
unattributed response
NO DATA
timeout
negative response
malformed/odd byte count
disconnect/partial scan
```

## Closure state

```text
service purpose                 CLOSED
PID-vs-no-PID boundary          CLOSED
DTC pair semantics              CLOSED
status semantics                CLOSED
zero-code semantics             CLOSED
multi-ECU attribution rule      CLOSED
CAN extra-count parser hazard   CLOSED AS DESIGN CONSTRAINT
fixture corpus                  OPEN
physical CAN proof              OPEN
runtime parser promotion        BLOCKED
```
