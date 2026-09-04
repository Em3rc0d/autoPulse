# Q-CHECK-004 — Freeze-frame acquisition and semantics

**Status:** `SEMANTIC_BOUNDARY_CLOSED_FIXTURES_OPEN`  
**Captured:** 2026-09-04  
**Runtime impact:** none

## Purpose

Define freeze-frame evidence as a historical ECU snapshot associated with a diagnostic event, without confusing it with current Mode 01 telemetry or Live-session history.

## Product boundary

```text
CURRENT PID VALUE
!= FREEZE-FRAME PID VALUE
!= HISTORICAL AUTOPULSE LIVE VALUE
```

All three may contain the same signal name and unit while describing different times and provenance.

## Standard relationship

Service/Mode 02 exposes freeze-frame data. Standard references describe it as a snapshot of PID data captured around the event that caused a DTC/freeze frame to be stored.

Service 02 PID 02 identifies the DTC associated with the stored freeze frame. If the reported freeze-frame DTC is zero/no frame according to the promoted parser contract, other Mode 02 values must not be presented as a meaningful diagnostic snapshot.

## Evidence model

Conceptual entity:

```text
DiagnosticFreezeFrame
- endpointId?
- frameId / frameNumber
- associatedDtc?
- capturedAt: ECU_EVENT_TIME_UNKNOWN unless a trustworthy timestamp exists
- observations[]
- rawEvidence[]
- integrity / parse status
```

Do not invent an actual wall-clock timestamp merely because the Check was run now.

## PID interpretation reuse

Many Mode 02 PIDs share decode formulas with Mode 01. Reusing formula definitions is acceptable only when provenance remains:

```text
service = 02
context = FREEZE_FRAME
```

A shared decoder must not collapse the observation into current telemetry.

## Frame identity

Some implementations may expose frame-number semantics or multiple snapshot identifiers. AutoPulse must preserve the frame identifier supplied by the service/transport rather than flatten multiple frames into one object.

The first Check Core promotion may support only the standard frame scope demonstrated by fixtures. Broader/multiple-frame behavior is not inferred.

## Associated-DTC rule

When freeze-frame metadata associates a DTC with the frame:

```text
FreezeFrame --CONTEXT_FOR--> DTC observation
```

This relationship is evidence. It does not prove that every current symptom or PID anomaly has the same cause.

If no DTC association is available, the frame may still be retained as unassociated evidence if the service response itself is valid and the parser contract permits it.

## No-frame / unsupported outcomes

Distinct results:

```text
FRAME_OBSERVED
NO_FRAME_AVAILABLE
SERVICE_UNSUPPORTED
PID_NOT_AVAILABLE_IN_FRAME
NO_DATA
INVALID_RESPONSE
TIMEOUT
UNATTRIBUTED
```

`NO_FRAME_AVAILABLE` is not equivalent to `NO DTCs` and not equivalent to `healthy`.

## Targeted acquisition

Freeze-frame collection follows the DTC Core scan rather than preceding it. The planner can use observed DTCs to decide whether freeze-frame enrichment has diagnostic value.

Do not blindly iterate every reference-defined PID under Mode 02.

## UI contract

Example structure:

```text
At the time the ECU stored this event
RPM       ...
Load      ...
Coolant   ...
Speed     ...
```

Do not label the values “now”.

The report should expose whether the frame was actually retrieved, not supported, or unavailable.

## Required fixtures

```text
freeze-frame DTC present
freeze-frame DTC zero / no frame
one valid Mode02 PID
several valid Mode02 PIDs
PID unavailable in Mode02
same PID current vs frozen with different values
multi-responder freeze-frame data
malformed/partial frame
NO DATA
timeout/disconnect
```

## Closure state

```text
freeze vs current boundary       CLOSED
DTC association semantics        CLOSED
no-frame semantics               CLOSED
formula reuse/provenance rule    CLOSED
targeted-enrichment rule         CLOSED
wall-clock timestamp prohibition CLOSED
frame-number breadth             FIXTURE-BOUNDED
fixture corpus                   OPEN
runtime promotion                BLOCKED
```
