import { RawElmResponse, CommandRequest, CommandResult, CommandResultStatus } from './pipeline/types';
import { ElmNormalizer } from './pipeline/ElmNormalizer';
import { ElmClassifier } from './pipeline/ElmClassifier';
import { ObdFrameParser } from './pipeline/ObdFrameParser';
import { ObdDecoder } from './pipeline/ObdDecoder';
import { DiagnosticsBuffer } from './DiagnosticsBuffer';
import { RawTransport } from '../../../application/live/ports/RawTransport';
import { ObdCommandExecutor } from '../../../application/live/ports/ObdCommandExecutor';

export class ObdCommandProcessor implements ObdCommandExecutor {
  private isProcessing: boolean = false;
  private queue: Array<() => Promise<void>> = [];
  
  constructor(private transport: RawTransport) {}

  get isConnected() {
    return this.transport.isConnected;
  }

  public async executeCommand(request: CommandRequest): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve) => {
      const task = async () => {
        if (!this.isConnected) {
          resolve(this.buildErrorResult(request, 'DISCONNECTED', 'Not connected'));
          return;
        }

        try {
          const rawResponse = await this.transport.executeRaw(request.command, request.timeoutMs);
          
          if (rawResponse.completionReason === 'TIMEOUT') {
             resolve(this.buildResultFromRaw(request, rawResponse, 'TIMEOUT'));
             return;
          }
          if (rawResponse.completionReason === 'CANCELLED') {
             resolve(this.buildResultFromRaw(request, rawResponse, 'CANCELLED'));
             return;
          }

          const result = this.runPipeline(request, rawResponse);
          DiagnosticsBuffer.push(result);
          resolve(result);

        } catch (e: any) {
          if (e.message === 'DISCONNECTED') {
            resolve(this.buildErrorResult(request, 'DISCONNECTED', 'Connection lost'));
          } else if (e.message === 'TIMEOUT') {
            resolve(this.buildErrorResult(request, 'TIMEOUT', 'Timeout'));
          } else {
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
        decoded.push({ type: 'ADAPTER_VOLTAGE', value: parseFloat(match[1]), unit: 'V' });
        status = 'SUCCESS_DECODED';
      } else {
        status = 'SUCCESS_RAW';
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

  private buildResultFromRaw(request: CommandRequest, rawResponse: RawElmResponse, status: CommandResultStatus): CommandResult {
      const result: CommandResult = {
        request,
        rawResponse,
        normalizedResponse: null,
        classifiedLines: [],
        obdFrames: [],
        negativeResponses: [],
        decodedValues: [],
        status,
        errors: [],
        latencyMs: rawResponse.latencyMs
      };
      DiagnosticsBuffer.push(result);
      return result;
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
    this.processQueue();
  }

  public disconnect() {
    if (this.transport && typeof this.transport.disconnect === 'function') {
      this.transport.disconnect();
    }
  }
}
