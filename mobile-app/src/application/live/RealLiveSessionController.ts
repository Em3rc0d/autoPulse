import { AppState, NativeEventSubscription } from 'react-native';
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
  TelemetryCommitQueue,
  CommitQueueEvent,
  TelemetryCommitQueueDrainTimeoutError
} from './TelemetryCommitQueue';
import { CommandResult, CommandRequest } from '../../infrastructure/ble/real/pipeline/types';
import { ObdAcquisitionMapper } from '../../domain/telemetry/factories/ObdAcquisitionMapper';
import { TelemetryBlockAssembler } from '../../domain/telemetry/logic/TelemetryBlockAssembler';
import { BinaryObd2V3Codec } from '../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';

export type RecordingStatus = 'NOT_STARTED' | 'RECORDING' | 'FLUSHING' | 'DEGRADED' | 'FAILED' | 'CLOSED';

type LiveControllerState = 'CREATED' | 'ACTIVE' | 'RECOVERING' | 'STOPPING' | 'COMPLETED' | 'INTERRUPTED';

export interface LiveSessionTerminalOutcome {
  state: 'COMPLETED' | 'INTERRUPTED';
  reason?: string;
}

const RECOVERY_DELAYS_MS = [0, 1500, 3500] as const;
const RECOVERY_CONNECT_TIMEOUT_MS = 3500;

/**
 * Release-1 lifecycle policy:
 * - Live acquisition is foreground-only.
 * - Temporary adapter/ECU transport failures receive a bounded recovery window.
 * - Recovery never fabricates telemetry; any missing interval remains missing evidence.
 * - Leaving the app while ACTIVE/RECOVERING still produces explicit interruption.
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
  private appStateSubscription: NativeEventSubscription | null = null;
  private bleDisconnectSubscription: Subscription | null = null;

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
    this.currentState = 'ACTIVE';
    this.onUiUpdate = onUiUpdate;
    this.onRecordingError = onRecordingError;
    this.onSessionTerminal = onSessionTerminal ?? (outcome => {
      if (outcome.state === 'INTERRUPTED') {
        onRecordingError(`SESSION_INTERRUPTED:${outcome.reason ?? 'UNKNOWN'}`);
      }
    });

    const conn = activeBleController.getConnection(this.connectionHandleId);
    if (!conn) {
      await this.handleUnexpectedDisconnect('CONNECTION_LOST');
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

    this.appStateSubscription = AppState.addEventListener('change', nextState => {
      this.handleAppStateChange(nextState);
    });

    this.recordingStatus = 'RECORDING';
    this.poller?.start(250);
  }

  private livePollRequests(): string[] {
    const normalized = this.supportedPids.map(pid => String(pid).trim().toUpperCase()).filter(Boolean);
    if (this.pollAdapterVoltage && !normalized.includes('ATRV')) normalized.push('ATRV');
    return normalized;
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

  private handleAppStateChange(nextState: string) {
    if (
      nextState !== 'active' &&
      (this.currentState === 'ACTIVE' || this.currentState === 'RECOVERING')
    ) {
      void this.handleUnexpectedDisconnect('APP_BACKGROUND');
    }
  }

  private observePhysicalDisconnect(conn: ActiveConnection) {
    this.bleDisconnectSubscription?.remove();
    this.bleDisconnectSubscription = conn.device.onDisconnected(() => {
      if (this.currentState === 'ACTIVE') {
        void this.attemptConnectionRecovery('DEVICE_DISCONNECTED', conn);
      }
    });
  }

  private handlePollerDiagnostic(event: PollerDiagnosticEvent, conn: ActiveConnection) {
    if (event.type !== 'TRANSPORT_STALLED' || this.currentState !== 'ACTIVE') return;
    const recoveryReason = event.reason === 'DISCONNECTED' ? 'DEVICE_DISCONNECTED' : 'ECU_RESPONSE_LOST';
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
      if (firstProbe.status === 'SUCCESS_DECODED' || firstProbe.status === 'SUCCESS_RAW') {
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
      return secondProbe.status === 'SUCCESS_DECODED' || secondProbe.status === 'SUCCESS_RAW';
    } catch (error) {
      console.warn('[RealLiveSessionController] Recovery probe failed', error);
      return false;
    } finally {
      probeController.disconnect();
    }
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
      this.poller?.stop();
      this.bleDisconnectSubscription?.remove();
      this.bleDisconnectSubscription = null;
      this.obdController?.disconnect();
      this.onRecordingError?.(`SESSION_RECOVERING:${reason}`);

      for (let attempt = 0; attempt < RECOVERY_DELAYS_MS.length; attempt++) {
        await this.delay(RECOVERY_DELAYS_MS[attempt]);
        if (this.terminalPromise) return false;

        try {
          const recoveredConnection = await this.prepareConnection(previous);
          if (this.terminalPromise) return false;

          const vehiclePathAlive = await this.probeVehiclePath(recoveredConnection);
          if (!vehiclePathAlive || this.terminalPromise) continue;

          activeBleController.retainConnection(recoveredConnection);
          this.installTransport(recoveredConnection);
          this.currentState = 'ACTIVE';
          this.recordingStatus = 'RECORDING';
          this.onRecordingError?.('');
          this.poller?.start(250);
          return true;
        } catch (error) {
          console.warn(
            `[RealLiveSessionController] Recovery attempt ${attempt + 1}/${RECOVERY_DELAYS_MS.length} failed`,
            error
          );
        }
      }

      if (!this.terminalPromise) {
        await this.handleUnexpectedDisconnect(`${reason}_RECOVERY_FAILED`);
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
    const wasActive = this.currentState === 'ACTIVE';
    this.currentState = mode === 'NORMAL' ? 'STOPPING' : 'INTERRUPTED';

    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.bleDisconnectSubscription?.remove();
    this.bleDisconnectSubscription = null;

    if (wasActive && mode === 'NORMAL') {
      await this.sessionRepo.requestStop(this.workspaceId, this.sessionId, 'USER_INITIATED');
    }

    this.poller?.stop();

    const stopTime = Date.now();
    this.recordingStatus = 'FLUSHING';

    await new Promise(r => setTimeout(r, 100));

    if (this.assembler && !this.commitQueue?.getHasFailed()) {
      const finalBlock = this.assembler.flush(stopTime);
      if (finalBlock) {
        this.enqueueBlock(finalBlock);
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
          throw error;
        }
      }
    }

    this.obdController?.disconnect();
    activeBleController.releaseConnection();
    this.recordingStatus = 'CLOSED';

    if (mode === 'NORMAL' && !this.commitQueue?.getHasFailed() && !drainTimedOut) {
      await this.sessionRepo.completeSession(this.workspaceId, this.sessionId);
      this.currentState = 'COMPLETED';
      this.onSessionTerminal?.({ state: 'COMPLETED' });
    } else {
      const failReason = drainTimedOut ? 'TELEMETRY_DRAIN_TIMEOUT' : (reason || 'TELEMETRY_PERSISTENCE_FAILED');
      try {
        await this.sessionRepo.interruptSession(this.workspaceId, this.sessionId, failReason);
      } catch (err) {
        console.error('Failed to record session interruption', err);
      }
      this.currentState = 'INTERRUPTED';
      this.onSessionTerminal?.({ state: 'INTERRUPTED', reason: failReason });
    }
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
