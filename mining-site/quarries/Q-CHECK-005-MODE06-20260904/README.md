# Q-CHECK-005 — Mode 06 Monitor Evidence

**Status:** SEMANTICS_CLOSED_FIXTURES_OPEN  
**Scope:** Standard OBD on-board monitoring evidence for Check Intelligence.  
**Runtime impact:** none.

## Boundary

Mode/Service 06 is treated as **monitor/test evidence**, not as a DTC list and not as a mechanical diagnosis.

AutoPulse models a monitor observation as:

```text
MonitorObservation
- sourceEndpointId?
- monitorId / testId / componentId as available
- rawValue
- minLimit?
- maxLimit?
- units/scale only when proven
- result: WITHIN_LIMIT | OUTSIDE_LIMIT | NOT_EVALUABLE
- provenance
```

`OUTSIDE_LIMIT` means the reported monitor result crossed the applicable ECU-reported/verified limit. It does not by itself establish a repair action or root cause.

## Product rules

- Mode 06 evidence never becomes a DTC by inference.
- A monitor identifier is not assigned a human component meaning without reviewed provenance.
- Unsupported/no-data is not `PASS`.
- Missing scale/units yields raw evidence, not guessed engineering values.
- Results remain endpoint-scoped where source attribution exists.
- Mode 06 is optional for earliest DTC Core and cannot block stored/pending/permanent DTC reporting.

## Promotion gate

Before production decoding:

1. verified standard/reference table for the target encoding;
2. CAN and legacy fixture coverage where applicable;
3. raw + decoded golden cases, including unsupported and malformed responses;
4. source-endpoint preservation tests;
5. no guessed MID/TID/CID meaning;
6. safety descriptor classified `READ_ONLY_PROVEN`.

Until these close, Check may report Mode 06 as `NOT_EVALUATED`/`UNAVAILABLE`, never fabricate monitor health.
