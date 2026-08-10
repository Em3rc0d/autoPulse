import { RealObdController } from './RealObdController';
import { CommandRequest, CommandResult } from './pipeline/types';
import { OBD_SIGNAL_REGISTRY } from '../../../domain/telemetry/ObdSignalRegistry';

type ObdCommandExecutor = {
  isConnected: boolean;
  executeCommand(request: CommandRequest): Promise<CommandResult>;
};

// We use CommandResult directly for 05E

export interface PollerDiagnosticEvent {
  type: 'PID_RETIRED_NO_DATA';
  pid: string;
}

export class RealTelemetryPoller {
  private controller: ObdCommandExecutor;
  private resolvedPollingSet: string[];
  private isPolling: boolean = false;
  private onData: (data: CommandResult) => void;
  private onDiagnostic?: (event: PollerDiagnosticEvent) => void;
  private intervalHandle: NodeJS.Timeout | null = null;
  private currentPidIndex: number = 0;

  // Track consecutive failures per PID
  private consecutiveFailures: Record<string, number> = {};

  constructor(
    controller: ObdCommandExecutor, 
    resolvedPollingSet: string[], 
    onData: (data: CommandResult) => void,
    onDiagnostic?: (event: PollerDiagnosticEvent) => void
  ) {
    this.controller = controller;
    
    // The resolvedPollingSet already contains the dynamically resolved commands (e.g. 010C, ATRV)
    // as determined by the active monitoring profile and capability snapshot.
    this.resolvedPollingSet = [...resolvedPollingSet];

    this.onData = onData;
    this.onDiagnostic = onDiagnostic;
  }

  public start(intervalMs: number = 250) {
    if (this.isPolling) return;
    this.isPolling = true;

    // Use an asynchronous loop to prevent flooding the ELM327.
    // We must wait for the PREVIOUS command to finish before waiting for the interval.
    const pollLoop = async () => {
      if (!this.isPolling || !this.controller.isConnected || this.resolvedPollingSet.length === 0) {
        this.stop();
        return;
      }

      // Ensure we don't divide by zero if supportedPids was reduced to 0
      if (this.resolvedPollingSet.length === 0) {
        this.stop();
        return;
      }

      const pid = this.resolvedPollingSet[this.currentPidIndex];
      // Increment index for next time, safely wrapping
      this.currentPidIndex = (this.currentPidIndex + 1) % this.resolvedPollingSet.length;

      const isAT = pid.toUpperCase().startsWith('AT');
      const request: CommandRequest = {
        id: Math.random().toString(36).substring(7),
        command: pid,
        family: isAT ? 'ELM_AT' : 'OBD_MODE_01',
        expectedService: isAT ? undefined : '41',
        timeoutMs: 1500
      };

      const result = await this.controller.executeCommand(request);
      this.handleResult(pid, result);

      if (this.isPolling) {
        this.intervalHandle = setTimeout(pollLoop, intervalMs);
      }
    };

    // Kick off the loop
    pollLoop();
  }

  public stop() {
    this.isPolling = false;
    if (this.intervalHandle) {
      clearTimeout(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private handleResult(pid: string, result: CommandResult) {
    if (result.status === 'SUCCESS_DECODED' || result.status === 'SUCCESS_RAW') {
      this.consecutiveFailures[pid] = 0;
    } else if (result.status === 'NO_DATA') {
      this.consecutiveFailures[pid] = (this.consecutiveFailures[pid] || 0) + 1;
      
      if (this.consecutiveFailures[pid] >= 3) {
        console.log(`[RealTelemetryPoller] Retiring PID ${pid} after 3 consecutive NO_DATA`);
        const indexToRemove = this.resolvedPollingSet.indexOf(pid);
        if (indexToRemove !== -1) {
          this.resolvedPollingSet.splice(indexToRemove, 1);
          if (this.currentPidIndex >= indexToRemove && this.currentPidIndex > 0) {
            this.currentPidIndex--;
          }
        }
        
        if (this.onDiagnostic) {
          this.onDiagnostic({ type: 'PID_RETIRED_NO_DATA', pid });
        }
        
        this.onData(result);
        
        if (this.resolvedPollingSet.length === 0) {
          this.stop();
        }
        return;
      }
    }
    
    // Do not retire on TIMEOUT, ELM_ERROR, or DISCONNECTED
    this.onData(result);
  }

  private getTypeForPid(pid: string): string {
    const entry = Object.values(OBD_SIGNAL_REGISTRY).find(s => s.command === pid || (pid.startsWith('01') && s.command === pid.substring(2)));
    return entry ? entry.canonicalId : 'UNKNOWN';
  }

  private getUnit(pid: string): string {
    const entry = Object.values(OBD_SIGNAL_REGISTRY).find(s => s.command === pid || (pid.startsWith('01') && s.command === pid.substring(2)));
    return entry ? entry.unit : '';
  }
}
