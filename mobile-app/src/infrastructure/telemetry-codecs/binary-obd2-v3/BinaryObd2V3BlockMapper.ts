import { ObdAcquisitionEvent, ObdAcquisitionStatus } from '../../../domain/telemetry/models/ObdAcquisitionEvent';
import { UnencodedTelemetryBlock } from '../../../domain/telemetry/models/UnencodedTelemetryBlock';
import {
  BinaryObd2V3Event,
  BinaryObd2V3Input,
  BinaryObd2V3NegativeResponse,
  BinaryObd2V3RawFragment,
  BinaryObd2V3Reading,
  BinaryObd2V3Signal,
  BinaryObd2V3Target,
  BinaryObd2V3Frame
} from './types';

// Congelados
const STATUS_MAP: Record<string, number> = {
  'SUCCESS': 0,
  'SUCCESS_DECODED': 0,
  'SUCCESS_RAW': 1,
  'NO_DATA': 2,
  'ERROR': 3,
  'ELM_ERROR': 3,
  'INVALID_RESPONSE': 4,
  'PARTIAL': 5,
  'TIMEOUT': 6,
  'CANCELLED': 7,
  'WRITE_FAILED': 8,
  'DISCONNECTED': 9,
  'NEGATIVE_RESPONSE': 10
};

const COMPLETION_REASON_MAP: Record<string, number> = {
  'PROMPT_RECEIVED': 0,
  'TIMEOUT': 1,
  'DISCONNECTED': 2,
  'CANCELLED': 3,
  'MAX_BYTES_REACHED': 4,
  'WRITE_FAILED': 5,
  'UNKNOWN': 255
};

const QUALITY_MAP: Record<string, number> = {
  'VALID': 0,
  'GOOD': 0,
  'DEGRADED': 1,
  'STALE': 2,
  'UNAVAILABLE': 3,
  'INVALID': 4
};

export class BinaryObd2V3BlockMapper {

