import { CommandRequest, CommandResult } from './pipeline/types';
import { STANDARD_OBD_TIER_1 } from '../../../domain/obd/StandardObdCatalogV1';
import { LIVE_OBD_REQUEST_ORDER } from '../../../domain/obd/LiveObdPollingPolicy';

type ObdCommandExecutor = {
  isConnected: boolean;
  executeCommand(request: CommandRequest): Promise<CommandResult>;
};

type StallReason = 'TIMEOUT' | 'WRITE_FAILED' | 'DISCONNECTED' | 'UNUSABLE_RESPONSE';

export type PollerDiagnosticEvent =
  | {
      type: 'PID_RETIRED_NO_DATA';
      pid: string;
    }
  | {
      type: 'TRANSPORT_STALLED';
      pid: string;
      reason: StallReason;
      consecutiveFailures: number;
    };

const TRANSPORT_FAILURE_THRESHOLD = 3;
const UNUSABLE_RESPONSE_THRESHOLD = 6;
const NO_DATA_RETIRE_THRESHOLD = 3;

const isTransportFailure = (result: CommandResult) =>
  result.status === 'TIMEOUT' ||
  result.status === 'WRITE_FAILED' ||
  result.status === 'DISCONNECTED';

const provesVehiclePathProgress = (result: CommandResult) =>
  result.status === 'SUCCESS_DECODED' ||
  result.status === 'SUCCESS_RAW' ||
  result.status === 'NO_DATA';

