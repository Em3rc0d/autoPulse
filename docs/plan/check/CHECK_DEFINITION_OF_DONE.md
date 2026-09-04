# AutoPulse Check — Definition of Done

**Lane:** Plan  
**Authority:** EXECUTION AUTHORITY  
**Status:** CHECK-MK0

## 1. Purpose

Define the exact evidence required before AutoPulse may call Check implemented, physically passed or release-certified. Green CI alone is insufficient.

## 2. CHECK-MK0 documentation DoD

CHECK-MK0 is closed when:

- product boundary is explicit;
- Check and Session Report are separated;
- endpoint attribution model is explicit;
- truth/evidence vocabulary is explicit;
- Core standard-service scope is explicit;
- safety default-deny architecture is explicit;
- persistence/immutability boundary is explicit;
- UX semantics for no-code/limited/unsupported are explicit;
- implementation order and research dependencies are explicit;
- no material architectural decision is left hidden in future code.

Result vocabulary:

```text
CHECK-MK0 = DESIGNED + PLANNED
```

It is not implementation evidence.

## 3. Check Core V1 functional DoD

A Core V1 candidate must demonstrate:

```text
✓ connector characterized
✓ protocol evidence preserved or explicitly UNKNOWN
✓ diagnostic responders/endpoints preserved individually where evidence permits
✓ stored DTC scan
✓ pending DTC scan
✓ permanent DTC scan where supported
✓ MIL / confirmed-DTC evidence
✓ readiness semantics where promoted
✓ service coverage and limitations
✓ no-code semantics are conservative
✓ partial/limited scan semantics
✓ cancellation/disconnect semantics
✓ technical request receipt
```

## 4. Safety DoD

Mandatory deterministic proofs:

```text
unknown request                  → BLOCKED
mutating request                 → BLOCKED
unregistered raw request         → BLOCKED
READ_ONLY_EXPECTED               → BLOCKED in V1
READ_ONLY_PROVEN                 → connector allowed
retry budget exhausted           → no further retry
hard failure threshold reached   → scan stops/degrades
cancel requested                 → no new diagnostic requests
partial evidence                 → retained
```

No physical pilot proceeds if any safety invariant fails.

## 5. Parser DoD

Every promoted parser/service requires:

- positive fixture;
- no-data fixture;
- malformed fixture;
- multi-value/multi-DTC fixture where applicable;
- multi-ECU fixture where applicable;
- source-attribution expectation;
- deterministic output;
- no hidden dependence on UI or hardware objects.

A parser with unknown semantics may preserve raw evidence but may not fabricate decoded meaning.

## 6. Endpoint/capability DoD

The endpoint layer passes when:

```text
✓ source address retained when available
✓ unattributed response remains unattributed
✓ address never silently maps to module role
✓ capability support is endpoint-scoped
✓ advertised support distinct from actual valid observation
✓ unsupported/no-data/timeout/invalid remain distinct
```

## 7. Supported-PID discovery DoD

Before PID enrichment is certified:

```text
✓ support bitmap bit mapping fixture-tested
✓ continuation chain implemented
✓ discovery stops when next block not advertised
✓ support retained per endpoint
✓ full 114-PID blind polling impossible by default planner
✓ advertised-but-no-data remains representable
✓ non-advertised PID not reported as failure
```

## 8. DTC DoD

Before DTC Core physical pass:

```text
✓ P/B/C/U family decode correct
✓ code bytes decoded deterministically
✓ zero padding ignored correctly
✓ duplicates normalized without losing status/source evidence
✓ STORED/PENDING/PERMANENT remain distinguishable
✓ same DTC across modes can be grouped
✓ manufacturer-specific namespace is not mislabeled generic
✓ source endpoint retained when observable
```

## 9. Readiness DoD

Before readiness is shown as complete:

```text
✓ MIL state decoded
✓ confirmed DTC count decoded
✓ spark/compression monitor layout handled correctly
✓ supported vs complete bits separated
✓ NOT_READY != FAILED
✓ current-cycle vs since-clear evidence distinguished where used
```

## 10. Freeze-frame DoD

Before freeze frame is promoted:

```text
✓ frame identity semantics documented
✓ frozen PID values separated from current values
✓ no-frame/unsupported/no-data explicit
✓ endpoint/DTC relation preserved when evidence allows
✓ UI labels historical/frozen context clearly
```

## 11. Mode 06 DoD

Mode 06 remains absent from product claims until:

