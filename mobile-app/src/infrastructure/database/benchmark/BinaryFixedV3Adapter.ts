import { PayloadAdapter, Obd2TelemetryFrame, EncodeResult, DecodeResult } from './PayloadAdapter';
import { BinaryObd2V3Codec } from '../../telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';
import { Obd2AcquisitionEvent } from '../../../domain/telemetry';
import { ObdAcquisitionEvent, ObdAcquisitionStatus, UnencodedTelemetryBlock } from '../../../domain/telemetry';

export class BinaryFixedV3Adapter implements PayloadAdapter {
  readonly formatId = 'BINARY_OBD2_V3';
  readonly formatVersion = '3';
  readonly storageType = 'BLOB';

  private codec = new BinaryObd2V3Codec();

  encode(frames: Obd2TelemetryFrame[]): EncodeResult {
    const blockStart = frames.length > 0 ? frames[0].timestampMs : 0;
    const protocolCode = frames.length > 0 ? frames[0].protocolCode : 0;

    const newEvents: ObdAcquisitionEvent[] = [];
    for (const f of frames) {
      for (const ev of f.events) {
        let status: ObdAcquisitionStatus = 'ERROR';
        if (ev.outcome === 'VALUE') status = 'SUCCESS';
        else if (ev.outcome === 'TIMEOUT') status = 'TIMEOUT';
        else if (ev.outcome === 'CANCELLED') status = 'CANCELLED';
        else if (ev.outcome === 'INVALID_RESPONSE') status = 'INVALID_RESPONSE';

        let commandFamily: any = 'UNKNOWN';
        if (ev.service === 1) commandFamily = 'OBD_MODE_01';

        const requestedAt = blockStart + ev.requestDelta;
        const latencyMs = (ev.responseDelta || 0) + (ev.decodeDelta || 0);
        const completedAt = requestedAt + latencyMs;

        const newEv: ObdAcquisitionEvent = {
          sessionId: 'bench_session',
          sequenceNumber: ev.requestSequence,
          requestId: `bench_req_${ev.requestSequence}`,
          requestedAt,
          completedAt,
          command: `${(ev.service || 0).toString(16).padStart(2, '0').toUpperCase()}${(ev.pid || 0).toString(16).padStart(2, '0').toUpperCase()}`,
          commandFamily,
          completionReason: 'PROMPT_RECEIVED',
          latencyMs,
          rawFragments: [],
          rawText: '',
          frames: [],
          decodedReadings: ev.readings.map(r => ({
            signalId: r.signalDefinitionId,
            service: (ev.service || 0).toString(16).padStart(2, '0').toUpperCase(),
            pid: (ev.pid || 0).toString(16).padStart(2, '0').toUpperCase(),
            value: r.normalizedValue,
            unit: r.unit,
            rawBytes: [],
            origin: 'OBD2',
            quality: (r.quality === 'VALID' ? 'GOOD' : r.quality) as any,
            sourceEcu: ev.ecuAddress ? ev.ecuAddress.toString(16).toUpperCase() : null,
            observedAt: completedAt
          })),
          negativeResponses: [],
          status,
          warnings: []
        };
        newEvents.push(newEv);
      }
    }

    const block: UnencodedTelemetryBlock = {
      sessionId: 'bench_session',
      blockSequence: 0,
      windowIndex: 0,
      startedAt: blockStart,
      endedAt: blockStart + 5000,
      isPartial: false,
      events: newEvents,
      eventCount: newEvents.length,
      readingCount: newEvents.reduce((s, e) => s + e.decodedReadings.length, 0),
      firstEventSequence: newEvents.length > 0 ? newEvents[0].sequenceNumber : 0,
      lastEventSequence: newEvents.length > 0 ? newEvents[newEvents.length - 1].sequenceNumber : 0
    };

    const encoded = this.codec.encode(block);

    return {
      payload: encoded.payload,
      byteSize: encoded.payloadByteLength,
      frameCount: frames.length,
      eventCount: encoded.eventCount,
      readingCount: encoded.readingCount,
      formatVersion: encoded.formatVersion.toString(),
      payloadBytes: encoded.payloadByteLength
    };
  }

  decode(payload: string | Uint8Array): DecodeResult {
    let unencoded: UnencodedTelemetryBlock;
    try {
      unencoded = this.codec.decode(payload as Uint8Array, { sessionId: 'bench_session', startedAt: 0 }); // Note: We lose blockStart inside V3 since it uses startedAt context
    } catch (e: any) {
      return {
        frames: [],
        eventCount: 0,
        readingCount: 0,
        formatVersion: this.formatVersion,
        errors: [e.message]
      };
    }

    const legacyEvents: Obd2AcquisitionEvent[] = unencoded.events.map(ev => {
      let outcome: any = 'INVALID_RESPONSE';
      if (ev.status === 'SUCCESS') outcome = 'VALUE';
      else if (ev.status === 'TIMEOUT') outcome = 'TIMEOUT';
      else if (ev.status === 'CANCELLED') outcome = 'CANCELLED';

      return {
        requestSequence: ev.sequenceNumber,
        ecuAddress: ev.decodedReadings.length > 0 && ev.decodedReadings[0].sourceEcu ? parseInt(ev.decodedReadings[0].sourceEcu, 16) : undefined,
        service: ev.commandFamily === 'OBD_MODE_01' ? 1 : undefined,
        pid: parseInt(ev.command.replace('01', ''), 16) || undefined,
        requestDelta: Math.max(0, ev.requestedAt - unencoded.startedAt),
        responseDelta: ev.latencyMs,
        decodeDelta: 0,
        outcome,
        connectionState: 'CONNECTED',
        readings: ev.decodedReadings.map(r => ({
          signalDefinitionId: r.signalId,
          normalizedValue: r.value,
          unit: r.unit,
          quality: (r.quality === 'GOOD' ? 'VALID' : r.quality) as any
        }))
      };
    });

    const frames: Obd2TelemetryFrame[] = [{
      timestampMs: unencoded.startedAt,
      sequenceNumber: 1,
      protocolCode: 0,
      events: legacyEvents
    }];

    return {
      frames,
      eventCount: unencoded.eventCount,
      readingCount: unencoded.readingCount,
      formatVersion: this.formatVersion,
      errors: []
    };
  }
}
