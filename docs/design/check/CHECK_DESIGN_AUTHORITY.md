# AutoPulse Check — Design Authority

**Lane:** Design  
**Authority:** DESIGN AUTHORITY  
**Status:** CHECK-MK0 / architecture freeze candidate  
**Applies to:** the future AutoPulse Check subsystem. It does not redefine Live acquisition.

## 1. Product boundary

AutoPulse has three separate product surfaces and they must not be conflated:

```text
LIVE
= acquisition and driver-oriented interpretation while the vehicle is operating

SESSION REPORT
= immutable reconstruction of what AutoPulse captured during one Live session

CHECK
= active read-only interrogation of diagnostic ECUs/endpoints and their evidence
```

The current Check Lite V1 implementation is semantically a **Session Evidence Report**. Its proven reconstruction, integrity, signal-summary and compatibility evidence are retained, but its long-term product home is `History -> Session -> Session Report`, not the main Check surface.

Check must work even when no prior Live session exists.

## 2. Check product question

One Check run must answer, with explicit evidence boundaries:

1. Can AutoPulse communicate reliably with the connected vehicle?
2. Which diagnostic endpoints/responders were actually observed?
3. Which safe diagnostic services were successfully read from each endpoint?
4. Which DTCs, readiness facts, freeze-frame facts, monitor results and supported live-data signals were observed?
5. Which evidence is related to each diagnostic concern?
6. Which conclusions are supported, which are hypotheses, and which areas were not evaluated?

A Check result is never a mechanical certification and never a universal vehicle-health verdict.

## 3. Existing foundation that is reused

The current repository already contains product-worthy foundations:

- `DiagnosticConnector` as the hardware-neutral diagnostic boundary;
- `ElmBleDiagnosticConnector` as the adapter over the proven BLE/ELM pipeline;
- `DiagnosticDiscovery` for adapter/protocol/standard-OBD evidence;
- `EcuCapabilityDiscovery` for source-address-attributed responses;
- `DiagnosticServiceCharacterization` for safe generic service probes;
- `CompatibilitySnapshot` as durable characterization evidence;
- `RuntimeCompatibilityCharacterization` as the current orchestration path.

Check must extend and refactor these components where appropriate. It must not create a second BLE stack or a parallel diagnostic truth model.

## 4. Diagnostic truth model

Every diagnostic fact belongs to one of these evidence stages:

```text
REFERENCE_DEFINED
    ↓
ECU_ADVERTISED
    ↓
QUERIED
    ↓
OBSERVED / NO_DATA / INVALID / TIMEOUT / UNSUPPORTED
```

No stage may be inferred from a previous stage.

Examples:

- a PID in the OBD standard is `REFERENCE_DEFINED`;
- a support bitmap can establish `ECU_ADVERTISED` for one endpoint;
- issuing the request establishes `QUERIED`;
- a valid response establishes `OBSERVED`;
- catalog presence alone never establishes vehicle support.

The word `OBSERVED` is reserved for runtime/physical evidence. Research artifacts should use vocabulary such as `DBC_DEFINED` or `REFERENCE_DEFINED`, not `DBC_OBSERVED`.

## 5. Diagnostic endpoint model

Check reasons about individual diagnostic endpoints, not a single global vehicle capability set.

Conceptual entity:

```text
DiagnosticEndpoint
- endpointId
- sourceAddress
- protocol
- role: UNKNOWN | ENGINE | TRANSMISSION | ABS | SRS | BODY | STEERING | HVAC | OTHER
- roleConfidence
- identityEvidence[]
- supportedServices[]
- supportedPids[]
- scanStatus
```

Rules:

- source address is evidence, not a module-role claim;
- `address != role` unless a reviewed profile/evidence source establishes the role;
- support is stored per endpoint;
- unattributed successful observations are retained rather than silently assigned.

## 6. Check state machine

Check uses an explicit state machine, not independent `loading/error/done` booleans.

