import { Device, Subscription } from 'react-native-ble-plx';
import { DiscoveredCharacteristic } from './probe/GattInspector';

export type AdapterMode = 'REAL_BLE' | 'VIRTUAL_PREVIEW' | 'REPLAY_WS';

export interface ActiveConnection {
  connectionHandleId: string;
  device: Device;
  writeCharacteristic: DiscoveredCharacteristic;
  receiveCharacteristic: DiscoveredCharacteristic;
  profileId?: string;
}

class ActiveBleConnectionController {
  private activeConnection: ActiveConnection | null = null;
  private listeners: ((conn: ActiveConnection | null) => void)[] = [];

  retainConnection(connection: ActiveConnection) {
    this.activeConnection = connection;
    this.notify();
  }

  releaseConnection() {
    this.activeConnection = null;
    this.notify();
  }

  getConnection(handleId: string): ActiveConnection | null {
    if (this.activeConnection && this.activeConnection.connectionHandleId === handleId) {
      return this.activeConnection;
    }
    return null;
  }

  subscribe(listener: (conn: ActiveConnection | null) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.activeConnection));
  }
}

export const activeBleController = new ActiveBleConnectionController();
