import { RawElmResponse } from '../../../infrastructure/ble/real/pipeline/types';

export interface RawTransport {
  isConnected: boolean;
  executeRaw(command: string, timeoutMs: number): Promise<RawElmResponse>;
  disconnect(): void;
}
