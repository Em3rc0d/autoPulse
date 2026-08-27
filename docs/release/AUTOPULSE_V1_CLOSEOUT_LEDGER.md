# AutoPulse V1 Closeout Ledger

Status: ACTIVE CLOSEOUT
Branch: `v1/truth-closeout`
Baseline: `ee37f77e23eeb05a0f9fa93fcd235d32b495f2ed`

This ledger is the release-facing truth table for the AutoPulse V1 closeout. It does not replace the test ledger, physical-gate documents, or release-candidate runbook. Its purpose is to prevent implementation, automated verification, and physical validation from being conflated.

## Status vocabulary

- `NOT_STARTED`: required V1 work has not been implemented.
- `IMPLEMENTED`: code or documentation exists, but the relevant automated gate has not yet been observed passing for the candidate.
- `AUTOMATED_PASS`: the exact candidate has passed its applicable automated verification.
- `PHYSICAL_PASS`: the exact candidate/artifact has passed the named physical procedure with retained evidence.
- `BLOCKED`: the gate cannot currently progress and the blocker is recorded.
- `N/A`: the validation class does not apply to that gate.

A gate is not release-closed merely because its code exists. Physical claims require physical evidence tied to the exact build under test.

## V1 product contract

AutoPulse V1 is evidence-first and local-first. Its product chain is:

`Live observes -> History preserves -> Evidence supports -> Compatibility learns -> Check evaluates -> Report materializes`

V1 must never turn missing, stale, degraded, adapter-origin, or untested information into stronger vehicle claims than the evidence supports.

## Closeout gates

| Gate | Requirement | Implementation | Automated | Physical | Release rule |
|---|---|---|---|---|---|
| V1-01 | STALE telemetry cannot look current | IMPLEMENTED | PENDING | N/A | Main card suppresses stale numeric current value; stale history remains explicitly labeled |
| V1-02 | Real Live requires a valid ECU-origin sample before ECU-live truth | EXISTING | PENDING CANDIDATE | REQUIRED | Adapter/config success is never ECU-live proof |
| V1-03 | `NO_DATA` remains distinct from timeout, transport failure, and unsupported inference | EXISTING | PENDING CANDIDATE | REQUIRED | No false capability claim |
| V1-04 | Serialized polling does not flood ELM-compatible adapters | EXISTING | PENDING CANDIDATE | REQUIRED | Preserve bounded/serialized acquisition |
| V1-05 | Off-Road phone sensors do not destabilize ECU acquisition | RC4 FIX EXISTS | PENDING CANDIDATE | **PENDING Q-003** | No physical PASS until exact new candidate artifact is retested |
| V1-06 | Clean USER_INITIATED Stop reconstructs a complete session when evidence is complete | RC4 FIX EXISTS | PENDING CANDIDATE | **PENDING Q-003** | Short final block must not make the whole clean session PARTIAL |
| V1-07 | Backgrounding an active Release-1 session records explicit interruption | EXISTING | PENDING CANDIDATE | REQUIRED | Foreground-only contract remains explicit |
| V1-08 | Abrupt orphan/process recovery reconstructs from durable evidence | EXISTING | PENDING CANDIDATE | REQUIRED | No invented completion state |
| V1-09 | History/Summary preserves COMPLETE/PARTIAL/DEGRADED/CORRUPTED/UNAVAILABLE integrity | EXISTING | PENDING CANDIDATE | REQUIRED | Reconstruction must report limitations |
| V1-10 | Evidence provenance links observation to session, vehicle, adapter, app/build, and source | PARTIAL | PENDING | REQUIRED | No detached screenshot or claim promoted as authoritative evidence |
| V1-11 | Compatibility is evidence-scoped, not a universal boolean | CONTRACT EXISTS | PENDING | REQUIRED | Tested combination only; unknown remains unknown |
| V1-12 | Check Lite executes Observation -> Finding -> Coverage -> Limitations -> Review/Report | PARTIAL DOMAIN | PENDING | PILOT REQUIRED | No unsupported mechanical conclusion |
| V1-13 | Report is a versioned immutable snapshot with deterministic integrity verification | PARTIAL | PENDING | N/A | Hash exact canonical payload, not a mutable reconstructed view |
| V1-14 | Release APK is standalone, reproducible, and identified by SHA-256 | PARTIAL PROCESS | REQUIRED | REQUIRED | Debug/Metro-dependent APKs are not release evidence |
| V1-15 | Release manifest/permissions are audited for the actual release build | NOT_STARTED | REQUIRED | SMOKE REQUIRED | Debug dependency permissions do not define public release surface |
| V1-16 | Certified adapter lane is explicit for V1 | PARTIAL | N/A | REQUIRED | Do not promise arbitrary ELM327 clones |
| V1-17 | Logan and Duster evidence is scoped to exact tested combinations | EVIDENCE EXISTS | N/A | RE-CERTIFY CANDIDATE | Historical success is not automatically inherited by a new candidate |

## Current closeout changes

### STALE truth semantics

The V1 closeout branch changes stale telemetry presentation so that an old numeric sample is not rendered as the current primary reading. The stale state receives an explicit `STALE` badge. The historical numeric sample remains inspectable in the detail sheet only under an explicit last-observed label.

This implements the rule:

> old evidence may be retained, but old evidence must not masquerade as current telemetry.

## Physical validation rule

The historical RC4 artifact and its test evidence remain historical evidence. Any code change on `v1/truth-closeout` creates a new candidate lineage. Therefore Q-003 (and any final physical certification) must be executed against the exact newly frozen APK/commit pair.

Minimum physical receipt for a PASS:

- git commit SHA
- APK SHA-256
- app/version/build identity
- Android device identity sufficient for reproduction
- adapter identity/fingerprint
- vehicle identity/scope
- procedure ID
- start/end timestamps
- raw or durable telemetry/session evidence where available
- screenshots only as supplemental UI evidence
- result and limitations

## V1 scope discipline

The following are not required to close the first commercially testable V1 unless a gate above depends on them:

- broad cloud platform
- generative mechanical diagnosis
- arbitrary adapter compatibility
- universal make/model compatibility
- large PID expansion
- social/community features
- predictive maintenance claims
- ABS/airbag coverage without validated acquisition support

The V1 priority is a trustworthy, repeatable end-to-end chain from observation to report.

## Exit condition

AutoPulse V1 is release-ready only when:

1. all required implementation gates are closed;
2. the exact release candidate passes automated verification;
3. required physical gates pass on the exact frozen artifact;
4. release APK identity and provenance are retained;
5. known limitations are documented and visible where they affect interpretation;
6. no unresolved issue allows stale, missing, degraded, adapter-origin, or untested data to be presented as stronger vehicle truth.
