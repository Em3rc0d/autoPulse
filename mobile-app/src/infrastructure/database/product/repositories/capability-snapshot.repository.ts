import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '../schema';
import { eq, and, desc } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { ProductIdGenerator } from '../uuidv7';
import { VehicleParameterEvidence } from '../../../../domain/acquisition/VehicleParameterEvidence';
import { deriveVehicleDiscoveryStatus } from '../../../../domain/acquisition/VehicleDiscoveryStatus';
import { resolveParameterDefinition } from '../../../../domain/acquisition/ParameterDefinitionResolver';

export type ECUInput = {
  address: number;
  protocol: string;
};

export type ParameterInput = {
  ecuAddress: number;
  observedRequestId: string;
  supportState: string;
  evidence: VehicleParameterEvidence;
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
    ecus: ECUInput[],
    parameters: ParameterInput[]
  ) {
    return await this.db.transaction(async (tx) => {
      const snapshotId = ProductIdGenerator.generate();
      const now = Date.now();
      const definitionRows = await tx
        .select({ id: schema.obdParameterDefinitions.id })
        .from(schema.obdParameterDefinitions);
      const verifiedDefinitionIds = new Set(definitionRows.map(row => row.id));
      const resolvedParameters = parameters.map(param =>
        resolveParameterDefinition(param, verifiedDefinitionIds)
      );
      const discoveryStatus = deriveVehicleDiscoveryStatus(ecus, resolvedParameters);

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

      if (resolvedParameters.length > 0) {
        await tx.insert(schema.vehicleCapabilityParameters).values(
          resolvedParameters.map(param => ({
            id: ProductIdGenerator.generate(),
            snapshotId,
            ecuAddress: param.ecuAddress,
            observedRequestId: param.observedRequestId,
            parameterDefinitionId: param.parameterDefinitionId,
            supportState: param.supportState,
            discoveryOutcome: param.evidence.probeResult,
            standardDefinitionState: param.evidence.standardDefinition,
            capabilityAdvertisedState: param.evidence.capabilityAdvertised,
            probeResult: param.evidence.probeResult,
            liveObservationState: param.evidence.liveObservation,
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
      discoveryOutcome: schema.vehicleCapabilityParameters.discoveryOutcome,
      standardDefinitionState: schema.vehicleCapabilityParameters.standardDefinitionState,
      capabilityAdvertisedState: schema.vehicleCapabilityParameters.capabilityAdvertisedState,
      probeResult: schema.vehicleCapabilityParameters.probeResult,
      liveObservationState: schema.vehicleCapabilityParameters.liveObservationState,
      errorCode: schema.vehicleCapabilityParameters.errorCode,
      technicalName: schema.obdParameterDefinitions.technicalName,
      service: schema.obdParameterDefinitions.service,
      parameterIdentifier: schema.obdParameterDefinitions.parameterIdentifier,
      observedRequestId: schema.vehicleCapabilityParameters.observedRequestId,
      parameterDefinitionId: schema.vehicleCapabilityParameters.parameterDefinitionId
    })
    .from(schema.vehicleCapabilityParameters)
    .leftJoin(schema.obdParameterDefinitions, eq(schema.vehicleCapabilityParameters.parameterDefinitionId, schema.obdParameterDefinitions.id))
    .where(eq(schema.vehicleCapabilityParameters.snapshotId, snapshotId))
    .all();

    return params;
  }
}
