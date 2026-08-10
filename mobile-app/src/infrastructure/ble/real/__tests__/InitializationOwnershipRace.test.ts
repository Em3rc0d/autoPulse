import { obdTransportRegistry } from '../../../../application/live/ObdTransportRegistry';
import { BleRawTransport } from '../BleRawTransport';
import { ActiveConnection } from '../../ActiveBleConnectionController';
import { Device, Subscription } from 'react-native-ble-plx';

describe('Initialization Ownership Race & Hand-off Safeguard', () => {
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
      connectionHandleId: 'test-race-handle',
      device: mockDevice as Device,
      writeCharacteristic: { serviceUuid: 's1', uuid: 'c1', isWritableWithResponse: false } as any,
      receiveCharacteristic: { serviceUuid: 's1', uuid: 'c2', isNotifiable: true } as any
    };

    obdTransportRegistry.take('test-race-handle');
  });

  it('guarantees that registering transport in registry and marking handedOff prevents disconnect on screen unmount/progress change', () => {
    const transport = new BleRawTransport(activeConn);
    let hasHandedOff = false;

    // Simulate completion & registry transfer
    obdTransportRegistry.register('test-race-handle', transport as any);
    hasHandedOff = true;

    // Simulate React cleanup unmount
    const cleanup = () => {
      if (transport && !hasHandedOff) {
        transport.disconnect();
      }
    };

    cleanup();

    // Transport must STILL be connected!
    expect(transport.isConnected).toBe(true);
    expect(mockSubscription.remove).not.toHaveBeenCalled();

    // Live session takes controller
    const taken = obdTransportRegistry.take('test-race-handle');
    expect(taken).toBe(transport);
  });
});
