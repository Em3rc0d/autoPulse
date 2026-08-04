import { useState, useEffect, useRef } from 'react';
import { Device, BleError, ScanMode } from 'react-native-ble-plx';
import { useBleManager } from './BleManagerProvider';

export interface DiscoveredDevice {
  id: string;
  name: string | null;
  rssi: number;
  lastSeen: number;
  serviceUUIDs: string[] | null;
  manufacturerData: string | null;
}

export function useAdapterDiscovery() {
  const { manager, requestPermissions, bluetoothState } = useBleManager();
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const devicesRef = useRef<{ [id: string]: DiscoveredDevice }>({});

  const startScan = async () => {
    if (!manager) {
      setError('BLE Manager not initialized');
      return;
    }

    if (bluetoothState !== 'PoweredOn') {
      setError(`Bluetooth is ${bluetoothState}. Please enable it.`);
      return;
    }

    const granted = await requestPermissions();
    if (!granted) {
      setError('Bluetooth permissions denied');
      return;
    }

    setError(null);
    setDevices([]);
    devicesRef.current = {};
    setIsScanning(true);

    manager.startDeviceScan(
      null, // No strict UUID filter to catch all potentially valid adapters
      { scanMode: ScanMode.Balanced },
      (bleError: BleError | null, device: Device | null) => {
        if (bleError) {
          setError(`Scan error: ${bleError.message}`);
          setIsScanning(false);
          return;
        }

        if (device) {
          // Dedupe and update RSSI/lastSeen
          const existing = devicesRef.current[device.id];
          const updated: DiscoveredDevice = {
            id: device.id,
            name: device.name || device.localName || (existing ? existing.name : 'Unknown Device'),
            rssi: device.rssi || (existing ? existing.rssi : -100),
            lastSeen: Date.now(),
            serviceUUIDs: device.serviceUUIDs || (existing ? existing.serviceUUIDs : null),
            manufacturerData: device.manufacturerData || (existing ? existing.manufacturerData : null),
          };

          devicesRef.current[device.id] = updated;

          // Rank devices: We want to show top 3.
          // Ranking logic:
          // 1. Devices with names containing 'OBD', 'ELM', 'VLINK' score high.
          // 2. RSSI
          const values = Object.values(devicesRef.current);
          values.sort((a, b) => {
            const aIsObd = a.name?.toUpperCase().match(/OBD|ELM|VLINK/);
            const bIsObd = b.name?.toUpperCase().match(/OBD|ELM|VLINK/);
            if (aIsObd && !bIsObd) return -1;
            if (!aIsObd && bIsObd) return 1;
            return b.rssi - a.rssi; // Higher RSSI is better
          });

          setDevices(values);
        }
      }
    );

    // Stop scan automatically after 15 seconds
    setTimeout(() => {
      stopScan();
    }, 15000);
  };

  const stopScan = () => {
    if (manager && isScanning) {
      manager.stopDeviceScan();
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [manager, isScanning]);

  return {
    devices: devices.slice(0, 3), // Max 3 devices as per rules
    isScanning,
    error,
    startScan,
    stopScan,
    bluetoothState
  };
}