const isUnusableResponse = (result: CommandResult) =>
  result.status === 'ELM_ERROR' ||
  result.status === 'INVALID_RESPONSE' ||
  result.status === 'PARTIAL' ||
  result.status === 'CANCELLED';

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
  private consecutiveUnusableResponses = 0;
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

    this.supportedPids = Array.from(new Set(
      supportedPids
        .map(pid => String(pid).trim().toUpperCase())
        .filter(Boolean)
    )).filter(pid => decodableRequests.has(pid));

    if (this.supportedPids.length === 0) {
      // Capability discovery can fail even while the vehicle path is usable.
      // Probe only the bounded Driving View v2 set; unsupported commands self-retire.
      this.supportedPids = [...LIVE_OBD_REQUEST_ORDER];
    }

    this.onData = onData;
    this.onDiagnostic = onDiagnostic;
  }

  public start(intervalMs: number = 250) {
    if (this.isPolling) return;
    this.isPolling = true;

    const scheduleNext = () => {
      if (!this.isPolling) return;
      this.intervalHandle = setTimeout(pollLoop, Math.max(0, intervalMs));
    };

    const pollLoop = async () => {
      if (!this.isPolling) return;
      if (this.supportedPids.length === 0) {
        this.stop();
        return;
      }

      const pid = this.supportedPids[this.currentPidIndex] ?? this.supportedPids[0];

      // A controller that already reports disconnected must not silently stop.
      // Surface one explicit stall so the session controller can enter bounded recovery.
      if (!this.controller.isConnected) {
        this.emitTransportStall(pid, 'DISCONNECTED', TRANSPORT_FAILURE_THRESHOLD);
        this.stop();
        return;
      }

      this.currentPidIndex = (this.currentPidIndex + 1) % this.supportedPids.length;

      const isAT = pid.startsWith('AT');
      const request: CommandRequest = {
        id: Math.random().toString(36).substring(7),
        command: pid,
        family: isAT ? 'ELM_AT' : 'OBD_MODE_01',
        expectedService: isAT ? undefined : '41',
        expectedPid: isAT ? undefined : pid.slice(2),
        timeoutMs: isAT ? 1200 : 1500
      };

      try {
        const result = await this.controller.executeCommand(request);
        this.handleResult(pid, result);
      } catch (error) {
        // executeCommand is expected to return a typed failure, but the poller is the
        // last containment boundary. A thrown transport/pipeline error must not kill
        // the loop as an unhandled rejection.
        console.warn(`[RealTelemetryPoller] executeCommand threw for ${pid}`, error);
        const reason = this.controller.isConnected ? 'WRITE_FAILED' : 'DISCONNECTED';
        this.recordTransportFailure(pid, reason);
      } finally {
        scheduleNext();
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

  private resetLinkHealth() {
    this.consecutiveTransportFailures = 0;
    this.consecutiveUnusableResponses = 0;
    this.transportStallEmitted = false;
  }

  private emitTransportStall(
    pid: string,
    reason: StallReason,
    consecutiveFailures: number,
  ) {
    if (this.transportStallEmitted) return;
    this.transportStallEmitted = true;
    this.onDiagnostic?.({
      type: 'TRANSPORT_STALLED',
      pid,
      reason,
      consecutiveFailures,
    });
  }

  private recordTransportFailure(
    pid: string,
    reason: 'TIMEOUT' | 'WRITE_FAILED' | 'DISCONNECTED',
  ) {
    this.consecutiveTransportFailures += 1;
    if (this.consecutiveTransportFailures >= TRANSPORT_FAILURE_THRESHOLD) {
      this.emitTransportStall(pid, reason, this.consecutiveTransportFailures);
    }
  }

  private observeLinkHealth(pid: string, result: CommandResult) {
    if (isTransportFailure(result)) {
      this.consecutiveUnusableResponses = 0;
      this.recordTransportFailure(pid, result.status as 'TIMEOUT' | 'WRITE_FAILED' | 'DISCONNECTED');
      return;
    }

    if (provesVehiclePathProgress(result)) {
      // A decoded/raw vehicle response or an explicit NO_DATA proves the request
      // round-trip is alive. Only this class of response fully resets link health.
      this.resetLinkHealth();
      return;
    }

    // Typed malformed/partial/adapter-error responses prove the JS pipeline returned,
    // but they do NOT prove that the ECU path is healthy. A sufficiently long run of
    // unusable replies is treated as a degraded vehicle path and enters the exact same
    // bounded recovery used for timeouts. This is intentionally global across PIDs: an
    // intermittent unsupported optional PID cannot trigger recovery when other signals
    // are still returning usable vehicle-path evidence.
    this.consecutiveTransportFailures = 0;
    if (isUnusableResponse(result)) {
      this.consecutiveUnusableResponses += 1;
      if (this.consecutiveUnusableResponses >= UNUSABLE_RESPONSE_THRESHOLD) {
        this.emitTransportStall(pid, 'UNUSABLE_RESPONSE', this.consecutiveUnusableResponses);
      }
    }
  }

  private retirePid(pid: string) {
    const indexToRemove = this.supportedPids.indexOf(pid);
    if (indexToRemove === -1) return;

    this.supportedPids.splice(indexToRemove, 1);
    this.currentPidIndex = this.supportedPids.length === 0
      ? 0
      : this.currentPidIndex % this.supportedPids.length;
  }

  private handleResult(pid: string, result: CommandResult) {
    this.observeLinkHealth(pid, result);

    if (result.status === 'NO_DATA') {
      this.consecutiveFailures[pid] = (this.consecutiveFailures[pid] || 0) + 1;

      if (this.consecutiveFailures[pid] >= NO_DATA_RETIRE_THRESHOLD) {
        console.log(`[RealTelemetryPoller] Retiring PID ${pid} after ${NO_DATA_RETIRE_THRESHOLD} consecutive NO_DATA`);
        this.retirePid(pid);
        this.onDiagnostic?.({ type: 'PID_RETIRED_NO_DATA', pid });
        this.onData(result);

        if (this.supportedPids.length === 0) this.stop();
        return;
      }
    } else {
      // "Consecutive NO_DATA" must be literal. Any other result breaks the streak.
      this.consecutiveFailures[pid] = 0;
    }

    this.onData(result);
  }
}
