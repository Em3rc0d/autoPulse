# AutoPulse Pilot 0 — Session Receipt

> One receipt per physical/dry-run/client evaluation. Do not reuse a receipt across sessions.

## Candidate identity

- Pilot candidate label:
- Git head SHA:
- CI-tested merge SHA:
- APK SHA-256:
- JS bundle SHA-256:
- Package-lock SHA-256:
- Android permission-set SHA-256:
- Signer class (`ANDROID_DEBUG` / production signer):
- Artifact receipt file/reference:

## Test context

- Receipt ID:
- Date/time:
- Operator:
- Test class: `INTERNAL_DRY_RUN` / `EXTERNAL_ACCOMPANIED`
- Environment: `STATIONARY` / `CONTROLLED_MOVEMENT`
- Vehicle make/model/year if known:
- Vehicle identifier used in AutoPulse:
- Adapter make/model if known:
- Adapter identifier/address suffix if appropriate:
- Android device/model:
- Android version:

## Safety / scope confirmation

- [ ] Read-only diagnostic scope maintained.
- [ ] No DTC clear, actuator command, ECU reset or write service used.
- [ ] App operator was not the driver during any vehicle movement.
- [ ] Participant understood that AutoPulse is a bounded evidence report, not full mechanical certification.

## Live evidence

- Session ID:
- Acquisition mode: `REAL_BLE`
- Adapter-ready observed: `YES / NO`
- Vehicle/ECU-ready observed: `YES / NO`
- First valid ECU sample observed: `YES / NO`
- Time to first valid ECU sample:
- Protocol value shown:
- Protocol confidence/provenance shown:
- RPM: `OBSERVED / PROBED_NO_DATA / INVALID_ONLY / NOT_EVALUATED`
- Speed: `OBSERVED / PROBED_NO_DATA / INVALID_ONLY / NOT_EVALUATED`
- Coolant: `OBSERVED / PROBED_NO_DATA / INVALID_ONLY / NOT_EVALUATED`
- ECU voltage PID 0142: `OBSERVED / PROBED_NO_DATA / INVALID_ONLY / NOT_EVALUATED`
- Adapter ATRV voltage: `OBSERVED / PROBED_NO_DATA / INVALID_ONLY / NOT_EVALUATED`
- Off-Road phone sensors used: `YES / NO`
- Phone-sensor provenance remained distinct from ECU: `PASS / FAIL / N/A`
- STALE value semantics observed correctly: `PASS / FAIL / NOT_EXERCISED`

## Lifecycle / resilience

- Clean Stop exercised: `YES / NO`
- Terminal state:
- Terminal reason:
- History/Summary integrity:
- RC5 recovery exercised: `YES / NO`
- Recovery trigger:
- Same session preserved after successful recovery: `PASS / FAIL / N/A`
- Missing recovery interval remained explicit/not synthesized: `PASS / FAIL / N/A`
- Recovery exhaustion exercised: `YES / NO`
- Failure terminalized explicitly: `PASS / FAIL / N/A`
- `NO_DATA` incorrectly triggered transport recovery: `YES / NO`
- Background interruption exercised: `YES / NO`
- Background became explicit interruption: `PASS / FAIL / N/A`

## Check Lite

- Check generated: `YES / NO`
- Check ID:
- Evidence readiness / `pilotEligible`:
- Coverage percentage:
- Limitations shown:
- Adapter voltage remained separate from ECU voltage: `PASS / FAIL`
- Missing values remained non-zero/non-observed: `PASS / FAIL`

## Report V0

- Report opened: `YES / NO`
- Report schema:
- Report SHA-256:
- Integrity verified in app: `YES / NO`
- Reopened report reused immutable existing report: `PASS / FAIL / NOT_EXERCISED`
- Any integrity mismatch/error:

## Evidence attachments

Record references/hashes, not assumptions.

- APK artifact:
- App artifact receipt:
- Session export/raw telemetry reference:
- Screenshots:
- Report snapshot/export:
- Additional logs:

## Final classification

Choose exactly one:

- `PASS_INTERNAL_A4`
- `PASS_CLIENT_PILOT`
- `FAIL_PRODUCT`
- `INVALID_EVIDENCE`
- `INCOMPLETE_TEST`

Reason:

Operator notes:
