# AutoPulse Check — Research Matrix

**Lane:** Plan  
**Authority:** EXECUTION AUTHORITY  
**Status:** CHECK-MK0 research closure map

## 1. Rule

Research is promoted only when it produces enough evidence to constrain implementation. A source list alone does not close a node.

Each quarry must produce:

```text
scope + boundary
source provenance
standard/request semantics
positive response examples
negative/no-data/error semantics
transport caveats
parser expectations
safety classification
known ambiguities
promotion gate
```

## 2. Q-CHECK-001 — OBD DTC services

**Goal:** close acquisition semantics for standard stored, pending and permanent DTCs.

Must establish:

- request/positive-response service mapping for Mode 03, 07 and 0A;
- DTC two-byte encoding and zero-padding termination behavior;
- handling of multiple DTCs;
- handling of multiple ECU responders;
- distinction between no codes, `NO DATA`, timeout and invalid response;
- same DTC observed in multiple status classes;
- generic vs manufacturer-specific namespace boundary;
- preservation of source endpoint.

Promotion artifacts:

```text
service_catalog.json
fixtures/stored/*
fixtures/pending/*
fixtures/permanent/*
dtc_decode_contract.md
negative_response_matrix.md
```

Core blocker: **YES**.

## 3. Q-CHECK-002 — supported PID discovery

**Goal:** turn support bitmaps into an endpoint-scoped capability map.

Must establish:

- bitmap block semantics for 00/20/40/60/80/A0/C0 and continuation behavior;
- bit-to-PID mapping;
- endpoint/source attribution;
- chained stop condition;
- response with multiple endpoints;
- advertised PID that later returns no-data;
- non-advertised PID semantics;
- distinction between `REFERENCE_DEFINED` and `ECU_ADVERTISED`.

Promotion artifacts:

```text
support_bitmap_contract.md
bitmap_fixtures.json
edge_cases.md
```

Core blocker: **NO for earliest DTC-only core; YES for PID enrichment**.

## 4. Q-CHECK-003 — readiness / MIL monitors

**Goal:** fully decode standard readiness evidence without converting incompleteness into failure.

Must establish:

- PID 0101 semantics;
- PID 0141 semantics where applicable;
- MIL bit and confirmed-DTC count;
- supported monitor bits;
- incomplete/completed monitor bits;
- spark-ignition vs compression-ignition monitor layouts;
- `NOT_READY != FAILED` rule;
- current drive-cycle vs since-clear semantics.

Promotion artifacts:

```text
readiness_contract.md
spark_fixtures.json
compression_fixtures.json
presentation_semantics.md
```

Core blocker: **YES for readiness section; DTC-only scan can be staged before full UI promotion**.

## 5. Q-CHECK-004 — freeze frame

**Goal:** define safe acquisition and attribution of freeze-frame context.

Must establish:

- Mode 02 request structure;
- frame-number semantics;
- relationship to the DTC indicated by standard freeze-frame metadata;
- PID support/availability within freeze frame;
- endpoint attribution;
- no-frame / unsupported / no-data outcomes;
- separation of frozen historical values from current Mode 01 values.

Promotion artifacts:

```text
freeze_frame_contract.md
frame_fixtures.json
attribution_rules.md
```

Core blocker: **NO for first DTC core; YES for Intelligence enrichment**.

## 6. Q-CHECK-005 — Mode 06

**Goal:** define monitor-result acquisition without guessing TID/MID/CID semantics.

Must establish:

- differences between legacy and newer Mode 06 response forms;
- monitor/test identifiers and component identifiers where standardized;
- value/min/max encoding;
- unsupported/unknown test semantics;
- manufacturer-specific limits/identifiers boundary;
- multi-frame/transport implications;
- what can be safely surfaced generically.

Promotion artifacts:

```text
mode06_contract.md
standard_fixture_set.json
unknown_identifier_cases.json
presentation_boundary.md
```

Core blocker: **NO**. Intelligence V1 blocker: **YES if Mode 06 is claimed**.

## 7. Q-CHECK-006 — vehicle information

**Goal:** define safe standard vehicle/ECU information acquisition.

Must establish:

- Mode 09 supported-info discovery;
- VIN read semantics;
- calibration ID / CVN / ECU-name data that AutoPulse plans to use;
- multi-message reconstruction;
- missing/partial VIN handling;
- privacy rules for persisted VIN;
- Garage identity mismatch behavior.

Promotion artifacts:

```text
mode09_contract.md
vin_fixtures.json
privacy_boundary.md
identity_mismatch.md
```

Core blocker: **NO**. Optional enrichment.

## 8. Q-CHECK-007 — ECU attribution

**Goal:** guarantee that observations are associated with the correct responder as far as available evidence permits.

Must establish:

