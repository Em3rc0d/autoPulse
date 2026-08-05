import { RawElmResponse } from '../ble/real/pipeline/types';
import { RawTransport } from '../../application/live/ports/RawTransport';

export class ReplayRawTransport implements RawTransport {
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

  async executeRaw(command: string, timeoutMs: number): Promise<RawElmResponse> {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    const startedAt = Date.now();
    const commandUrl = `${this.getBaseUrl()}/command`;

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(commandUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: Math.random().toString(), command }),
        signal: controller.signal
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const message = await response.json();
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

      return rawResponse;
    } catch (error: any) {
      this.isConnected = false;
      if (error.name === 'AbortError') {
        throw new Error('TIMEOUT');
      }
      throw new Error('DISCONNECTED');
    }
  }

  disconnect() {
    this.isConnected = false;
  }
}
