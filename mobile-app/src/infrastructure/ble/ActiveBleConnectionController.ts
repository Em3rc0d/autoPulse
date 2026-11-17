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
  // Every lease transition invalidates pending native operations from the
  // previous owner. The native BLE API does not automatically cancel promises
  // when their originating React screen unmounts.
  private leaseGeneration = 0;
  private teardownInFlight = false;
  private listeners: ((conn: ActiveConnection | null) => void)[] = [];

  retainConnection(connection: ActiveConnection, owner: ConnectionOwner = 'IDLE') {
    if (this.teardownInFlight) throw new Error('BLE_TEARDOWN_PENDING');
    if (this.activeConnection && this.owner !== 'IDLE' && (
      this.activeConnection.connectionHandleId !== connection.connectionHandleId || this.owner !== owner
    )) {
      throw new Error('BLE_CONNECTION_LEASED');
    }
    if (this.activeConnection && this.owner === 'IDLE' &&
        this.activeConnection.device.id !== connection.device.id) {
      throw new Error('BLE_IDLE_CONNECTION_REQUIRES_DISCONNECT');
    }
    this.activeConnection = connection;
    this.owner = owner;
    this.leaseGeneration++;
    this.notify();
  }

  claimConnection(handleId: string, owner: Exclude<ConnectionOwner, 'IDLE'>): ActiveConnection | null {
    if (this.teardownInFlight) return null;
    if (!this.activeConnection || this.activeConnection.connectionHandleId !== handleId) return null;
    if (this.owner !== 'IDLE' && this.owner !== owner) return null;
    if (this.owner !== owner) this.leaseGeneration++;
    this.owner = owner;
    return this.activeConnection;
  }

  releaseClaim(owner: Exclude<ConnectionOwner, 'IDLE'>) {
    if (this.owner === owner) {
      this.owner = 'IDLE';
      this.leaseGeneration++;
    }
  }

  /**
   * Rebuilds only the BLE transport for the workflow that already owns the lease.
   * This is deliberately bounded and does not issue ECU/OBD commands. The caller
   * must renegotiate the ELM/vehicle path after this returns.
   */
  async reconnectClaimedConnection(
    handleId: string,
    owner: Exclude<ConnectionOwner, 'IDLE'>,
    isCancelled: () => boolean = () => false,
  ): Promise<ActiveConnection | null> {
    const current = this.activeConnection;
    if (!current || current.connectionHandleId !== handleId ||
        this.owner !== owner || this.teardownInFlight || isCancelled()) return null;
    const generation = this.leaseGeneration;
    const stillOwner = () => !this.teardownInFlight &&
      this.leaseGeneration === generation &&
      this.activeConnection === current &&
      this.owner === owner &&
      !isCancelled();

    try {
      // Each await creates an opportunity for Stop, Cancel or another screen
      // to invalidate this lease. Never commit a connection after invalidation.
      let connected = false;
      try {
        connected = await current.device.isConnected();
      } catch {
        // A stale native BLE handle may already be disconnected.
      }
      if (!stillOwner()) return null;
      if (connected) await current.device.cancelConnection();
      if (!stillOwner()) return null;

      await new Promise(resolve => setTimeout(resolve, RECONNECT_SETTLE_MS));
      if (!stillOwner()) return null;
      const device = await current.device.connect({ timeout: RECONNECT_TIMEOUT_MS });
      if (!stillOwner()) return null;
      await device.discoverAllServicesAndCharacteristics();
      if (!stillOwner()) return null;

      const recovered: ActiveConnection = { ...current, device };
      this.activeConnection = recovered;
      this.leaseGeneration++;
      this.notify();
      return recovered;
    } catch (error) {
      console.warn('[ActiveBleConnectionController] Claimed transport recovery failed', error);
      // A late error must NEVER tear down a connection now owned by Live or
      // another Check attempt.
      if (stillOwner()) await this.disconnectAndRelease();
      return null;
    }
  }

  releaseConnection() {
    this.activeConnection = null;
    this.owner = 'IDLE';
    this.leaseGeneration++;
    this.notify();
  }

  async disconnectAndRelease() {
    const connection = this.activeConnection;
    this.activeConnection = null;
    this.owner = 'IDLE';
    this.leaseGeneration++;
    // Refuse new leases until native disconnect has settled, even though the
    // JS owner has already been released.
    if (connection) this.teardownInFlight = true;
    this.notify();

    if (!connection) return;
    try {
      if (await connection.device.isConnected()) {
        await connection.device.cancelConnection();
      }
    } catch (error) {
      console.warn('[ActiveBleConnectionController] Physical disconnect failed', error);
    } finally {
      this.teardownInFlight = false;
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
    this.listeners.forEach(listener => {
      try {
        listener(this.activeConnection);
      } catch (error) {
        // A failed UI observer must not interrupt the BLE owner transition.
        console.warn('[ActiveBleConnectionController] Listener failed', error);
      }
    });
  }
}

export const activeBleController = new ActiveBleConnectionController();
