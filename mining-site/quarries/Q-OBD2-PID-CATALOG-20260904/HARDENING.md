# PID Quarry Hardening — CHECK-MK1 receipt

**Quarry:** `Q-OBD2-PID-CATALOG-20260904`  
**Status:** `HARDENING_IMPLEMENTED_SOURCE_REGEN_OPEN`  
**Runtime impact:** none

## Why this hardening exists

The first extractor normalized repeated DBC declarations by selecting the variant with the widest declared numeric range. That was acceptable for exploratory mining but not acceptable as an upstream source for a production decoder because non-equivalent decoding definitions could be silently collapsed.

The first inventory also used `DBC_OBSERVED`, which conflicts with AutoPulse's product-level meaning of `OBSERVED` as actual runtime/physical evidence.

## Hardening applied to the extractor

The updated `extract_mode01.py` is fail-closed for the frozen v5 evidence pack.

It now verifies before generation:

```text
outer archive SHA-256
nested DBC archive SHA-256
OBD-v4.3.dbc SHA-256
raw declaration count = 580
normalized signal count = 145
unique PID count = 114
Tier 1 intersection = 10
```

Any mismatch aborts extraction.

## Decode semantics preserved

The generated signal-level inventory now retains:

```text
start_bit
bit_length
byte_order
signedness
factor
offset
min
max
unit
```

These fields participate in the normalization signature.

## Duplicate declaration rule

Repeated declarations may normalize to one signal only when their decode signatures are equivalent.

If one signal name has more than one decoding signature:

```text
NORMALIZATION_CONFLICT
→ extraction aborts
→ nothing is promoted
```

The old `pick widest range` heuristic is removed.

## Evidence vocabulary

New generated rows use:

```text
DBC_DEFINED
```

rather than `DBC_OBSERVED`.

`OBSERVED` remains reserved for valid vehicle/runtime evidence.

## What remains open

The original `obd2-pack-v5.zip` is intentionally not committed. Therefore the hardened extractor cannot be certified merely by syntax review.

Before CHECK-MK1 is marked fully CLOSED:

1. rerun the hardened extractor against the exact source archive whose SHA-256 is recorded;
2. verify zero normalization conflicts;
3. regenerate both derived inventories;
4. diff the committed PID inventory against regenerated output;
5. replace the historical `DBC_OBSERVED` rows with regenerated `DBC_DEFINED` output;
6. retain the generated signal-level inventory as build/research evidence or prove deterministic regeneration in CI/harness.

## Current closure state

```text
source hash assertions             IMPLEMENTED
count assertions                   IMPLEMENTED
decode-field preservation          IMPLEMENTED
normalization conflict detection   IMPLEMENTED
DBC_DEFINED vocabulary             IMPLEMENTED IN GENERATOR
python syntax check                 PASS
source-pack regeneration            OPEN
zero-conflict proof                 OPEN
committed CSV regeneration          OPEN
CHECK-MK1 full closure              BLOCKED BY SOURCE REGEN
```

No runtime PID promotion is authorized by this hardening alone.
