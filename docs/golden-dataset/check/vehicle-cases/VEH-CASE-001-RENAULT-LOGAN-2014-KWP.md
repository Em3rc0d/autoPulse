# VEH-CASE-001 — Renault Logan 2014 — ISO 14230 KWP

Status: `SCREENSHOT_TRANSCRIBED_PHYSICAL_OBSERVATION`

Observed date: 2026-09-06

AutoPulse source HEAD: `64a8d4e7eedc9b9f7d5c96e875cdb844b1c79ce6`

Pilot: `check-physical-pilot/v2`

Vehicle label used by AutoPulse: Renault Logan 2014

Protocol reported by Check: `ISO_14230_KWP`

Protocol evidence: `A4`

Responder attribution: `UNATTRIBUTED`

## Physical observations

The Check UI reported one bootstrap OBD command, four planned scan commands, four normalized scan response records, and 23 response bytes for the planned scan.

### Bootstrap Mode 01 PID 00

Visible raw response:

```text
SEARCHING... 410000000000 >
```

Normalized diagnostic bytes:

```text
41 00 00 00 00 00
```

Interpretation allowed by this case: a positive Mode 01 PID 00 response with an all-zero 32-bit support bitmap was observed during bootstrap.

### Planned Check Mode 01 PID 00

Visible raw response:

```text
410000000000
```

Normalized diagnostic bytes:

```text
41 00 00 00 00 00
```

Interpretation allowed by this case: the same all-zero support bitmap was independently observed by the planned Check request. AutoPulse therefore presents the capability map as `INCONCLUSIVE`. This case does **not** claim that individual PIDs are unsupported.

### Stored DTCs — Mode 03

Visible raw response:

```text
43000000000000
```

Normalized diagnostic bytes:

```text
43 00 00 00 00 00 00
```

Interpretation allowed by this case: the scanned response contained no non-zero stored DTC pairs. This is not a whole-vehicle health claim.

### Pending DTCs — Mode 07

Visible raw response:

```text
47000000000000
```

Normalized diagnostic bytes:

```text
47 00 00 00 00 00 00
```

Interpretation allowed by this case: the scanned response contained no non-zero pending DTC pairs. This is not a whole-vehicle health claim.

### Permanent DTCs — Mode 0A

Visible raw response:

```text
7F0A11
```

Normalized diagnostic bytes:

```text
7F 0A 11
```

Interpretation allowed by this case: the ECU/path returned a negative response for service `0A`, NRC `0x11` (`Service Not Supported`). AutoPulse correctly reports the permanent-DTC service as unavailable and does not retry it automatically.

## Cross-evidence note

Earlier AutoPulse Live sessions on this same vehicle directly observed standard Mode 01 values such as engine RPM (`010C`), vehicle speed (`010D`) and coolant temperature (`0105`). Those observations are a separate evidence class from the all-zero `0100` advertisement observed here.

The correct model is therefore:

```text
0100 advertisement: EMPTY / INCONCLUSIVE
0105 direct observation: previously OBSERVED
010C direct observation: previously OBSERVED
010D direct observation: previously OBSERVED
```

Direct observation must never be rewritten as `ECU_ADVERTISED`, and the empty bitmap must never be rewritten as proof of `UNSUPPORTED` for those PIDs.

## Claims explicitly NOT made

- no ECU role is inferred from `UNATTRIBUTED` responses;
- no ABS/SRS/transmission/manufacturer-enhanced coverage is claimed;
- no mechanical PASS/FAIL or whole-vehicle health verdict is made;
- no permanent-DTC support is claimed;
- no PID is declared unsupported solely because the `0100` bitmap was empty;
- the earlier compatibility observation of multiple ECUs is not used to assign these unattributed responses to a module.

## Promotion boundary

This case was transcribed from screenshots of a real physical run. The screenshots visibly preserve the response text, but there is no independently supplied raw transport archive and no capture-package hash for this run. Therefore this record may seed reviewed field fixtures and regression tests, but **cannot** by itself satisfy `PHYSICALLY_CERTIFIED` promotion.