- source-address evidence under ISO 15765 CAN;
- source attribution under ISO 14230/KWP and ISO 9141 through supported adapter formatting;
- behavior when headers/source address are unavailable;
- multi-responder aggregation hazards;
- rules for `UNKNOWN` endpoint;
- explicit prohibition on address-to-role guessing;
- future profile mechanism for evidence-backed role assignment.

Promotion artifacts:

```text
endpoint_identity_contract.md
can_examples.json
kwp_examples.json
unattributed_cases.json
```

Core blocker: **YES**.

## 9. Q-CHECK-008 — diagnostic safety

**Goal:** produce the evidence-backed allowlist consumed by `DiagnosticCommandSafetyPolicy`.

Must establish for every Core request:

- semantic intent;
- read-only classification;
- expected positive response;
- possible negative responses;
- no known mutation of vehicle diagnostic state;
- timing/session assumptions;
- raw payload representation for current connectors.

Must explicitly classify mutating families as prohibited, including clearing DTCs and write/control services.

Promotion artifacts:

```text
read_only_allowlist.json
blocked_command_families.md
request_safety_receipts.md
```

Core blocker: **ABSOLUTE YES**.

## 10. Q-CHECK-009 — DTC knowledge

**Goal:** build a provenance-aware code-definition knowledge layer.

Must establish:

- P/B/C/U family decoding;
- generic vs manufacturer-specific namespace rules;
- canonical standard descriptions where legally/source-wise usable;
- unknown-code behavior;
- provenance/version representation;
- no dependence on one commercial lookup site as the sole canonical source.

Promotion artifacts:

```text
dtc_namespace_contract.md
source_registry.json
sample_catalog.json
unknown_code_cases.md
```

Core blocker: **NO for raw code capture; YES before claiming rich descriptions broadly**.

## 11. Q-CHECK-010 — DTC/PID correlation

**Goal:** define deterministic evidence requirements without pretending correlation proves root cause.

Must establish concern families such as:

```text
COMBUSTION
AIR_FUEL
COOLING
EMISSIONS
ELECTRICAL
SENSOR
COMMUNICATION
TRANSMISSION
```

For each promoted concern family define:

- triggering DTC/monitor evidence;
- candidate PID families;
- supporting evidence patterns;
- contradicting evidence patterns;
- insufficient-evidence behavior;
- cause groups, not repair prescriptions;
- event-confidence vs cause-confidence rules.

Promotion artifacts:

```text
concern_taxonomy.json
evidence_requirements.json
correlation_fixtures.json
confidence_contract.md
```

Core blocker: **NO**. Intelligence V1 blocker: **YES**.

## 12. Q-CHECK-011 — transport behavior

**Goal:** prevent Check from encoding CAN-only timing/framing assumptions.

Must cover at least:

```text
ISO_15765_CAN
ISO_14230_KWP
ISO_9141_2
ELM/STN response normalization
```

Must establish:

- command completion/prompt behavior;
- header/source availability;
- multi-line/multi-frame responses;
- adapter formatting variance;
- timeout and retry recommendations;
- protocol-specific scan budgets;
- clone/noise cases relevant to the existing parser pipeline.

Promotion artifacts:

```text
transport_matrix.md
timeout_budget.json
raw_response_fixtures/
normalization_rules.md
```

Core blocker: **YES**.

## 13. Source hierarchy

Preferred source priority:

```text
1. applicable standard / official technical documentation
2. adapter/vendor technical documentation for adapter behavior
3. reputable machine-readable technical datasets with provenance
4. physically captured AutoPulse evidence
5. secondary references for cross-check/explanation
```

A secondary consumer-facing site may inform human descriptions but should not become the sole authority for wire semantics.

## 14. Physical evidence promotion

A quarry based on a real vehicle must record:

```text
vehicle identity scope
adapter identity
app/source SHA
protocol evidence
request issued
raw response where permissible
source endpoint evidence
decoded expectation
observed limitations
```

Physical evidence from Logan or Duster proves only the tested path until promoted through the compatibility matrix.

## 15. Research closure waves

### Wave A — required before first runtime Check Core

```text
Q-CHECK-001 DTC_SERVICES
Q-CHECK-007 ECU_ATTRIBUTION
Q-CHECK-008 DIAGNOSTIC_SAFETY
Q-CHECK-011 TRANSPORT_BEHAVIOR
```

### Wave B — required before complete standard Core report

```text
Q-CHECK-003 READINESS_MONITORS
Q-CHECK-002 SUPPORTED_PID_DISCOVERY
Q-CHECK-004 FREEZE_FRAME
Q-CHECK-006 VEHICLE_INFORMATION (if promoted in Core UI)
```

### Wave C — required before Check Intelligence V1

```text
Q-CHECK-005 MODE06 (if claimed)
Q-CHECK-009 DTC_KNOWLEDGE
Q-CHECK-010 DTC_PID_CORRELATION
```

## 16. Research stop rule

If a source or physical capture conflicts with an existing assumption, mark the node `CONFLICT` and return to Design. Do not normalize conflicting evidence into a convenient implementation rule.
