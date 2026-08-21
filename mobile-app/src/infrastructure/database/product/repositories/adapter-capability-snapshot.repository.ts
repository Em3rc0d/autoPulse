import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../schema';
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
    const [snapshot] = await this.db.insert(schema.obdAdapterCapabilitySnapshots).values({
      id: ProductIdGenerator.generate(),
      workspaceId: input.workspaceId,
      adapterInstanceId: input.adapterInstanceId,
      observedAt: input.observedAt,
      transportType: input.transportType,
      profileMatch: input.profileMatch,
      matchedProfileId: input.matchedProfileId,
      compatibilityGrade: input.compatibilityGrade,
      compatibilityReasonsJson: JSON.stringify(input.compatibilityReasons),
      writeCharacteristic: input.writeCharacteristic,
      receiveCharacteristic: input.receiveCharacteristic,
      writeMode: input.writeMode,
      receiveMode: input.receiveMode,
      commandUsed: input.commandUsed,
      sanitizedResponse: input.sanitizedResponse,
      latencyMs: input.latencyMs,
      echoDetected: input.echoDetected ? 1 : 0,
      promptDetected: input.promptDetected ? 1 : 0,
      timedOut: input.timedOut ? 1 : 0,
      disconnectObserved: input.disconnectObserved ? 1 : 0,
      createdAt: now,
    }).returning();

    return snapshot;
  }

  async latestForAdapter(workspaceId: string, adapterInstanceId: string) {
    return this.db.query.obdAdapterCapabilitySnapshots.findFirst({
      where: and(
        eq(schema.obdAdapterCapabilitySnapshots.workspaceId, workspaceId),
        eq(schema.obdAdapterCapabilitySnapshots.adapterInstanceId, adapterInstanceId),
      ),
      orderBy: [desc(schema.obdAdapterCapabilitySnapshots.observedAt)],
    });
  }
}
