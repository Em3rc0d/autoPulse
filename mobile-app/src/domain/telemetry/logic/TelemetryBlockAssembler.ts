import { ObdAcquisitionEvent } from '../models/ObdAcquisitionEvent';
import { UnencodedTelemetryBlock } from '../models/UnencodedTelemetryBlock';

export class TelemetryBlockAssembler {
  private state: 'OPEN' | 'CLOSED' = 'OPEN';
  private persistedBlockSequence = 0;
  private currentWindowIndex = -1;
  private currentEvents: ObdAcquisitionEvent[] = [];
  private lastEventSequence = -1;

  constructor(
    private readonly sessionId: string,
    private readonly recordingStartedAt: number,
    private readonly blockDurationMs: number = 5000
  ) {
    if (blockDurationMs <= 0) {
      throw new Error('blockDurationMs must be positive');
    }
  }

  append(event: ObdAcquisitionEvent): UnencodedTelemetryBlock[] {
    if (this.state === 'CLOSED') {
      throw new Error('ASSEMBLER_CLOSED');
    }

    if (event.sessionId !== this.sessionId) {
      throw new Error('SESSION_MISMATCH');
    }

    if (event.completedAt < this.recordingStartedAt) {
      throw new Error('EVENT_BEFORE_RECORDING_START');
    }

    if (event.sequenceNumber === this.lastEventSequence) {
      throw new Error('DUPLICATE_EVENT_SEQUENCE');
    }

    if (event.sequenceNumber < this.lastEventSequence) {
      throw new Error('REGRESSIVE_EVENT_SEQUENCE');
    }

    const eventWindowIndex = Math.floor((event.completedAt - this.recordingStartedAt) / this.blockDurationMs);

    if (this.currentWindowIndex !== -1 && eventWindowIndex < this.currentWindowIndex) {
      throw new Error('LATE_EVENT');
    }

    const emittedBlocks: UnencodedTelemetryBlock[] = [];

    // Rotación de ventana
    if (this.currentWindowIndex !== -1 && eventWindowIndex > this.currentWindowIndex) {
      const block = this.closeCurrentBlock(false);
      if (block) {
        emittedBlocks.push(block);
      }
      this.currentWindowIndex = eventWindowIndex;
    } else if (this.currentWindowIndex === -1) {
      // Inicializar el índice de ventana en el primer evento
      this.currentWindowIndex = eventWindowIndex;
    }

    this.currentEvents.push(event);
    this.lastEventSequence = event.sequenceNumber;

    return emittedBlocks;
  }

  flush(stoppedAt: number): UnencodedTelemetryBlock | null {
    if (this.state === 'CLOSED') {
      return null;
    }

    this.state = 'CLOSED';

    return this.closeCurrentBlock(true, stoppedAt);
  }

  getState(): 'OPEN' | 'CLOSED' {
    return this.state;
  }

  private closeCurrentBlock(isFlush: boolean, stoppedAt?: number): UnencodedTelemetryBlock | null {
    if (this.currentEvents.length === 0) {
      return null;
    }

    const windowStartAt = this.recordingStartedAt + (this.currentWindowIndex * this.blockDurationMs);
    let windowEndAt = windowStartAt + this.blockDurationMs;

    if (isFlush && stoppedAt !== undefined) {
      // Partial block logic: si se hace flush antes del final de la ventana
      // limitamos el endAt de la ventana, siempre respetando que stoppedAt sea válido.
      // stoppedAt no puede ser menor al final del último evento, porque ya sucedió.
      const lastCompletedAt = this.currentEvents[this.currentEvents.length - 1].completedAt;
      windowEndAt = Math.max(lastCompletedAt, stoppedAt);
    }

    // Calcula lectura de señales exitosas (ignora NO DATA u otros)
    let readingCount = 0;
    for (const ev of this.currentEvents) {
      readingCount += ev.decodedReadings.length;
    }

    const block: UnencodedTelemetryBlock = {
      sessionId: this.sessionId,
      blockSequence: this.persistedBlockSequence++,
      windowIndex: this.currentWindowIndex,
      startedAt: windowStartAt,
      endedAt: windowEndAt,
      isPartial: isFlush || (windowEndAt - windowStartAt < this.blockDurationMs),
      events: [...this.currentEvents], // array copy for immutability
      eventCount: this.currentEvents.length,
      readingCount,
      firstEventSequence: this.currentEvents[0].sequenceNumber,
      lastEventSequence: this.currentEvents[this.currentEvents.length - 1].sequenceNumber
    };

    this.currentEvents = [];
    return block;
  }
}
