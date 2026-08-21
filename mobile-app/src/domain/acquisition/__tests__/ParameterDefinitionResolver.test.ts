import { initializationEvidence } from '../VehicleParameterEvidence';
import { resolveParameterDefinition } from '../ParameterDefinitionResolver';

describe('ParameterDefinitionResolver', () => {
  const raw = {
    observedRequestId: '0111',
    evidence: initializationEvidence({
      definitionExists: true,
      advertised: true
    })
  };

  it('links a verified catalog definition', () => {
    expect(resolveParameterDefinition(raw, new Set(['0111']))).toMatchObject({
      observedRequestId: '0111',
      parameterDefinitionId: '0111',
      evidence: { standardDefinition: 'DEFINED' }
    });
  });

  it('preserves raw evidence without inventing an unknown definition', () => {
    expect(resolveParameterDefinition(raw, new Set())).toMatchObject({
      observedRequestId: '0111',
      parameterDefinitionId: null,
      evidence: {
        standardDefinition: 'UNDEFINED',
        capabilityAdvertised: 'ADVERTISED'
      }
    });
  });
});
