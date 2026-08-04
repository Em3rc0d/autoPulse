import { ElmNormalizer } from '../ble/real/pipeline/ElmNormalizer';
import { ElmClassifier } from '../ble/real/pipeline/ElmClassifier';
import { ObdFrameParser } from '../ble/real/pipeline/ObdFrameParser';
import { ObdDecoder } from '../ble/real/pipeline/ObdDecoder';
import { CommandRequest, CommandResult, CommandResultStatus, RawElmResponse } from '../ble/real/pipeline/types';
import { DiagnosticsBuffer } from '../ble/real/DiagnosticsBuffer';

type PendingRequest = {
  resolve: (result: CommandResult) => void;
  request: CommandRequest;
  startedAt: number;
  timeout: NodeJS.Timeout;
  chunks: string[];
};

export class ReplayObdController {
  public isConnected = false;

  constructor(private replayUrl: string) {}

  private getBaseUrl() {
    return this.replayUrl
      .replace(/^ws:\/\//, 'http://')
      .replace(/\/obd$/, '')
      .replace(/\/command$/, '')
      .replace(/\/health$/, '')
      .replace(/\/$/, '');
  }

  async connect() {
    const healthUrl = `${this.getBaseUrl()}/health`;
    const response = await fetch(healthUrl);
    if (!response.ok) {
      throw new Error(`Could not connect to OBD replay server at ${healthUrl}`);
    }
    this.isConnected = true;
  }

  async executeCommand(request: CommandRequest): Promise<CommandResult> {
    await this.connect();

    const startedAt = Date.now();
    const commandUrl = `${this.getBaseUrl()}/command`;

    try {
      const response = await fetch(commandUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: request.id, command: request.command })
      });

      if (!response.ok) {
        return this.buildErrorResult(request, 'ELM_ERROR', `Replay server returned HTTP ${response.status}`);
      }

      const message = await response.json();
      return this.buildResultFromReplayMessage(request, startedAt, message);
    } catch (error) {
      return this.buildErrorResult(
        request,
        'DISCONNECTED',
        error instanceof Error ? error.message : 'Replay server request failed'
      );
    }
  }

  disconnect() {
    this.isConnected = false;
  }

  private buildResultFromReplayMessage(
    request: CommandRequest,
    startedAt: number,
    message: { raw?: string; chunks?: string[] }
  ): CommandResult {
    const finishedAt = Date.now();
    const chunks = Array.isArray(message.chunks) ? message.chunks : [];
    const accumulatedText = message.raw || chunks.join('');
    const rawResponse: RawElmResponse = {
      fragments: chunks.length > 0 ? chunks.map((chunk, index) => ({
        receivedAt: startedAt + index,
        base64: '',
        decodedText: chunk
      })) : [{
        receivedAt: finishedAt,
        base64: '',
        decodedText: accumulatedText
      }],
      accumulatedText,
      completionReason: 'PROMPT_RECEIVED',
      startedAt,
      finishedAt,
      latencyMs: finishedAt - startedAt
    };

    const result = this.runPipeline(request, rawResponse);
    DiagnosticsBuffer.push(result);
    return result;
  }

  private runPipeline(request: CommandRequest, rawResponse: RawElmResponse): CommandResult {
    const normalized = ElmNormalizer.normalize(rawResponse, request.command);
    const classified = ElmClassifier.classify(normalized, request);
    const { frames, negatives } = ObdFrameParser.parse(classified, request);
    const decoded = ObdDecoder.decode(frames);

    let status: CommandResultStatus = 'SUCCESS_RAW';
    const errors: string[] = [];

    if (normalized.statusLines.some(s => s.toUpperCase().includes('NO DATA'))) {
      status = 'NO_DATA';
    } else if (classified.some(c => c.classification === 'ELM_ERROR')) {
      status = 'ELM_ERROR';
      errors.push(...classified.filter(c => c.classification === 'ELM_ERROR').map(c => c.originalText));
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
}
