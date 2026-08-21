import type { ProbeResult } from '../../domain/telemetry/probe/ProbeResult';

export interface AdapterRegistrationPort {
  upsertAdapter(
    workspaceId: string,
    profile: {
      alias: string;
      platformDeviceId: string;
      trustState: string;
      advertisedName?: string;
    }
  ): Promise<{ id: string }>;
}

export interface AdapterCapabilityEvidencePort {
  appendProbeResult(
    workspaceId: string,
    adapterInstanceId: string,
    result: ProbeResult
  ): Promise<unknown>;
}

export interface LiveSessionCreationPort {
  createSession(
    workspaceId: string,
    vehicleId: string,
    operatorId: string,
    adapterInstanceId: string
  ): Promise<string>;
}

export interface AcceptProbedAdapterInput {
  workspaceId: string;
  operatorId: string;
  vehicleId: string;
  platformDeviceId: string;
  adapterAlias: string;
  advertisedName?: string;
  probeResult: ProbeResult;
}

export interface AcceptedProbedAdapter {
  adapterInstanceId: string;
  sessionId: string;
}

/**
 * Acceptance boundary between adapter discovery and vehicle/session discovery.
 *
 * Invariant: no Live session is created unless the adapter's canonical probe
 * assessment has first been persisted as append-only capability evidence.
 */
export class AcceptProbedAdapter {
  constructor(
    private adapterRegistration: AdapterRegistrationPort,
    private adapterEvidence: AdapterCapabilityEvidencePort,
    private liveSessions: LiveSessionCreationPort,
  ) {}

  async execute(input: AcceptProbedAdapterInput): Promise<AcceptedProbedAdapter> {
    const grade = input.probeResult.compatibilityGrade;
    if (!grade) {
      throw new Error('ADAPTER_COMPATIBILITY_ASSESSMENT_MISSING');
    }
    if (grade === 'UNSUPPORTED') {
      throw new Error('ADAPTER_NOT_ACCEPTABLE_FOR_LIVE');
    }
    if (!input.probeResult.connectionRetained) {
      throw new Error('ADAPTER_CONNECTION_NOT_RETAINED');
    }

    const adapter = await this.adapterRegistration.upsertAdapter(input.workspaceId, {
      alias: input.adapterAlias,
      platformDeviceId: input.platformDeviceId,
      trustState: 'PROBED',
      advertisedName: input.advertisedName,
    });

    // Evidence is a hard gate. If this fails, createSession is never called.
    await this.adapterEvidence.appendProbeResult(
      input.workspaceId,
      adapter.id,
      input.probeResult,
    );

    const sessionId = await this.liveSessions.createSession(
      input.workspaceId,
      input.vehicleId,
      input.operatorId,
      adapter.id,
    );

    return {
      adapterInstanceId: adapter.id,
      sessionId,
    };
  }
}
