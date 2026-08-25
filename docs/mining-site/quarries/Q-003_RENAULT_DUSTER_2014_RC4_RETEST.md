# Q-003 — Renault Duster 2014 RC4 Retest Quarry

**Quarry ID:** Q-003
**Vehicle:** Renault Duster 2014
**Build target:** RC4 final CI APK from head `4f463a0925cc069b5e835a430132da9e9b9ab092` or later exact replacement if the head changes before artifact freeze
**Status:** PLANNED / NOT YET EXECUTED

This file is intentionally committed before the physical retest so the evidence form is fixed before results are known.

## 1. Purpose

Q-003 exists to close two defects found in Q-002:

- Q2-D-01 — Off-Road could destabilize the active ECU/session path;
- Q2-D-02 — normal USER_INITIATED Stop could be mislabeled Session PARTIAL because of the expected final short telemetry block.

It also provides a short regression check that RC4 did not damage the already-working Duster acquisition path.

## 2. Required pre-test metadata

Fill before starting:

- Date/time:
- Exact APK file/build ID:
- APK SHA-256:
- Git commit SHA:
- Android device model:
- Android version/build:
- AutoPulse install type: clean install / upgrade:
- Adapter commercial name/model:
- Adapter reported identity/firmware:
- Vehicle engine (if known):
- Location permission granted before Live: yes/no:
- Phone orientation/calibration state:

If an item is unknown, write `UNKNOWN`; do not leave ambiguity that can later be mistaken for evidence.

## 3. Baseline acquisition

### Q3-A-01 — initialization

- [ ] BLE adapter connected.
- [ ] ELM-compatible adapter identified/accepted.
- [ ] adapter configuration completes.
- [ ] protocol detection step completes honestly.
- [ ] supported-signal discovery completes.
- [ ] Live opens.

Observed notes:

```text

```

### Q3-A-02 — first ECU truth

- [ ] connected/waiting state is visible before first valid ECU sample if applicable.
- [ ] adapter-only data does not unlock Live.
- [ ] first real ECU sample transitions the UI to healthy Live.
- [ ] large healthy Live banner is absent after transition.
- [ ] subtle green live indicator is present.

Observed first valid signal/value:

```text

```

## 4. Essential control period

Run ~15 seconds.

Record at least two observations where available:

- RPM:
- speed:
- coolant:
- adapter voltage:
- other signal:

Checks:

- [ ] values update over time;
- [ ] no unexplained freeze;
- [ ] no session reset;
- [ ] Driver Intelligence state remains source-truthful.

## 5. Performance control period

Run ~15 seconds.

Record:

- RPM range/observations:
- coolant:
- trend behavior:
- any warning/voice/haptic:

Checks:

- [ ] mode switch does not reset session;
- [ ] ECU values continue updating;
- [ ] no permission UI;
- [ ] no adapter reconnect sequence.

## 6. Off-Road critical retest

Remain in Off-Road for 30–60 seconds.

### ECU continuity

- [ ] RPM continues to update.
- [ ] speed continues if vehicle is moving.
- [ ] coolant remains available.
- [ ] other previously available ECU signals remain alive.
- [ ] no BLE disconnect.
- [ ] no reinitialization screen.
- [ ] no new session/session ID reset.

### Permission behavior

- [ ] no Android permission dialog is launched during ACTIVE Live.

If permission was intentionally not granted before Live:

- [ ] location/altitude becomes unavailable/permission-required;
- [ ] ECU acquisition continues unaffected.

### Phone sensor sidecar

- [ ] pitch updates where sensor available.
- [ ] roll updates where sensor available.
- [ ] altitude updates only if location evidence is available.
- [ ] heading updates where available.
- [ ] phone sensor unavailability does not downgrade ECU source truth.

### Resource/UX behavior

- [ ] screen remains responsive.
- [ ] primary ECU data remains readable.
- [ ] no repeated voice spam.
- [ ] no critical red state unless a real terminal/critical condition occurs.

Observed values/time sequence:

```text

```

## 7. Return from Off-Road

Switch back to Essential or Performance.

- [ ] same session remains active.
- [ ] ECU values continue.
- [ ] mode switch itself produces no disconnect/reinit.

Notes:

```text

```

## 8. Normal Stop / Summary semantics

Press Stop Session.

- [ ] bounded stop completes.
- [ ] Summary opens.
- [ ] no TextDecoder error.
- [ ] termination reason is USER_INITIATED.
- [ ] integrity verdict is COMPLETE if no actual corruption/gap/mismatch/interruption occurred.
- [ ] a final shorter block may still be counted in block detail without downgrading session-level integrity.
- [ ] counts/duration are plausible.

Record:

- session ID:
- duration:
- expected blocks:
- found blocks:
- partial blocks:
- total events:
- total readings:
- integrity state:
- termination reason:

## 9. History persistence

- [ ] Done navigates to History.
- [ ] same session appears.
- [ ] status is COMPLETED.
- [ ] termination is USER_INITIATED.
- [ ] reopen reconstructed Summary succeeds.
- [ ] reopened Summary agrees with original terminal facts.

## 10. Failure capture protocol

If ECU behavior breaks in Off-Road, do not immediately retry without recording:

- elapsed session time at mode switch;
- last visible RPM/speed/coolant;
- whether values froze or disappeared;
- whether timer continued;
- status banner text/color;
- whether Android permission UI appeared;
- whether Bluetooth system indicator changed;
- whether AutoPulse returned to initialization;
- whether History created COMPLETED/INTERRUPTED/other status;
- terminal reason;
- Summary availability;
- any log/stack trace.

## 11. Gate decision template

### RC4 Off-Road isolation

`PASS / FAIL / INCONCLUSIVE`

Reason:

```text

```

### Clean Stop Summary semantics

`PASS / FAIL / INCONCLUSIVE`

Reason:

```text

```

### Duster RC4 overall

`PASS / FAIL / PARTIAL`

Remaining defects:

```text

```

## 12. Golden Dataset promotion

Only after the physical run:

- promote Off-Road sidecar isolation as GOLDEN if ECU continuity survives the defined period;
- promote normal Stop COMPLETE semantics if the Summary result matches the expected rule;
- retain any failure as a negative golden regression case if it is sufficiently reproducible and identified.
