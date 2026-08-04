import { RawElmResponse, NormalizedElmResponse } from './types';

export class ElmNormalizer {

  public static normalize(rawResponse: RawElmResponse, commandText: string): NormalizedElmResponse {
    let rawText = rawResponse.accumulatedText;

    let promptDetected = false;
    if (rawText.includes('>')) {
      promptDetected = true;
      rawText = rawText.replace(/>/g, ''); // Strip prompt for line processing
    }

    // Split by carriage return or newline
    const rawLines = rawText.split(/[\r\n]+/).filter(line => line.trim().length > 0);

    const echoLines: string[] = [];
    const statusLines: string[] = [];
    const candidateHexLines: string[] = [];
    const unknownLines: string[] = [];

    // Normalize command text for echo comparison (remove spaces/newlines)
    const cleanCmd = commandText.replace(/\s+/g, '').toUpperCase();

    // Known ELM statuses
    const KNOWN_STATUSES = [
      'SEARCHING',
      'NO DATA',
      'UNABLE TO CONNECT',
      'BUS INIT: ERROR',
      'BUS INIT: OK',
      'BUS INIT: ...',
      'CAN ERROR',
      'STOPPED',
      'OK',
      '?'
    ];

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      const noSpaces = trimmed.replace(/\s+/g, '').toUpperCase();

      // 1. Is it an exact echo?
      if (noSpaces === cleanCmd && cleanCmd.length > 0) {
        echoLines.push(rawLine);
        continue;
      }

      // 2. Is it a known status?
      let matchedStatus = false;
      for (const status of KNOWN_STATUSES) {
        if (trimmed.toUpperCase().startsWith(status)) {
          statusLines.push(rawLine);
          matchedStatus = true;
          break;
        }
      }

      if (matchedStatus) continue;

      // 3. Is it an ELM327 version banner? (e.g. "ELM327 v1.5")
      if (trimmed.toUpperCase().startsWith('ELM327') || trimmed.toUpperCase().startsWith('OBDLINK') || trimmed.toUpperCase().startsWith('V-LINK')) {
        statusLines.push(rawLine);
        continue;
      }

      // 4. Is it candidate hex data?
      // A valid hex candidate should only contain valid hex chars after removing spaces
      const isHex = /^[0-9A-F]+$/.test(noSpaces);
      if (isHex && noSpaces.length > 0) {
        candidateHexLines.push(rawLine);
      } else {
        unknownLines.push(rawLine);
      }
    }

    // Re-construct the full normalized text for backward-compat or logging if needed
    // Typically, the normalized text used for parsing was without spaces and carriage returns.
    // We will join candidate hex lines.
    const normalizedText = candidateHexLines
      .map(line => line.replace(/\s+/g, '').toUpperCase())
      .join('');

    return {
      rawText: rawResponse.accumulatedText,
      normalizedText,
      echoLines,
      statusLines,
      candidateHexLines,
      unknownLines,
      promptDetected
    };
  }
}
