import { Device, Service, Characteristic } from 'react-native-ble-plx';

export interface DiscoveredCharacteristic {
  uuid: string;
  serviceUuid: string;
  isReadable: boolean;
  isWritableWithResponse: boolean;
  isWritableWithoutResponse: boolean;
  isNotifiable: boolean;
  isIndicatable: boolean;
}

export interface DiscoveredService {
  uuid: string;
  characteristics: DiscoveredCharacteristic[];
}

export interface GattInventory {
  deviceId: string;
  deviceName: string | null;
  rssi: number | null;
  mtu: number;
  services: DiscoveredService[];
}

export class GattInspector {
  static async inspect(device: Device): Promise<GattInventory> {
    // Requires device to be already connected and discoverAllServicesAndCharacteristics to be called
    const services = await device.services();
    const inventoryServices: DiscoveredService[] = [];

    for (const service of services) {
      const characteristics = await service.characteristics();
      const inventoryChars: DiscoveredCharacteristic[] = characteristics.map(c => ({
        uuid: c.uuid,
        serviceUuid: service.uuid,
        isReadable: c.isReadable,
        isWritableWithResponse: c.isWritableWithResponse,
        isWritableWithoutResponse: c.isWritableWithoutResponse,
        isNotifiable: c.isNotifiable,
        isIndicatable: c.isIndicatable
      }));

      inventoryServices.push({
        uuid: service.uuid,
        characteristics: inventoryChars
      });
    }

    return {
      deviceId: device.id,
      deviceName: device.name || device.localName,
      rssi: device.rssi,
      mtu: device.mtu,
      services: inventoryServices
    };
  }
}
