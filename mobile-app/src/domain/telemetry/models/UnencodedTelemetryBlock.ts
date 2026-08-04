import { ObdAcquisitionEvent } from './ObdAcquisitionEvent';

export interface UnencodedTelemetryBlock {
  sessionId: string;
  blockSequence: number;
  windowIndex: number;
  startedAt: number;
  endedAt: number;
  isPartial: boolean;
  events: ObdAcquisitionEvent[];
  eventCount: number;
  readingCount: number;
  firstEventSequence: number;
  lastEventSequence: number;
}
