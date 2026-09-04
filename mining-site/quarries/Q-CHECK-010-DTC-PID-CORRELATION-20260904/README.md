# Q-CHECK-010 — DTC/PID Correlation and Evidence Planning

**Status:** SEMANTICS_CLOSED_RULE_CORPUS_OPEN  
**Scope:** deterministic evidence planning and concern correlation.  
**Runtime impact:** none.

## Boundary

AutoPulse never implements `DTC == PID` and never treats a related signal as proof of root cause.

The correlation path is:

```text
observed DTC / monitor anomaly
→ concern family
→ candidate evidence requirements
→ intersection with endpoint capabilities
→ targeted safe acquisition
→ evidence graph
→ bounded interpretation
```

## Planner model

```text
EvidenceRequirement
- concernFamily
- evidenceType
- candidateService/PID
- priority: REQUIRED | HIGH | OPTIONAL
- applicability conditions
- reason
- provenance
```

The planner may only request evidence that:

1. has a promoted decoder/reference definition;
2. is advertised/supported by the relevant endpoint when support discovery exists;
3. has an exact `READ_ONLY_PROVEN` command descriptor;
4. fits scan budget and lifecycle state.

## Correlation rules

- current ECU evidence, freeze-frame evidence, Mode 06 evidence and Live history remain separate source classes;
- correlation may create `SUPPORTS`, `CONTRADICTS`, `CONTEXTUALIZES` and `CO_OCCURS` relationships;
- historical Live data never becomes current ECU evidence;
- co-occurrence is not causation;
- missing evidence lowers confidence rather than being converted to normal;
- a cause group may be suggested only with an explicit cause-confidence level;
- fuel-quality, ignition, mechanical and sensor causes remain hypotheses unless evidence specifically establishes one.

## Confidence split

```text
EVENT CONFIDENCE
= confidence that an ECU/monitor event was observed

CONDITION CONFIDENCE
= confidence that the correlated symptom/condition is present

CAUSE CONFIDENCE
= confidence in a proposed root-cause group
```

These values must not be collapsed into one health score.

## Example

`P0171` can map to an `AIR_FUEL` concern and make fuel trims, MAF/MAP, O2/AFR, fuel pressure, RPM/load candidate evidence. AutoPulse queries only the subset safely supported by that endpoint. Elevated trims can strengthen evidence for a lean condition; they do not prove poor fuel quality.

## Promotion gate

Before a correlation rule affects user-facing interpretation:

1. rule ID and version fixed;
2. DTC/concern applicability defined;
3. evidence inputs and source classes explicit;
4. confidence impact explicit;
5. contradiction/missing-data behavior defined;
6. fixture corpus includes positive, negative and insufficient-evidence cases;
7. no rule can emit a stronger cause claim than its evidence contract allows.

Earliest DTC Core may ship without broad correlation; raw diagnostic truth must never depend on Intelligence V1.
