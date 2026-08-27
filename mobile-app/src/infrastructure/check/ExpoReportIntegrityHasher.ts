import * as Crypto from 'expo-crypto';
import { ReportIntegrityHasher } from '../../application/check/CheckReportIntegrity';

export const expoReportIntegrityHasher: ReportIntegrityHasher = {
  sha256Hex: (payload: string) => Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    payload,
    { encoding: Crypto.CryptoEncoding.HEX },
  ),
};
