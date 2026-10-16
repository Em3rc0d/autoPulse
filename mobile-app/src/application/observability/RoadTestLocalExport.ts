import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import type { RoadTestObservabilityReport } from './RoadTestObservabilityService';

export type RoadTestExportOutcome =
  | { readonly status: 'CANCELLED' }
  | { readonly status: 'EXPORTED'; readonly uri: string };

/**
 * Explicit post-session, user-initiated Android Storage Access Framework export.
 * The user chooses a local destination; no broad storage permission, automatic
 * upload or background export. Invalid/active/virtual sessions are rejected by
 * RoadTestObservabilityService before this function can be called.
 */
export async function exportRoadTestJson(
  report: RoadTestObservabilityReport,
  sessionId: string,
): Promise<RoadTestExportOutcome> {
  if (!sessionId || report.schemaVersion !== 1) throw new Error('ROAD_TEST_EXPORT_INVALID_REPORT');
  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return { status: 'CANCELLED' };

  const sessionHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sessionId);
  const generatedAt = new Date().toISOString();
  const filename = `autopulse-roadtest-${generatedAt.replace(/[-:.]/g, '').replace('T', '-').replace('Z', 'Z')}.json`;

  const json = JSON.stringify({
    schemaVersion: 1,
    purpose: 'ROAD_TEST_001_POST_SESSION_OBSERVABILITY',
    generatedAt,
    sessionRefSha256Prefix: sessionHash.slice(0, 16),
    scope: 'FULL_SESSION_UNSEGMENTED',
    privacy: 'SANITIZED_COMMANDS_NO_RAW_ECU_RESPONSES_NO_LOCATION_NO_VIN',
    limitations: [
      'Application command success is not a native BLE RF packet-loss metric.',
      'The V3 persisted codec reconstructs selected event fields; report provenance is local decode.',
      'Metrics are full-session only, not separate road/parked phase observations.',
      'A local export is not an APK identity or hardware certification.',
    ],
    report,
  });
  if (json.length > 6_000_000) throw new Error('ROAD_TEST_EXPORT_TOO_LARGE');

  const uri = await FileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    filename.replace(/\.json$/, ''),
    'application/json',
  );
  try {
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (error) {
    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch { /* best-effort cleanup */ }
    throw error;
  }
  return { status: 'EXPORTED', uri };
}
