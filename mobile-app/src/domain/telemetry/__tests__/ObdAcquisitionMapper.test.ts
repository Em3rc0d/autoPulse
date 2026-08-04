import { ObdAcquisitionMapper } from '../factories/ObdAcquisitionMapper';
import { CommandResult, CommandRequest } from '../../../infrastructure/ble/real/pipeline/types';

describe('ObdAcquisitionMapper', () => {
  it('maps a successful decoded CommandResult to an ObdAcquisitionEvent', () => {
    const request: CommandRequest = {
      id: 'req_123',
      command: '010C',
      family: 'OBD_MODE_01',
      expectedService: '01',
      expectedPid: '0C',
      timeoutMs: 1000
    };

    const result: CommandResult = {
      request,
      rawResponse: {
        fragments: [{ receivedAt: 1000, base64: '', decodedText: '41 0C 0B 6C \r' }],
        accumulatedText: '41 0C 0B 6C \r',
        completionReason: 'PROMPT_RECEIVED',
        startedAt: 1000,
        finishedAt: 1050,
        latencyMs: 50
      },
      normalizedResponse: null,
      classifiedLines: [],
      obdFrames: [
        {
          sourceAddress: '7E8',
          service: '41',
          pid: '0C',
          payloadBytes: [11, 108],
          declaredLength: null,
          rawLine: '41 0C 0B 6C',
          validity: 'VALID'
        }
      ],
      negativeResponses: [],
      decodedValues: [
        {
          type: 'RPM',
          value: 731,
          unit: 'RPM'
        }
      ],
      status: 'SUCCESS_DECODED',
      errors: [],
      latencyMs: 50
    };

    const event = ObdAcquisitionMapper.fromCommandResult(result, 'sess_1', 42);

    expect(event.sessionId).toBe('sess_1');
    expect(event.sequenceNumber).toBe(42);
    expect(event.requestId).toBe('req_123');
    expect(event.command).toBe('010C');
    expect(event.commandFamily).toBe('OBD_MODE_01');
    expect(event.requestedAt).toBe(1000);
    expect(event.completedAt).toBe(1050);
    expect(event.latencyMs).toBe(50);
    expect(event.status).toBe('SUCCESS');
    expect(event.decodedReadings).toHaveLength(1);

    const reading = event.decodedReadings[0];
    expect(reading.signalId).toBe('RPM');
    expect(reading.value).toBe(731);
    expect(reading.unit).toBe('RPM');
    expect(reading.sourceEcu).toBe('7E8');
    expect(reading.rawBytes).toEqual([11, 108]);
  });

  it('handles NO_DATA gracefully', () => {
    const request: CommandRequest = {
      id: 'req_124',
      command: '0142',
      family: 'OBD_MODE_01',
      expectedService: '01',
      expectedPid: '42',
      timeoutMs: 1000
    };

    const result: CommandResult = {
      request,
      rawResponse: {
        fragments: [{ receivedAt: 2000, base64: '', decodedText: 'NO DATA\r' }],
        accumulatedText: 'NO DATA\r',
        completionReason: 'PROMPT_RECEIVED',
        startedAt: 2000,
        finishedAt: 2050,
        latencyMs: 50
      },
      normalizedResponse: null,
      classifiedLines: [],
      obdFrames: [],
      negativeResponses: [],
      decodedValues: [],
      status: 'NO_DATA',
      errors: [],
      latencyMs: 50
    };

    const event = ObdAcquisitionMapper.fromCommandResult(result, 'sess_1', 43);

    expect(event.status).toBe('NO_DATA');
    expect(event.decodedReadings).toHaveLength(0);
    expect(event.frames).toHaveLength(0);
  });
});
