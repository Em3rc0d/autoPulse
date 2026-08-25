# Q-002 — Renault Duster 2014 Physical Quarry

**Quarry ID:** Q-002
**Vehicle:** Renault Duster
**Year:** 2014
**Engine:** not sufficiently documented in this quarry record
**Adapter:** same primary BLE ELM-compatible adapter used in the Logan test
**Build lineage:** RC3 (`6ac2fac8…` lineage)
**Evidence type:** UI_OBSERVATION + PHYSICAL_BEHAVIOR + visible persisted Summary

## 1. Purpose

This quarry changes one important variable from Q-001: the vehicle.

```text
Q-001: Renault Logan 2014 + Adapter A
Q-002: Renault Duster 2014 + Adapter A
```

Keeping the adapter constant makes the Duster useful for isolating vehicle-vs-feature behavior even though both vehicles are Renault.

## 2. Provenance limitations

Available:

- physical Android app screenshots;
- direct user observation during the drive;
- visible Live telemetry and Session Summary.

Not captured here:

- full raw BLE/ELM transcript;
- raw CAN/ISO-TP capture;
- exact adapter firmware string;
- exact Android model/version;
- exported SQLite/session payload.

## 3. Initialization observations

Visible initialization showed:

- BLE adapter connected;
- ELM327 identified;
- configuring adapter;
- detecting vehicle protocol;
- checking supported signals;
- transition into Live.

### Q2-INIT-01

**Observed:** the same adapter successfully negotiated the Duster far enough to start real Live acquisition.

**Scope:** tested Duster/adapter/build only.

## 4. Waiting → real ECU data

The Live screen initially displayed:

```text
CONNECTED · WAITING FOR ECU DATA
```

with a message that AutoPulse was waiting for the first valid ECU observation.

Later screenshots showed the banner gone and a subtle green Live indicator after ECU-origin values arrived.

### Q2-ECU-01

**Observed:** Duster honored the intended first-ECU-sample truth transition.

This is useful because adapter/initialization state did not automatically imply Live ECU state.

## 5. ECU telemetry observations

Visible examples included:

### Early sample

- RPM: ~1482 rpm;
- coolant: ~78 °C.

### Moving samples

- RPM: ~1482 rpm;
- speed: ~18 km/h;
- coolant: ~78 °C.

Additional samples:

- ~1909 rpm / ~23 km/h / ~78 °C;
- ~1955 rpm / ~24 km/h / ~78 °C;
- later ~924 rpm / ~6 km/h / ~84 °C.

### Q2-ECU-02

**Observed:** RPM changed plausibly over time.

### Q2-ECU-03

**Observed:** speed became available while moving and varied across screenshots.

### Q2-ECU-04

**Observed:** coolant remained available and changed from ~78 °C to ~84 °C over the field session.

### Q2-ECU-05

**Observed:** RPM trend chart accumulated a time sequence rather than only a single value.

No claim is made here about calibration/absolute sensor accuracy beyond what the ECU data path reported.

## 6. Driver Mode observations

### Essential

Observed with RPM/speed/coolant available. Engine evidence showed PARTIAL while Motion could show READY depending on available dimensions.

### Family / Daily

Observed while ECU telemetry continued. Family mode changed the evidence dimensions shown, not the underlying telemetry source.

### Performance

Observed while RPM/coolant and RPM trend continued to update.

### Q2-MODE-01

**Observed:** switching among Essential, Family and Performance did not visibly destroy the ECU session in the captured run.

This became the control condition for the Off-Road defect.

## 7. Off-Road failure observation

User observation:

> “The systems (ECU connection) breaks when I enter to the off road mode. Lost connection or something like that but another works well.”

This is an important negative result.

### Q2-D-01 — Off-Road destabilizes active acquisition

**Observed:** entering Off-Road was associated with loss/breakage of the active ECU connection/data behavior.

**Control:** same Duster + same adapter continued to work in Essential/Family/Performance.

**Classification:** cross-subsystem integration defect; not sufficient evidence to classify the Duster as unsupported.

### Code-risk findings after the field result

