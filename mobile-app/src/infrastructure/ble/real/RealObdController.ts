import { ActiveConnection } from '../ActiveBleConnectionController';
import { Buffer } from 'buffer';
import { ElmAccumulator } from './pipeline/ElmAccumulator';
import { ElmNormalizer } from './pipeline/ElmNormalizer';
import { ElmClassifier } from './pipeline/ElmClassifier';
import { ObdFrameParser } from './pipeline/ObdFrameParser';
import { ObdDecoder } from './pipeline/ObdDecoder';
import { CommandRequest, CommandResult, CommandResultStatus, RawElmResponse } from './pipeline/types';
import { DiagnosticsBuffer } from './DiagnosticsBuffer';
import { BleDebugLogger } from './BleDebugLogger';

export class RealObdController {
  private connection: ActiveConnection;
  private isProcessing: boolean = false;
  private queue: Array<() => Promise<void>> = [];
  private accumulator: ElmAccumulator;
  public isConnected: boolean = true;

  constructor(connection: ActiveConnection) {
    this.connection = connection;
    this.accumulator = new ElmAccumulator(this.connection);
  }

  public async executeCommand(request: CommandRequest): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve) => {
      const task = async () => {
        if (!this.isConnected) {
          resolve(this.buildErrorResult(request, 'DISCONNECTED', 'Not connected'));
          return;
        }

        try {
          console.log(`[RealObdController] Executing command: ${request.command}`);
          BleDebugLogger.log(`TX: ${request.command}`);
          const base64Command = Buffer.from(request.command + '\r', 'ascii').toString('base64');

          // Start accumulator listening
          const awaitPromise = this.accumulator.awaitResponse(request.timeoutMs);

          // Prepare write promise
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

          // Execute write with a timeout
          let writeTimeoutHandle: NodeJS.Timeout;
          const writeWithTimeout = Promise.race([
            writePromise,
            new Promise((_, reject) => {
               writeTimeoutHandle = setTimeout(() => reject(new Error('BLE Write Timeout')), Math.min(request.timeoutMs, 5000));
            })
          ]);

          console.log(`[RealObdController] Awaiting write for ${request.command}...`);
          await writeWithTimeout;
          clearTimeout(writeTimeoutHandle!);
          console.log(`[RealObdController] Write successful for ${request.command}. Awaiting response...`);

          // Wait for accumulator to finish (either by PROMPT, TIMEOUT, etc.)
          const rawResponse = await awaitPromise;
          console.log(`[RealObdController] Response received for ${request.command}. Reason: ${rawResponse.completionReason}`);
          BleDebugLogger.log(`RX (${rawResponse.completionReason}): ${JSON.stringify(rawResponse.accumulatedText)}`);

          // Run Pipeline
          const result = this.runPipeline(request, rawResponse);
          DiagnosticsBuffer.push(result);
          resolve(result);

        } catch (e: any) {
          console.log(`[RealObdController] Error executing ${request.command}:`, e.message);
          BleDebugLogger.log(`ERR (${request.command}): ${e.message}`);
          if (e?.errorCode === 201) {
            this.isConnected = false;
            resolve(this.buildErrorResult(request, 'DISCONNECTED', e.message));
          } else {
            this.accumulator.reportWriteFailure();
            resolve(this.buildErrorResult(request, 'WRITE_FAILED', e.message));
          }
        }
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  private runPipeline(request: CommandRequest, rawResponse: RawElmResponse): CommandResult {
    const normalized = ElmNormalizer.normalize(rawResponse, request.command);
    const classified = ElmClassifier.classify(normalized, request);

    const { frames, negatives } = ObdFrameParser.parse(classified, request);
    const decoded = ObdDecoder.decode(frames);

    let status: CommandResultStatus = 'SUCCESS_RAW';
    const errors: string[] = [];

    if (rawResponse.completionReason === 'TIMEOUT') {
       status = 'TIMEOUT';
    } else if (rawResponse.completionReason === 'DISCONNECTED') {
       status = 'DISCONNECTED';
    } else if (rawResponse.completionReason === 'CANCELLED') {
       status = 'CANCELLED';
    } else {
       const errorLines = classified.filter(c => c.classification === 'ELM_ERROR');
       if (errorLines.length > 0) {
         status = 'ELM_ERROR';
         errors.push(...errorLines.map(e => e.originalText));
       } else if (normalized.statusLines.some(s => s.toUpperCase().includes('NO DATA'))) {
         status = 'NO_DATA';
       } else if (request.family !== 'ELM_AT' && frames.length === 0 && negatives.length === 0) {
         status = 'INVALID_RESPONSE';
       } else if (decoded.length > 0) {
         status = 'SUCCESS_DECODED';
       } else if (request.command.toUpperCase() === 'ATRV' && rawResponse.accumulatedText) {
         // Decode ATRV (e.g. 13.8V)
         const match = rawResponse.accumulatedText.match(/([\d\.]+)\s*V/i);
         if (match) {
           decoded.push({ type: 'VOLTAGE', value: parseFloat(match[1]), unit: 'V' });
           status = 'SUCCESS_DECODED';
         } else {
           status = 'SUCCESS_RAW';
         }
       }
    }

    return {
      request,
      rawResponse,
      normalizedResponse: normalized,
      classifiedLines: classified,
      obdFrames: frames,
      negativeResponses: negatives,
      decodedValues: decoded,
      status,
      errors,
      latencyMs: rawResponse.latencyMs
    };
  }

  private buildErrorResult(request: CommandRequest, status: CommandResultStatus, error: string): CommandResult {
    const result: CommandResult = {
      request,
      rawResponse: null,
      normalizedResponse: null,
      classifiedLines: [],
      obdFrames: [],
      negativeResponses: [],
      decodedValues: [],
      status,
      errors: [error],
      latencyMs: 0
    };
    DiagnosticsBuffer.push(result);
    return result;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const task = this.queue.shift();
    if (task) {
      await task();
    }
    this.isProcessing = false;
    this.processQueue(); // Process next
  }

  public disconnect() {
    this.isConnected = false;
    this.accumulator.dispose();
  }
}
