import { CommandRequest, CommandResult } from '../../../infrastructure/ble/real/pipeline/types';

export interface ObdCommandExecutor {
  isConnected: boolean;
  executeCommand(request: CommandRequest): Promise<CommandResult>;
  disconnect(): void;
}

export interface ObdSessionLease {
  executor: ObdCommandExecutor;
  sourceType: 'REAL_BLE' | 'LAPTOP_REPLAY';
  release: () => Promise<void>;
}
