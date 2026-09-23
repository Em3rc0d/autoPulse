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

  claimConnection(handleId: string, owner: Exclude<ConnectionOwner, 'IDLE'>): ActiveConnection | null {
    if (!this.activeConnection || this.activeConnection.connectionHandleId !== handleId) return null;
    if (this.owner !== 'IDLE' && this.owner !== owner) return null;
    this.owner = owner;
    return this.activeConnection;
  }

  releaseClaim(owner: Exclude<ConnectionOwner, 'IDLE'>) {
    if (this.owner === owner) this.owner = 'IDLE';
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
      if (await connection.device.isConnected()) {
        await connection.device.cancelConnection();
      }
    } catch (error) {
      console.warn('[ActiveBleConnectionController] Physical disconnect failed', error);
    }
  }

  getConnection(handleId: string): ActiveConnection | null {
    return this.activeConnection?.connectionHandleId === handleId ? this.activeConnection : null;
  }

  getActiveConnection(): ActiveConnection | null {
    return this.activeConnection;
  }

  getOwner(): ConnectionOwner {
    return this.owner;
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
