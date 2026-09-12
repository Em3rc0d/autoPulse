import type { DiagnosticTroubleCodeFamily } from '../../../domain/check/DiagnosticTroubleCode';
import { isDiagnosticByte } from './DiagnosticServiceEnvelope';

export interface DecodedDtcPair {
  readonly code: string;
  readonly family: DiagnosticTroubleCodeFamily;
  readonly rawPair: readonly [number, number];
}

const DTC_FAMILIES: readonly DiagnosticTroubleCodeFamily[] = [
  'POWERTRAIN',
  'CHASSIS',
  'BODY',
  'NETWORK',
] as const;

/**
 * Decode one SAE-style two-byte DTC value. 0000 is padding/no-code and returns null.
 * Human meaning and generic/manufacturer namespace are intentionally outside this primitive.
 */
export function decodeDtcPair(first: number, second: number): DecodedDtcPair | null {
  if (!isDiagnosticByte(first) || !isDiagnosticByte(second)) {
    throw new Error(`Invalid DTC byte pair: ${first}, ${second}`);
  }
  if (first === 0 && second === 0) return null;

  const familyIndex = (first & 0xc0) >> 6;
  const familyLetter = ['P', 'C', 'B', 'U'][familyIndex];
  const family = DTC_FAMILIES[familyIndex];
  const digit1 = (first & 0x30) >> 4;
  const digit2 = (first & 0x0f).toString(16).toUpperCase();
  const digit3 = ((second & 0xf0) >> 4).toString(16).toUpperCase();
  const digit4 = (second & 0x0f).toString(16).toUpperCase();

  return {
    code: `${familyLetter}${digit1}${digit2}${digit3}${digit4}`,
    family,
    rawPair: [first, second],
  };
}
