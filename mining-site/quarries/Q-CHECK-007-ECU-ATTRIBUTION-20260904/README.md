# Q-CHECK-007 — ECU / diagnostic endpoint attribution

**Status:** `SEMANTIC_BOUNDARY_CLOSED_FIXTURES_OPEN`  
**Captured:** 2026-09-04  
**Runtime impact:** none

## Purpose

Define what AutoPulse is allowed to claim about the source of a diagnostic response across the currently targeted OBD transports.

The central rule is:

```text
response source evidence != module role
```

AutoPulse may know that responder `X` sent evidence while still not knowing whether `X` is Engine, Transmission, ABS, SRS, etc.

## Endpoint identity

Check uses a `DiagnosticEndpoint` abstraction. The minimum endpoint identity may be:

```text
protocol + observed source address/identifier
```

when the adapter/transport exposes reliable source evidence.

If source evidence is absent, stripped, ambiguous, or cannot be safely reconstructed, the observation remains:

```text
UNATTRIBUTED
```

It must not be force-assigned to a synthetic “main ECU”.

## Functional vs physical addressing

Generic OBD queries commonly use functional addressing: any ECU that supports the function may respond. Multiple responders are therefore normal, not duplicate noise by definition.

Physical addressing can target one specific responder when the transport/address mapping is known and the request remains within the reviewed safety contract.

Check Core uses functional discovery first. A future planner may use physical targeting only when:

- the mapping is evidence-backed;
- the request is `READ_ONLY_PROVEN`;
- transport behavior is closed;
- the operation improves attribution/reliability without broadening product claims.

## Legacy 3-byte header protocols

ELM327 documentation describes SAE J1850, ISO 9141-2 and ISO 14230-4 messages with three header bytes representing priority, target/receiver and source/transmitter.

When headers are exposed (`AT H1` or an equivalent reviewed adapter mode), the source/transmitter field is endpoint evidence.

AutoPulse must preserve the exact raw header/source evidence used for attribution.

## ISO 15765 CAN

For 11-bit ISO15765 OBD functional addressing, request ID `7DF` may receive responses from physical responder IDs such as `7E8`, `7E9`, etc. The response CAN ID is endpoint evidence when headers are exposed and normalized correctly.

The standard functional request does not establish ECU role. For example:

```text
7E8 != ENGINE by AutoPulse rule
```

unless an independent, reviewed identity/profile source proves that role for the tested vehicle path.

## Role inference

Endpoint role values remain:

```text
UNKNOWN
ENGINE
TRANSMISSION
ABS
SRS
BODY
STEERING
HVAC
OTHER
```

but only `UNKNOWN` is safe by default.

Role assignment requires a future evidence source such as:

- standard vehicle information that identifies the module;
- an approved enhanced diagnostic profile;
- reviewed manufacturer/model mapping with provenance;
- physically certified identity evidence.

Address folklore is not sufficient.

## Multi-response aggregation rule

A connector response may contain evidence from several ECUs. The high-level `DiagnosticResponse.sourceEcus[]` is useful for discovery, but Check parsers must not attach one aggregated DTC list to every source ECU.

The future normalized response model must preserve source at the smallest practical evidence unit:

```text
NormalizedDiagnosticMessage
- sourceEndpointEvidence
- service
- servicePayload
- rawLine/rawFrame provenance
```

Then DTC/PID/readiness parsers operate on those source-scoped messages.

## Current code implication

Current `ElmBleDiagnosticConnector` collects `sourceEcus` as a set across all parsed frames and returns a single `diagnosticCodes[]` array. This is sufficient for compatibility characterization but not sufficient for final Check per-DTC attribution when several responders return codes in one command.

**Decision:** CHECK-MK3/MK4 must evolve the domain/parser boundary so code observations retain source message/endpoint provenance. Do not infer per-code source from an aggregated response-level source list.

## Response Pending implication

KWP and CAN may return `7F <service> 78` Response Pending. Vendor documentation notes complexity when several ECUs respond differently. Therefore a pending response must retain its source if available, and the transport planner may need endpoint filtering/physical targeting in a future proven path.

No global “one ECU is pending” assumption is allowed.

## Promotion contract

Before runtime endpoint attribution is certified, fixtures must cover:

```text
CAN single responder
CAN multiple responders
KWP/ISO14230 headers-on source extraction
legacy no-header/unattributed response
multiple DTC responders in one command
negative response with source
response-pending with source
malformed/ambiguous header
adapter strips headers
```

## Closure state

```text
endpoint vs role distinction         CLOSED
functional/multi-responder semantics CLOSED
UNATTRIBUTED fallback                CLOSED
CAN responder-ID semantics           CLOSED
legacy source-header semantics       CLOSED
per-evidence attribution requirement CLOSED
role mapping datasets                DEFERRED / FUTURE PROFILE
fixture corpus                       OPEN
physical CAN attribution proof       OPEN
runtime promotion                    BLOCKED
```
