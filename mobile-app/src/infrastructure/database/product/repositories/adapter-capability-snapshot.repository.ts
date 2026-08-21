import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../schema';
import { obdAdapterCapabilitySnapshots } from '../schema/adapters';
import { ProductIdGenerator } from '../uuidv7';
import type { AdapterCompatibilityGrade } from '../../../../domain/telemetry/probe/AdapterCompatibilityAssessment';
import type { ProbeResult, ProfileMatchType } from '../../../../domain/telemetry/probe/ProbeResult';

export interface AppendAdapterCapabilitySnapshotInput {
  workspaceId: string;
  adapterInstanceId: string;
  observedAt: number;
  transportType: 'BLE';
  profileMatch: ProfileMatchType;
  matchedProfileId?: string;
  compatibilityGrade: AdapterCompatibilityGrade;
  compatibilityReasons: string[];
  writeCharacteristic?: string;
  receiveCharacteristic?: string;
  writeMode?: 'WITH_RESPONSE' | 'WITHOUT_RESPONSE';
  receiveMode?: 'NOTIFY' | 'INDICATE' | 'READ';
  commandUsed?: string;
  sanitizedResponse?: string;
  latencyMs?: number;
  echoDetected: boolean;
  promptDetected: boolean;
  timedOut: boolean;
  disconnectObserved: boolean;
}

export class AdapterCapabilitySnapshotRepository {
  constructor(private db: ExpoSQLiteDatabase<typeof schema>) {}

  async appendProbeResult(workspaceId: string, adapterInstanceId: string, result: ProbeResult) {
    if (!result.compatibilityGrade) {
      throw new Error('ADAPTER_COMPATIBILITY_ASSESSMENT_MISSING');
    }

    return this.append({
      workspaceId,
      adapterInstanceId,
      observedAt: result.finishedAt,
      transportType: 'BLE',
      profileMatch: result.profileMatch,
      matchedProfileId: result.matchedProfileId,
      compatibilityGrade: result.compatibilityGrade,
      compatibilityReasons: result.compatibilityReasons || [],
      writeCharacteristic: result.writeCharacteristicUUID,
      receiveCharacteristic: result.receiveCharacteristicUUID,
      writeMode: result.writeMode,
      receiveMode: result.receiveMode,
      commandUsed: result.commandUsed,
      sanitizedResponse: result.sanitizedResponse,
      latencyMs: result.latencyMs,
      echoDetected: Boolean(result.echoDetected),
      promptDetected: Boolean(result.promptDetected),
      timedOut: Boolean(result.timedOut),
      disconnectObserved: Boolean(result.disconnectObserved),
    });
  }

  async append(input: AppendAdapterCapabilitySnapshotInput) {
    const now = Date.now();
    const [snapshot] = await this.db.insert(obdAdapterCapabilitySnapshots).values({
      id: ProductIdGenerator.generate(),
      workspaceId: input.workspaceId,
      adapterInstanceId: input.adapterInstanceId,
      observedAt: input.observedAt,
      transportType: input.transportType,
      profileMatch: input.profileMatch,
      matchedProfileId: input.matchedProfileId ?? null,
      compatibilityGrade: input.compatibilityGrade,
      compatibilityReasonsJson: JSON.stringify(input.compatibilityReasons),
      writeCharacteristic: input.writeCharacteristic ?? null,
      receiveCharacteristic: input.receiveCharacteristic ?? null,
      writeMode: input.writeMode ?? null,
      receiveMode: input.receiveMode ?? null,
      commandUsed: input.commandUsed ?? null,
      sanitizedResponse: input.sanitizedResponse ?? null,
      latencyMs: input.latencyMs ?? null,
      echoDetected: input.echoDetected ? 1 : 0,
      promptDetected: input.promptDetected ? 1 : 0,
      timedOut: input.timedOut ? 1 : 0,
      disconnectObserved: input.disconnectObserved ? 1 : 0,
      createdAt: now,
    }).returning();

    return snapshot;
  }

  async latestForAdapter(workspaceId: string, adapterInstanceId: string) {
    const rows = await this.db.select()
      .from(obdAdapterCapabilitySnapshots)
      .where(and(
        eq(obdAdapterCapabilitySnapshots.workspaceId, workspaceId),
        eq(obdAdapterCapabilitySnapshots.adapterInstanceId, adapterInstanceId),
      ))
      .orderBy(desc(obdAdapterCapabilitySnapshots.observedAt))
      .limit(1);

    return rows[0];
  }
}
