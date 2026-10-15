import { ClassifiedLine, ObdFrame, CommandRequest, NegativeObdResponse } from './types';

export class ObdFrameParser {

  public static parse(classifiedLines: ClassifiedLine[], request: CommandRequest): { frames: ObdFrame[], negatives: NegativeObdResponse[] } {
    const frames: ObdFrame[] = [];
    const negatives: NegativeObdResponse[] = [];

    const candidateLines = classifiedLines.filter(c => c.classification === 'OBD_HEX_CANDIDATE');

    for (const line of candidateLines) {
      const hex = line.normalizedText;

      // 7F <requested service> <NRC> must precede a positive response.
      // A literal '7F' inside a positive PID payload is NOT a negative reply.
      const positiveMarker = request.expectedService || '41';
      const positiveIndex = hex.indexOf(positiveMarker);
      const negativeIndex = hex.indexOf('7F');
      const requestedServiceCode = request.command.slice(0, 2).toUpperCase();
      if (negativeIndex >= 0 && (positiveIndex < 0 || negativeIndex < positiveIndex) &&
          hex.length >= negativeIndex + 6 &&
          hex.substring(negativeIndex + 2, negativeIndex + 4) === requestedServiceCode) {
        negatives.push({
          requestedService: requestedServiceCode,
          responseCode: hex.substring(negativeIndex + 4, negativeIndex + 6),
          sourceEcu: negativeIndex > 0 ? hex.substring(0, negativeIndex) : null,
          rawLine: line.originalText,
        });
        continue;
      }

      // Check for standard Mode 01/09 responses
      // e.g. "410C1AF8" or "7E804410C1AF8"
      let sourceAddress: string | null = null;
      let service: string | null = null;
      let pid: string | null = null;
      let payloadHex: string | null = null;

      const expectedServiceStr = request.expectedService || '41'; // default to mode 01 response

      const serviceIdx = hex.indexOf(expectedServiceStr);

      if (serviceIdx === -1) {
        // AMBIGUOUS or UNSUPPORTED. We don't use heuristics to guess payload yet.
        frames.push({
          sourceAddress: null,
          service: 'UNKNOWN',
          pid: null,
          payloadBytes: [],
          declaredLength: null,
          rawLine: line.originalText,
          validity: 'AMBIGUOUS'
        });
        continue;
      }

      if (serviceIdx > 0) {
        // CAN header usually precedes the service. e.g., 7E8 04 41 ...
        // We can extract 7E8
        const prefix = hex.substring(0, serviceIdx);
        if (prefix.length >= 3) {
          sourceAddress = prefix.substring(0, prefix.length > 3 ? prefix.length - 2 : 3);
        }
      }

      service = expectedServiceStr;

      if (hex.length >= serviceIdx + 4) {
        pid = hex.substring(serviceIdx + 2, serviceIdx + 4);
        payloadHex = hex.substring(serviceIdx + 4);
      } else {
        frames.push({
          sourceAddress,
          service,
          pid: null,
          payloadBytes: [],
          declaredLength: null,
          rawLine: line.originalText,
          validity: 'INCOMPLETE'
        });
        continue;
      }

      // Never promote a reply for a different PID to this request's telemetry.
      // Extra ECU/header material is preserved in rawLine, not guessed into values.
      if (request.expectedPid && pid !== request.expectedPid.toUpperCase()) {
        frames.push({ sourceAddress, service, pid, payloadBytes: [], declaredLength: null,
          rawLine: line.originalText, validity: 'AMBIGUOUS' });
        continue;
      }
      if (payloadHex.length % 2 !== 0) {
        frames.push({ sourceAddress, service, pid, payloadBytes: [], declaredLength: null,
          rawLine: line.originalText, validity: 'INCOMPLETE' });
        continue;
      }

      const payloadBytes: number[] = [];
      for (let i = 0; i < payloadHex.length; i += 2) {
        if (i + 1 < payloadHex.length) {
          payloadBytes.push(parseInt(payloadHex.substring(i, i + 2), 16));
        }
      }

      frames.push({
        sourceAddress,
        service,
        pid,
        payloadBytes,
        declaredLength: null, // Length byte extraction can be added later if strictly needed
        rawLine: line.originalText,
        validity: payloadBytes.length > 0 ? 'VALID' : 'MALFORMED'
      });
    }

    return { frames, negatives };
  }
}
