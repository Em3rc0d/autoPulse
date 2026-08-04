import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { BleManager, Device, BleError, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

interface BleContextType {
  manager: BleManager | null;
  bluetoothState: State;
  requestPermissions: () => Promise<boolean>;
  permissionsGranted: boolean;
}

const BleContext = createContext<BleContextType | null>(null);

export function BleManagerProvider({ children }: { children: React.ReactNode }) {
  const [manager, setManager] = useState<BleManager | null>(null);
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const isManagerCreated = useRef(false);

  useEffect(() => {
    if (!isManagerCreated.current) {
      try {
        const bleManager = new BleManager();
        setManager(bleManager);
        isManagerCreated.current = true;

        const subscription = bleManager.onStateChange((state) => {
          setBluetoothState(state);
        }, true);

        return () => {
          subscription.remove();
          bleManager.destroy();
          isManagerCreated.current = false;
        };
      } catch (e) {
        console.warn(
          "⚠️ BLE Native Module not found. The app will not crash, but BLE features will be disabled.\n" +
          "If you need BLE, make sure you are NOT running in Expo Go. You must compile the app natively using `npx expo run:android`."
        );
      }
    }
  }, []);



  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if ((Platform.Version as number) >= 31) {
        // Android 12+
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const granted =
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;

        setPermissionsGranted(granted);
        return granted;
      } else {
        // Android 11 and lower
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setPermissionsGranted(granted);
        return granted;
      }
    } else {
      setPermissionsGranted(true);
      return true;
    }
  };

  return (
    <BleContext.Provider value={{ manager, bluetoothState, requestPermissions, permissionsGranted }}>
      {children}
    </BleContext.Provider>
  );
}

export function useBleManager() {
  const context = useContext(BleContext);
  if (!context) {
    throw new Error('useBleManager must be used within a BleManagerProvider');
  }
  return context;
}
