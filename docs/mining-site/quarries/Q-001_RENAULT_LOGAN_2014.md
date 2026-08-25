# Q-001 — Renault Logan 2014 Physical Quarry

**Quarry ID:** Q-001
**Vehicle:** Renault Logan
**Year:** 2014
**Engine:** not sufficiently documented in this quarry record
**Adapter:** same primary BLE ELM-compatible adapter used in project physical testing; exact commercial identity/firmware should be added when captured
**Android device:** real user Android smartphone; exact model/version should be added to future certification receipt
**Evidence type:** UI_OBSERVATION + PHYSICAL_BEHAVIOR + visible persisted session metadata

## 1. Purpose

This quarry preserves the first substantial real AutoPulse vertical evidence on the Renault Logan. It is intentionally not rewritten into a clean success story: the run proved major acquisition/persistence behavior and also exposed real lifecycle/runtime defects.

## 2. Provenance limitations

Available evidence includes real screenshots and user field observations from the physical test conversation.

Not available in this quarry:

- full raw BLE transaction log;
- full raw ELM command/response transcript;
- CAN bus capture;
- exact adapter commercial model/firmware receipt;
- exact Android OS/build receipt;
- raw SQLite export.

Therefore claims below are scoped to what was visibly/behaviorally observed.

## 3. Initialization observations

Observed initialization screen showed successful progression through:

- BLE adapter connected;
- ELM327 identified;
- configuring adapter;
- detecting vehicle protocol;
- checking supported signals;
- preparation toward Live.

### Observation Q1-INIT-01

**Observed:** physical adapter path reached supported-signal discovery.

**Interpretation:** BLE → ELM-compatible initialization → vehicle diagnostic negotiation was functioning sufficiently to proceed.

**Not proven:** universal adapter compatibility or exact resolved vehicle protocol from screenshots alone.

## 4. First ECU truth observations

Live UI eventually displayed first ECU sample received and real vehicle telemetry.

Observed/previously recorded values included:

- engine RPM;
- vehicle speed;
- coolant temperature;
- adapter voltage in roughly the mid-14 V range.

### Observation Q1-ECU-01

**Observed:** valid ECU-origin telemetry was displayed after initialization.

**Promotable claim:** tested Logan + tested adapter can produce real standard Live ECU observations in AutoPulse under the tested conditions.

**Do not promote to:** all Renault / all ELM readers.

## 5. Adapter voltage/source truth

Visible Live UI later showed adapter voltage such as ~14.5 V and labeled it as adapter measurement.

### Observation Q1-SRC-01

**Observed:** UI can present adapter-origin voltage separately from ECU telemetry.

**Design consequence:** preserve strict distinction between `ATRV` and PID `0142`.

## 6. Off-Road observations

Off-Road mode displayed phone-origin context including:

- calibrated vehicle pitch;
- calibrated vehicle roll;
- altitude around 309 m in the observed phone/location context;
- heading;
- recalibration control.

Examples visible across the run included pitch/roll values around:

- 3.4° / 1.9°;
- later a large pitch change around -28.4° with roll around -1.3°;
- after recalibration values near 0.1° / 0.4°.

### Observation Q1-OFF-01

**Observed:** vehicle-scoped calibration visibly changes the attitude reference.

**Inference:** the large pre-recalibration shift is consistent with phone orientation changing relative to the saved calibration reference.

**Not proven:** absolute vehicle attitude accuracy or rugged/off-road sensor certification.

### Observation Q1-OFF-02

**Observed:** altitude and heading were obtainable on this device/context.

**Not proven:** altitude quality/accuracy beyond the phone/location source.

## 7. Background interruption observation

During the real session, backgrounding the app produced a visible red terminal state:

```text
SESSION INTERRUPTED
The Live session ended unexpectedly (APP_BACKGROUND)
Persisted evidence remains available in Session Summary.
```

### Observation Q1-LIFE-01

**Observed:** release-1 foreground-only policy physically triggered on background.

**Observed:** interruption reason was explicit rather than silently pretending continued recording.

## 8. Terminal Live UX defect

After interruption, screenshots showed that parts of the Live surface could continue to look active: timer progression and active controls/mode interactions were still possible/visible.

### Defect Q1-D-01

**Severity:** product truth / lifecycle UX defect.

**Meaning:** persistence state could be terminal while UI affordances still suggested an active session.

**Fix lineage:** RC3 terminal-state UI hardening.

**Closure:** requires current-build physical revalidation; implementation exists.

## 9. Session reconstruction runtime failure

Attempting to reconstruct Summary produced:

```text
Failed to reconstruct session.
Property 'TextDecoder' doesn't exist
```

### Defect Q1-D-02

**Classification:** Android/Hermes runtime portability defect.

**Evidence implication:** persisted session metadata existed, but reconstruction path failed at runtime text decoding.

**Root cause from later code review:** product codec depended on global `TextDecoder` that was available in Node tests but not the tested Hermes runtime.

**Fix lineage:** RC3 Hermes-safe encoding/polyfill.

**Physical closure evidence:** later Q-002 Duster RC3 run successfully opened Session Summary, demonstrating the previous runtime failure was fixed in the tested later build/runtime path.

## 10. History durability observation

History screenshot showed two recent Logan sessions.

One visible entry:

- status `COMPLETED`;
- termination `USER_INITIATED`;
- duration around 11 seconds in that captured receipt;
- 2 blocks;
- 10 readings.

Another visible entry:

- status `INTERRUPTED`;
- termination `APP_BACKGROUND`;
- duration around 33 seconds;
- 6 blocks;
- 46 readings.

### Observation Q1-PERSIST-01

**Observed:** both completed and interrupted session metadata persisted into History.

### Observation Q1-PERSIST-02

**Observed:** committed blocks/readings remained associated with interrupted evidence.

**Not proven at that moment:** successful reconstruction of the persisted blocks, because Q1-D-02 prevented Summary decoding in that build.

## 11. Product/UX observations

The field screenshots also demonstrated that the original Live layout consumed too much vertical space with Driver Mode cards and status chrome relative to the phone viewport.

### Observation Q1-UX-01

**Observed:** actual phone use made the dashboard density/vertical hierarchy problem clear.

**Design promotion:** smartphone-first cockpit, compact mode selector, quiet healthy state, exception-first banners.

## 12. Quarry decision

### PASS observations

- physical BLE connection path;
- ELM-compatible initialization path;
- real ECU telemetry;
- adapter-origin voltage presentation;
- Off-Road phone sensor acquisition/calibration behavior;
- explicit APP_BACKGROUND interruption;
- durable History entries for completed/interrupted sessions.

### FAIL observations

- terminal Live UI remained too operational-looking after interruption;
- persisted Summary reconstruction failed because of missing TextDecoder in Hermes.

### Pending physical rows after fixes

- current-build clean Stop → Summary → History → restart → same Summary;
- physical BLE unplug terminal behavior;
- abrupt process kill boot recovery;
- current-build background terminal UI recheck.

## 13. Golden promotion status

Approved for Golden Dataset as scoped behavioral cases:

- real Logan acquisition case;
- APP_BACKGROUND interruption persistence case;
- History durability case;
- negative Hermes TextDecoder regression case (historical defect/fixed-regression reference).

Not suitable for raw diagnostic Golden Corpus:

- no byte-level diagnostic capture is attached to this quarry.
