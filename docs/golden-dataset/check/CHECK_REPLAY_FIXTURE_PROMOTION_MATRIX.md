# AutoPulse Check — Replay Fixture Promotion Matrix

**Lane:** Golden Dataset / Check  
**Captured:** 2026-09-05  
**Base implementation:** CHECK-MK6 @ `f92cd4fdaafa1dba2fb9d5a72641bba14dc185b0`  
**Status:** `REPLAY_IMPLEMENTATION_GREEN_CERTIFICATION_BLOCKED`

## 1. Decision

CHECK-MK6 now has a deterministic replay implementation, but replay **certification is not granted** by passing synthetic fixtures alone.

Current authority remains:

```text
REPLAY IMPLEMENTATION    IMPLEMENTED + AUTOMATED PASS
REPLAY CERTIFICATION     BLOCKED
LIVE ECU HAMMER          DESCRIPTOR-GATED
MUTATING DIAGNOSTICS     FORBIDDEN
```

The blocking reason is evidence provenance, not missing runtime architecture.

## 2. Current MK6 fixture inventory

The reusable MK6 corpus is explicitly labelled:

```text
check-replay-corpus/synthetic-v1
SYNTHETIC_NOT_PHYSICAL_CERTIFICATION
```

Current synthetic cases:

| Case | Protocol | Semantic purpose | Current state |
|---|---|---|---|
| `zero-dtc-kwp` | ISO 14230/KWP | zero stored/pending/permanent DTC lists | `NORMALIZED_FIXTURE` |
| `stored-single-kwp` | ISO 14230/KWP | one stored DTC | `NORMALIZED_FIXTURE` |
| `same-dtc-multi-status-kwp` | ISO 14230/KWP | same code across stored/pending + separate permanent code | `NORMALIZED_FIXTURE` |
| `timeout-then-success-kwp` | ISO 14230/KWP | bounded explicit retry | `NORMALIZED_FIXTURE` |
| `response-pending-kwp` | ISO 14230/KWP | NRC `0x78` continuation without hidden second command | `NORMALIZED_FIXTURE` |
| `disconnect-kwp` | ISO 14230/KWP | disconnect termination | `NORMALIZED_FIXTURE` |
| `stored-single-can` | ISO 15765/CAN | Mode 03 item-count byte | `NORMALIZED_FIXTURE` |
| inline `mode01-support-00-kwp` | ISO 14230/KWP | echoed PID + four-byte support bitmap | `NORMALIZED_FIXTURE` |

These cases prove deterministic engine/parser behavior. They do **not** prove that a particular adapter/vehicle emits the represented byte sequence.

## 3. Existing repository corpus

The pre-existing:

```text
mobile-app/src/infrastructure/ble/real/pipeline/golden/GoldenDiagnosticCorpusV1.ts
```

contains useful canonical parser/decoder fixtures including Mode 01 CAN frames, a negative response and an ISO-TP/multiframe DTC-shaped case.

Its own source comment states that these are small canonical fixtures and are **not bundled raw-capture archives**.

Disposition:

```text
useful cross-check / regression evidence     YES
physical-capture provenance                  NO
sufficient alone for PHYSICALLY_CERTIFIED   NO
```

No existing repository artifact located in this review supplies a raw KWP or CAN Check capture with the full Golden Dataset record shape required by `CHECK_GOLDEN_DATASET_CONTRACT.md`.

## 4. Promotion truth

Every candidate record must retain, where applicable:

```text
caseId
sourceType
vehicle / protocol / adapter metadata
request semantic descriptor
raw adapter response
normalized lines / frames
source endpoint evidence
expected semantic result
expected failure / coverage state
provenance
review status
engine / parser version
raw evidence hash
```

Promotion is:

```text
QUARRY
  ↓
NORMALIZED_FIXTURE
  ↓
REVIEWED
  ↓
GOLDEN
  ↓
PHYSICALLY_CERTIFIED  (where required)
```

Passing implementation tests may move a synthetic record into a reviewed fixture lane only after provenance review. It does not itself perform the `GOLDEN` or `PHYSICALLY_CERTIFIED` promotion.

## 5. Core replay-certification gap matrix

### DTC / KWP

| Evidence | Synthetic implementation | Promoted reference | Physical/raw capture |
|---|---:|---:|---:|
| zero stored DTC | YES | OPEN | OPEN |
| one stored DTC | YES | OPEN | OPEN |
| multiple stored DTCs | PARTIAL via multi-status fixture | OPEN | OPEN |
| pending-only | parser covered | OPEN | OPEN |
| permanent-only | parser covered | OPEN | OPEN |
| same DTC in several statuses | YES | OPEN | OPEN |
| NO DATA | structural coverage | OPEN | OPEN |
| timeout → retry | YES | OPEN | OPEN |
| disconnect | YES | OPEN | OPEN |
| negative response | parser coverage exists | OPEN | OPEN |
| Response Pending → success | YES | OPEN | OPEN |
| source endpoint attribution | synthetic endpoint | OPEN | OPEN |
| multiple KWP responders | OPEN | OPEN | OPEN |
| unattributed physical response | OPEN | OPEN | OPEN |

