import { ActiveConnection } from '../ActiveBleConnectionController';
import { Buffer } from 'buffer';
import { ElmAccumulator } from './pipeline/ElmAccumulator';
import { RawElmResponse } from './pipeline/types';
import { BleDebugLogger } from './BleDebugLogger';
import { RawTransport } from '../../../application/live/ports/RawTransport';

export class BleRawTransport implements RawTransport {
  private connection: ActiveConnection;
  private accumulator: ElmAccumulator;
  public isConnected: boolean = true;

  constructor(connection: ActiveConnection) {
    this.connection = connection;
    this.accumulator = new ElmAccumulator(this.connection);
  }

  public async executeRaw(command: string, timeoutMs: number): Promise<RawElmResponse> {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    try {
      console.log(`[BleRawTransport] Executing command: ${command}`);
      BleDebugLogger.log(`TX: ${command}`);
      const base64Command = Buffer.from(command + '\r', 'ascii').toString('base64');

      const awaitPromise = this.accumulator.awaitResponse(timeoutMs);

      const writePromise = this.connection.writeCharacteristic.isWritableWithResponse
        ? this.connection.device.writeCharacteristicWithResponseForService(
            this.connection.writeCharacteristic.serviceUuid,
            this.connection.writeCharacteristic.uuid,
            base64Command
          )
        : this.connection.device.writeCharacteristicWithoutResponseForService(
            this.connection.writeCharacteristic.serviceUuid,
            this.connection.writeCharacteristic.uuid,
            base64Command
          );

      let writeTimeoutHandle: NodeJS.Timeout;
      const writeWithTimeout = Promise.race([
        writePromise,
        new Promise((_, reject) => {
           writeTimeoutHandle = setTimeout(() => reject(new Error('BLE Write Timeout')), Math.min(timeoutMs, 5000));
        })
      ]);

      console.log(`[BleRawTransport] Awaiting write for ${command}...`);
      await writeWithTimeout;
      clearTimeout(writeTimeoutHandle!);
      console.log(`[BleRawTransport] Write successful for ${command}. Awaiting response...`);

      const rawResponse = await awaitPromise;
      console.log(`[BleRawTransport] Response received for ${command}. Reason: ${rawResponse.completionReason}`);
      BleDebugLogger.log(`RX (${rawResponse.completionReason}): ${JSON.stringify(rawResponse.accumulatedText)}`);

      return rawResponse;
    } catch (e: any) {
      console.log(`[BleRawTransport] Error executing ${command}:`, e.message);
      BleDebugLogger.log(`ERR (${command}): ${e.message}`);
      if (e?.errorCode === 201) {
        this.isConnected = false;
        throw new Error('DISCONNECTED');
      } else {
        this.accumulator.reportWriteFailure();
        throw new Error('WRITE_FAILED');
      }
    }
  }

  public disconnect() {
    this.isConnected = false;
    this.accumulator.dispose();
  }
}
