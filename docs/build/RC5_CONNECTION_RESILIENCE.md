# RC5 — Connection Resilience

**Base:** RC4 Off-Road isolation
**Purpose:** tolerate intermittent ELM/ECU transport loss without lying about missing telemetry.

## Failure classes

AutoPulse must keep these facts separate:

- `NO_DATA`: ECU/adapter responded with an OBD no-data outcome. This is PID capability/availability evidence, not a transport disconnect.
- `ELM_ERROR`: adapter replied with an ELM-level error. This proves adapter reachability and is not by itself a transport disconnect.
- `TIMEOUT`, `WRITE_FAILED`, `DISCONNECTED`: transport-health failures. Three consecutive failures trigger bounded recovery.
- native BLE disconnect: immediately enters bounded recovery instead of terminalizing the session.

## Recovery algorithm

1. Pause normal polling.
2. Keep the same Live session and already committed telemetry.
3. Show `RECONNECTING` as an amber/transitional state.
4. Attempt the same adapter up to three times with bounded delays.
5. Re-establish BLE when necessary and rediscover services/characteristics.
6. Prove the vehicle path with read-only Mode 01 `0100`.
7. If the ECU path is stale, issue adapter command `ATSP0` and probe `0100` again.
8. On success, reinstall the transport/poller and resume the same session.
9. On exhaustion, terminate once with `<reason>_RECOVERY_FAILED` and preserve committed evidence.

## Safety boundary

Recovery remains read-only relative to the vehicle ECU. `ATSP0` configures the ELM-compatible adapter protocol selection; no DTC clear, actuator control, ECU reset, write service, or destructive command is introduced.

## Evidence truth

Recovery never synthesizes telemetry for the missing interval. A sufficiently long gap remains visible to persisted block/window integrity and may cause a degraded summary rather than false completeness.

## RC5 physical checks

- intermittent ECU/ELM stall recovers without a new session when the adapter path returns;
- physical adapter disconnect/reconnect within the recovery window resumes the same session;
- amber `RECONNECTING` is visible while retrying;
- failure after bounded attempts becomes explicit terminal interruption;
- `NO_DATA` never triggers transport recovery;
- Off-Road RC4 isolation remains intact;
- normal Stop/History/Summary behavior remains intact.
