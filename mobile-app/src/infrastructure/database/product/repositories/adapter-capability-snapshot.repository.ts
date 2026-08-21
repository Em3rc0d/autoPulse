import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../schema';
import { ProductIdGenerator } from '../uuidv7';
import { AdapterCapabilitySnapshot } from '../../../../domain/telemetry/probe/AdapterCapabilitySnapshot';
import { AdapterCompatibilityGrade, ProfileMatchType } from '../../../../domain/telemetry/probe/ProbeResult';

export class AdapterCapabilitySnapshotRepository {
  constructor(private db: ExpoSQLiteDatabase<typeof schema>) {}

  async append(
    workspaceId: string,
    adapterInstanceId: string,
    snapshot: AdapterCapabilitySnapshot,
  ) {
    const id = ProductIdGenerator.generate();
    const createdAt = Date.now();

    const [row] = await this.db.insert(schema.adapterCapabilitySnapshots).values({
      id,
      workspaceId,
      adapterInstanceId,
      schemaVersion: snapshot.schemaVersion,
      transport: snapshot.transport,
      deviceId: snapshot.deviceId,
      deviceName: snapshot.deviceName,
      rssi: snapshot.rssi,
      profileMatch: snapshot.profileMatch,
      compatibilityGrade: snapshot.compatibilityGrade,
      writeCharacteristicUuid: snapshot.channel.writeCharacteristicUUID,
      receiveCharacteristicUuid: snapshot.channel.receiveCharacteristicUUID,
      testedCombinationCount: snapshot.channel.testedCombinationCount,
      commandUsed: snapshot.behavior.commandUsed,
      sanitizedResponse: snapshot.behavior.sanitizedResponse,
      bytesWritten: snapshot.behavior.bytesWritten,
      latencyMs: snapshot.behavior.latencyMs,
      echoObserved: snapshot.behavior.echoObserved,
      promptObserved: snapshot.behavior.promptObserved,
      probeStage: snapshot.assessment.probeStage,
      failureReason: snapshot.assessment.failureReason,
      connectionRetained: snapshot.assessment.connectionRetained,
      assessedAt: snapshot.assessedAt,
      createdAt,
    }).returning();

    return row;
  }

  async getLatest(workspaceId: string, adapterInstanceId: string): Promise<AdapterCapabilitySnapshot | null> {
    const row = await this.db.query.adapterCapabilitySnapshots.findFirst({
      where: and(
        eq(schema.adapterCapabilitySnapshots.workspaceId, workspaceId),
        eq(schema.adapterCapabilitySnapshots.adapterInstanceId, adapterInstanceId),
      ),
      orderBy: [desc(schema.adapterCapabilitySnapshots.assessedAt), desc(schema.adapterCapabilitySnapshots.createdAt)],
    });

    if (!row) return null;

    return Object.freeze({
      schemaVersion: row.schemaVersion as '1.0',
      transport: row.transport as 'BLE',
      deviceId: row.deviceId,
      deviceName: row.deviceName,
      rssi: row.rssi,
      profileMatch: row.profileMatch as ProfileMatchType,
      compatibilityGrade: row.compatibilityGrade as AdapterCompatibilityGrade,
      assessedAt: row.assessedAt,
      channel: Object.freeze({
        writeCharacteristicUUID: row.writeCharacteristicUuid ?? undefined,
        receiveCharacteristicUUID: row.receiveCharacteristicUuid ?? undefined,
        testedCombinationCount: row.testedCombinationCount,
      }),
      behavior: Object.freeze({
        commandUsed: row.commandUsed ?? undefined,
        sanitizedResponse: row.sanitizedResponse ?? undefined,
        bytesWritten: row.bytesWritten ?? undefined,
        latencyMs: row.latencyMs ?? undefined,
        echoObserved: row.echoObserved ?? undefined,
        promptObserved: row.promptObserved ?? undefined,
      }),
      assessment: Object.freeze({
        probeStage: row.probeStage,
        failureReason: row.failureReason ?? undefined,
        connectionRetained: row.connectionRetained,
      }),
    });
  }
}
