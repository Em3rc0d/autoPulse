import { CommandRequest, CommandResult } from './pipeline/types';
import { STANDARD_OBD_TIER_1 } from '../../../domain/obd/StandardObdCatalogV1';

type ObdCommandExecutor = {
  isConnected: boolean;
  executeCommand(request: CommandRequest): Promise<CommandResult>;
};

export type PollerDiagnosticEvent =
  | {
      type: 'PID_RETIRED_NO_DATA';
      pid: string;
    }
  | {
      type: 'TRANSPORT_STALLED';
      pid: string;
      reason: 'TIMEOUT' | 'WRITE_FAILED' | 'DISCONNECTED';
      consecutiveFailures: number;
    };

const TRANSPORT_FAILURE_THRESHOLD = 3;

export class RealTelemetryPoller {
  private controller: ObdCommandExecutor;
  private supportedPids: string[];
  private isPolling: boolean = false;
  private onData: (data: CommandResult) => void;
  private onDiagnostic?: (event: PollerDiagnosticEvent) => void;
  private intervalHandle: NodeJS.Timeout | null = null;
  private currentPidIndex: number = 0;

  private consecutiveFailures: Record<string, number> = {};
  private consecutiveTransportFailures = 0;
  private transportStallEmitted = false;

  constructor(
    controller: ObdCommandExecutor,
    supportedPids: string[],
    onData: (data: CommandResult) => void,
    onDiagnostic?: (event: PollerDiagnosticEvent) => void
  ) {
    this.controller = controller;
    const decodableRequests = new Set([
      ...STANDARD_OBD_TIER_1.map(definition => definition.requestId),
      'ATRV'
    ]);
    this.supportedPids = Array.from(new Set(supportedPids))
      .filter(pid => decodableRequests.has(pid));

    if (this.supportedPids.length === 0) {
      this.supportedPids = ['010C', '010D', '0105', '0104', '010B'];
    }

    this.onData = onData;
    this.onDiagnostic = onDiagnostic;
  }

  public start(intervalMs: number = 250) {
    if (this.isPolling) return;
    this.isPolling = true;

    const pollLoop = async () => {
      if (!this.isPolling || !this.controller.isConnected || this.supportedPids.length === 0) {
        this.stop();
        return;
      }

      const pid = this.supportedPids[this.currentPidIndex];
      this.currentPidIndex = (this.currentPidIndex + 1) % this.supportedPids.length;

      const isAT = pid.toUpperCase().startsWith('AT');
      const request: CommandRequest = {
        id: Math.random().toString(36).substring(7),
        command: pid,
        family: isAT ? 'ELM_AT' : 'OBD_MODE_01',
        expectedService: isAT ? undefined : '41',
        expectedPid: isAT ? undefined : pid.slice(2),
        timeoutMs: 1500
      };

      const result = await this.controller.executeCommand(request);
      this.handleResult(pid, result);

      if (this.isPolling) {
        this.intervalHandle = setTimeout(pollLoop, intervalMs);
      }
    };

    void pollLoop();
  }

  public stop() {
    this.isPolling = false;
    if (this.intervalHandle) {
      clearTimeout(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private resetTransportHealth() {
    this.consecutiveTransportFailures = 0;
    this.transportStallEmitted = false;
  }

  private observeTransportHealth(pid: string, result: CommandResult) {
    // NO_DATA and ELM_ERROR prove that the adapter answered. They are not a
    // transport disconnect and must never trigger connection recovery.
    if (
      result.status === 'SUCCESS_DECODED' ||
      result.status === 'SUCCESS_RAW' ||
      result.status === 'NO_DATA' ||
      result.status === 'ELM_ERROR'
    ) {
      this.resetTransportHealth();
      return;
    }

    if (
      result.status !== 'TIMEOUT' &&
      result.status !== 'WRITE_FAILED' &&
      result.status !== 'DISCONNECTED'
    ) {
      return;
    }

    this.consecutiveTransportFailures += 1;
    if (
      this.consecutiveTransportFailures >= TRANSPORT_FAILURE_THRESHOLD &&
      !this.transportStallEmitted
    ) {
      this.transportStallEmitted = true;
      this.onDiagnostic?.({
        type: 'TRANSPORT_STALLED',
        pid,
        reason: result.status,
        consecutiveFailures: this.consecutiveTransportFailures
      });
    }
  }

  private handleResult(pid: string, result: CommandResult) {
    this.observeTransportHealth(pid, result);

    if (result.status === 'SUCCESS_DECODED' || result.status === 'SUCCESS_RAW') {
      this.consecutiveFailures[pid] = 0;
    } else if (result.status === 'NO_DATA') {
      this.consecutiveFailures[pid] = (this.consecutiveFailures[pid] || 0) + 1;

      if (this.consecutiveFailures[pid] >= 3) {
        console.log(`[RealTelemetryPoller] Retiring PID ${pid} after 3 consecutive NO_DATA`);
        const indexToRemove = this.supportedPids.indexOf(pid);
        if (indexToRemove !== -1) {
          this.supportedPids.splice(indexToRemove, 1);
          if (this.currentPidIndex >= indexToRemove && this.currentPidIndex > 0) {
            this.currentPidIndex--;
          }
        }

        this.onDiagnostic?.({ type: 'PID_RETIRED_NO_DATA', pid });
        this.onData(result);

        if (this.supportedPids.length === 0) {
          this.stop();
        }
        return;
      }
    }

    this.onData(result);
  }
}
