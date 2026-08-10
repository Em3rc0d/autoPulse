import { BleRawTransport } from '../BleRawTransport';
import { ObdCommandProcessor } from '../ObdCommandProcessor';
import { RealObdInitialization } from '../RealObdInitialization';
import { ActiveConnection } from '../../ActiveBleConnectionController';
import { Device, Subscription } from 'react-native-ble-plx';

describe('BLE Monitor Disconnect Propagation Integration', () => {
  let mockSubscription: Subscription;
  let mockDevice: any;
  let activeConn: ActiveConnection;

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
      connectionHandleId: 'test-handle-disc',
      device: mockDevice as Device,
      writeCharacteristic: { serviceUuid: 's1', uuid: 'c1', isWritableWithResponse: false } as any,
      receiveCharacteristic: { serviceUuid: 's1', uuid: 'c2', isNotifiable: true } as any
    };
  });

  it('propagates BLE errorCode 201 through ElmAccumulator, BleRawTransport, ObdCommandProcessor to RealObdInitialization', async () => {
    const transport = new BleRawTransport(activeConn);
    const controller = new ObdCommandProcessor(transport);

    // Get monitor callback
    const rxCallback = mockDevice.monitorCharacteristicForService.mock.calls[0][2];

    const init = new RealObdInitialization(controller as any, jest.fn());
    const initPromise = init.execute();

    // Simulate BLE notification emitting errorCode 201 during ATZ command
    rxCallback({ errorCode: 201, message: 'Device disconnected' }, null);

    const snapshot = await initPromise;

    // 1. BleRawTransport must set isConnected = false
    expect(transport.isConnected).toBe(false);
    expect(controller.isConnected).toBe(false);

    // 2. RealObdInitialization short-circuits and fails with DISCONNECTED
    expect(snapshot.initializationSuccessful).toBe(false);
    expect(snapshot.failureReason).toContain('DISCONNECTED');
  });
});
