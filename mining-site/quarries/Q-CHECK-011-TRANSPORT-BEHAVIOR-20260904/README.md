# Q-CHECK-011 — Diagnostic transport behavior

**Status:** `SEMANTIC_BOUNDARY_CLOSED_TIMING_FIXTURES_OPEN`  
**Captured:** 2026-09-04  
**Runtime impact:** none

## Purpose

Prevent AutoPulse Check from encoding CAN-only assumptions into a diagnostic engine that must also operate on the physically observed Renault ISO 14230/KWP path and other standard OBD transports.

Check issues semantic diagnostic requests through `DiagnosticConnector`; transport/adapter behavior determines framing, response completion, source visibility, timing and retry policy.

## Core invariant

```text
OBD semantic request != physical transport frame
```

For an ELM-compatible adapter, a product request such as `01 0C` can be represented as a short hexadecimal command while the adapter handles protocol-specific headers/checksum/framing. Check domain code must not confuse that convenience representation with the physical bus frame.

## Variable response count

One functional OBD request may produce:

- one response;
- several responses from different ECUs;
- several messages from one ECU that require reassembly.

The ELM adapter normally waits for a response-completion timeout. `NO DATA` means no acceptable response was observed, not numeric zero or zero DTCs.

### Do not prematurely cap response count

ELM documentation allows a maximum response-count hint, but warns that specifying too few responses can cause early return and, on some protocols, bus congestion/retries.

**Check decision:** Core V1 does not use a fixed response-count optimization unless the exact request/endpoint behavior has been learned and certified. Correct completeness is preferred over small latency gains.

## Protocol-aware pacing

Older transports/vehicles may not tolerate aggressive back-to-back traffic. Check therefore remains serial by default and uses a protocol-aware command budget.

Exact production timing numbers remain **OPEN** until replay/physical evidence establishes safe values for the target matrix.

No document in this quarry invents an arbitrary universal delay.

## ISO 9141-2 / ISO 14230 KWP

These transports can require bus initialization and periodic wakeup/keep-alive behavior. The connector/ELM layer owns that transport lifecycle.

Check must not independently send competing initialization or keepalive traffic from domain logic.

The Renault Logan physical path already demonstrates that ISO 14230/KWP is a real first-class AutoPulse requirement, not a theoretical legacy case.

## Response Pending

KWP and CAN ECUs may send negative-response form:

```text
7F <requested-service> 78
```

meaning the ECU is still processing the request.

This is not equivalent to:

```text
FAILED
NO_DATA
UNSUPPORTED
```

The transport/request state may remain pending within a bounded deadline.

Vendor documentation also warns that multiple ECUs may behave differently during Response Pending. Therefore response-pending handling must retain source attribution when possible; future physical targeting/filtering may be required for ambiguous multi-ECU cases.

## ISO 15765 CAN

CAN adds transport-specific structure including CAN identifiers, PCI/length information and multi-frame responses. ELM formatting may simplify or reformat this representation.

Check parsers should consume normalized diagnostic messages, not assume raw visible lines always match one physical CAN frame.

Headers must be available when endpoint attribution is required.

## CAN DTC-specific constraint

Mode 03 on ISO15765/CAN may include a DTC-item-count byte after response service `43`. This is a transport/service envelope difference that must be removed/interpreted before generic DTC pair parsing.

This constraint is jointly tracked by Q-CHECK-001.

## Header visibility

For diagnostic endpoint discovery and attribution, Check needs a connector mode that preserves source identifiers where the adapter can expose them.

The ELM family supports header display. The exact configuration sequence belongs to the connector implementation, not to the domain scanner.

If an adapter cannot expose reliable source identity, Check degrades to unattributed evidence rather than guessing.

## Connector health and backpressure

Each request result remains one of distinct transport outcomes such as:

```text
SUCCESS
NO_DATA
TIMEOUT
DISCONNECTED
INVALID_RESPONSE
FAILED
```

The planner uses bounded retries only for retryable outcomes. Repeated hard failures reduce connector health and can terminate optional enrichment while preserving completed Core evidence.

## Initial budget shape

The design shape is closed while concrete values remain evidence-gated:

```text
CommandBudget
- maxRequestsPerStage
- minInterCommandDelayMs
- requestTimeoutMs
- responsePendingExtensionPolicy
- maxRetries
- retryBackoffMs
- maxConsecutiveHardFailures
- stageDeadlineMs
- overallDeadlineMs
```

Profiles may differ by:

```text
protocol
adapter family
observed connector reliability
service family
```

No UI layer sets these directly.

## Required transport fixtures

Before the runtime planner is certified:

```text
KWP normal response
KWP NO DATA
KWP Response Pending then success
KWP Response Pending timeout
CAN one responder
CAN multiple responders
CAN multiline/segmented response
CAN DTC count-byte response
legacy headers on/off
adapter echo/whitespace variations
SEARCHING... preamble
STOPPED / transport error
partial response then disconnect
```

## Closure state

```text
semantic request vs transport frame CLOSED
serial-default rule                CLOSED
response-count optimization rule   CLOSED
NO DATA semantics                  CLOSED
Response Pending state             CLOSED
multi-ECU pending caveat            CLOSED
CAN/KWP first-class support         CLOSED
budget dimensions                  CLOSED
concrete timing values              OPEN
transport fixture corpus            OPEN
physical CAN proof                  OPEN
runtime planner promotion           BLOCKED
```
