# CHECK v4.3 — OBD handoff recovery node

Previous runtime candidate: `5460c1d4cf2f7650555e50084c79a2955d8599f5`

## Physical symptom consumed

After using Live, entering Connect/Check can intermittently report that the ECU cannot be reached. Closing and reopening AutoPulse restores operation.

## Root-cause class closed by this node

The process restart was clearing transport/controller state that AutoPulse did not deterministically clear itself:

1. A failed Check attempt could leave its `RealObdController` / `ElmAccumulator` monitor alive.
2. Retry could then create a second controller over the same BLE receive characteristic.
3. A retained BLE link can be physically connected while the ELM/vehicle protocol path is stale.
4. Replacing an idle retained adapter could orphan the previous native BLE connection.

## Invariants

- One workflow owns the adapter command lease at a time.
- One Check attempt owns one command controller/ELM accumulator.
- Every Check attempt disposes that controller on success, failure or cancellation.
- A recoverable startup-path failure may trigger exactly one BLE transport rebuild.
- The rebuilt transport must rerun the existing read-only adapter setup, `0100` bootstrap and protocol discovery.
- Semantic/safety failures never trigger transport retry.
- No unbounded reconnect loop.
- A Check screen unmount never disconnects a link that a newer workflow owns.
- Replacing a retained adapter retires the previous physical BLE link first.
- No DTC clearing, reset-module operation, actuator control, coding, adaptation or write command is introduced.

## Recoverable startup failures

- `CHECK_ADAPTER_SETUP_FAILED:*`
- `CHECK_STANDARD_OBD_UNREACHABLE:*`
- `CHECK_PROTOCOL_UNRESOLVED:*`

All other failures remain fail-closed.

## QA gate

1. Live -> normal Stop -> Check using retained adapter.
2. Repeat the transition multiple times without killing AutoPulse.
3. Force/observe one stale ECU-path failure; AutoPulse should rebuild BLE once and renegotiate.
4. Retry after a failed Check must not create duplicate receive monitors.
5. Check -> Live must be possible after Check reaches a terminal state.
6. Existing read-only Check safety/planner/replay tests remain green.
