import type { CommandResult } from './pipeline/types';

export type DiagnosticCommandLogEntry = CommandResult & {
  /** Wall-clock time when AutoPulse classified this command outcome. */
  observedAt: number;
};

class DiagnosticsBufferImpl {
  private buffer: DiagnosticCommandLogEntry[] = [];
  private readonly MAX_SIZE = 100;

  public push(result: CommandResult, observedAt: number = Date.now()) {
    this.buffer.push({ ...result, observedAt });
    if (this.buffer.length > this.MAX_SIZE) {
      this.buffer.shift();
    }
  }

  public getHistory(): DiagnosticCommandLogEntry[] {
    return [...this.buffer];
  }

  public clear() {
    this.buffer = [];
  }
}

export const DiagnosticsBuffer = new DiagnosticsBufferImpl();
