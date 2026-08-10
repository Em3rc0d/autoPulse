import { LiveSessionCoordinator } from '../LiveSessionCoordinator';
import { ObdSessionLease } from '../ports/ObdCommandExecutor';
import { BleRawTransport } from '../../../infrastructure/ble/real/BleRawTransport';
import { ObdCommandProcessor } from '../../../infrastructure/ble/real/ObdCommandProcessor';
import { ActiveConnection } from '../../../infrastructure/ble/ActiveBleConnectionController';
import { Device, Subscription } from 'react-native-ble-plx';

describe('Live Monitor Disconnect End-to-End Test', () => {
  let mockSubscription: Subscription;
  let mockDevice: any;
  let activeConn: ActiveConnection;
  let sessionRepo: any;
  let telemetryRepo: any;

  beforeEach(() => {
    mockSubscription = {
      remove: jest.fn()
    } as any;

    mockDevice = {
      monitorCharacteristicForService: jest.fn().mockReturnValue(mockSubscription),
      writeCharacteristicWithoutResponseForService: jest.fn().mockResolvedValue(undefined),
      writeCharacteristicWithResponseForService: jest.fn().mockResolvedValue(undefined),
    };

    activeConn = {
      connectionHandleId: 'live-disc-handle',
      device: mockDevice as Device,
      writeCharacteristic: { serviceUuid: 's1', uuid: 'c1', isWritableWithResponse: false } as any,
      receiveCharacteristic: { serviceUuid: 's1', uuid: 'c2', isNotifiable: true } as any
    };

    sessionRepo = {
      requestStop: jest.fn().mockResolvedValue(undefined),
      failSession: jest.fn().mockResolvedValue(undefined),
      interruptSession: jest.fn().mockResolvedValue(undefined)
    };

    telemetryRepo = {
      saveBlock: jest.fn().mockResolvedValue(undefined)
    };
  });

  it('proves BLE monitor errorCode=201 during Live polling results in session INTERRUPTED, lease released, and subscription removed', async () => {
    const transport = new BleRawTransport(activeConn);
    const executor = new ObdCommandProcessor(transport);

    const releaseFn = jest.fn().mockImplementation(() => {
      executor.disconnect();
    });

    const lease: ObdSessionLease = {
      executor,
      sourceType: 'REAL_BLE',
      release: releaseFn
    };

    const coordinator = new LiveSessionCoordinator(
      sessionRepo,
      telemetryRepo,
      'ws-1',
      'sess-1',
      ['010C']
    );

    const onUiUpdate = jest.fn();
    const onRecordingError = jest.fn();

    // Start Live Session
    coordinator.start(lease, onUiUpdate, onRecordingError);

    // Get monitor callback
    const rxCallback = mockDevice.monitorCharacteristicForService.mock.calls[0][2];

    // Emit BLE errorCode 201 mid-polling
    rxCallback({ errorCode: 201, message: 'Device disconnected' }, null);

    // Give asynchronous disconnect handler time to run
    await new Promise(r => setTimeout(r, 200));

    // 1. Session repository called interruptSession with REASON / CONNECTION_LOST
    expect(sessionRepo.interruptSession).toHaveBeenCalledWith('ws-1', 'sess-1', 'CONNECTION_LOST');

    // 2. Subscription.remove was called
    expect(mockSubscription.remove).toHaveBeenCalled();

    // 3. Lease release / disconnect was executed
    expect(executor.isConnected).toBe(false);
  });
});
