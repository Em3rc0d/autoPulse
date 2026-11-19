import type { Subscription } from 'react-native-ble-plx';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import {
  RealTelemetryPoller,
  type PollerDiagnosticEvent,
} from '../../infrastructure/ble/real/RealTelemetryPoller';
import {
  activeBleController,
  ActiveConnection
} from '../../infrastructure/ble/ActiveBleConnectionController';
import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import { ITelemetryBlockRepository } from '../../domain/telemetry/repositories/TelemetryBlockRepository';
import {
  resolveLivePollingPlan,
  withProvenAdapterVoltage,
} from '../../domain/obd/LiveObdPollingPolicy';
import {
  TelemetryCommitQueue,
  CommitQueueEvent,
  TelemetryCommitQueueDrainTimeoutError
} from './TelemetryCommitQueue';
import { CommandResult, CommandRequest } from '../../infrastructure/ble/real/pipeline/types';
import { ObdAcquisitionMapper } from '../../domain/telemetry/factories/ObdAcquisitionMapper';
import { TelemetryBlockAssembler } from '../../domain/telemetry/logic/TelemetryBlockAssembler';
import { BinaryObd2V3Codec } from '../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';
import {
  startLiveForegroundService,
  stopLiveForegroundService,
  subscribeLiveForegroundServiceFailure,
} from './LiveForegroundService';
import { flightRecorder } from '../observability/FlightRecorder';

export type RecordingStatus = 'NOT_STARTED' | 'RECORDING' | 'FLUSHING' | 'DEGRADED' | 'FAILED' | 'CLOSED';

type LiveControllerState = 'CREATED' | 'ACTIVE' | 'RECOVERING' | 'STOPPING' | 'COMPLETED' | 'INTERRUPTED';

export interface LiveSessionTerminalOutcome {
  state: 'COMPLETED' | 'INTERRUPTED';
  reason?: string;
}

const RECOVERY_DELAYS_MS = [0, 1500, 3500] as const;
const RECOVERY_CONNECT_TIMEOUT_MS = 3500;
const RECOVERY_STOP_SETTLEMENT_TIMEOUT_MS = 9000;

/**
 * Release-1 lifecycle policy:
 * - App visibility is not a terminal transport event.
 * - Temporary adapter/ECU transport failures receive a bounded recovery window.
 * - Recovery never fabricates telemetry; any missing interval remains missing evidence.
 * - A connected-device foreground service owns background eligibility.
 * - Live polling is bounded to signals consumed by Driving View v2 so a weak link
 *   does not burn freshness budget on unrelated capability-catalog signals.
 */
export class RealLiveSessionController {
  private obdController: RealObdController | null = null;
  public poller: RealTelemetryPoller | null = null;

  private currentState: LiveControllerState = 'CREATED';
  public recordingStatus: RecordingStatus = 'NOT_STARTED';

  private recordingStartedAt: number | null = null;
  private nextEventSequence = 1;

  private assembler: TelemetryBlockAssembler | null = null;
  private codec = new BinaryObd2V3Codec();
  private commitQueue: TelemetryCommitQueue | null = null;
  private bleDisconnectSubscription: Subscription | null = null;
  private foregroundServiceFailureUnsubscribe: (() => void) | null = null;

  private terminalPromise: Promise<void> | null = null;
  private recoveryPromise: Promise<boolean> | null = null;
  private onSessionTerminal: ((outcome: LiveSessionTerminalOutcome) => void) | null = null;
  private onUiUpdate: ((result: CommandResult) => void) | null = null;
  private onRecordingError: ((err: string) => void) | null = null;

  constructor(
    private sessionRepo: LiveSessionRepository,
    private telemetryRepo: ITelemetryBlockRepository,
    private workspaceId: string,
    public sessionId: string,
    private connectionHandleId: string,
    private supportedPids: string[],
    private pollAdapterVoltage: boolean = false,
  ) {}

  public async start(
    onUiUpdate: (result: CommandResult) => void,
    onRecordingError: (err: string) => void,
    onSessionTerminal?: (outcome: LiveSessionTerminalOutcome) => void
  ) {
    if (this.currentState !== 'CREATED') return;
    flightRecorder.record({
      category: 'SESSION',
      event: 'START_REQUESTED',
      sessionId: this.sessionId,
      details: {
        supportedPidCount: this.supportedPids.length,
        pollAdapterVoltage: this.pollAdapterVoltage,
      },
    });
    this.currentState = 'ACTIVE';
    this.onUiUpdate = onUiUpdate;
    this.onRecordingError = onRecordingError;
    this.onSessionTerminal = onSessionTerminal ?? (outcome => {
      if (outcome.state === 'INTERRUPTED') {
        onRecordingError(`SESSION_INTERRUPTED:${outcome.reason ?? 'UNKNOWN'}`);
      }
    });

    const conn = activeBleController.claimConnection(this.connectionHandleId, 'LIVE');
    if (!conn) {
      flightRecorder.record({
        category: 'BLUETOOTH',
        event: 'CONNECTION_CLAIM_FAILED',
        sessionId: this.sessionId,
        details: { handleId: this.connectionHandleId },
      });
      await this.handleUnexpectedDisconnect('CONNECTION_UNAVAILABLE_OR_LEASED');
      return;
    }

    this.foregroundServiceFailureUnsubscribe?.();
    this.foregroundServiceFailureUnsubscribe = subscribeLiveForegroundServiceFailure(reason => {
      if (this.currentState === 'ACTIVE' || this.currentState === 'RECOVERING') {
        void this.handleUnexpectedDisconnect(reason);
      }
    });

    if (!(await startLiveForegroundService())) {
      flightRecorder.record({
        category: 'SESSION',
        event: 'FOREGROUND_SERVICE_UNAVAILABLE',
        sessionId: this.sessionId,
      });
      await this.handleUnexpectedDisconnect('FOREGROUND_SERVICE_UNAVAILABLE');
      return;
    }

    this.recordingStartedAt = Date.now();
    this.assembler = new TelemetryBlockAssembler(this.sessionId, this.recordingStartedAt, 5000);

    this.commitQueue = new TelemetryCommitQueue(
      this.workspaceId,
      this.sessionId,
      this.telemetryRepo,
      (event) => this.handleCommitEvent(event, onRecordingError)
    );

    this.installTransport(conn);


    this.recordingStatus = 'RECORDING';
    this.poller?.start(250);
    flightRecorder.record({
      category: 'SESSION',
      event: 'RECORDING_STARTED',
      sessionId: this.sessionId,
      details: { pollRequestCount: this.livePollRequests().length },
    });
  }

  private livePollRequests(): string[] {
    const plan = resolveLivePollingPlan(this.supportedPids);
    return withProvenAdapterVoltage(plan.requestIds, this.pollAdapterVoltage);
  }

  private installTransport(conn: ActiveConnection) {
    this.obdController?.disconnect();
    this.bleDisconnectSubscription?.remove();
    this.bleDisconnectSubscription = null;

    this.obdController = new RealObdController(conn);
    this.observePhysicalDisconnect(conn);
    this.poller = new RealTelemetryPoller(
      this.obdController,
      this.livePollRequests(),
      result => {
        if (this.onUiUpdate) this.handleCommandResult(result, this.onUiUpdate);
      },
      event => this.handlePollerDiagnostic(event, conn)
    );
  }


  private observePhysicalDisconnect(conn: ActiveConnection) {
    this.bleDisconnectSubscription?.remove();
    this.bleDisconnectSubscription = conn.device.onDisconnected(() => {
      if (this.currentState === 'ACTIVE') {
        flightRecorder.record({
          category: 'BLUETOOTH',
          event: 'DEVICE_DISCONNECTED',
          sessionId: this.sessionId,
        });
        void this.attemptConnectionRecovery('DEVICE_DISCONNECTED', conn);
      }
    });
  }

  private handlePollerDiagnostic(event: PollerDiagnosticEvent, conn: ActiveConnection) {
    if (event.type !== 'TRANSPORT_STALLED' || this.currentState !== 'ACTIVE') return;
    const recoveryReason = event.reason === 'DISCONNECTED' ? 'DEVICE_DISCONNECTED' : 'ECU_RESPONSE_LOST';
    flightRecorder.record({
      category: 'OBD_TRANSPORT',
      event: 'TRANSPORT_STALLED',
      sessionId: this.sessionId,
      details: { reason: recoveryReason },
    });
    void this.attemptConnectionRecovery(recoveryReason, conn);
  }

