# Q-CHECK-003 — Readiness / MIL monitor semantics

**Status:** `SEMANTIC_BOUNDARY_CLOSED_NORMATIVE_FIXTURES_OPEN`  
**Captured:** 2026-09-04  
**Runtime impact:** none

## Purpose

Define AutoPulse readiness evidence so Check never confuses monitor availability, monitor completion, monitor failure, MIL state, or DTC count.

## Core inputs

Check Core uses two distinct standard current-data PIDs when supported:

```text
0101 → monitor status since DTCs cleared
0141 → monitor status for the current drive cycle
```

Both are read-only diagnostic evidence.

## PID 0101 byte A

The first data byte carries two independent facts:

```text
bit 7      → MIL state
bits 6..0  → count of confirmed emissions-related DTCs available for display by that ECU
```

The count is endpoint-scoped when multiple modules respond. It is not a universal vehicle DTC count unless all contributing endpoint evidence is explicitly reconciled.

## Readiness has two dimensions

A monitor needs separate fields:

```text
supported / available?
complete / ready?
```

Required truth table:

```text
not supported → NOT_SUPPORTED
supported + complete → READY
supported + incomplete → NOT_READY
unknown bits / invalid layout → UNKNOWN
```

`NOT_READY` is **not** a failed diagnostic test and must never be presented as a detected fault.

## Counterintuitive bit semantics

For readiness completeness bitmaps, a clear completion bit can represent `complete`, while a set bit can represent `not complete`. AutoPulse parsers must encode this semantic explicitly rather than expose raw booleans such as `bitSet=true` to UI.

Preferred domain field:

```text
completion: COMPLETE | INCOMPLETE | NOT_APPLICABLE | UNKNOWN
```

not:

```text
failed: boolean
```

## Common monitors

PID 0101 includes common monitor evidence for areas such as:

```text
misfire
fuel system
comprehensive components
```

Support and completion remain separate for each.

## Engine-family-dependent monitors

The response indicates whether the engine layout is spark ignition or compression ignition. The engine-type-specific readiness bits must therefore be decoded through the selected layout.

AutoPulse must not apply a spark-monitor map to a diesel response or vice versa.

Conceptual families include:

```text
SPARK:
- catalyst
- heated catalyst
- evaporative system
- secondary air
- particulate-filter slot where defined
- oxygen sensor
- oxygen sensor heater
- EGR/VVT

COMPRESSION:
- NMHC catalyst
- NOx/SCR
- boost pressure
- exhaust-gas sensor
- particulate filter
- EGR/VVT
- reserved/standard-version-dependent slots
```

The exact bit map must live in a versioned parser contract/fixture, not UI code.

## PID 0141 distinction

PID `0141` describes monitor status for the **current drive cycle**, not the same time horizon as `0101`.

AutoPulse stores the time-horizon semantic explicitly:

```text
SINCE_DTC_CLEAR
CURRENT_DRIVE_CYCLE
```

One must never overwrite the other.

## DTC count relationship

PID 0101 DTC count is contextual evidence. The authoritative DTC-list observations still come from the relevant DTC service scans.

Possible inconsistency such as:

```text
0101 confirmed count = 1
Mode03 parsed stored codes = 0
```

must be preserved as a diagnostic evidence inconsistency/limitation, not silently reconciled by choosing one value.

## UI contract

Allowed user states:

```text
READY
NOT READY
NOT SUPPORTED
UNKNOWN
```

Forbidden transformations:

```text
NOT READY → FAILED
NOT SUPPORTED → HEALTHY
UNKNOWN → READY
```

The MIL is displayed independently from readiness state.

## Normative-source boundary

Current research uses the ELM327 vendor documentation for MIL/count behavior and a secondary PID reference for the detailed readiness bit layout. That is enough to close the **product/domain semantics**, but the exact production bit table remains fixture/normative-cross-check gated before parser promotion.

## Required fixtures

```text
MIL off / zero DTC
MIL on / one DTC
spark ignition all common monitors ready
spark ignition partial readiness
compression ignition layout
supported but incomplete monitor
unsupported monitor
PID0101 malformed/short
PID0141 current-cycle example
multi-ECU differing MIL/count states
0101 count vs Mode03 inconsistency
```

## Closure state

```text
MIL vs DTC-count semantics             CLOSED
support vs completion distinction      CLOSED
NOT_READY != FAILED                    CLOSED
spark/compression layout requirement   CLOSED
0101 vs 0141 time-horizon distinction  CLOSED
endpoint-scoped count requirement      CLOSED
exact normative bit table verification OPEN
fixture corpus                         OPEN
runtime parser promotion               BLOCKED
```
