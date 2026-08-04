import { ActiveConnection } from '../../ActiveBleConnectionController';
import { Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { RawElmResponse, BleFragment, AccumulatorCompletionReason } from './types';
import { BleDebugLogger } from '../BleDebugLogger';

export class ElmAccumulator {
  private connection: ActiveConnection;
  private subscription: Subscription | null = null;
  private fragments: BleFragment[] = [];
  private accumulatedText: string = '';
  private startedAt: number = 0;

  private resolvePromise: ((res: RawElmResponse) => void) | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;

  private isListening: boolean = false;
  private maxBytes: number;

  constructor(connection: ActiveConnection, maxBytes: number = 4096) {
    this.connection = connection;
    this.maxBytes = maxBytes;
    this.setupMonitor();
  }

  private setupMonitor() {
    this.subscription = this.connection.device.monitorCharacteristicForService(
      this.connection.receiveCharacteristic.serviceUuid,
      this.connection.receiveCharacteristic.uuid,
      (error, characteristic) => {
        if (error) {
          if (error.errorCode === 201 && this.isListening) {
            this.finish('DISCONNECTED');
          }
          return;
        }

        if (characteristic?.value && this.isListening) {
          const base64 = characteristic.value;
          const decodedText = Buffer.from(base64, 'base64').toString('ascii');

          console.log(`[ELM327 RAW RX] ${JSON.stringify(decodedText)}`);
          BleDebugLogger.log(`RX: ${JSON.stringify(decodedText)}`);

          this.fragments.push({
            receivedAt: Date.now(),
            base64,
            decodedText
          });

          this.accumulatedText += decodedText;

          if (this.accumulatedText.length > this.maxBytes) {
            this.finish('MAX_BYTES_REACHED');
            return;
          }

          if (this.accumulatedText.includes('>')) {
            this.finish('PROMPT_RECEIVED');
          }
        }
      }
    );
  }

  public async awaitResponse(timeoutMs: number): Promise<RawElmResponse> {
    this.fragments = [];
    this.accumulatedText = '';
    this.startedAt = Date.now();
    this.isListening = true;

    return new Promise<RawElmResponse>((resolve) => {
      this.resolvePromise = resolve;

      this.timeoutHandle = setTimeout(() => {
        if (this.isListening) {
          this.finish('TIMEOUT');
        }
      }, timeoutMs);
    });
  }

  public cancel() {
    if (this.isListening) {
      this.finish('CANCELLED');
    }
  }

  public reportWriteFailure() {
    if (this.isListening) {
      this.finish('WRITE_FAILED');
    }
  }

  private finish(reason: AccumulatorCompletionReason) {
    this.isListening = false;

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    if (this.resolvePromise) {
      const finishedAt = Date.now();
      const response: RawElmResponse = {
        fragments: [...this.fragments],
        accumulatedText: this.accumulatedText,
        completionReason: reason,
        startedAt: this.startedAt,
        finishedAt,
        latencyMs: finishedAt - this.startedAt
      };

      this.resolvePromise(response);
      this.resolvePromise = null;
    }
  }

  public dispose() {
    this.cancel();
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }
}
