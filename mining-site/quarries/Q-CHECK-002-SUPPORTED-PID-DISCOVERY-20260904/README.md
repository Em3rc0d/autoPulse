# Q-CHECK-002 — Supported PID discovery

**Status:** `SEMANTIC_BOUNDARY_CLOSED_FIXTURES_OPEN`  
**Captured:** 2026-09-04  
**Runtime impact:** none

## Purpose

Define how AutoPulse converts standard Mode 01 support-bitmap responses into endpoint-scoped PID capability evidence without blind-polling the reference catalog.

## Core truth boundary

```text
REFERENCE_DEFINED
!= ECU_ADVERTISED
!= QUERIED
!= OBSERVED
```

A PID catalog entry means only that AutoPulse has a definition. A support bitmap may establish `ECU_ADVERTISED` for one responder. A later PID request may still return `NO_DATA`, timeout, invalid data, or a valid observation.

## Support block semantics

Mode 01 PID `00` returns four bytes. Each bit represents support for one of the next 32 PIDs.

The quarry and secondary references identify the support-block requests used by the current research source:

```text
0100 → support for 01–20
0120 → support for 21–40
0140 → support for 41–60
0160 → support for 61–80
0180 → support for 81–A0
01A0 → support for A1–C0
01C0 → support for C1–E0
```

The final bit in a support block can advertise availability of the next support block. The scanner must follow that chain rather than assume all blocks exist.

## Endpoint scope

Support is attached to the responder that produced the bitmap.

Conceptual output:

```text
EcuPidSupportMap
- endpointId
- blocks[]
- advertisedPids[]
- evidence[]
```

A union across vehicle responders may be useful for presentation/planning, but the original endpoint-specific support evidence must remain available.

## Chained discovery algorithm

```text
query 0100
→ decode advertised 01–20
→ if next-block marker advertised, query 0120
→ repeat
→ stop when next block is not advertised
   or transport/safety budget terminates discovery
```

Do not issue later support blocks merely because the reference catalog contains them.

## Planner relationship

The PID quarry is **not** a polling plan.

For a diagnostic concern:

```text
reference evidence requirements
∩ endpoint advertised support
= candidate targeted PID requests
```

Then every actual result is recorded independently as:

```text
OBSERVED
NO_DATA
INVALID
TIMEOUT
UNSUPPORTED/NOT_ADVERTISED
```

## Non-advertised semantics

A PID not advertised by the endpoint is not a failed sensor and not a fault. It is simply outside the demonstrated standard capability of that endpoint for this Check run.

AutoPulse should generally not query it in the standard planner unless another reviewed capability source explicitly justifies doing so.

## Advertised-but-no-data semantics

An advertised PID that later returns no usable response is preserved as two facts:

```text
ECU_ADVERTISED = true
QUERY_RESULT = NO_DATA / INVALID / TIMEOUT
```

Do not rewrite the support bitmap retroactively.

## Support bitmaps are discovery evidence, not user health data

Support bitmaps belong to technical coverage/planning. They should not produce a user-facing “support score” or health percentage.

## Promotion contract

Before runtime promotion, fixtures must cover:

```text
single support block
multi-block continuation
next block not advertised
all-zero usable bitmap cases
multiple responders with different support
advertised PID later observed
advertised PID later NO DATA
non-advertised PID planning exclusion
malformed bitmap
partial scan/disconnect
```

## Closure state

```text
truth boundary                   CLOSED
32-bit support-block semantics   CLOSED
chained discovery rule           CLOSED
endpoint-scoped support          CLOSED
planner intersection rule        CLOSED
non-advertised semantics         CLOSED
advertised/no-data distinction   CLOSED
fixture corpus                   OPEN
physical multi-ECU proof         OPEN
runtime promotion                BLOCKED
```