### DTC / ISO15765 CAN

| Evidence | Synthetic implementation | Promoted reference | Physical/raw capture |
|---|---:|---:|---:|
| Mode 03 item-count byte | YES | candidate repository cross-check | OPEN |
| Mode 03 multiframe/reassembly | parser corpus has fail-closed shape | OPEN | OPEN |
| multiple responders | OPEN | OPEN | OPEN |
| source attribution | synthetic only | OPEN | OPEN |
| Mode 07 CAN envelope | BLOCKED by MK4 promotion gate | OPEN | OPEN |
| Mode 0A CAN envelope | BLOCKED by MK4 promotion gate | OPEN | OPEN |

### PID support discovery

| Evidence | Synthetic implementation | Physical/raw capture |
|---|---:|---:|
| `0100` echoed PID + bitmap | YES | OPEN |
| continuation advertised | YES | OPEN |
| continuation absent | parser unit coverage | OPEN |
| endpoint-specific differing support | planner coverage | OPEN |
| advertised then NO DATA | OPEN for full engine flow | OPEN |
| dynamic `0100 → 0120 → ...` re-plan | DEFERRED to capability enrichment | OPEN |

### Safety / scheduling

| Property | Structural/replay proof | Physical timing evidence |
|---|---:|---:|
| default deny | YES | N/A |
| Mode 04 blocked | YES | N/A — must never be tested by sending it |
| Mode 08 blocked | YES | N/A — must never be tested by sending it |
| RAW/UDS/vendor unregistered blocked | YES | N/A |
| total command budget | YES | N/A |
| per-response byte ceiling | YES | N/A |
| retry cannot escape command budget | YES | N/A |
| Response Pending does not count as hidden retry | YES | OPEN for physical behavior |
| next-command pacing after pending continuation | YES | OPEN |
| production `minInterCommandDelayMs` | mechanism only | OPEN |
| production request/stage deadlines | mechanism only | OPEN |

## 6. What can be certified now

The following claim is supported:

```text
CHECK-MK6 REPLAY IMPLEMENTATION
= deterministic + fail-closed + automated PASS
```

The following claims are **not** supported yet:

```text
KWP replay corpus = GOLDEN
CAN replay corpus = GOLDEN
KWP physical diagnostic parsing = CERTIFIED
CAN physical diagnostic parsing = CERTIFIED
production KWP timing profile = CERTIFIED
production CAN timing profile = CERTIFIED
```

## 7. Evidence collection order

When physical evidence collection is separately authorized and performed safely while the vehicle is stationary, the minimal order is:

```text
1. Logan / known ISO 14230 KWP
   - existing read-only environment characterization
   - exact raw response/provenance for already-approved read families only
   - no fault induction

2. Duster
   - same evidence contract

3. ISO15765/CAN vehicle
   - Mode 03 envelope / responder attribution / multiframe behavior
```

This document does not authorize a new physical command family and does not request destructive or fault-inducing tests.

## 8. Capture acceptance rule

A future physical capture is promotable only if:

```text
exact descriptor is identified
+ request is already READ_ONLY_PROVEN
+ vehicle is stationary
+ adapter/protocol metadata retained
+ raw response retained before interpretation
+ source endpoint evidence retained where available
+ capture hash recorded
+ normalized fixture is reproducible from raw evidence
+ expected result reviewed independently from current parser output
```

Parser output alone may not define its own expected result.

## 9. Exit gate for Replay Certification

`REPLAY CERTIFICATION` may move from `BLOCKED` only when the required Core subset has:

```text
reviewed promoted fixtures
+ provenance complete
+ parser expectations independently reviewed
+ KWP transport evidence sufficient for the declared KWP scope
+ CAN transport evidence sufficient for the declared CAN scope
+ no unresolved attribution ambiguity hidden by the fixture model
+ automated replay green at the exact certified SHA
```

Physical certification remains scoped to the exact tested vehicle/adapter/protocol combinations.

## 10. Current verdict

```text
CHECK-MK3 DOMAIN                 REVIEWED / GREEN
CHECK-MK4 PARSERS               REVIEWED / GREEN
CHECK-MK5 SAFETY + PLANNER      REVIEWED / GREEN
CHECK-MK6 REPLAY IMPLEMENTATION REVIEWED / GREEN

REPLAY FIXTURE POPULATION       PARTIAL — SYNTHETIC
REPLAY CERTIFICATION            BLOCKED — PROVENANCE GAP
LIVE DIAGNOSTIC ACTIVATION      BLOCKED — DESCRIPTOR + GOLDEN GATES
MUTATING DIAGNOSTICS            FORBIDDEN
```
