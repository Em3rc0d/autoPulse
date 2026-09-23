import { Device } from 'react-native-ble-plx';
import { DiscoveredCharacteristic } from './probe/GattInspector';

export type AdapterMode = 'REAL_BLE' | 'VIRTUAL_PREVIEW' | 'REPLAY_WS';
export type ConnectionOwner = 'IDLE' | 'LIVE' | 'CHECK';

export interface ActiveConnection {
  connectionHandleId: string;
  device: Device;
  writeCharacteristic: DiscoveredCharacteristic;
  receiveCharacteristic: DiscoveredCharacteristic;
  profileId?: string;
  vehicleId?: string;
  adapterInstanceId?: string;
}

class ActiveBleConnectionController {
  private activeConnection: ActiveConnection | null = null;
  private owner: ConnectionOwner = 'IDLE';
  private listeners: ((conn: ActiveConnection | null) => void)[] = [];

  retainConnection(connection: ActiveConnection, owner: ConnectionOwner = 'IDLE') {
    this.activeConnection = connection;
    this.owner = owner;
    this.notify();
  }

  getConnection(handleId: string): ActiveConnection | null {
    if (this.activeConnection && this.activeConnection.connectionHandleId === handleId) {
      return this.activeConnection;
    }
    return null;
  }

  getActiveConnection(): ActiveConnection | null {
    return this.activeConnection;
  }

  getOwner(): ConnectionOwner {
    return this.owner;
  }

  claimConnection(handleId: string, owner: Exclude<ConnectionOwner, 'IDLE'>): ActiveConnection | null {
    const connection = this.getConnection(handleId);
    if (!connection) return null;
    if (this.owner !== 'IDLE' && this.owner !== owner) return null;
    this.owner = owner;
    this.notify();
    return connection;
  }

  releaseLease(owner: Exclude<ConnectionOwner, 'IDLE'>) {
    if (this.owner === owner) {
      this.owner = 'IDLE';
      this.notify();
    }
  }

  releaseConnection() {
    this.activeConnection = null;
    this.owner = 'IDLE';
    this.notify();
  }

  async disconnectAndRelease() {
    const connection = this.activeConnection;
    this.activeConnection = null;
    this.owner = 'IDLE';
    this.notify();
    if (!connection) return;
    try {
      const connected = await connection.device.isConnected();
      if (connected) await connection.device.cancelConnection();
    } catch {
      // The link is already gone or Android has disposed it. The broker is clean.
    }
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
