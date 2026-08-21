import { CommandFamily } from '../types';

export const GOLDEN_DIAGNOSTIC_CORPUS_VERSION = 'AUTOPULSE_DIAGNOSTIC_CORPUS_V1';

export interface GoldenDiagnosticCase {
  readonly id: string;
  readonly family: CommandFamily;
  readonly command: string;
  readonly expectedService: string;
  readonly rawText: string;
  readonly expected: {
    readonly validFrames: number;
    readonly ambiguousFrames?: number;
    readonly negativeResponses: number;
    readonly decodedType?: string;
    readonly decodedValue?: number;
    readonly sourceEcu?: string;
  };
}

/**
 * Small, reviewable canonical fixtures. These represent parser/decoder
 * contracts and are intentionally not bundled raw-capture archives.
 * ISO-TP/DTC cases are fail-closed in Release 1: preserve diagnostic shape,
 * but never manufacture a Mode 01 signal from a multi-frame response.
 */
export const GOLDEN_DIAGNOSTIC_CORPUS_V1: readonly GoldenDiagnosticCase[] = Object.freeze([
  {
    id: 'standard-11-bit-rpm',
    family: 'OBD_MODE_01', command: '010C', expectedService: '41',
    rawText: '010C\r7E8 04 41 0C 1A F8\r>',
    expected: {
      validFrames: 1, negativeResponses: 0,
      decodedType: 'RPM', decodedValue: 1726, sourceEcu: '7E8'
    }
  },
  {
    id: 'extended-29-bit-speed',
    family: 'OBD_MODE_01', command: '010D', expectedService: '41',
    rawText: '18 DA F1 10 04 41 0D 64\r>',
    expected: {
      validFrames: 1, negativeResponses: 0,
      decodedType: 'SPEED', decodedValue: 100, sourceEcu: '18DAF110'
    }
  },
  {
    id: 'ecu-negative-response',
    family: 'OBD_MODE_01', command: '010C', expectedService: '41',
    rawText: '7E8 03 7F 01 12\r>',
    expected: { validFrames: 0, negativeResponses: 1 }
  },
  {
    id: 'high-range-rpm',
    family: 'OBD_MODE_01', command: '010C', expectedService: '41',
    rawText: '7E8 04 41 0C FF FF\r>',
    expected: {
      validFrames: 1, negativeResponses: 0,
      decodedType: 'RPM', decodedValue: 16383.75, sourceEcu: '7E8'
    }
  },
  {
    id: 'iso-tp-multiframe-dtc-fails-closed',
    family: 'OBD_MODE_03', command: '03', expectedService: '43',
    rawText: '7E8 10 08 43 01 33 02 10\r7E8 21 03 00 00 00 00 00\r>',
    expected: { validFrames: 1, ambiguousFrames: 1, negativeResponses: 0 }
  },
  {
    id: 'mixed-can-keeps-only-mode01-truth',
    family: 'OBD_MODE_01', command: '010D', expectedService: '41',
    rawText: '123 8 11 22 33 44 55 66 77 88\r7E8 03 41 0D 2A\r>',
    expected: {
      validFrames: 1, ambiguousFrames: 1, negativeResponses: 0,
      decodedType: 'SPEED', decodedValue: 42, sourceEcu: '7E8'
    }
  },
  {
    id: 'truncated-frame-is-not-data',
    family: 'OBD_MODE_01', command: '010C', expectedService: '41',
    rawText: '7E8 03 41\r>',
    expected: { validFrames: 0, negativeResponses: 0 }
  }
]);
