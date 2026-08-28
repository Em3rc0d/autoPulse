# AutoPulse V1 Validation Protocol

**Status:** authoritative V1 validation contract  
**Scope:** Android / local-first / read-only OBD Live V1 and the evidence needed to support release claims  
**Rule:** this document defines what a PASS means. Test execution must not redefine the criteria after results are known.

## 1. What “reliable” means in AutoPulse

AutoPulse does not claim absolute or universal certainty. V1 aims for **complete evidence integrity for every claim it makes**.

A claim is valid only when its evidence class is explicit:

| Level | Name | What it proves | What it does not prove |
|---|---|---|---|
| A0 | Design | intended invariant / acceptance rule | implementation or runtime behavior |
| A1 | Static + unit | types and isolated logic | Android/native/vehicle behavior |
| A2 | Integration + replay | subsystem behavior against controlled fixtures | physical adapter/ECU behavior |
| A3 | Artifact | exact APK exists, is structurally valid, bundle-complete, signature-valid, signing-classified and hash-addressable | physical vehicle behavior or production-distribution signing |
| A4 | Physical | observed behavior on the exact tested tuple | universal compatibility |
| A5 | Repeated physical | repeatability across multiple runs/tuples | untested vehicles/adapters/phones |

No lower assurance level may be presented as a higher one.

## 2. Claim scope tuple

Every physical claim MUST be scoped to:

`app artifact × source revision × Android device/OS × adapter/fingerprint × transport × vehicle × ECU/protocol observation × session × test case`

A successful result on one tuple MUST NOT become a global `compatible=true` claim.

## 3. Immutable artifact identity

The certification artifact is identified by all of the following:

- PR number;
- PR head SHA;
- PR base SHA;
- CI-tested SHA (GitHub PR merge revision when applicable);
- workflow run ID and attempt;
- dependency lockfile SHA-256;
- APK SHA-256;
- APK size;
- packaged JavaScript bundle SHA-256;
- effective APK permissions/package metadata;
- APK signature verification result;
- APK signing class.

The APK PR workflow MUST publish `autopulse-apk-receipt.json` with those fields alongside the APK and its supporting audit files.

### Invalidation rule

Physical certification is invalid for a new artifact whenever its APK SHA-256 differs from the physically tested APK. A source change, dependency change, Android build change, workflow/build-input change, signing change, or changed PR base may therefore require a new physical artifact gate.

Documentation-only changes do not retroactively alter evidence, but they also cannot upgrade an unproven runtime claim.

## 4. Automated artifact gate

Required before physical certification:

- TypeScript `tsc --noEmit` PASS;
- all non-skipped Jest suites PASS;
- skipped tests explicitly counted;
- standalone release-internal APK builds;
- APK ZIP structure verifies;
- React Native/Expo JS bundle exists inside APK;
- JavaScript bundle hash is recorded;
- APK signature verifies;
- signing class is recorded;
- effective APK permissions are extracted from the built APK rather than inferred only from source manifests;
- dependency audit/reachability evidence is preserved;
- exact artifact receipt is generated and uploaded.

The security gate may remain red while evidence collection continues; a red security gate still blocks release. A warning is never silently converted into PASS.

## 5. Internal certification vs public distribution

A physically testable internal artifact and a publicly distributable production artifact are different assurance claims.

An internal `release-internal` APK MAY use the current internal signing lane if its signing class and SHA-256 are explicitly recorded. Physical evidence then applies only to that exact binary.

A public V1 release MUST additionally satisfy all of the following:

- `release` is not signed with `signingConfigs.debug`;
- signer is not the Android Debug certificate;
- production signing material is supplied outside the repository through an approved secret/signing mechanism;
- signature verification succeeds on the final public artifact;
- public artifact receives a new immutable receipt and, if its APK hash differs from the physically certified binary, the release decision explicitly determines which physical gates must be repeated.

A debug-signed APK can be an A3 internal artifact. It is never evidence of production signing readiness.

## 6. Physical safety boundary

AutoPulse remains read-only relative to the vehicle ECU for V1.

- no DTC clear;
- no actuator command;
- no ECU reset;
- no destructive/write diagnostic service.

All app interaction for validation must be performed while the vehicle is stationary. If a test requires the vehicle to move, a licensed adult driver must operate the vehicle legally while a separate test operator/passenger handles observation; the driver must not interact with the phone.

## 7. RC5 / Live V1 physical certification cases

All cases use the **same frozen APK SHA-256** unless a case is explicitly marked automated-only.

### V1-P01 — First ECU truth gate

**Precondition:** adapter connected and initialization begins.  
**PASS:** Live is not declared ECU-live until at least one valid ECU-origin sample is decoded.  
**FAIL:** adapter/configuration success alone causes ECU-live presentation.

Required evidence:
- artifact receipt;
- session ID;
- initialization screenshot/receipt;
- first valid ECU-origin observation timestamp;
- persisted session/telemetry evidence.

### V1-P02 — Healthy baseline acquisition

**PASS:** the exact tested tuple produces stable valid samples for the supported Tier-1 signals available on that vehicle. Missing signals remain unavailable rather than becoming zero.

Record at minimum when supported:
- RPM;
- vehicle speed;
- coolant;
- ECU voltage and/or adapter voltage with their origins kept distinct.

### V1-P03 — Driver-mode continuity

Sequence:
- Essential;
- Performance;
- Off-Road;
- return to a non-Off-Road mode.

**PASS:** ECU acquisition remains alive across the sequence; entering Off-Road does not launch a permission prompt during ACTIVE Live and phone-sensor work does not terminate or replace ECU evidence.

