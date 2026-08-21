import { VehicleParameterEvidence } from './VehicleParameterEvidence';

export interface RawParameterEvidenceInput {
  readonly observedRequestId: string;
  readonly evidence: VehicleParameterEvidence;
}

export function resolveParameterDefinition<T extends RawParameterEvidenceInput>(
  parameter: T,
  verifiedDefinitionIds: ReadonlySet<string>
): T & { readonly parameterDefinitionId: string | null } {
  const definitionExists = verifiedDefinitionIds.has(parameter.observedRequestId);

  return {
    ...parameter,
    parameterDefinitionId: definitionExists ? parameter.observedRequestId : null,
    evidence: {
      ...parameter.evidence,
      standardDefinition: definitionExists ? 'DEFINED' : 'UNDEFINED'
    }
  };
}
