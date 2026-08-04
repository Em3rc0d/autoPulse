import { ClassifiedLine, LineClassification, NormalizedElmResponse, CommandRequest } from './types';

export class ElmClassifier {

  public static classify(normalizedResponse: NormalizedElmResponse, request: CommandRequest): ClassifiedLine[] {
    const lines: ClassifiedLine[] = [];

    // Process echo lines
    for (const raw of normalizedResponse.echoLines) {
      lines.push({
        originalText: raw,
        normalizedText: raw.replace(/\s+/g, '').toUpperCase(),
        classification: 'COMMAND_ECHO'
      });
    }

    // Process status lines
    for (const raw of normalizedResponse.statusLines) {
      let classification: LineClassification = 'ELM_STATUS';

      const upper = raw.toUpperCase();
      if (upper.includes('ERROR') || upper.includes('UNABLE TO CONNECT') || upper.includes('?')) {
        classification = 'ELM_ERROR';
      }

      lines.push({
        originalText: raw,
        normalizedText: raw.trim().toUpperCase(),
        classification
      });
    }

    // Process candidate hex lines
    for (const raw of normalizedResponse.candidateHexLines) {
      const normalizedText = raw.replace(/\s+/g, '').toUpperCase();
      let classification: LineClassification = 'UNKNOWN_TEXT';

      if (request.family === 'ELM_AT') {
        classification = 'AT_RESPONSE';
      } else {
        // Basic heuristic: if it's hex and we are expecting OBD, it's an OBD candidate
        if (/^[0-9A-F]+$/.test(normalizedText)) {
          classification = 'OBD_HEX_CANDIDATE';
        } else {
          classification = 'MALFORMED_HEX';
        }
      }

      lines.push({
        originalText: raw,
        normalizedText,
        classification
      });
    }

    // Process unknown lines
    for (const raw of normalizedResponse.unknownLines) {
      lines.push({
        originalText: raw,
        normalizedText: raw.trim().toUpperCase(),
        classification: 'UNKNOWN_TEXT'
      });
    }

    if (normalizedResponse.promptDetected) {
      lines.push({
        originalText: '>',
        normalizedText: '>',
        classification: 'PROMPT'
      });
    }

    return lines;
  }
}
