import { CommandResult } from '../../../infrastructure/ble/real/pipeline/types';
import { ObdAcquisitionEvent, ObdAcquisitionStatus, ObdReading } from '../models/ObdAcquisitionEvent';

export class ObdAcquisitionMapper {
  static fromCommandResult(
    result: CommandResult,
    sessionId: string,
    sequenceNumber: number
  ): ObdAcquisitionEvent {
    const rawFragments = result.rawResponse?.fragments.map(f => ({
      receivedAt: f.receivedAt,
      decodedText: f.decodedText
    })) || [];

    const frames = result.obdFrames.map(f => ({
      service: f.service,
      pid: f.pid,
      payloadBytes: f.payloadBytes
    }));

    const decodedReadings: ObdReading[] = result.decodedValues.map(dv => {
      // Find the frame that likely generated this decoded value to extract its raw bytes and ECU
      // For now, we will default to the first frame if there's no exact mapping available in DecodedValue
      const relatedFrame = result.obdFrames.find(f => f.service === result.request.expectedService && f.pid === result.request.expectedPid) || result.obdFrames[0];

      return {
        signalId: dv.type,
        service: result.request.expectedService || relatedFrame?.service || 'UNKNOWN',
        pid: result.request.expectedPid || relatedFrame?.pid || null,
        value: dv.value,
        unit: dv.unit,
        rawBytes: relatedFrame?.payloadBytes || [],
        origin: 'OBD2',
        quality: 'GOOD',
        sourceEcu: relatedFrame?.sourceAddress || null,
        observedAt: result.rawResponse?.finishedAt || Date.now()
      };
    });

    const negativeResponses = result.negativeResponses.map(nr => ({
      requestedService: nr.requestedService,
      responseCode: nr.responseCode
    }));

    let status: ObdAcquisitionStatus = 'SUCCESS';
    switch (result.status) {
      case 'SUCCESS_DECODED':
      case 'SUCCESS_RAW':
        status = 'SUCCESS';
        break;
      case 'NO_DATA':
        status = 'NO_DATA';
        break;
      case 'ELM_ERROR':
        status = 'ERROR';
        break;
      case 'INVALID_RESPONSE':
        status = 'INVALID_RESPONSE';
        break;
      case 'PARTIAL':
        status = 'PARTIAL';
        break;
      case 'TIMEOUT':
        status = 'TIMEOUT';
        break;
      case 'CANCELLED':
      case 'DISCONNECTED':
      case 'WRITE_FAILED':
        status = 'CANCELLED';
        break;
      default:
        status = 'ERROR';
    }

    if (negativeResponses.length > 0 && status === 'SUCCESS') {
      status = 'NEGATIVE_RESPONSE';
    }

    return {
      sessionId,
      sequenceNumber,
      requestId: result.request.id,
      requestedAt: result.rawResponse?.startedAt || Date.now(),
      completedAt: result.rawResponse?.finishedAt || Date.now(),
      command: result.request.command,
      commandFamily: result.request.family,
      completionReason: result.rawResponse?.completionReason || 'UNKNOWN',
      latencyMs: result.latencyMs,
      rawFragments,
      rawText: result.rawResponse?.accumulatedText || '',
      frames,
      decodedReadings,
      negativeResponses,
      status,
      warnings: result.errors || []
    };
  }
}
