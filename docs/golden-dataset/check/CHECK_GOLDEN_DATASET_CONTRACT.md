# AutoPulse Check — Golden Diagnostic Dataset Contract

**Lane:** Golden Dataset  
**Authority:** APPROVED EVIDENCESET CONTRACT  
**Status:** PRE-HAMMER CONTRACT / dataset population pending

This document defines what evidence must exist before a Check parser/service/result may be treated as production truth.

## 1. Dataset purpose

The diagnostic Golden Dataset is separate from Live telemetry fixtures. It certifies request/response parsing, endpoint attribution, safety behavior, scan lifecycle and evidence semantics for Check.

No screenshot-only observation is sufficient for byte-level parser truth. Byte-level records require raw/replayable diagnostic evidence or an independently verified synthetic fixture whose origin is explicit.

## 2. Record shape

Every golden case must retain, as applicable:

```text
caseId
sourceType: PHYSICAL_CAPTURE | VERIFIED_REFERENCE | SYNTHETIC_EDGE_CASE
vehicle/protocol/adapter metadata when physical
request semantic descriptor
raw adapter response
normalized lines/frames
source endpoint evidence
expected semantic result
expected failure/coverage state
provenance
review status
engine/parser version
```

Sensitive identity such as VIN must be redacted in public fixtures while preserving deterministic testability.

## 3. Minimum Core corpus

Before real DTC Core activation, the dataset must contain reviewed cases for:

```text
DTC
- zero stored DTC
- one stored DTC
- multiple stored DTCs
- pending-only
- permanent-only where supported
- same code in multiple statuses
- malformed/odd-length payload
- duplicate code normalization
- service response with no result
- NO DATA
- timeout
- disconnect mid-scan

ENDPOINT
- one responder
- multiple responders
- attributed response
- unattributed response
- response-level source ambiguity

TRANSPORT
- proven KWP/legacy envelope
- proven ISO15765/CAN envelope
- multiline/multiframe completion
- adapter noise/prompt handling
- negative response
- bounded response-pending behavior

READINESS
- MIL off/on
- confirmed DTC count
- supported+complete
- supported+not-ready
- unsupported monitor
- spark/compression branch fixtures

SAFETY
- every allowlisted descriptor executes in replay only
- Mode 04 blocked
- Mode 08 blocked
- arbitrary RAW blocked
- arbitrary UDS/vendor command blocked
- malformed/unknown descriptor blocked
```

## 4. Enrichment corpus

Before corresponding features are activated:

```text
PID SUPPORT
- each supported bitmap block used in production
- chained continuation
- stop when continuation absent
- advertised-but-NO_DATA
- not-advertised

FREEZE FRAME
- associated DTC + frozen values
- no frame available
- malformed frame
- frozen/current value separation

SERVICE 09
- supported/unsupported
- legacy and CAN reconstruction where applicable
- VIN privacy/redaction
- Garage mismatch

MODE 06
- valid monitor result
- outside-limit result
- unknown scale/raw preservation
- unsupported
- malformed
```

## 5. Intelligence corpus

A correlation rule is GOLDEN only when the corpus includes:

- supporting evidence;
- contradicting evidence;
- missing/insufficient evidence;
- historical-only evidence that must not be treated as current;
- cause hypothesis that must remain lower confidence than the ECU event;
- regression case ensuring wording/claim strength does not increase silently.

## 6. Promotion states

```text
QUARRY
→ NORMALIZED_FIXTURE
→ REVIEWED
→ GOLDEN
→ PHYSICALLY_CERTIFIED (where required)
```

No implementation test may relabel a quarry record as GOLDEN merely because code currently passes against it.

## 7. Core activation rule

A new live diagnostic request family may connect to the real `DiagnosticConnector` only when its exact descriptor has:

```text
semantic contract CLOSED
+ safety classification READ_ONLY_PROVEN
+ positive golden fixture
+ zero-result/unsupported fixture
+ malformed/failure fixture
+ endpoint behavior fixture when relevant
+ transport envelope fixture
+ parser tests PASS
+ safety adversarial tests PASS
```

Until then the request may exist only in pure domain/parser/replay code.

## 8. Physical pilot promotion

Physical success is scoped to the tested combination. Initial target matrix:

```text
Renault Logan  — legacy/KWP evidence path
Renault Duster — second known vehicle path
one ISO15765/CAN vehicle — modern CAN path
```

No single vehicle makes a generic OBD claim universal.