```text
✓ promoted fixture set
✓ identifier semantics bounded
✓ min/max/test values decoded correctly
✓ unknown manufacturer identifiers remain UNKNOWN
✓ legacy/current response differences handled
✓ monitor result not converted to a mechanical diagnosis
```

## 12. Evidence-planner DoD

The planner passes when:

```text
✓ DTC/concern produces evidence requirements
✓ requirements intersect with endpoint-supported capability
✓ unsupported evidence is not queried blindly
✓ cause hypothesis does not determine evidence outcome
✓ planner cannot bypass safety policy
✓ request budget remains bounded
```

## 13. Correlation/Intelligence DoD

Before Check Intelligence V1:

- evidence graph retains provenance;
- current vs historical evidence remains separately labeled;
- supporting, contradicting and unavailable evidence are distinct;
- event confidence and cause confidence are distinct;
- candidate cause groups are not repair prescriptions;
- insufficient evidence produces `INSUFFICIENT`, not a guessed cause;
- rules are deterministic and fixture-tested;
- claims such as fuel quality remain hypotheses unless specific evidence supports stronger wording.

## 14. Persistence DoD

A completed Check report must survive process restart and reconstruct identically from durable evidence.

Required:

```text
✓ scan metadata durable
✓ endpoint/service evidence durable
✓ DTC/status/source evidence durable
✓ report version metadata durable
✓ integrity/evidence hash verifiable
✓ interrupted scan reconstructable as partial/limited
✓ completed report immutable
✓ future reinterpretation cannot mutate old evidence silently
```

## 15. UX DoD

The real Check UI passes when:

```text
✓ Run Check is the primary action
✓ running stages are understandable without raw terminal output
✓ zero DTCs never renders “vehicle healthy”
✓ LIMITED is first-class
✓ UNSUPPORTED != NORMAL
✓ NOT EVALUATED != NO ISSUE
✓ no universal health percentage
✓ issue details expose code/status/source/evidence
✓ technical evidence is accessible but subordinate
✓ Session Evidence Report moved to History/Session context
```

## 16. Replay DoD

The same `DiagnosticScanEngine` must run against deterministic replay and real connectors.

Replay suite includes at minimum:

```text
no codes
single stored code
multiple stored codes
pending only
permanent only
same code multiple statuses
multi-ECU
no data
timeout
malformed response
partial scan
disconnect
KWP path
CAN path
```

Identical fixture input must produce identical domain/report output.

## 17. Physical pilot DoD — Logan

For the known Logan path:

- exact APK/source SHA recorded;
- adapter identity recorded;
- protocol evidence recorded;
- endpoints observed and retained;
- Core diagnostic requests receipt recorded;
- no destructive command issued;
- stored/pending/permanent results match raw evidence semantics;
- no-code result, if applicable, remains coverage-bounded;
- scan completes or degrades honestly;
- report persists/reopens.

Only then mark `LOGAN CHECK CORE = PHYSICAL PASS`.

## 18. Physical pilot DoD — Duster

Same gate as Logan, treated as independent evidence. Logan success is not inherited.

## 19. Physical pilot DoD — ISO 15765 CAN vehicle

Required before broad standard-OBD release language:

- CAN protocol path exercised;
- multi-responder/header behavior captured;
- endpoint attribution verified under the tested adapter;
- service parser behavior verified;
- request budget acceptable;
- persistence/report path passes.

## 20. Release certification DoD

Check may be marked release-certified only for a stated support envelope when:

```text
Design CLOSED
Research nodes required by claimed features CLOSED
Implementation receipts complete
Automated fixture/replay gates PASS
Safety gates PASS
Physical compatibility matrix PASS for claimed scope
Release documentation states limitations conservatively
```

`CERTIFIED` always names its scope.

## 21. Explicit non-DoD

The following do not prove Check is done:

- a screenshot showing one decoded DTC;
- one vehicle returning `NO DATA` without a crash;
- all unit tests green but no physical connector test;
- one Logan pass generalized to all Renault vehicles;
- one adapter identity string recognized;
- parsing DTC strings without source/status evidence;
- displaying more PIDs than competitors;
- an LLM explanation without deterministic evidence underneath.

## 22. Hammer-ready definition

“Ready to take the hammer” for a runtime milestone means:

```text
all architecture nodes upstream = CLOSED
all research nodes used by that milestone = CLOSED
all safety classifications used = READ_ONLY_PROVEN
all parser contracts used = fixture-backed
no material decision remains implicit
```

If those conditions are not met, the next action remains research/design, not runtime code.
