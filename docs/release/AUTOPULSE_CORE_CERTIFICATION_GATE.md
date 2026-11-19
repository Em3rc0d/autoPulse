# AutoPulse Core Certification Gate v1

**Status:** PRECOMMITTED AUTHORITY — physical execution still required  
**Applies to:** internal Android candidates used for AutoPulse Core physical claims  
**Scope:** read-only Garage + Compatibility + Live + Check + durable Sessions + History + Reports  
**Does not certify:** universal vehicle/adapter compatibility, public Play Store readiness, Vehicle Memory product hypotheses, predictive diagnosis or ECU write/control

## 1. Purpose

A green build is not a physically certified AutoPulse artifact.

Certification requires one traceable chain:

```text
SOURCE COMMIT
→ CLEAN BUILD INPUTS
→ APK SHA-256
→ INSTALLED APK SHA-256
→ DEVICE + ADAPTER + VEHICLE TUPLE
→ EXECUTED GATES
→ EVIDENCE
→ SCOPED VERDICT
```

Any break in this chain produces `BLOCKED` or `INVALID_EVIDENCE`, never PASS.

This document consolidates the gate hierarchy. Existing receipts and test contracts remain evidence templates and must not silently redefine these semantics.

## 2. Artifact identity invariant

A certification candidate must satisfy all of the following:

- build source commit recorded;
- build source branch recorded;
- Git working tree clean;
- APK SHA-256 recorded;
- `package-lock.json` SHA-256 recorded;
- Android package identity and target SDK verified;
- effective permissions checked;
- build receipt marks `certificationEligible: true`;
- the APK installed on the test device hashes to the same SHA-256.

Local commands from `mobile-app/`:

```bash
npm run apk:check
npm run apk:internal
npm run apk:identify
```

`apk:identify` is the final identity check before physical certification. Filename, UI version text, screenshot or operator memory are insufficient.

A build produced with `--allow-dirty` is internal-only and cannot enter G1/G2/G3.

## 3. Gate model

### G0 — Source + build assurance

Required before device testing:

- TypeScript PASS;
- full Jest suite PASS, with skipped tests explicitly accounted for;
- patch-package/application patches PASS where applicable;
- source tree clean;
- local Android build PASS;
- standalone embedded JS bundle check PASS;
- APK signature verification PASS;
- package/target SDK/permission contract PASS;
- provenance receipt emitted;
- no unresolved P0 truth/safety defect known in the candidate.

**G0 PASS does not prove Android runtime or vehicle compatibility.**

### G1 — Stationary physical core

Run with vehicle safely parked.

Required:

- installed APK identity matches certification-eligible receipt;
- Garage opens the intended vehicle;
- adapter connects without source-code intervention;
- initialization does not promote adapter-only evidence to ECU truth;
- at least one valid ECU-origin observation is obtained before ECU-live is claimed;
- one Live session records real ECU evidence;
- missing/unsupported signals remain unavailable rather than synthetic zero;
- clean user Stop reaches one terminal outcome;
- persisted Summary reconstructs honestly;
- History reopens the same durable session;
- one direct read-only Check completes;
- sealed Check report reopens with identical integrity hash;
- no ECU write/destructive command is issued.

A failure of foreground-service startup, BLE ownership, persistence, truth semantics or report integrity blocks G2.

### G2 — Controlled driving

G2 uses **the exact G1 artifact**.

Safety:

- configure/start while parked;
- driver must not operate detailed UI while moving;
- use a passenger/test operator where practical;
- never induce hazardous engine, braking, steering, thermal or electrical conditions.

Required:

- repeated live observations remain plausible for signals that are actually available;
- stale/missing evidence never becomes current synthetic data;
- motion-data loss degrades only the affected dimension when other ECU evidence remains healthy;
- healthy operation remains visually quiet;
- actionable abnormal state is explicit;
- session identity remains stable;
- no hidden terminal failure is presented as active Live.

Naturally occurring signal loss may be observed. Do not force unsafe road conditions to trigger it.

### G3 — Stationary lifecycle + resilience

Run parked on the same artifact unless a test explicitly requires otherwise.

Required matrix:

- screen lock/background with connected-device foreground service;
- bounded BLE/transport recovery;
- recovery exhaustion produces one explicit terminal outcome;
- `NO_DATA` is not treated as transport death;
- abrupt process kill reconciles durable orphan state on relaunch;
- previously committed evidence survives;
- missing time is not fabricated;
- Live → Stop → Check → sealed report reopen → Live handoff succeeds without duplicate controllers/listeners;
- app restart preserves History/Summary.

## 4. Verdicts

Allowed gate outcomes:

- `PASS` — all mandatory exercised criteria for the declared scope passed;
- `FAIL` — observed behavior contradicts a mandatory criterion;
- `BLOCKED` — prerequisite or required evidence unavailable;
- `NOT_EXERCISED` — optional/conditional case did not occur;
- `INVALID_EVIDENCE` — artifact identity or evidence chain cannot be proven.

`NOT_EXERCISED`, `BLOCKED` and `INVALID_EVIDENCE` never promote to PASS.

## 5. Certification tuple

Every physical receipt must identify, at minimum:

```text
sourceCommit
apkSha256
packageLockSha256
packageName
AutoPulse version
Android device model
Android version
vehicle make/model/year (sanitized)
adapter make/model or stable fingerprint
transport
observed protocol
session/check identifiers
executed gate
timestamps
result
limitations
```

Do not publish VIN, plate, exact route, account identifiers, secrets or unrelated personal metadata.

## 6. Evidence hierarchy

Preferred evidence, strongest first:

1. raw/private vehicle or transport capture with content hash;
2. durable SQLite/session/check record;
3. generated local export/receipt;
4. Android logcat/native lifecycle evidence;
5. screenshot/video observation;
6. operator note.

A screenshot can prove visible UI state. It cannot by itself prove ECU response timing, provenance or source commit.

Private raw evidence may stay outside the public repository; store a sanitized description and content hash when needed.

## 7. Regression promotion rule

A physical defect should produce, when technically possible:

```text
PHYSICAL FAILURE
→ MINIMAL REPRODUCTION
→ AUTOMATED FIXTURE / REGRESSION
→ SOURCE FIX
→ NEW APK SHA
→ AFFECTED PHYSICAL GATES RERUN
```

Never rewrite a failed historical receipt into a pass. Preserve the negative evidence and add the later closure.

## 8. Compatibility claim boundary

Certification is scoped to the tested tuple.

A PASS on:

```text
Vehicle A + Adapter X + Android Y + APK Z
```

does not certify:

- another vehicle of the same model;
- every vehicle from the same manufacturer;
- another ELM327 clone;
- another Android device;
- another protocol;
- a later APK.

Compatibility knowledge may accumulate, but must remain evidence-based.

## 9. Release blocker classes

Immediate NO-GO examples:

- fabricated telemetry;
- adapter-origin data labeled ECU-direct;
- stale value represented as current;
- false NORMAL/healthy state from insufficient evidence;
- lost/corrupt session presented COMPLETE;
- foreground service falsely reported running;
- duplicate concurrent acquisition controllers;
- wrong vehicle identity;
- destructive/write ECU command;
- artifact identity mismatch.

## 10. Relationship to existing documents

This authority is the common gate hierarchy. Detailed execution may continue to use:

- `docs/test/V43_DRIVING_CERTIFICATION_RECEIPT.md`;
- `docs/release/ROAD_TEST_001_CONTRACT.md`;
- `docs/test/ROAD_TEST_001_RECEIPT.md`;
- Golden Dataset contracts and vehicle quarries;
- Android native audit receipts.

Where an older receipt describes behavior superseded by a later frozen design, the newer design authority controls. Historical evidence remains historical and must not be rewritten.

## 11. Promotion rule

```text
G0 PASS
→ eligible for G1

G1 PASS
→ eligible for G2

G2 PASS + mandatory G3 scope PASS
→ physically certified only for declared tuple

Physical certification
≠ public release certification
```

Public release still requires its own security, signing, distribution, privacy and product gates.

## 12. Current execution rule

Until one exact candidate completes this chain, AutoPulse Core remains:

```text
SOURCE-HARDENED
PHYSICALLY PARTIAL
PUBLIC RELEASE UNVALIDATED
```

No number of synthetic tests may silently promote it beyond that boundary.