```text
IDLE
→ CONNECTING
→ IDENTIFYING_CONNECTOR
→ DISCOVERING_PROTOCOL
→ DISCOVERING_ECUS
→ DISCOVERING_CAPABILITIES
→ SCANNING_DTC
→ SCANNING_READINESS
→ SCANNING_FREEZE_FRAME
→ SCANNING_MONITORS
→ PLANNING_EVIDENCE
→ ACQUIRING_TARGETED_PIDS
→ CORRELATING
→ SEALING_REPORT
→ COMPLETE
```

Terminal/degraded outcomes:

```text
COMPLETE
LIMITED
CANCELLED
FAILED
DISCONNECTED
```

A later-stage failure must not erase valid earlier evidence. `LIMITED` is preferred when a meaningful subset completed.

## 7. Standard Check Core scope

The target standard-services envelope is:

```text
Service/Mode 01  current data, support discovery, MIL/readiness
Service/Mode 02  freeze-frame data
Service/Mode 03  stored DTCs
Service/Mode 06  on-board monitor test results
Service/Mode 07  pending DTCs
Service/Mode 09  vehicle information
Service/Mode 0A  permanent DTCs
```

Each service enters runtime only after its research boundary, parser contract, fixtures and safety classification are closed.

No service is assumed available merely because it exists in the standard.

## 8. Supported-PID discovery

Check must not blind-poll the entire PID quarry.

Support discovery is endpoint-scoped and chained through standard support blocks:

```text
0100
→ if next block advertised: 0120
→ if next block advertised: 0140
→ 0160
→ 0180
→ 01A0
→ 01C0
```

The scanner stops when the endpoint no longer advertises the next block or when a protocol/adapter budget terminates discovery.

The PID quarry is a reference catalog, not a runtime polling list.

## 9. DTC model

A DTC is not a PID and must not be represented only as a string in the final domain model.

Conceptual model:

```text
DiagnosticTroubleCode
- code
- family: POWERTRAIN | CHASSIS | BODY | NETWORK
- namespace: GENERIC | MANUFACTURER_SPECIFIC | UNKNOWN
- status: STORED | PENDING | PERMANENT
- sourceEndpointId
- canonicalMeaning?
- meaningProvenance?
- milRelated?
- freezeFrameAvailable?
- evidence[]
```

The same code observed in several statuses is one diagnostic concern with several observations, not several unrelated defects.

## 10. DTC knowledge boundary

DTC definitions live behind a versioned `DiagnosticKnowledgeBase`; they are not scattered as UI `if` statements.

Knowledge must retain provenance and distinguish:

```text
generic standardized meaning
manufacturer-specific meaning
unknown/unresolved meaning
```

A user-facing description may be absent when provenance is insufficient.

## 11. Evidence planning

AutoPulse does not implement `DTC == PID`.

The relationship is:

```text
DTC / monitor anomaly
→ DiagnosticConcern
→ EvidenceRequirements
→ intersection with endpoint capability
→ targeted safe acquisition
```

Example:

```text
P0171
→ air/fuel mixture concern
→ candidate evidence: fuel trims, MAF, MAP, O2/AFR, fuel pressure, RPM, load
→ query only signals advertised/supported by that endpoint
```

The 114-PID quarry therefore feeds planning, not indiscriminate polling.

## 12. Evidence graph

All facts used by the reasoner are preserved as evidence nodes with provenance.

Conceptual model:

```text
EvidenceFact
- sourceType: DTC | PID | FREEZE_FRAME | READINESS | MODE06 | LIVE_HISTORY | COMPATIBILITY
- sourceEndpointId?
- observedAt
- value
- unit?
- quality
- provenance

EvidenceRelation
- from
- to
- relation: SUPPORTS | CONTRADICTS | CONTEXTUALIZES | CO_OCCURS | UNAVAILABLE
```

