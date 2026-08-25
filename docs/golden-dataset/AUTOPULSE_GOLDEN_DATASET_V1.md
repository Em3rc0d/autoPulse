# AutoPulse Golden Dataset v1

**Lane:** Golden Dataset
**Authority:** APPROVED EVIDENCESET
**Version:** v1 working set

This dataset is the normalized evidence layer between raw field quarries/tests and compatibility/release claims.

It is not a marketing matrix and not a dump of screenshots. Each record has a narrow claim, provenance, status and explicit non-claims.

## 1. Dataset layers

AutoPulse uses two related golden layers.

### 1.1 Behavioral / physical golden cases

These capture approved product behaviors on identified real combinations:

- connection/acquisition;
- lifecycle;
- persistence;
- UI truth;
- mode isolation;
- compatibility observations.

They may be sourced from screenshots/physical behavior when the claim is limited to what those sources can prove.

### 1.2 Diagnostic byte/fixture corpus

These contain deterministic raw diagnostic inputs/outputs for parsers/decoders and persisted codecs.

Examples:

- raw OBD request/response bytes;
- 11-bit and 29-bit headers;
- ISO-TP multi-frame sequences;
- negative responses;
- malformed/truncated data;
- persisted block payloads with expected decode output.

A screenshot cannot be promoted into this layer. Raw/canonical diagnostic evidence is required.

## 2. Golden record schema

Every physical golden record should include:

```yaml
id: GD-XXX
status: GOLDEN | CANDIDATE | NEGATIVE_GOLDEN | RETIRED
scope:
  vehicle:
  year:
  engine:
  adapter:
  android_device:
  build_sha:
claim:
source_quarry:
source_test:
evidence_type:
expected_behavior:
observed_behavior:
non_claims:
regression_target:
notes:
```

Unknown metadata is represented as `UNKNOWN`, never silently omitted when it affects scope.

## 3. Current approved/candidate physical cases

### GD-001 — Logan real ECU acquisition

**Status:** GOLDEN

**Source:** Q-001

**Scope:** Renault Logan 2014 + primary tested BLE ELM-compatible adapter + tested Android build lineage.

**Claim:** AutoPulse physically progressed through BLE/ELM/vehicle initialization and displayed valid ECU-origin Live telemetry on the tested Logan combination.

**Expected behavior:** adapter/initialization completion does not itself imply ECU Live; valid ECU-origin observation is required.

**Observed:** real ECU telemetry became visible after initialization and the first-ECU evidence transition.

**Non-claims:**

- does not certify all Renault vehicles;
- does not certify all ELM adapters;
- does not identify a universal protocol;
- does not certify every standard PID.

**Regression target:** `LiveEcuTruth` and real initialization paths must preserve this waiting→ECU-live boundary.

### GD-002 — Adapter voltage source distinction

**Status:** GOLDEN

**Source:** Q-001 + design/build evidence.

**Claim:** adapter voltage can be displayed as adapter-origin evidence and must remain distinct from ECU/control-module voltage PID `0142`.

**Expected:** `ATRV` cannot unlock ECU Live and cannot be relabeled as control-module voltage.

**Regression target:** source-truth tests and Live metric presentation.

### GD-003 — Logan APP_BACKGROUND interruption

**Status:** GOLDEN

**Source:** Q-001

**Scope:** release-1 foreground-only Live policy on tested Logan/Android build lineage.

**Claim:** sending an ACTIVE Live session to background physically produced explicit interruption reason `APP_BACKGROUND` and persisted session evidence into History.

**Expected:** no silent claim that recording continued in background.

**Non-claim:** does not certify future background-recording support.

**Regression target:** `RealLiveSessionController` app-state terminalization and History persistence.

### GD-004 — Persisted completed/interrupted History entries

**Status:** GOLDEN

**Source:** Q-001

**Claim:** completed and interrupted sessions were both physically visible in durable History with blocks/readings/termination metadata.

**Expected:** restart/history path preserves terminal session truth.

