# Q-CHECK-008 — Diagnostic command safety evidence

**Status:** `CORE_SEMANTIC_ALLOWLIST_CLOSED_FIXTURE_PROOF_OPEN`  
**Captured:** 2026-09-04  
**Runtime impact:** none

## Purpose

Turn the CHECK-MK0 default-deny safety architecture into an evidence-backed semantic allowlist for the standard Check Core request families.

This quarry does **not** authorize runtime commands by itself. It classifies semantic request families so CHECK-MK5 can implement an enforceable policy and adversarial tests.

## Safety classes

```text
READ_ONLY_PROVEN
READ_ONLY_EXPECTED
UNKNOWN
MUTATING
```

Check Core V1 executes only concrete request descriptors promoted as `READ_ONLY_PROVEN`.

## Standard OBD service classification

For the Core scope, the following service purposes are classified at the semantic-family level:

| Mode | Purpose | Check classification | V1 disposition |
|---|---|---|---|
| 01 | current data / support / readiness | READ_ONLY_PROVEN family | candidate allowlist; exact PID descriptor still required |
| 02 | freeze-frame data | READ_ONLY_PROVEN family | candidate allowlist after Q-CHECK-004 |
| 03 | stored DTCs | READ_ONLY_PROVEN family | candidate allowlist after parser fixtures |
| 04 | clear DTCs and stored values | MUTATING | **BLOCKED** |
| 05 | oxygen-sensor test results | READ_ONLY_EXPECTED / not Core | blocked until separately researched/promoted |
| 06 | non-continuous monitor test results | READ_ONLY_PROVEN family for standard read semantics | candidate only after Q-CHECK-005 |
| 07 | pending DTCs | READ_ONLY_PROVEN family | candidate allowlist after parser fixtures |
| 08 | special control mode | MUTATING/CONTROL | **BLOCKED** |
| 09 | vehicle information | READ_ONLY_PROVEN family | candidate after Q-CHECK-006 |
| 0A | permanent DTCs | READ_ONLY_PROVEN family | candidate allowlist after parser fixtures |

The table classifies service intent, not every possible payload. A Mode 01 request still requires a known/read-only PID descriptor; arbitrary bytes do not inherit permission merely because they start with `01`.

## Why Mode 04 is an absolute block

ELM327 vendor documentation states that Mode 04 clears diagnostic information and can erase DTCs, freeze-frame information, oxygen-sensor test data and Mode 06/07 information. It also notes that the ELM interface itself does not protect software from sending the command accidentally.

Therefore:

```text
payload semantic = CLEAR_DIAGNOSTIC_INFORMATION
→ MUTATING
→ never issued by Check Core V1
```

No confirmation dialog is sufficient to make it part of Core V1 because the product contract is read-only.

## Why Mode 08 is blocked

Mode 08 is identified as a special control mode. Check Core is observation-only and does not perform actuator/control operations.

Therefore:

```text
Mode 08 family
→ MUTATING/CONTROL
→ BLOCKED
```

A future product could research specific controls separately, but it would be outside this Check Core contract.

## Raw / vendor / UDS requests

The connector abstraction supports:

```text
RAW_DIAGNOSTIC
VENDOR_SPECIFIC
UDS
```

That capability is transport flexibility, not product permission.

Default classifications:

```text
unregistered RAW_DIAGNOSTIC → UNKNOWN → BLOCK
unregistered VENDOR_SPECIFIC → UNKNOWN → BLOCK
unregistered UDS request     → UNKNOWN → BLOCK
```

A future enhanced profile must register each exact semantic operation and prove read-only behavior before promotion.

## Adapter-control commands

Adapter commands also require descriptors. Commands used for identity, protocol introspection, safe formatting/header visibility and read-path setup may be allowlisted after connector-specific review.

Adapter reset/configuration must be distinguished from ECU mutation. Even if an AT command only changes adapter state, Check should issue it only when required by the connector plan and with expected-state handling.

## Exact request descriptor requirement

The future policy should evaluate a descriptor such as:

```text
semanticId
requestKind
service
pid/subfunction?
payload encoding rule
readOnly classification
source/provenance
expected response service
parser contract id
```

Permission is attached to the descriptor, not a free-form user string.

## Architectural enforcement

All Check request paths are:

```text
planner proposal
→ descriptor resolution
→ safety classification
→ budget check
→ connector execute
```

No parser or UI may call the connector with arbitrary payloads.

## Adversarial proof still required

CHECK-MK5 must add deterministic tests proving:

```text
04                → BLOCK
08/control        → BLOCK
unknown raw       → BLOCK
unknown vendor    → BLOCK
unknown UDS       → BLOCK
known safe 03     → ALLOW after promotion
known safe 07     → ALLOW after promotion
known safe 0A     → ALLOW after promotion
known safe 0101   → ALLOW after promotion
```

Tests must verify the blocked request never reaches a fake/spy connector.

## Closure state

```text
default-deny policy                 CLOSED
service-family safety classification CLOSED
Mode04 destructive boundary         CLOSED
Mode08 control boundary              CLOSED
raw/vendor/UDS default block         CLOSED
exact-descriptor requirement         CLOSED
runtime allowlist implementation     OPEN
adversarial connector-spy fixtures   OPEN
service parser fixture linkage       OPEN
runtime promotion                    BLOCKED
```
