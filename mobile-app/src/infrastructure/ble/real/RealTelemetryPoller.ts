import { RealObdController } from './RealObdController';
import { CommandRequest, CommandResult } from './pipeline/types';

type ObdCommandExecutor = {
  isConnected: boolean;
  executeCommand(request: CommandRequest): Promise<CommandResult>;
};

// We use CommandResult directly for 05E

export class RealTelemetryPoller {
  private controller: ObdCommandExecutor;
  private supportedPids: string[];
  private isPolling: boolean = false;
  private onData: (data: CommandResult) => void;
  private intervalHandle: NodeJS.Timeout | null = null;
  private currentPidIndex: number = 0;

  // Track consecutive failures per PID
  private consecutiveFailures: Record<string, number> = {};

  constructor(controller: ObdCommandExecutor, supportedPids: string[], onData: (data: CommandResult) => void) {
    this.controller = controller;
    // We only poll PIDs we know how to decode (and that are supported)
    this.supportedPids = supportedPids.filter(pid =>
      ['010C', '010D', '0105', '0142', 'ATRV'].includes(pid)
    );

    // Diagnostic Fallback: if no valid PIDs were detected by initialization, try directly polling RPM, Speed, Coolant, Voltage as a probe.
    if (this.supportedPids.length === 0) {
      this.supportedPids = ['010C', '010D', '0105', 'ATRV'];
    }

    this.onData = onData;
  }

  public start(intervalMs: number = 250) {
    if (this.isPolling) return;
    this.isPolling = true;

    // Use an asynchronous loop to prevent flooding the ELM327.
    // We must wait for the PREVIOUS command to finish before waiting for the interval.
    const pollLoop = async () => {
      if (!this.isPolling || !this.controller.isConnected || this.supportedPids.length === 0) {
        this.stop();
        return;
      }

      // Ensure we don't divide by zero if supportedPids was reduced to 0
      if (this.supportedPids.length === 0) {
        this.stop();
        return;
      }

      const pid = this.supportedPids[this.currentPidIndex];
      // Increment index for next time, safely wrapping
      this.currentPidIndex = (this.currentPidIndex + 1) % this.supportedPids.length;

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
    this.onData(result);
  }

  private getTypeForPid(pid: string): string {
    switch(pid) {
      case '010C': return 'RPM';
      case '010D': return 'SPEED';
      case '0105': return 'COOLANT';
      case '0142':
      case 'ATRV': return 'VOLTAGE';
      default: return 'UNKNOWN';
    }
  }

  private getUnit(pid: string): string {
    switch (pid) {
      case '010C': return 'RPM';
      case '010D': return 'km/h';
      case '0105': return '°C';
      case '0142':
      case 'ATRV': return 'V';
      default: return '';
    }
  }
}