**Limitation:** Q-001 build could not reconstruct Summary because of the then-open TextDecoder defect.

### GD-005 — Hermes TextDecoder negative regression

**Status:** NEGATIVE_GOLDEN (historical fixed defect)

**Source:** Q-001

**Trigger:** reconstruct persisted Session Summary on Android/Hermes build that depended on ambient global TextDecoder.

**Historical observed behavior:** reconstruction failed with `Property 'TextDecoder' doesn't exist`.

**Correct expected behavior now:** runtime-safe decoding without ambient TextDecoder assumption.

**Closure evidence:** Q-002 physically opened Session Summary on RC3.

**Regression target:** `TextEncodingPolyfill` and `BinaryObd2V3Codec` reconstruction path.

### GD-006 — Duster real ECU acquisition

**Status:** GOLDEN

**Source:** Q-002

**Scope:** Renault Duster 2014 + same primary tested adapter + RC3.

**Claim:** AutoPulse physically acquired and displayed varying RPM, vehicle speed and coolant values on the tested Duster.

**Observed examples:** approximately 924–1955 rpm, 6–24 km/h and 78–84 °C across screenshots.

**Non-claims:** numeric examples are observational, not calibration standards; no raw OBD byte capture attached.

### GD-007 — Duster first-ECU waiting→Live transition

**Status:** GOLDEN

**Source:** Q-002

**Claim:** Duster session visibly stayed in `CONNECTED · WAITING FOR ECU DATA` before a valid ECU observation and then moved into the quiet healthy Live state.

**Regression target:** normal healthy state remains quiet; transitional waiting state remains explicit.

### GD-008 — Duster Essential/Family/Performance continuity

**Status:** GOLDEN

**Source:** Q-002

**Claim:** on the observed Duster RC3 session, switching among Essential, Family/Daily and Performance did not visibly terminate the ECU session, and telemetry/trends continued.

**Non-claim:** this does not prove every mode dimension was fully READY or that every optional signal was available.

### GD-009 — Off-Road destabilization negative case

**Status:** NEGATIVE_GOLDEN (open physical closure)

**Source:** Q-002

**Trigger:** enter Off-Road during active Duster Live session.

**Observed:** user reported ECU connection/data path broke or was lost while other modes worked.

**Interpretation:** Off-Road cross-subsystem integration defect, not sufficient evidence of basic Duster incompatibility.

**Code risks identified:** Live-time Android location permission request and excessive phone sensor event/context load.

**Correct expected behavior:** Off-Road phone sensors remain optional sidecar and cannot stop, reset or starve ECU acquisition.

**Fix candidate:** RC4 PR #37.

**Physical closure:** pending Q-003.

### GD-010 — Duster RC3 Summary reconstruction

**Status:** GOLDEN

**Source:** Q-002

**Claim:** normal Stop reached a real persisted Session Summary on RC3 and did not reproduce the historical TextDecoder runtime failure.

**Regression target:** Android/Hermes persisted Summary reconstruction.

### GD-011 — Clean Stop mislabeled PARTIAL negative case

**Status:** NEGATIVE_GOLDEN (code-fixed, physical closure pending)

**Source:** Q-002

**Historical observed:** Summary displayed `Session PARTIAL` with reason `USER_INITIATED`.

**Root cause:** final normal flush block is intentionally shorter/`isPartial`, but Summary previously interpreted any partial block as whole-session PARTIAL.

**Correct expected behavior:** one expected final short flush on an otherwise complete normal session does not downgrade session-level integrity.

**Fix:** RC4 Summary integrity semantics.

**Physical closure:** pending Q-003.

## 4. RC4 candidate golden cases

These must remain CANDIDATE until physical execution.

### GD-C01 — Off-Road sidecar isolation

**Status:** CANDIDATE

**Source plan:** Q-003

**Expected:** Duster ECU RPM/speed/coolant continue across 30–60 seconds in Off-Road; no permission UI, reinitialization, session reset or BLE loss caused by mode entry.

