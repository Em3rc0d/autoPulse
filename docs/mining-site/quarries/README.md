# AutoPulse Mining Site — Quarries

**Lane:** Mining Site / Quarries
**Authority:** SOURCE EVIDENCE

A quarry preserves field evidence with minimal interpretation. It is the source layer from which Test and Golden Dataset records are derived.

## Quarry rules

1. Preserve failures as carefully as successes.
2. Record vehicle, build, adapter and device context when known.
3. Separate **observed** from **inferred**.
4. Do not convert a screenshot into a raw OBD-frame claim.
5. Do not convert one vehicle result into manufacturer-wide compatibility.
6. Do not rewrite old quarry records when a defect is fixed; add a later quarry/retest and link them.
7. If raw logs/captures are unavailable, say so.
8. A quarry may contain incomplete/contradictory evidence; the Golden Dataset is where approved normalization happens.

## Current quarry catalog

| Quarry | Vehicle | Build lineage | Main contribution | Current outcome |
|---|---|---|---|---|
| Q-001 | Renault Logan 2014 | P1/RC3 lineage | acquisition, Off-Road phone sensors, background interruption, History, TextDecoder failure | mixed: major acquisition/persistence PASS, Summary defect found and later fixed |
| Q-002 | Renault Duster 2014 | RC3 | second-vehicle acquisition, multi-mode telemetry, Summary reconstruction, Off-Road destabilization | mixed: base ECU path PASS, Off-Road FAIL pending RC4 retest |
| Q-003 | Renault Duster 2014 | RC4 | Off-Road sidecar isolation + clean Stop Summary semantics | planned / pending physical execution |

## Evidence categories

### `UI_OBSERVATION`

Visible state from screenshot/video/user observation.

### `PHYSICAL_BEHAVIOR`

Observed interaction with a real vehicle/device, such as mode selection, adapter disconnect or backgrounding.

### `RAW_LOG`

Application log with timestamps/source information.

### `RAW_OBD_CAPTURE`

Raw request/response or bus-level capture suitable for parser/protocol fixture generation.

### `PERSISTED_SESSION_METADATA`

History/Summary/database-derived facts such as block/read count, termination reason and session integrity.

Current Logan/Duster quarries rely heavily on `UI_OBSERVATION` and `PHYSICAL_BEHAVIOR`; they are not a substitute for a complete `RAW_OBD_CAPTURE` corpus.

## Quarry → Golden promotion checklist

A quarry fact may be promoted only when:

- [ ] source is identified;
- [ ] context/scope is explicit;
- [ ] observation is reproducible or sufficiently clear;
- [ ] no unresolved contradiction invalidates the claim;
- [ ] defect status is preserved;
- [ ] claim does not over-generalize;
- [ ] provenance links to build/test evidence.
