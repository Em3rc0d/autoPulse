## P0 Stabilization Fixes

This PR includes the final two mandatory fixes for the P0 stabilization phase.

### 1. Poller Integrity: Preserving Retired PID Evidence
- Modified `RealTelemetryPoller` to ensure that when a PID hits its 3rd `NO_DATA` failure, the event is correctly dispatched down the historical pipeline before the PID is formally retired from the active loop. 
- Prevents silent loss of the final read attempt and corrects the event boundary logic.
- Included corresponding updates to `RealTelemetryPoller.test.ts`.

### 2. Live Session Snapshots: PROBE Origin
- Updated `InitializationScreen` to dynamically detect non-advertised PIDs as `PROBE` origin.
- Replaced previous loose type casts (`as any`) with proper assignments, persisting `origin: 'PROBE'` and `supportState: 'NOT_AVAILABLE'`.
- Added a validation test in `liveSessionRepository.test.ts` to confirm that `attachSignalSnapshots` can store these specific payloads safely without triggering schema constraints.

---

### Verification Run
```text
> autopulse-mobile@1.0.0 verify
> npm run typecheck && npm run test

> autopulse-mobile@1.0.0 typecheck
> tsc --noEmit

> autopulse-mobile@1.0.0 test
> jest --runInBand

Test Suites: 30 passed, 30 total
Tests:       150 passed, 150 total
Snapshots:   0 total
Time:        10.546 s, estimated 11 s
Ran all test suites.
```