Promotion condition: Q-003 physical PASS.

### GD-C02 — missing Live-time location permission degrades only Off-Road location

**Status:** CANDIDATE

**Expected:** no permission dialog in ACTIVE Live; altitude/location unavailable state appears honestly; ECU remains alive.

Promotion condition: physical run with permission absent or controlled UI/native validation strong enough for the defined scope.

### GD-C03 — clean user Stop produces COMPLETE session when evidence is otherwise complete

**Status:** CANDIDATE

**Expected:** terminal reason USER_INITIATED, Summary reconstruction succeeds, session integrity COMPLETE despite one expected final short block.

Promotion condition: Q-003 physical PASS.

## 5. Lifecycle candidates still pending physical certification

### GD-C04 — physical BLE adapter disconnect

Expected:

- explicit terminal interruption;
- device-disconnect reason;
- no indefinitely active UI;
- committed blocks survive;
- Summary/History honest.

Status: CANDIDATE / not yet physically certified on current stabilized candidate.

### GD-C05 — abrupt Android process kill recovery

Expected after relaunch:

- orphan active session reconciles to interrupted;
- reason `UNEXPECTED_APP_TERMINATION` unless stronger prior reason;
- durable counts/sequence/end evidence retained;
- missing tail not invented;
- History/Summary accessible.

Status: CANDIDATE / not yet physically certified.

## 6. Raw Diagnostic Corpus status

Current repository automated tests contain deterministic parser/codec vectors, but the field screenshots in Q-001/Q-002 do not provide byte-level Duster/Logan captures.

Therefore the raw physical Golden Diagnostic Corpus remains incomplete.

Required future raw cases:

1. standard 11-bit OBD capability and telemetry trace;
2. extended 29-bit OBD trace;
3. ISO-TP multi-frame diagnostic/DTC trace;
4. negative ECU response;
5. repeated OBD `NO_DATA` case;
6. timeout/adapter-error distinction;
7. fragmented/multiline adapter behavior;
8. high-dynamic-range telemetry sequence;
9. corrupt/truncated BINARY_OBD2_V3 block;
10. unsupported codec-version block;
11. sequence gap/overlap persistence case.

Each raw corpus case must include expected normalized events/readings and deterministic regression assertions.

## 7. Golden compatibility matrix — current scope

| Vehicle | Year | Adapter | Real ECU acquisition | Summary reconstruction | Off-Road | Lifecycle | Certification note |
|---|---:|---|---|---|---|---|---|
| Renault Logan | 2014 | Primary tested BLE ELM-compatible adapter | GOLDEN PASS | historical fail then code-fixed; later runtime closure shown on Duster | phone sensors observed | APP_BACKGROUND + History observed; BLE unplug/process kill pending | physical vertical incomplete |
| Renault Duster | 2014 | same adapter | GOLDEN PASS | GOLDEN PASS on RC3 | NEGATIVE_GOLDEN on RC3; RC4 retest pending | normal Stop observed; destructive matrix pending | second vehicle evidence, not manufacturer-wide certification |

Adapter identity/model and Android model should be upgraded from UNKNOWN to exact metadata in future physical receipts.

## 8. Release-claim boundary from Golden Dataset

The current Golden Dataset supports saying:

> AutoPulse has physically acquired real standard ECU telemetry from the tested 2014 Renault Logan and 2014 Renault Duster using the project's tested BLE ELM-compatible adapter path. Persistence, History and explicit interruption behavior have real field evidence, while Off-Road isolation and parts of the destructive lifecycle matrix remain under certification.

It does not support saying:

> AutoPulse works with every car, every Renault, every OBD adapter or every connector.

## 9. Dataset maintenance

When a candidate passes:

- never delete the earlier negative golden case;
- mark the negative case historical/fixed with closure reference;
- create/promote a positive golden record tied to the exact new build;
- update compatibility matrix scope;
- update Release documents only to the level justified by the new record.
