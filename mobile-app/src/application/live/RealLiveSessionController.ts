import { NativeEventSubscription, Platform } from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import { RealTelemetryPoller } from '../../infrastructure/ble/real/RealTelemetryPoller';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import { ITelemetryBlockRepository } from '../../domain/telemetry/repositories/TelemetryBlockRepository';
import { TelemetryCommitQueue, CommitQueueEvent } from './TelemetryCommitQueue';
import { CommandResult } from '../../infrastructure/ble/real/pipeline/types';
import { ObdAcquisitionMapper } from '../../domain/telemetry/factories/ObdAcquisitionMapper';
import { TelemetryBlockAssembler } from '../../domain/telemetry/logic/TelemetryBlockAssembler';
import { BinaryObd2V3BlockMapper } from '../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3BlockMapper';
import { BinaryObd2V3Codec } from '../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';

export type RecordingStatus = 'NOT_STARTED' | 'RECORDING' | 'FLUSHING' | 'DEGRADED' | 'FAILED' | 'CLOSED';

export class RealLiveSessionController {
  private obdController: RealObdController | null = null;
  public poller: RealTelemetryPoller | null = null;

  private currentState: 'CREATED' | 'ACTIVE' | 'STOPPING' | 'COMPLETED' | 'INTERRUPTED' = 'CREATED';
  public recordingStatus: RecordingStatus = 'NOT_STARTED';

  private recordingStartedAt: number | null = null;
  private nextEventSequence = 1;

  private assembler: TelemetryBlockAssembler | null = null;
  private codec = new BinaryObd2V3Codec();
  private commitQueue: TelemetryCommitQueue | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;

  private terminalPromise: Promise<void> | null = null;

  constructor(
    private sessionRepo: LiveSessionRepository,
    private telemetryRepo: ITelemetryBlockRepository,
    private workspaceId: string,
    public sessionId: string,
    private connectionHandleId: string,
    private supportedPids: string[]
  ) {}

  public async start(
    onUiUpdate: (result: CommandResult) => void,
    onRecordingError: (err: string) => void
  ) {
    if (this.currentState !== 'CREATED') return;
    this.currentState = 'ACTIVE';

    const conn = activeBleController.getConnection(this.connectionHandleId);
    if (!conn) {
      this.handleUnexpectedDisconnect('CONNECTION_LOST');
      return;
    }

    this.obdController = new RealObdController(conn);
    this.recordingStartedAt = Date.now();
    this.assembler = new TelemetryBlockAssembler(this.sessionId, this.recordingStartedAt, 5000);

    this.commitQueue = new TelemetryCommitQueue(
      this.workspaceId,
      this.sessionId,
      this.telemetryRepo,
      (event) => this.handleCommitEvent(event, onRecordingError)
    );

    this.poller = new RealTelemetryPoller(this.obdController, this.supportedPids, (result) => {
      this.handleCommandResult(result, onUiUpdate);
    });

    this.recordingStatus = 'RECORDING';

    this.poller.start(250);
  }

  private handleCommandResult(result: CommandResult, onUiUpdate: (res: CommandResult) => void) {
    if (this.currentState !== 'ACTIVE') return;

    // Give UI the update
    onUiUpdate(result);

    // Map to acquisition event
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
      // Initiate safety stop if recording failed
      this.handleUnexpectedDisconnect('TELEMETRY_PERSISTENCE_FAILED');
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
    if (wasActive && mode === 'NORMAL') {
      await this.sessionRepo.requestStop(this.workspaceId, this.sessionId, 'USER_INITIATED');
    }

    if (this.poller) {
      this.poller.stop();
    }

    const stopTime = Date.now();
    this.recordingStatus = 'FLUSHING';

    // In a real app we might await in-flight commands up to 1500ms
    // For MVP, we simulate a bounded grace period
    await new Promise(r => setTimeout(r, 100));

    if (this.assembler && !this.commitQueue?.getHasFailed()) {
      const finalBlock = this.assembler.flush(stopTime);
      if (finalBlock) {
        this.enqueueBlock(finalBlock);
      }
    }

    if (this.commitQueue) {
      await this.commitQueue.drain();
    }

    if (this.obdController) {
      this.obdController.disconnect();
    }

    activeBleController.releaseConnection();
    this.recordingStatus = 'CLOSED';

    if (mode === 'NORMAL' && !this.commitQueue?.getHasFailed()) {
       await this.sessionRepo.completeSession(this.workspaceId, this.sessionId);
       this.currentState = 'COMPLETED';
    } else {
       const failReason = reason || 'TELEMETRY_PERSISTENCE_FAILED';
       try {
         await this.sessionRepo.interruptSession(this.workspaceId, this.sessionId, failReason);
       } catch (err) {
         console.error('Failed to record session interruption', err);
       }
       this.currentState = 'INTERRUPTED';
    }
  }

  public forceCleanup() {
    if (this.currentState === 'ACTIVE' || this.currentState === 'STOPPING') {
       this.handleUnexpectedDisconnect('UNEXPECTED_UNMOUNT');
    }
  }
}
