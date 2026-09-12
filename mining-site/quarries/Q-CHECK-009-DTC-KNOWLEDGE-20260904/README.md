# Q-CHECK-009 — DTC Knowledge and Provenance

**Status:** SEMANTICS_CLOSED_CATALOG_OPEN  
**Scope:** human meaning, taxonomy and provenance for DTCs already observed from ECUs.  
**Runtime impact:** none.

## Boundary

The acquisition layer may prove that a code such as `P0301` was reported. The knowledge layer separately decides whether AutoPulse can attach a canonical human meaning, family, manufacturer scope and evidence hints.

No UI string is allowed to become diagnostic truth merely because it resembles a common internet description.

## Versioned model

```text
DtcDefinition
- code
- family: POWERTRAIN | CHASSIS | BODY | NETWORK
- namespace: GENERIC | MANUFACTURER_SPECIFIC | UNKNOWN
- canonicalMeaning?
- applicability?
- concernFamily?
- evidenceHints[]
- sources[]
- knowledgeVersion
- confidence
```

## Rules

- code observation remains valid even if meaning is unavailable;
- generic and manufacturer-specific meanings are never merged silently;
- `P/B/C/U` classification is separate from root-cause interpretation;
- descriptions require provenance and versioning;
- evidence hints select candidate evidence only; they are not causal conclusions;
- a manufacturer-specific code without a certified profile may be shown as a code with `meaning unavailable`;
- changes to the knowledge catalog never mutate historical scan evidence or historical reports in place.

## Cause boundary

AutoPulse distinguishes:

```text
ECU EVENT CLAIM
"ECU reported P0301"

MEANING CLAIM
"Cylinder 1 misfire detected"

CAUSE HYPOTHESIS
"ignition / fuel / air / mechanical"
```

Each layer has independent evidence/provenance.

## Promotion gate

Before a DTC definition is user-facing:

1. source/provenance recorded;
2. generic vs manufacturer-specific scope resolved;
3. canonical wording reviewed;
4. concern category reviewed;
5. evidence hints reviewed separately from meaning;
6. catalog version fixed;
7. regression test prevents meaning drift for frozen records.

The first DTC Core may capture/report raw codes before full catalog coverage. Missing descriptions must degrade honestly, never block scanning.