  static mapToInput(block: UnencodedTelemetryBlock): BinaryObd2V3Input {
    // Validations (Reject empty or malformed blocks)
    if (!block.sessionId) throw new Error('Session ID empty');
    if (block.blockSequence < 0) throw new Error('Invalid block sequence');
    if (block.windowIndex < 0) throw new Error('Invalid window index');
    if (block.endedAt < block.startedAt) throw new Error('endedAt < startedAt');
    if (block.events.length === 0) throw new Error('Block without events');
    if (block.eventCount !== block.events.length) throw new Error('Inconsistent event count');

    // Limits
    if (block.events.length > 5000) throw new Error('BLOCK_LIMIT_EXCEEDED: events');

    const targets: BinaryObd2V3Target[] = [];
    const signals: BinaryObd2V3Signal[] = [];
    const strings: string[] = []; // Used for signalIds and units

    const getStringIndex = (str: string): number => {
      let idx = strings.indexOf(str);
      if (idx === -1) {
        idx = strings.length;
        strings.push(str);
      }
      return idx;
    };

    const getTargetIndex = (ecuStr: string | null, serviceStr: string | number | null, pidStr: string | number | null): number => {
      if (!ecuStr && !serviceStr && !pidStr) return 255; // 255 = no target

      let ecuAddress = 0;
      if (ecuStr && typeof ecuStr === 'string') {
        ecuAddress = parseInt(ecuStr, 16);
        if (isNaN(ecuAddress)) ecuAddress = 0;
      } else if (typeof ecuStr === 'number') {
        ecuAddress = ecuStr;
      }

      let service = 0;
      if (typeof serviceStr === 'string') service = parseInt(serviceStr, 16);
      else if (typeof serviceStr === 'number') service = serviceStr;
      if (isNaN(service)) service = 0;

      let pid = 0;
      if (typeof pidStr === 'string') pid = parseInt(pidStr, 16);
      else if (typeof pidStr === 'number') pid = pidStr;
      if (isNaN(pid)) pid = 0;

      let idx = targets.findIndex(t => t.sourceAddress === ecuAddress && t.service === service && t.parameterIdentifier === pid);
      if (idx === -1) {
        idx = targets.length;
        targets.push({ sourceAddress: ecuAddress, service, parameterIdentifier: pid });
      }
      return idx;
    };

    const getSignalIndex = (targetIdx: number, signalId: string, unit: string): number => {
      const sIdx = getStringIndex(signalId);
      const uIdx = getStringIndex(unit);

      let idx = signals.findIndex(s => s.targetIndex === targetIdx && s.signalIdIndex === sIdx && s.unitIndex === uIdx);
      if (idx === -1) {
        idx = signals.length;
        signals.push({ targetIndex: targetIdx, signalIdIndex: sIdx, unitIndex: uIdx });
      }
      return idx;
    };

    const mappedEvents: BinaryObd2V3Event[] = [];
    let lastSeq = -1;

    for (const ev of block.events) {
      if (ev.sequenceNumber === lastSeq) throw new Error('DUPLICATE_EVENT_SEQUENCE');
      if (lastSeq !== -1 && ev.sequenceNumber < lastSeq) throw new Error('REGRESSIVE_EVENT_SEQUENCE');
      if (ev.sessionId !== block.sessionId) throw new Error('SESSION_MISMATCH');
      if (ev.completedAt < block.startedAt || ev.completedAt > block.endedAt) throw new Error('EVENT_OUT_OF_WINDOW');

      lastSeq = ev.sequenceNumber;

      const targetIndex = getTargetIndex(null, ev.commandFamily === 'OBD' || ev.commandFamily === 'OBD_MODE_01' ? '01' : null, ev.command.replace('01', ''));

      const readings: BinaryObd2V3Reading[] = ev.decodedReadings.map(r => {
        const tIdx = getTargetIndex(r.sourceEcu, r.service, r.pid);
        const sigIdx = getSignalIndex(tIdx, r.signalId, r.unit);
        return {
          signalIndex: sigIdx,
          qualityIndex: QUALITY_MAP[r.quality] ?? QUALITY_MAP['INVALID'],
          value: r.value
        };
      });

      const negativeResponses: BinaryObd2V3NegativeResponse[] = ev.negativeResponses.map(nr => {
        return {
          requestedService: typeof nr.requestedService === 'string' ? parseInt(nr.requestedService, 16) : nr.requestedService,
          responseCode: typeof nr.responseCode === 'string' ? parseInt(nr.responseCode, 16) : nr.responseCode,
          sourceTargetIndex: 255 // Default for now
        };
      });

      const rawFragments: BinaryObd2V3RawFragment[] = ev.rawFragments.map(rf => {
        const bytes = new TextEncoder().encode(rf.decodedText);
        if (bytes.length > 4096) throw new Error('BLOCK_LIMIT_EXCEEDED: maxRawBytesPerFragment');
        return {
          receivedDeltaMs: Math.max(0, rf.receivedAt - ev.requestedAt),
          bytes
        };
      });

      if (rawFragments.length > 32) throw new Error('BLOCK_LIMIT_EXCEEDED: maxRawFragmentsPerEvent');
      const totalRawBytes = rawFragments.reduce((sum, rf) => sum + rf.bytes.length, 0);
      if (totalRawBytes > 8192) throw new Error('BLOCK_LIMIT_EXCEEDED: maxRawBytesPerEvent');

      const frames: BinaryObd2V3Frame[] = ev.frames.map(f => {
        return {
          transportIndex: 0,
          sourceAddress: 0,
          destinationAddress: 0,
          service: typeof f.service === 'string' ? parseInt(f.service, 16) || 0 : 0,
          pid: typeof f.pid === 'string' ? parseInt(f.pid, 16) || 0 : 0,
          payloadBytes: new Uint8Array(f.payloadBytes || []),
          validityIndex: 0
        };
      });

      mappedEvents.push({
        statusIndex: STATUS_MAP[ev.status] ?? 3, // Default to ERROR
        completionReasonIndex: COMPLETION_REASON_MAP[ev.completionReason] ?? 255,
        requestSequence: ev.sequenceNumber,
        requestedDeltaMs: Math.max(0, ev.requestedAt - block.startedAt),
        completedDeltaMs: Math.max(0, ev.completedAt - block.startedAt),
        latencyMs: ev.latencyMs,
        targetIndex,
        readings,
        negativeResponses,
        rawFragments,
        frames
      });
    }

    if (mappedEvents[0].requestSequence !== block.firstEventSequence) throw new Error('Inconsistent first event sequence');
    if (mappedEvents[mappedEvents.length - 1].requestSequence !== block.lastEventSequence) throw new Error('Inconsistent last event sequence');

    return {
      magic: 0x3344424F, // 'OBD3'
      formatVersion: 3,
      targets,
      signals,
      strings,
      events: mappedEvents
    };
  }
}