Current Check evidence and historical Live evidence remain separately labeled even when correlated.

## 13. Diagnostic concern model

The user-facing unit is a concern, not a flat code list.

Conceptual categories:

```text
COMBUSTION
AIR_FUEL
COOLING
EMISSIONS
ELECTRICAL
SENSOR
COMMUNICATION
TRANSMISSION
UNKNOWN
```

A concern contains DTCs, supporting/contradicting evidence, interpretation, confidence, cause groups and limitations.

Cause groups are hypotheses unless evidence establishes a stronger claim.

## 14. Confidence semantics

Check distinguishes event confidence from cause confidence.

Recommended evidence scale:

```text
CONFIRMED_BY_ECU
STRONG
MODERATE
WEAK
INSUFFICIENT
```

Example:

- a stored `P0301` can make the statement “the ECU recorded a cylinder-1 misfire condition” `CONFIRMED_BY_ECU`;
- “bad gasoline caused it” may remain `WEAK` or `INSUFFICIENT`.

The UI must never collapse those two confidence dimensions.

## 15. Readiness semantics

Readiness is diagnostic state, not health score.

Required invariant:

```text
NOT_READY != FAILED
```

MIL state, DTC count, supported monitors, completed monitors and incomplete monitors are separate facts.

## 16. Freeze-frame semantics

Freeze-frame values are historical ECU-captured context associated with a diagnostic event.

Required invariant:

```text
FREEZE_FRAME_VALUE != CURRENT_PID_VALUE
```

They must remain visually and structurally distinct.

## 17. Mode 06 semantics

Mode 06 can enrich monitor-level evidence but is not promoted until a dedicated quarry closes TID/MID/CID semantics, limits, transport differences and manufacturer variation.

No ad-hoc parser may enter Check merely because a response appears decodable.

## 18. Current vs historical intelligence

Check must function with no Live history.

When history exists:

```text
CURRENT CHECK EVIDENCE
+
HISTORICAL LIVE EVIDENCE
→ correlation
```

Historical evidence can strengthen/rebut a pattern but cannot rewrite what the ECU currently reported.

## 19. Diagnostic coverage

Check never displays a universal health percentage.

It reports coverage explicitly:

```text
endpoints discovered
endpoints scanned
services completed
services unsupported
services unavailable
evidence families available
```

`NO DTCs REPORTED` means only that successfully scanned endpoints did not report the queried code classes. It does not mean the vehicle is mechanically healthy.

## 20. Persistence and immutability

`DiagnosticScan` is independent from `LiveSession`.

A completed diagnostic report retains:

```text
scanSchemaVersion
diagnosticEngineVersion
decoderCatalogVersion
dtcKnowledgeVersion
correlationRulesVersion
evidenceHash
```

Completed reports are immutable. Future reinterpretation creates a new interpretation referencing the original evidence/report version rather than mutating history.

## 21. UX contract

Check is a one-action product surface.

Home:

```text
CHECK
Understand what your car's ECUs are reporting right now.
[ RUN CHECK ]
```

During scan the UI shows meaningful stages, not raw terminal output.

Result hierarchy:

```text
critical/attention concern
→ DTC summary
→ endpoint/service coverage
→ concern details
→ supporting evidence
→ limitations
→ technical evidence
```

Healthy/no-code state is quiet but precise. Limited coverage is explicit. Technical identifiers remain accessible below the primary user explanation.

## 22. Product non-goals for Check Core V1

Deferred/prohibited in V1:

```text
clear DTCs
ECU resets
actuator control
coding/programming
adaptation/service resets
security access
write-data operations
mechanical certification
universal health score
automatic repair prescription
unsupported predictive-failure claims
```

## 23. Design freeze condition

CHECK-MK0 Design is considered closed when the companion Safety Contract, Execution Authority, Dependency Graph, Research Matrix and Definition of Done agree with this document and contain no unresolved architectural decision that would materially change runtime structure.
