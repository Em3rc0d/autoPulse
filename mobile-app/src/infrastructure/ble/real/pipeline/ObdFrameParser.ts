import { ClassifiedLine, ObdFrame, CommandRequest, NegativeObdResponse } from './types';

export class ObdFrameParser {

  public static parse(classifiedLines: ClassifiedLine[], request: CommandRequest): { frames: ObdFrame[], negatives: NegativeObdResponse[] } {
    const frames: ObdFrame[] = [];
    const negatives: NegativeObdResponse[] = [];

    const candidateLines = classifiedLines.filter(c => c.classification === 'OBD_HEX_CANDIDATE');

    for (const line of candidateLines) {
      const hex = line.normalizedText;

      // Check for negative response: 7F <service> <code...>
      if (hex.includes('7F')) {
        const idx = hex.indexOf('7F');
        if (hex.length >= idx + 6) {
           const requestedService = hex.substring(idx + 2, idx + 4);
           const responseCode = hex.substring(idx + 4, idx + 6);
           negatives.push({
             requestedService,
             responseCode,
             sourceEcu: idx > 0 ? hex.substring(0, idx) : null,
             rawLine: line.originalText
           });
           continue;
        }
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
