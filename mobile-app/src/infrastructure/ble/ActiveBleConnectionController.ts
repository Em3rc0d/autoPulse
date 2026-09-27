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

const RECONNECT_TIMEOUT_MS = 5000;
const RECONNECT_SETTLE_MS = 250;

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

  /**
   * Rebuilds only the BLE transport for the workflow that already owns the lease.
   * This is deliberately bounded and does not issue ECU/OBD commands. The caller
   * must renegotiate the ELM/vehicle path after this returns.
   */
  async reconnectClaimedConnection(
    handleId: string,
    owner: Exclude<ConnectionOwner, 'IDLE'>,
  ): Promise<ActiveConnection | null> {
    const current = this.activeConnection;
    if (!current || current.connectionHandleId !== handleId || this.owner !== owner) return null;

    try {
      try {
        if (await current.device.isConnected()) {
          await current.device.cancelConnection();
        }
      } catch {
        // A stale native BLE handle is already equivalent to disconnected.
      }

      await new Promise(resolve => setTimeout(resolve, RECONNECT_SETTLE_MS));
      const device = await current.device.connect({ timeout: RECONNECT_TIMEOUT_MS });
      await device.discoverAllServicesAndCharacteristics();

      const recovered: ActiveConnection = { ...current, device };
      this.activeConnection = recovered;
      this.notify();
      return recovered;
    } catch (error) {
      console.warn('[ActiveBleConnectionController] Claimed transport recovery failed', error);
      await this.disconnectAndRelease();
      return null;
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