Investigation identified two concrete design violations/risk paths:

1. entering Off-Road could cause the phone location hook to request Android location permission while the OBD session was ACTIVE;
2. phone rotation/location events were delivered/propagated at a rate capable of creating excessive native→JS→React/context work while ELM request/response timing was active.

Because Release-1 treats leaving foreground as `APP_BACKGROUND`, a permission UI could indirectly cause a terminal lifecycle transition. Separately, high-rate phone sensor state propagation could increase JS contention.

**Important:** screenshots alone do not prove which mechanism caused the exact physical failure. RC4 fixes both architecture risks because neither is acceptable regardless of which was dominant.

## 8. RC4 response to Q2-D-01

PR #37 introduces:

- no location permission dialog during ACTIVE Live;
- missing location permission degrades location-derived Off-Road capability only;
- lower native rotation update rate;
- JS-side motion throttling;
- low-rate Driver Intelligence publication;
- explicit architectural priority: ECU acquisition > phone sensor sidecar.

Physical closure is pending Q-003.

## 9. Summary reconstruction observation

After a normal Stop, Duster opened an actual Session Summary.

Visible identity included:

- Vehicle: Duster;
- Acquisition Mode: `REAL_BLE`;
- duration roughly 0m 58s in the captured Summary.

### Q2-SUM-01

**Observed:** persisted Summary reconstruction succeeded on RC3.

This provides physical closure evidence for the earlier Logan `TextDecoder` runtime crash in the later RC3 build lineage.

It does not prove every historical session will reconstruct; it proves the tested later session/runtime path did.

## 10. Clean Stop semantic defect

Visible Summary showed:

```text
Session PARTIAL
Reason: USER_INITIATED
```

Code review established that `TelemetryBlockAssembler.flush()` intentionally marks the last shorter fixed-duration window as a partial block on Stop, while Summary logic previously treated any partial block as enough to downgrade the entire session.

### Q2-D-02 — clean Stop mislabeled PARTIAL

**Observed:** clean user-initiated stop displayed a session-level PARTIAL verdict.

**Classification:** integrity-semantics defect, not proof of lost evidence.

**RC4 fix:** allow a completed/user-initiated session with exactly the expected final short flush and no other corruption/gap/mismatch to remain COMPLETE while still reporting the partial block detail.

Physical closure pending Q-003.

## 11. UI observations

The RC3 phone-first redesign is visible in this quarry:

- compact mode cards instead of the former much larger panels;
- vehicle/timer near primary telemetry;
- no persistent large healthy `LIVE · ECU DATA` banner after first ECU truth;
- primary metric cards remain readable on the smartphone viewport;
- RPM trend appears below primary telemetry;
- Stop remains fixed/reachable.

### Q2-UX-01

**Observed:** phone-first RC3 hierarchy is materially denser/more usable than earlier Logan UI.

This is an observational UX receipt, not a formal usability study.

## 12. Quarry decision

### PASS

- initialization on Duster;
- first ECU truth transition;
- real RPM;
- real speed;
- real coolant;
- time-varying RPM trend;
- Essential mode session continuity;
- Family mode session continuity;
- Performance mode session continuity;
- Stop → reconstructed Session Summary;
- Hermes TextDecoder regression no longer reproduced on this Summary path.

### FAIL

- Off-Road associated with ECU/session destabilization;
- normal user Stop mislabeled Session PARTIAL.

### PENDING

- RC4 Off-Road retest;
- RC4 Summary COMPLETE semantics physical proof;
- History reopen of the exact RC4 Duster session;
- destructive lifecycle cases on current stabilized build.

## 13. Golden promotion status

Promotable now:

- Duster acquisition case;
- Duster first-ECU waiting→live transition;
- multi-mode Essential/Family/Performance continuity observation;
- successful RC3 Summary reconstruction case;
- historical negative Off-Road defect case;
- historical clean-Stop PARTIAL semantic regression case.

Not promotable as physically closed:

- RC4 Off-Road fix;
- RC4 clean Stop COMPLETE verdict.

Not suitable for raw protocol fixture generation:

- no raw OBD byte capture attached.
