# Q-CHECK-006 — Vehicle Information / Identity

**Status:** SEMANTICS_CLOSED_FIXTURES_OPEN  
**Scope:** Standard read-only vehicle/ECU information exposed through Service 09.  
**Runtime impact:** none.

## Boundary

Service 09 data is technical identity evidence. It is not automatically trusted as Garage truth and it is not proof of vehicle compatibility.

Candidate standardized facts include VIN, calibration identifiers, calibration verification numbers and ECU name when actually exposed and correctly decoded.

## Identity model

```text
VehicleIdentityEvidence
- sourceEndpointId?
- field: VIN | CALIBRATION_ID | CVN | ECU_NAME | OTHER
- rawValue
- normalizedValue?
- provenance
- confidence
```

Rules:

- transport reassembly must complete before string/value decoding;
- multi-line/multi-frame responses are not concatenated heuristically in UI;
- unknown source stays unattributed;
- Garage identity and ECU-reported identity are separate authorities;
- mismatch becomes explicit `IDENTITY_MISMATCH`, never silent overwrite;
- VIN must be redacted from ordinary logs/analytics/debug exports unless explicitly required by a protected diagnostic receipt;
- lack of VIN response is not a vehicle fault.

## Promotion gate

Before production Service 09 enrichment:

1. fixtures for supported/unsupported/malformed responses;
2. CAN and legacy reconstruction cases where relevant;
3. deterministic normalization rules;
4. privacy/redaction tests;
5. Garage mismatch behavior tests;
6. exact `READ_ONLY_PROVEN` request descriptors.

Service 09 remains optional enrichment and cannot block DTC Core.
