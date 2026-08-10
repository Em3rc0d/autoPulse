import { obdTransportRegistry } from '../../../../application/live/ObdTransportRegistry';
import { BleRawTransport } from '../BleRawTransport';
import { ObdCommandProcessor } from '../ObdCommandProcessor';
import { ActiveConnection } from '../../ActiveBleConnectionController';
import { Device, Subscription } from 'react-native-ble-plx';

describe('Transport Handoff (Initialization to Live)', () => {
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
      connectionHandleId: 'test-handle',
      device: mockDevice as Device,
      writeCharacteristic: { serviceUuid: 's1', uuid: 'c1', isWritableWithResponse: false } as any,
      receiveCharacteristic: { serviceUuid: 's1', uuid: 'c2', isNotifiable: true } as any
    };

    // Clean registry
    obdTransportRegistry.take('test-handle');
  });

  it('maintains exactly ONE monitor subscription across Initialization and Live, and cleans up exactly ONCE', async () => {
    // ------------------------------------------------------------------------
    // 1. Initialization (Simulating InitializationScreen success)
    // ------------------------------------------------------------------------
    const initTransport = new BleRawTransport(activeConn);
    const initController = new ObdCommandProcessor(initTransport);

    // Initial creation should trigger exactly 1 monitor call
    expect(mockDevice.monitorCharacteristicForService).toHaveBeenCalledTimes(1);
    expect(mockSubscription.remove).not.toHaveBeenCalled();

    // Simulating success: register the proven controller
    obdTransportRegistry.register('test-handle', initController);

    // Initialization successful, DO NOT DISCONNECT.
    expect(mockSubscription.remove).toHaveBeenCalledTimes(0);

    // ------------------------------------------------------------------------
    // 2. Navigation & Live (Simulating LiveSessionScreen)
    // ------------------------------------------------------------------------
    const liveController = obdTransportRegistry.take('test-handle');
    
    // Hard failure if missing
    expect(liveController).toBeTruthy();
    expect(liveController).toBe(initController); // Must be the EXACT same instance

    // Registry must be empty now
    expect(obdTransportRegistry.take('test-handle')).toBeNull();

    // Simulating Live command
    // Set up a mock response from BLE
    const rxCallback = mockDevice.monitorCharacteristicForService.mock.calls[0][2];
    
    const commandPromise = liveController!.executeCommand({
      command: '010C',
      timeoutMs: 1000,
      family: 'OBD_MODE_01',
      id: 'test-cmd'
    });

    // Feed the response
    rxCallback(null, { value: Buffer.from('41 0C 0F A0\r\r>', 'ascii').toString('base64') });
    
    const result = await commandPromise;
    expect(result.status).toBe('SUCCESS_DECODED');

    // Monitor should STILL only have been called ONCE total
    expect(mockDevice.monitorCharacteristicForService).toHaveBeenCalledTimes(1);
    
    // ------------------------------------------------------------------------
    // 3. Stop / Disconnect (Simulating LiveSessionScreen unmount or stop)
    // ------------------------------------------------------------------------
    liveController!.disconnect();

    // Verify EXACTLY one removal
    expect(mockSubscription.remove).toHaveBeenCalledTimes(1);
  });
});
