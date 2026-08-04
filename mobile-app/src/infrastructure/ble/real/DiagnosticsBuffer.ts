import { CommandResult } from './pipeline/types';

class DiagnosticsBufferImpl {
  private buffer: CommandResult[] = [];
  private readonly MAX_SIZE = 100;

  public push(result: CommandResult) {
    this.buffer.push(result);
    if (this.buffer.length > this.MAX_SIZE) {
      this.buffer.shift(); // Remove oldest
    }
  }

  public getHistory(): CommandResult[] {
    return [...this.buffer];
  }

  public clear() {
    this.buffer = [];
  }
}

export const DiagnosticsBuffer = new DiagnosticsBufferImpl();
