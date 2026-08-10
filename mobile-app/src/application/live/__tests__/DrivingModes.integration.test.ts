import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../../../infrastructure/database/product/schema';
import { eq } from 'drizzle-orm';
import * as path from 'path';
import { ProductIdGenerator } from '../../../infrastructure/database/product/uuidv7';
import { LiveSessionRepository } from '../../../infrastructure/database/product/repositories/live-session.repository';
import { resolveDrivingModeSignals } from '../../../domain/telemetry/DrivingModes';
import { OBD_SIGNAL_REGISTRY } from '../../../domain/telemetry/ObdSignalRegistry';

describe('Driving Modes Integration Test', () => {
  let dbName: string;
  let workspaceId: string;
  let vehicleId: string;
  let sessionId: string;
  let db: any;
  let sqlite: any;
  let sessionRepo: LiveSessionRepository;

  beforeAll(async () => {
    dbName = `autopulse_test_modes_${Date.now()}.db`;
    sqlite = createClient({ url: `file:${dbName}` });
    
    await sqlite.execute('PRAGMA foreign_keys = ON;');
    await sqlite.execute('PRAGMA journal_mode = WAL;');
    db = drizzle(sqlite, { schema });
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../infrastructure/database/product/migrations') });
    
    sessionRepo = new LiveSessionRepository(db);

    const now = Date.now();
    workspaceId = ProductIdGenerator.generate();
    vehicleId = ProductIdGenerator.generate();

    await db.insert(schema.workspaces).values({ id: workspaceId, name: 'Test WS', createdAt: now, updatedAt: now });
    await db.insert(schema.operators as any).values({ id: 'op-1', workspaceId, name: 'Test Op', createdAt: now, updatedAt: now });
    await db.insert(schema.vehicles).values({ id: vehicleId, workspaceId, alias: 'My Car', createdAt: now, updatedAt: now });
    await db.insert(schema.obdAdapterInstances as any).values({ id: 'ad-1', workspaceId, platformDeviceId: '00:11', firstSeen: now, lastSeen: now, trustState: 'TRUSTED', createdAt: now, updatedAt: now });

    // Seed all OBD signals into DB so they can be retrieved
    for (const [key, def] of Object.entries(OBD_SIGNAL_REGISTRY)) {
      if (def.command) {
        await sqlite.execute({
          sql: 'INSERT OR IGNORE INTO obd_parameter_definitions (id, namespace, service, parameter_identifier, technical_name, request_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [def.command, 'MODE_01', 1, parseInt(def.command.replace('01', ''), 16) || 0, def.canonicalId, '1.0', now]
        });
        await sqlite.execute({
          sql: 'INSERT OR IGNORE INTO signal_definitions (id, parameter_definition_id, signal_key, name, canonical_unit, numeric_type, decoder_key, decoder_version, scale, offset, precision, default_priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [def.command, def.command, def.canonicalId, def.canonicalId, def.unit, 'float', `MODE01_${def.command}`, '1.0', 1, 0, 0, 'HIGH', now]
        });
      }
    }
  });

  afterAll(() => {
    sqlite.close();
  });

  it('correctly resolves and persists PERFORMANCE mode signals', async () => {
    const monitoringProfile = 'PERFORMANCE';
    sessionId = await sessionRepo.createSession(workspaceId, vehicleId, 'op-1', 'ad-1', monitoringProfile);
    
    await sessionRepo.beginPreparation(workspaceId, sessionId);

    // Simulate vehicle that supports everything
    const availableSignalIds = new Set<string>(Object.keys(OBD_SIGNAL_REGISTRY));

    const resolvedCanonicalIds = resolveDrivingModeSignals(
      monitoringProfile,
      availableSignalIds,
      4
    );

    expect(resolvedCanonicalIds).toEqual(['ENGINE_RPM', 'ENGINE_LOAD', 'THROTTLE_POSITION', 'MAP']);

    const liveSupportedPids = resolvedCanonicalIds.map(cId => OBD_SIGNAL_REGISTRY[cId]?.command).filter(c => !!c) as string[];
    expect(liveSupportedPids).toEqual(['010C', '0104', '0111', '010B']);
    
    // Create the dummy snapshot
    const signals = resolvedCanonicalIds.map((canonicalId, index) => {
      const registryEntry = OBD_SIGNAL_REGISTRY[canonicalId];
      const pidStr = registryEntry.command || '';
      return {
        signalDefinitionId: pidStr,
        parameterDefinitionId: pidStr,
        service: 1,
        pid: 0,
        targetEcu: 0,
        effectiveUnit: registryEntry.unit,
        numericType: 'float',
        scale: 1,
        offset: 0,
        precision: 0,
        decoderVersion: '1.0',
        decoderKey: 'KEY',
        origin: 'BITMAP',
        priority: 'HIGH',
        targetPeriodMs: 250,
        indexInBlock: index,
        supportState: 'SUPPORTED',
        localTargetIndex: index,
        localSignalIndex: index
      };
    });

    await db.insert(schema.vehicleCapabilitySnapshots as any).values({ 
      id: 'snap-1', 
      workspaceId, 
      vehicleId, 
      adapterInstanceId: 'ad-1', 
      compatibilityProfileVersion: '1.0',
      discoveredAt: Date.now(),
      protocolCode: 'ISO', 
      decoderCatalogVersion: '1.0',
      discoveryStatus: 'COMPLETED',
      rawDiscoveryHash: 'hash',
      createdAt: Date.now()
    });
    await sessionRepo.attachCapabilitySnapshot(workspaceId, sessionId, 'snap-1', '1.0', 'ISO', 'REAL_BLE');
    await sessionRepo.attachSignalSnapshots(workspaceId, sessionId, signals);
    await sessionRepo.activateSession(workspaceId, sessionId);

    // Verify DB
    const session = await sessionRepo.getSessionById(workspaceId, sessionId);
    expect(session?.monitoringProfile).toBe('PERFORMANCE');

    const snapshots = await db.select().from(schema.liveSessionSignalSnapshots).where(eq(schema.liveSessionSignalSnapshots.sessionId, sessionId));
    expect(snapshots.length).toBe(4);
    expect(snapshots.map((s: any) => s.parameterDefinitionId)).toEqual(['010C', '0104', '0111', '010B']);
  });

  it('correctly defaults to GENERAL for legacy sessions', async () => {
    // A legacy session wouldn't have a monitoringProfile passed
    const legacySessionId = await sessionRepo.createSession(workspaceId, vehicleId, 'op-1', 'ad-1');
    const session = await sessionRepo.getSessionById(workspaceId, legacySessionId);
    expect(session?.monitoringProfile).toBe('GENERAL');
  });
});
