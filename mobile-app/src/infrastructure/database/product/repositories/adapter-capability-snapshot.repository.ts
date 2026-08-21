import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../schema';
import { obdAdapterCapabilitySnapshots } from '../schema/adapters';
import { ProductIdGenerator } from '../uuidv7';
import type { AdapterCompatibilityGrade } from '../../../../domain/telemetry/probe/AdapterCompatibilityAssessment';
import type { ProbeResult, ProfileMatchType } from '../../../../domain/telemetry/probe/ProbeResult';

export const ADAPTER_EVIDENCE_SCHEMA_VERSION = '1.0';

export interface AdapterCapabilityEvidenceV1 {
  matchedProfileId: string | null;
  writeCharacteristic: string | null;
  receiveCharacteristic: string | null;
  writeMode: 'WITH_RESPONSE' | 'WITHOUT_RESPONSE' | null;
  receiveMode: 'NOTIFY' | 'INDICATE' | 'READ' | null;
  commandUsed: string | null;
  sanitizedResponse: string | null;
  latencyMs: number | null;
  echoDetected: boolean;
  promptDetected: boolean;
  timedOut: boolean;
  disconnectObserved: boolean;
}

export interface AppendAdapterCapabilitySnapshotInput {
  workspaceId: string;
  adapterInstanceId: string;
  observedAt: number;
  transportType: 'BLE';
  profileMatch: ProfileMatchType;
  compatibilityGrade: AdapterCompatibilityGrade;
  compatibilityReasons: string[];
  evidence: AdapterCapabilityEvidenceV1;
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
      compatibilityGrade: result.compatibilityGrade,
      compatibilityReasons: result.compatibilityReasons || [],
      evidence: {
        matchedProfileId: result.matchedProfileId ?? null,
        writeCharacteristic: result.writeCharacteristicUUID ?? null,
        receiveCharacteristic: result.receiveCharacteristicUUID ?? null,
        writeMode: result.writeMode ?? null,
        receiveMode: result.receiveMode ?? null,
        commandUsed: result.commandUsed ?? null,
        sanitizedResponse: result.sanitizedResponse ?? null,
        latencyMs: result.latencyMs ?? null,
        echoDetected: Boolean(result.echoDetected),
        promptDetected: Boolean(result.promptDetected),
        timedOut: Boolean(result.timedOut),
        disconnectObserved: Boolean(result.disconnectObserved),
      },
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
      compatibilityGrade: input.compatibilityGrade,
      compatibilityReasonsJson: JSON.stringify(input.compatibilityReasons),
      evidenceSchemaVersion: ADAPTER_EVIDENCE_SCHEMA_VERSION,
      evidenceJson: JSON.stringify(input.evidence),
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

  static parseEvidence(snapshot: { evidenceSchemaVersion: string; evidenceJson: string }): AdapterCapabilityEvidenceV1 {
    if (snapshot.evidenceSchemaVersion !== ADAPTER_EVIDENCE_SCHEMA_VERSION) {
      throw new Error(`UNSUPPORTED_ADAPTER_EVIDENCE_SCHEMA:${snapshot.evidenceSchemaVersion}`);
    }
    return JSON.parse(snapshot.evidenceJson) as AdapterCapabilityEvidenceV1;
  }
}
