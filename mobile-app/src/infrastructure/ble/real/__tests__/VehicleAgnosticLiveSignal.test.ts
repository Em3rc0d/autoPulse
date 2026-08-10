import { RealObdInitialization } from '../RealObdInitialization';
import { resolveDrivingModeSignals } from '../../../../domain/telemetry/DrivingModes';
import { OBD_SIGNAL_REGISTRY } from '../../../../domain/telemetry/ObdSignalRegistry';

describe('Vehicle-Agnostic Live Signal Selection', () => {
  let mockController: any;
  let onProgress: jest.Mock;

  beforeEach(() => {
    onProgress = jest.fn();
    mockController = {
      isConnected: true,
      executeCommand: jest.fn()
    };
  });

  it('successfully initializes and selects signals when legacy core PIDs (RPM, Speed, Coolant, Voltage) are unavailable but non-legacy PIDs (Engine Load, MAP) are supported', async () => {
    // Simulate ECU that supports 0104 (Engine Load) and 010B (MAP), but NO 010C/010D/0105/0142
    mockController.executeCommand.mockImplementation(async (req: any) => {
      if (req.command === '0100') {
        return {
          status: 'SUCCESS_DECODED',
          decodedValues: [{ type: 'BITMAP', value: ['0104', '010B'] }],
          rawResponse: { accumulatedText: '41 00 10 20 00 00' }
        };
      }
      if (['010C', '010D', '0105', '0142'].includes(req.command)) {
        return { status: 'NO_DATA', errors: ['NO DATA'], rawResponse: { accumulatedText: 'NO DATA' } };
      }
      return { status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } };
    });

    const init = new RealObdInitialization(mockController, onProgress);
    const snapshot = await init.execute();

    // 1. Initialization must succeed
    expect(snapshot.initializationSuccessful).toBe(true);
    expect(snapshot.supportedPids).toContain('0104');
    expect(snapshot.supportedPids).toContain('010B');

    // 2. Resolve available signals mapping snapshot.supportedPids to OBD_SIGNAL_REGISTRY
    const availableSignalIds = new Set<string>();
    snapshot.supportedPids.forEach(pid => {
      const entry = Object.values(OBD_SIGNAL_REGISTRY).find(s => s.command === pid);
      if (entry) availableSignalIds.add(entry.canonicalId);
    });

    expect(availableSignalIds.has('ENGINE_LOAD')).toBe(true);
    expect(availableSignalIds.has('MAP')).toBe(true);

    // 3. Resolve driving mode signals for GENERAL profile
    const resolvedSignals = resolveDrivingModeSignals('GENERAL', availableSignalIds, 4);

    // Should resolve ENGINE_LOAD and MAP despite not being in GENERAL preferred list originally
    expect(resolvedSignals).toContain('ENGINE_LOAD');
    expect(resolvedSignals).toContain('MAP');
    expect(resolvedSignals.length).toBeGreaterThan(0);
  });
});