### V1-P04 — Clean user Stop semantics

**PASS:** a normal `COMPLETED / USER_INITIATED` session reconstructs as `COMPLETE` when the expected final short flush is the only partial block and there is no corruption, unexpected gap, or block mismatch.

**FAIL:** the expected final flush alone downgrades the session to `PARTIAL`.

### V1-P05 — Bounded transport recovery

Execute only while stationary.

**PASS:** a transport interruption enters an explicit recovering state, preserves the same session and already committed evidence, attempts bounded recovery, and resumes only after the adapter/vehicle path is re-proven.

**PASS on exhaustion:** one explicit terminal `<reason>_RECOVERY_FAILED` interruption is produced and existing evidence remains available.

**FAIL:** missing telemetry is synthesized, a new session is silently substituted, or recovery loops without bound.

### V1-P06 — `NO_DATA` semantic separation

**PASS:** repeated OBD `NO_DATA` affects PID availability/retirement according to policy but does not trigger transport recovery by itself.

**FAIL:** `NO_DATA` is treated as adapter/transport loss.

### V1-P07 — STALE truth

This case is primarily automated/replay-driven and may be visually confirmed on the physical artifact.

**PASS:** after freshness expires, an old numeric sample is not presented as current; the UI explicitly labels the signal `STALE` and historical/last-received value is distinguishable from current data.

### V1-P08 — Background interruption

**PASS:** moving AutoPulse out of the foreground during an active V1 session produces the documented explicit interruption semantics and preserves already committed evidence. V1 does not claim background recording.

### V1-P09 — Process-loss recovery

**PASS:** after abrupt process loss, the next boot reconstructs/reconciles the orphaned session from durable SQLite/telemetry evidence according to the documented recovery policy. The recovered record must not be presented as a clean uninterrupted completion.

## 8. Evidence package required for every physical run

Each run receipt must include:

```text
runId
testCaseId
executedAt
operatorRole
vehicleDescriptor
adapterDescriptor
transport
androidDeviceModel
androidVersion
appVersion
prNumber
headSha
baseSha
ciTestedSha
packageLockSha256
apkSha256
jsBundleSha256
signingClass
workflowRunId
sessionId
observedProtocol
firstEcuSampleAt
result: PASS | FAIL | BLOCKED
limitations[]
evidenceRefs[]
```

Raw/private captures and sanitized repository evidence are separate objects. Public repository evidence must not expose account identifiers, signed backend URLs, or unrelated private metadata.

## 9. PASS / FAIL / BLOCKED semantics

- **PASS:** all precommitted acceptance criteria were observed and required evidence exists.
- **FAIL:** execution reached the relevant condition and contradicted at least one acceptance criterion.
- **BLOCKED:** the criterion could not be meaningfully exercised or evidence was insufficient.

`BLOCKED` is never equivalent to PASS. Missing evidence is never inferred from screenshots or recollection.

## 10. Evidence integrity rules

1. Hash binary artifacts and deduplicate evidence by content hash.
2. Never count the same screenshot copied across exports as independent observations.
3. Preserve failures; do not curate them away from the Mining Site.
4. Promotion to Golden Dataset requires review and explicit scope.
5. A screenshot is screenshot-level evidence, not a raw OBD transcript.
6. CI PASS proves only the environment actually executed by CI.
7. Physical PASS proves only the exact tuple tested.
8. A report or compatibility claim may cite only evidence at or above the assurance level required by that claim.
9. The GitHub Actions revision used by a release workflow is itself a supply-chain input and should be pinned to a reviewed commit SHA.
10. The built APK, not a source manifest or package declaration, is authoritative for the effective permission surface of that artifact.

## 11. Security and supply-chain gate

Before public V1 release:

- classify dependency findings as runtime-shipped, active build-tooling, inactive tooling, or development-only;
- zero unresolved critical runtime findings;
- critical findings in active build tooling may not be silently waived: remediation is preferred, and any temporary exception requires a written reachability/threat-model decision, exact package/advisory/version/chain, compensating controls, expiry/review condition, and upgrade target;
- review high-severity runtime findings and either remediate or document an explicit release decision with reachability analysis;
- upgrade `drizzle-orm` to a patched line before public release unless a separately approved security decision supersedes this requirement;
- audit the merged/effective release Android manifest and remove permissions not required by the declared V1 capability set;
- use non-debug production signing for the public artifact;
- preserve dependency lockfile identity in the artifact provenance chain;
- pin release GitHub Actions to reviewed commit SHAs;
- no orphaned gitlinks/submodule metadata may remain in the V1 release tree.

A green functional test suite does not waive this gate.

## 12. V1 release decision

AutoPulse Live V1 is physically certified only when:

1. the automated/artifact gate is complete for one frozen artifact;
2. the required physical cases pass on that same APK SHA-256;
3. failures/blockers are recorded rather than omitted;
4. History/Summary reconstruct the resulting evidence consistently;
5. security/release-hardening blockers are either closed or explicitly prevent release;
6. release documentation states only the compatibility/evidence scope actually observed.

AutoPulse V1 is publicly releasable only when, in addition:

1. the final security gate passes under the documented threat model;
2. effective permissions have been reviewed;
3. the final public APK is non-debug signed and signature-verified;
4. its immutable receipt is archived;
5. any difference from the physically certified APK is reconciled before making physical claims.

The target is not “certainty about every vehicle.” The target is **no unsupported certainty in AutoPulse itself**.