  private async delay(ms: number) {
    if (ms <= 0) return;
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private async prepareConnection(previous: ActiveConnection): Promise<ActiveConnection> {
    let device = previous.device;
    let connected = false;

    try {
      connected = await device.isConnected();
    } catch {
      connected = false;
    }

    if (!connected) {
      device = await device.connect({ timeout: RECOVERY_CONNECT_TIMEOUT_MS });
    }

    await device.discoverAllServicesAndCharacteristics();

    return {
      ...previous,
      device,
    };
  }

  private async probeVehiclePath(conn: ActiveConnection): Promise<boolean> {
    const probeController = new RealObdController(conn);
    const request0100 = (): CommandRequest => ({
      id: `recover-0100-${Date.now()}`,
      command: '0100',
      family: 'OBD_MODE_01',
      expectedService: '41',
      expectedPid: '00',
      timeoutMs: 1800,
    });

    try {
      const firstProbe = await probeController.executeCommand(request0100());
      if (this.provesVehiclePathFrom0100(firstProbe)) {
        return true;
      }

      // Adapter may still be alive while its vehicle protocol path went stale.
      // Re-arm automatic protocol selection, then prove the ECU path again.
      await probeController.executeCommand({
        id: `recover-atsp0-${Date.now()}`,
        command: 'ATSP0',
        family: 'ELM_AT',
        timeoutMs: 1500,
      });

      const secondProbe = await probeController.executeCommand(request0100());
      return this.provesVehiclePathFrom0100(secondProbe);
    } catch (error) {
      console.warn('[RealLiveSessionController] Recovery probe failed', error);
      return false;
    } finally {
      probeController.disconnect();
    }
  }

  private provesVehiclePathFrom0100(result: CommandResult): boolean {
    return result.status === 'SUCCESS_DECODED' && result.obdFrames.some(frame =>
      frame.validity === 'VALID' && frame.service === '41' && frame.pid === '00' && frame.payloadBytes.length >= 4
    );
  }

  public attemptConnectionRecovery(
    reason: 'DEVICE_DISCONNECTED' | 'ECU_RESPONSE_LOST',
    connection?: ActiveConnection
  ): Promise<boolean> {
    if (this.terminalPromise) return Promise.resolve(false);
    if (this.recoveryPromise) return this.recoveryPromise;

    const previous = connection ?? activeBleController.getConnection(this.connectionHandleId);
    if (!previous) {
      void this.handleUnexpectedDisconnect(`${reason}_RECOVERY_FAILED`);
      return Promise.resolve(false);
    }

    this.recoveryPromise = (async () => {
      this.currentState = 'RECOVERING';
      flightRecorder.record({
        category: 'SESSION',
        event: 'RECOVERY_STARTED',
        sessionId: this.sessionId,
        details: { reason },
      });
      this.poller?.stop();
      this.bleDisconnectSubscription?.remove();
      this.bleDisconnectSubscription = null;
      this.obdController?.disconnect();
      this.onRecordingError?.(`SESSION_RECOVERING:${reason}`);

      for (let attempt = 0; attempt < RECOVERY_DELAYS_MS.length; attempt++) {
        flightRecorder.record({
          category: 'SESSION',
          event: 'RECOVERY_ATTEMPT',
          sessionId: this.sessionId,
          details: {
            reason,
            attempt: attempt + 1,
            maxAttempts: RECOVERY_DELAYS_MS.length,
          },
        });
        await this.delay(RECOVERY_DELAYS_MS[attempt]);
        if (this.terminalPromise) return false;

        try {
          const recoveredConnection = await this.prepareConnection(previous);
          if (this.terminalPromise) {
            // A native reconnect may finish after Stop was requested.
            // Never hand a newly attached device to Check during that race.
            try { await recoveredConnection.device.cancelConnection(); } catch { /* already disconnected */ }
            return false;
          }

          const vehiclePathAlive = await this.probeVehiclePath(recoveredConnection);
          if (this.terminalPromise) {
            try { await recoveredConnection.device.cancelConnection(); } catch { /* already disconnected */ }
            return false;
          }
          if (!vehiclePathAlive) continue;

          activeBleController.retainConnection(recoveredConnection, 'LIVE');
          this.installTransport(recoveredConnection);
          this.currentState = 'ACTIVE';
          this.recordingStatus = 'RECORDING';
          this.onRecordingError?.('');
          this.poller?.start(250);
          flightRecorder.record({
            category: 'SESSION',
            event: 'RECOVERY_SUCCEEDED',
            sessionId: this.sessionId,
            details: { reason, attempt: attempt + 1 },
          });
          return true;
        } catch (error) {
          console.warn(
            `[RealLiveSessionController] Recovery attempt ${attempt + 1}/${RECOVERY_DELAYS_MS.length} failed`,
            error
          );
        }
      }

      if (!this.terminalPromise) {
        flightRecorder.record({
          category: 'SESSION',
          event: 'RECOVERY_EXHAUSTED',
          sessionId: this.sessionId,
          details: { reason, attempts: RECOVERY_DELAYS_MS.length },
        });
        // Never await terminalization FROM the recovery promise: performStop
        // waits for this same recovery promise to settle before BLE teardown.
        // Awaiting here forms a self-deadlock on exhausted retries.
        void this.handleUnexpectedDisconnect(`${reason}_RECOVERY_FAILED`)
          .catch(error => console.error('[RealLiveSessionController] Recovery terminalization failed', error));
      }
      return false;
    })().finally(() => {
      this.recoveryPromise = null;
    });

    return this.recoveryPromise;
  }

  private handleCommandResult(result: CommandResult, onUiUpdate: (res: CommandResult) => void) {
    if (this.currentState !== 'ACTIVE') return;

    onUiUpdate(result);

    const event = ObdAcquisitionMapper.fromCommandResult(
      result,
      this.sessionId,
      this.nextEventSequence++
    );

    if (this.assembler && this.recordingStatus === 'RECORDING') {
      const blocks = this.assembler.append(event);
      for (const block of blocks) {
        this.enqueueBlock(block);
      }
    }
  }

  private enqueueBlock(unencodedBlock: any) {
    if (!this.commitQueue || this.recordingStatus === 'FAILED' || this.recordingStatus === 'DEGRADED') return;
    const encoded = this.codec.encode(unencodedBlock);
    this.commitQueue.enqueue(encoded);
  }

  private handleCommitEvent(event: CommitQueueEvent, onRecordingError: (err: string) => void) {
    if (event.type === 'FAILED') {
      this.recordingStatus = 'FAILED';
      onRecordingError(event.errorReason);
      void this.handleUnexpectedDisconnect('TELEMETRY_PERSISTENCE_FAILED');
    }
  }

  public stopSession(): Promise<void> {
    if (this.terminalPromise) return this.terminalPromise;
    this.terminalPromise = this.performStop('NORMAL');
    return this.terminalPromise;
  }

  public handleUnexpectedDisconnect(reasonCode: string): Promise<void> {
    if (this.terminalPromise) return this.terminalPromise;
    this.terminalPromise = this.performStop('INTERRUPTED', reasonCode);
    return this.terminalPromise;
  }

  private async performStop(mode: 'NORMAL' | 'INTERRUPTED', reason?: string): Promise<void> {
    const wasRecovering = this.currentState === 'RECOVERING';
    flightRecorder.record({
      category: 'SESSION',
      event: 'TERMINALIZATION_STARTED',
      sessionId: this.sessionId,
      details: {
        mode,
        reason: reason ?? null,
        wasRecovering,
      },
    });
    const wasRunning = this.currentState === 'ACTIVE' || wasRecovering;
    this.currentState = mode === 'NORMAL' ? 'STOPPING' : 'INTERRUPTED';

    this.bleDisconnectSubscription?.remove();
    this.bleDisconnectSubscription = null;

    // A manual stop while recovery is underway must not be reported as a
    // clean completion. The physical BLE handoff is not yet trustworthy.
    let stopFailureReason: string | null =
      wasRecovering && mode === 'NORMAL' ? 'STOP_DURING_RECOVERY' : null;
    if (wasRunning && mode === 'NORMAL') {
      try {
        await this.sessionRepo.requestStop(this.workspaceId, this.sessionId, 'USER_INITIATED');
      } catch (error) {
        // Persistence failures must not keep the BLE poller and native service running.
        console.error('[RealLiveSessionController] Stop request failed:', error);
        stopFailureReason = 'SESSION_STOP_REQUEST_FAILED';
      }
    }

    this.poller?.stop();
    // Do not release the owner lease while an asynchronous native reconnect is
    // still in progress. Recovery checks terminalPromise and exits boundedly.
    if (this.recoveryPromise) {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const settled = await Promise.race([
        this.recoveryPromise.then(() => true, () => false),
        new Promise<boolean>(resolve => {
          timeout = setTimeout(() => resolve(false), RECOVERY_STOP_SETTLEMENT_TIMEOUT_MS);
        }),
      ]);
      if (timeout) clearTimeout(timeout);
      if (!settled) stopFailureReason = stopFailureReason ?? 'RECOVERY_STOP_TIMEOUT';
    }

    const stopTime = Date.now();
    this.recordingStatus = 'FLUSHING';

    await new Promise(r => setTimeout(r, 100));

    if (this.assembler && !this.commitQueue?.getHasFailed()) {
      try {
        const finalBlock = this.assembler.flush(stopTime);
        if (finalBlock) this.enqueueBlock(finalBlock);
      } catch (error) {
        console.error('[RealLiveSessionController] Final telemetry flush failed:', error);
        stopFailureReason = 'TELEMETRY_FINAL_FLUSH_FAILED';
      }
    }

    let drainTimedOut = false;
    if (this.commitQueue) {
      try {
        await this.commitQueue.drain(5000);
      } catch (error) {
        if (error instanceof TelemetryCommitQueueDrainTimeoutError) {
          drainTimedOut = true;
          this.recordingStatus = 'FAILED';
          console.error(
            `[RealLiveSessionController] Telemetry drain timed out with ${error.pendingCount} block(s) pending`,
            error
          );
        } else {
          console.error('[RealLiveSessionController] Telemetry drain failed:', error);
          stopFailureReason = 'TELEMETRY_DRAIN_FAILED';
        }
      }
    }

    this.obdController?.disconnect();
    this.foregroundServiceFailureUnsubscribe?.();
    this.foregroundServiceFailureUnsubscribe = null;
    try {
      await stopLiveForegroundService();
    } catch (error) {
      console.error('[RealLiveSessionController] Foreground stop failed:', error);
      stopFailureReason = stopFailureReason ?? 'FOREGROUND_SERVICE_STOP_FAILED';
    }
    const completedCleanly = mode === 'NORMAL' && !this.commitQueue?.getHasFailed() &&
      !drainTimedOut && stopFailureReason === null;
    if (!completedCleanly) {
      await activeBleController.disconnectAndRelease();
    }
    this.recordingStatus = 'CLOSED';

    if (completedCleanly) {
      try {
        await this.sessionRepo.completeSession(this.workspaceId, this.sessionId);
        // Only now is this connection eligible for handoff to Check. The DB
        // commit may fail or still be in flight while a second screen mounts.
        activeBleController.releaseClaim('LIVE');
        this.currentState = 'COMPLETED';
        flightRecorder.record({
          category: 'SESSION',
          event: 'COMPLETED',
          sessionId: this.sessionId,
        });
        this.onSessionTerminal?.({ state: 'COMPLETED' });
        return;
      } catch (error) {
        console.error('[RealLiveSessionController] Completion persistence failed:', error);
        stopFailureReason = 'SESSION_COMPLETION_FAILED';
        await activeBleController.disconnectAndRelease();
      }
    }
    const failReason = drainTimedOut ? 'TELEMETRY_DRAIN_TIMEOUT' :
      (stopFailureReason || reason || 'TELEMETRY_PERSISTENCE_FAILED');
    try {
      await this.sessionRepo.interruptSession(this.workspaceId, this.sessionId, failReason);
    } catch (err) {
      console.error('Failed to record session interruption', err);
    }
    this.currentState = 'INTERRUPTED';
    flightRecorder.record({
      category: 'SESSION',
      event: 'INTERRUPTED',
      sessionId: this.sessionId,
      details: { reason: failReason },
    });
    this.onSessionTerminal?.({ state: 'INTERRUPTED', reason: failReason });
  }

  public forceCleanup() {
    if (
      this.currentState === 'ACTIVE' ||
      this.currentState === 'RECOVERING' ||
      this.currentState === 'STOPPING'
    ) {
      void this.handleUnexpectedDisconnect('UNEXPECTED_UNMOUNT');
    }
  }
}
