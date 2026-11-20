# AutoPulse Evidence Invariants v1

**Status:** FROZEN FOR CURRENT CORE  
**Purpose:** reconcile the minimum truth semantics shared by Live, Check, compatibility and future longitudinal features without forcing a production-wide schema migration during certification.

## 1. Core rule

AutoPulse may use different domain models for different evidence producers, but every promoted evidence item must preserve enough information to answer:

```text
WHAT was observed?
WHEN was it observed?
ABOUT WHAT entity/session/check?
FROM WHAT source?
HOW was it acquired?
HOW trustworthy/current is it?
WHAT was not observed or not covered?
```

A single mega-entity is not required.

## 2. Required semantic dimensions

### Identity / subject
Evidence must be attributable to the relevant subject when the product makes a scoped claim:

- vehicle;
- session;
- Check/report;
- ECU/endpoint when known;
- adapter/transport context where relevant.

Unknown attribution remains unknown. Never invent an ECU identity.

### Time
Evidence must preserve an observation timestamp or a bounded acquisition window.

A stored old value is not current evidence merely because it is the latest value available.

### Source
At minimum distinguish:

- ECU/vehicle-origin evidence;
- adapter-origin evidence;
- phone/device-origin evidence;
- persisted/reconstructed evidence;
- human/user/workshop claim;
- derived/inferred evidence.

Source class and truth status are separate concepts.

### Provenance
Evidence should retain the acquisition path or evidence producer sufficiently to audit the claim, for example:

```text
ECU direct via OBD Mode 01
adapter ATRV
Check read-only service
local persisted telemetry reconstruction
user-supplied intervention
derived policy output
```

### Quality / integrity
Quality must not collapse missing, stale, invalid, unsupported and untrusted into one value.

Current Core semantics already include several domain-specific states. Their labels may differ, but the following distinctions are mandatory:

```text
VALID / OBSERVED
UNAVAILABLE
NOT_OBSERVED
UNSUPPORTED
STALE
INVALID
UNTRUSTED
CORRUPTED / INTEGRITY_FAILURE
```

### Coverage
Where a conclusion depends on what was scanned, polled or reconstructed, coverage must remain explicit.

```text
NO DTC OBSERVED
≠
VEHICLE HAS NO FAULTS
```

```text
PID NOT AVAILABLE
≠
PID VALUE = 0
```

### Confidence / uncertainty
When AutoPulse makes an interpretation rather than a direct observation, it must preserve the distinction.

```text
OBSERVED
≠
INFERRED
≠
CLAIMED
≠
SUPPORTED
≠
VERIFIED
```

The vocabulary may be specialized by domain, but the epistemic boundary must survive.

## 3. Non-negotiable invariants

1. `UNKNOWN ≠ ZERO`
2. `UNKNOWN ≠ NORMAL`
3. `MISSING ≠ UNSUPPORTED`
4. `STALE ≠ CURRENT`
5. `ADAPTER EVIDENCE ≠ ECU EVIDENCE`
6. `NO_DATA ≠ TRANSPORT FAILURE`
7. `NO DTC OBSERVED ≠ VEHICLE HEALTHY`
8. `CORRELATION ≠ CAUSATION`
9. `TEMPORAL ORDER ≠ CAUSAL PROOF`
10. `SAME DTC ≠ SAME EPISODE`
11. `SAME SYMPTOM ≠ SAME ROOT CAUSE`
12. `REPAIR FOLLOWED BY IMPROVEMENT ≠ ROOT CAUSE VERIFIED`
13. `IMPLEMENTED ≠ SUPPORTED`
14. `SUPPORTED ≠ OBSERVED`
15. `OBSERVED ≠ PHYSICALLY CERTIFIED`
16. `ONE TESTED VEHICLE ≠ MODEL/MANUFACTURER UNIVERSALITY`

## 4. Current domain mapping

### Live

Primary evidence:

- OBD command/result;
- decoded readings;
- timestamps/freshness;
- telemetry block integrity;
- session lifecycle;
- source/provenance.

Live may present a degraded/limited state when only part of the evidence surface is lost.

### Check

Primary evidence:

- planned read-only request;
- protocol;
- normalized diagnostic envelope;
- endpoint attribution when proven;
- DTC/readiness/freeze-frame/Mode 06/PID evidence;
- coverage;
- immutable report + integrity hash;
- limitations.

Check must not infer “healthy car” from absence of observed codes.

### Compatibility

Keep separate:

```text
STANDARD_DEFINITION
CAPABILITY_ADVERTISED
PROBE_RESULT
LIVE_OBSERVATION
PHYSICALLY_VALIDATED
```

Do not silently promote one class into another.

### Session History

History currently preserves session evidence.

It is not yet equivalent to full longitudinal Vehicle Memory.

### Future Vehicle Memory

Future records must consume the same truth boundary, adding:

- intervention;
- outcome;
- configuration context;
- episode relationships;
- knowledge revision.

This document does not authorize those production capabilities.

## 5. Presentation rule

Internal sophistication may be high. User-facing language should remain understandable.

Prefer:

> “No pudimos verificar este dato.”

over exposing implementation vocabulary when not useful.

Prefer:

> “No se detectaron códigos en las unidades que pudieron revisarse.”

over:

> “El carro está sano.”

## 6. Certification rule

Any physical claim must remain traceable to:

```text
artifact
→ device
→ adapter
→ vehicle
→ acquisition
→ persisted evidence
→ interpretation
```

The evidence model must never erase the scope of that chain.

## 7. Migration decision

During current P0 certification:

- do not replace all existing evidence models;
- do not create a universal mega-schema;
- do not perform broad persistence migrations merely for naming consistency.

Instead:

1. preserve current working domain models;
2. enforce these invariants in new code;
3. reconcile only when a concrete feature crosses domain boundaries;
4. promote shared primitives during the future Vehicle Memory CONTRACT if behavioral validation earns that work.

This avoids destabilizing a functioning Core while preventing future semantic divergence.
