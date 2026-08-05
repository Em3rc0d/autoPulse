import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '../schema';
import { eq, and, desc } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { ProductIdGenerator } from '../uuidv7';

export type ECUInput = {
  address: number;
  protocol: string;
};

export type ParameterInput = {
  ecuAddress: number;
  parameterDefinitionId: string;
  supportState: string;
  evidenceOrigin: string;
  discoveryOutcome: string;
  errorCode?: string;
};

export class CapabilitySnapshotRepository {
  constructor(private db: ExpoSQLiteDatabase<typeof schema>) {}

  async createSnapshot(
    workspaceId: string,
    vehicleId: string,
    adapterInstanceId: string,
    profileVersion: string,
    protocolCode: string,
    transportType: string,
    discoveryStatus: string,
    ecus: ECUInput[],
    parameters: ParameterInput[]
  ) {
    return await this.db.transaction(async (tx) => {
      const snapshotId = ProductIdGenerator.generate();
      const now = Date.now();

      const [snapshot] = await tx.insert(schema.vehicleCapabilitySnapshots).values({
        id: snapshotId,
        workspaceId,
        vehicleId,
        adapterInstanceId,
        compatibilityProfileVersion: profileVersion,
        discoveredAt: now,
        protocolCode,
        decoderCatalogVersion: '1.0',
        discoveryStatus,
        rawDiscoveryHash: '0x0',
        createdAt: now
      } as any).returning();

      if (ecus.length > 0) {
        await tx.insert(schema.vehicleCapabilityEcus).values(
          ecus.map(ecu => ({
            id: ProductIdGenerator.generate(),
            snapshotId,
            ecuAddress: ecu.address,
            firstResponseTimestamp: now
          }))
        );
      }

      if (parameters.length > 0) {
        await tx.insert(schema.vehicleCapabilityParameters).values(
          parameters.map(param => ({
            id: ProductIdGenerator.generate(),
            snapshotId,
            ecuAddress: param.ecuAddress,
            parameterDefinitionId: param.parameterDefinitionId,
            supportState: param.supportState,
            evidenceOrigin: param.evidenceOrigin,
            discoveryOutcome: param.discoveryOutcome,
            errorCode: param.errorCode || null,
            discoveredAt: now
          }))
        );
      }

      return snapshot;
    });
  }

  async getLatestSnapshot(workspaceId: string, vehicleId: string) {
    return this.db.query.vehicleCapabilitySnapshots.findFirst({
      where: and(
        eq(schema.vehicleCapabilitySnapshots.workspaceId, workspaceId),
        eq(schema.vehicleCapabilitySnapshots.vehicleId, vehicleId)
      ),
      orderBy: [desc(schema.vehicleCapabilitySnapshots.discoveredAt)]
    });
  }

  async getParametersForSnapshot(snapshotId: string) {
    return this.db.select()
      .from(schema.vehicleCapabilityParameters)
      .where(eq(schema.vehicleCapabilityParameters.snapshotId, snapshotId))
      .all();
  }

  async getSnapshotWithParameters(snapshotId: string) {
    const params = await this.db.select({
      id: schema.vehicleCapabilityParameters.id,
      ecuAddress: schema.vehicleCapabilityParameters.ecuAddress,
      supportState: schema.vehicleCapabilityParameters.supportState,
      evidenceOrigin: schema.vehicleCapabilityParameters.evidenceOrigin,
      discoveryOutcome: schema.vehicleCapabilityParameters.discoveryOutcome,
      errorCode: schema.vehicleCapabilityParameters.errorCode,
      technicalName: schema.obdParameterDefinitions.technicalName,
      service: schema.obdParameterDefinitions.service,
      parameterIdentifier: schema.obdParameterDefinitions.parameterIdentifier,
      parameterDefinitionId: schema.vehicleCapabilityParameters.parameterDefinitionId
    })
    .from(schema.vehicleCapabilityParameters)
    .leftJoin(schema.obdParameterDefinitions, eq(schema.vehicleCapabilityParameters.parameterDefinitionId, schema.obdParameterDefinitions.id))
    .where(eq(schema.vehicleCapabilityParameters.snapshotId, snapshotId))
    .all();

    return params;
  }
}
