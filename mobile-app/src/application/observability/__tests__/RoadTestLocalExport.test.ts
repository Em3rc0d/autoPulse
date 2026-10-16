import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { exportRoadTestJson } from '../RoadTestLocalExport';
import type { RoadTestObservabilityReport } from '../RoadTestObservabilityService';

jest.mock('expo-file-system', () => ({
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
  },
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8' },
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(),
}));
const requestDir = FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock;
const createFile = FileSystem.StorageAccessFramework.createFileAsync as jest.Mock;
const writeFile = FileSystem.writeAsStringAsync as jest.Mock;
const deleteFile = FileSystem.deleteAsync as jest.Mock;
const hash = Crypto.digestStringAsync as jest.Mock;
const report = {
  schemaVersion: 1, source: 'LOCAL_PERSISTED_BINARY_OBD2_V3',
  status: 'COMPLETED',
  metrics: { schemaVersion: 1, safeEvents: [{command:'010C',values:[{signal:'RPM',value:800,unit:'RPM'}]}] },
  integrity: { expectedBlocks:1, foundBlocks:1, issues:[] },
} as unknown as RoadTestObservabilityReport;

beforeEach(() => {
  jest.clearAllMocks();
  hash.mockResolvedValue('a'.repeat(64));
  createFile.mockResolvedValue('content://picked/output.json');
  writeFile.mockResolvedValue(undefined);
  deleteFile.mockResolvedValue(undefined);
});

describe('post-session opt-in local Storage Access Framework export', () => {
  it('does nothing when user declines folder access', async () => {
    requestDir.mockResolvedValue({granted:false});
    await expect(exportRoadTestJson(report, 'private-session-id')).resolves.toEqual({status:'CANCELLED'});
    expect(createFile).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('writes sanitized JSON only into a user-picked destination, never raw IDs', async () => {
    requestDir.mockResolvedValue({granted:true,directoryUri:'content://picked'});
    await expect(exportRoadTestJson(report, 'private-session-id')).resolves.toEqual({
      status:'EXPORTED',uri:'content://picked/output.json',
    });
    expect(createFile).toHaveBeenCalledWith(
      'content://picked',
      expect.stringMatching(/^autopulse-roadtest-/),
      'application/json',
    );
    expect(writeFile).toHaveBeenCalledWith('content://picked/output.json', expect.any(String), {encoding:'utf8'});
    const json=writeFile.mock.calls[0][1] as string;
    expect(json).not.toContain('private-session-id');
    const doc=JSON.parse(json);
    expect(doc.sessionRefSha256Prefix).toBe('a'.repeat(16));
    expect(doc.report.metrics.safeEvents[0].values[0].value).toBe(800);
    expect(doc.scope).toBe('FULL_SESSION_UNSEGMENTED');
  });

  it('cleans up an incomplete file when Android document-provider write fails', async () => {
    requestDir.mockResolvedValue({granted:true,directoryUri:'content://picked'});
    writeFile.mockRejectedValueOnce(new Error('SAF_WRITE_FAILED'));
    await expect(exportRoadTestJson(report,'private')).rejects.toThrow('SAF_WRITE_FAILED');
    expect(deleteFile).toHaveBeenCalledWith('content://picked/output.json',{idempotent:true});
  });
});
