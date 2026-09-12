# AutoPulse Check — Research Wave B closure receipt

**Wave:** `CHECK-CORE-WAVE-B-20260904`  
**Branch:** `research/check-core-wave-b-20260904`  
**Base:** Wave A semantic closure  
**Runtime impact:** none

## Scope

Wave B closes the semantics required for diagnostic enrichment and hardens the PID research extractor:

```text
CHECK-MK1 hardening of Q-OBD2-PID-CATALOG
Q-CHECK-002 supported PID discovery
Q-CHECK-003 readiness / MIL monitors
Q-CHECK-004 freeze frame
```

## Q-OBD2-PID-CATALOG hardening

Implemented in research tooling:

```text
✓ fail-closed source/archive/DBC SHA assertions
✓ fail-closed 580/145/114/10 count assertions
✓ preserve start-bit / length / endian / sign / factor / offset / bounds / unit
✓ normalize duplicates only when decode signatures are equivalent
✓ NORMALIZATION_CONFLICT aborts extraction
✓ generator emits DBC_DEFINED instead of DBC_OBSERVED
✓ Python syntax gate passes
```

Still open:

```text
source-pack rerun
zero-conflict proof against exact ZIP
regenerated committed CSV
```

Therefore CHECK-MK1 is `HARDENING_IMPLEMENTED_SOURCE_REGEN_OPEN`, not fully certified.

## Q-CHECK-002 supported PID discovery

Closed semantics:

```text
REFERENCE_DEFINED != ECU_ADVERTISED != QUERIED != OBSERVED
32-bit support blocks
endpoint-scoped capability
continuation-chain discovery
no blind 114-PID sweep
advertised-but-NO_DATA remains representable
non-advertised != fault
```

Fixtures and physical multi-ECU proof remain open.

## Q-CHECK-003 readiness

Closed product/domain semantics:

```text
MIL != readiness
DTC count != parsed DTC list
supported != complete
NOT_READY != FAILED
spark layout != compression layout
0101 SINCE_DTC_CLEAR != 0141 CURRENT_DRIVE_CYCLE
```

Exact production bit-table verification and fixtures remain open.

## Q-CHECK-004 freeze frame

Closed semantics:

```text
FREEZE_FRAME != CURRENT PID
FREEZE_FRAME != AUTOPULSE LIVE HISTORY
associated DTC is an evidence relation
no frame != healthy / no codes
no invented wall-clock event time
targeted enrichment rather than blind Mode02 sweep
```

Fixtures remain open.

## Important consequence for Check architecture

The scanner pipeline now has a precise capability/evidence boundary:

```text
reference catalog
→ endpoint support discovery
→ diagnostic concern
→ evidence requirements
→ supported targeted requests
→ current/frozen observations
```

This removes the temptation to make Check “scan 114 PIDs” as a product feature.

## Runtime hammer state after Wave B

```text
CHECK-MK0 architecture       CLOSED
Wave A semantics             CLOSED
Wave B semantics             CLOSED
PID hardening code           READY
PID source regeneration      OPEN
parser/transport fixtures    OPEN
readiness fixtures           OPEN
freeze-frame fixtures        OPEN
runtime diagnostic hammer    BLOCKED
```

## Next closure wave

```text
Q-CHECK-005 Mode 06
Q-CHECK-006 vehicle information
Q-CHECK-009 DTC knowledge/provenance
Q-CHECK-010 DTC/PID correlation
Diagnostic Golden Dataset contract
Pre-Hammer Closure Matrix
```
