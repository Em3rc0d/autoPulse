import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { DiagnosticRequestDescriptor } from './DiagnosticRequestDescriptor';
import type { DiagnosticDescriptorRegistry } from './DiagnosticDescriptorRegistry';
import {
  CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
  CHECK_MUTATING_OBD_SERVICES,
  resolveDescriptorBySemanticId,
} from './DiagnosticDescriptorRegistry';

export const CHECK_COMMAND_SAFETY_POLICY_VERSION = 'check-command-safety/v1' as const;

export type DiagnosticSafetyBlockReason =
  | 'REGISTRY_NOT_ALLOWLISTED'
  | 'UNREGISTERED_DESCRIPTOR'
  | 'DESCRIPTOR_DEFINITION_MISMATCH'
  | 'REQUEST_KIND_NOT_ALLOWED'
  | 'CLASSIFICATION_NOT_PROVEN'
  | 'MUTATING_SERVICE_BLOCKED'
  | 'PROTOCOL_NOT_PROMOTED';

export type DiagnosticSafetyDecision =
  | {
      readonly disposition: 'ALLOW';
      readonly policyVersion: typeof CHECK_COMMAND_SAFETY_POLICY_VERSION;
      readonly descriptor: DiagnosticRequestDescriptor;
    }
  | {
      readonly disposition: 'BLOCK';
      readonly policyVersion: typeof CHECK_COMMAND_SAFETY_POLICY_VERSION;
      readonly reason: DiagnosticSafetyBlockReason;
      readonly descriptor?: DiagnosticRequestDescriptor;
    };

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameActivation(
  left: DiagnosticRequestDescriptor['activationCondition'],
  right: DiagnosticRequestDescriptor['activationCondition'],
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'ALWAYS' || right.kind === 'ALWAYS') return true;
  return left.advertisedPid === right.advertisedPid;
}

function matchesCanonicalDefinition(
  candidate: DiagnosticRequestDescriptor,
  canonical: DiagnosticRequestDescriptor,
): boolean {
  return candidate.descriptorId === canonical.descriptorId
    && candidate.semanticId === canonical.semanticId
    && candidate.requestKind === canonical.requestKind
    && candidate.service === canonical.service
    && candidate.pid === canonical.pid
    && candidate.subfunction === canonical.subfunction
    && candidate.expectedResponseService === canonical.expectedResponseService
    && candidate.parserContractId === canonical.parserContractId
    && candidate.stage === canonical.stage
    && candidate.safetyClassification === canonical.safetyClassification
    && sameStrings(candidate.supportedProtocols, canonical.supportedProtocols)
    && sameActivation(candidate.activationCondition, canonical.activationCondition)
    && candidate.provenance === canonical.provenance
    && candidate.executionMode === canonical.executionMode;
}

/**
 * Defense-in-depth check for one already-resolved canonical descriptor.
 * Registry authorization is intentionally separate and stricter below.
 */
export function evaluateDescriptorSafety(
  descriptor: DiagnosticRequestDescriptor | undefined,
  protocol: DiagnosticProtocol,
): DiagnosticSafetyDecision {
  if (!descriptor) {
    return { disposition: 'BLOCK', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, reason: 'UNREGISTERED_DESCRIPTOR' };
  }
  if (descriptor.requestKind !== 'OBD_STANDARD') {
    return { disposition: 'BLOCK', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, reason: 'REQUEST_KIND_NOT_ALLOWED', descriptor };
  }
  if (descriptor.safetyClassification !== 'READ_ONLY_PROVEN') {
    return { disposition: 'BLOCK', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, reason: 'CLASSIFICATION_NOT_PROVEN', descriptor };
  }
  if ((CHECK_MUTATING_OBD_SERVICES as readonly string[]).includes(descriptor.service.toUpperCase())) {
    return { disposition: 'BLOCK', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, reason: 'MUTATING_SERVICE_BLOCKED', descriptor };
  }
  if (!descriptor.supportedProtocols.includes(protocol)) {
    return { disposition: 'BLOCK', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, reason: 'PROTOCOL_NOT_PROMOTED', descriptor };
  }
  return { disposition: 'ALLOW', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, descriptor };
}

/**
 * The normal MK5 authorization entrypoint. A caller cannot mint a new
 * READ_ONLY_PROVEN operation simply by constructing another registry object:
 * the registry version and exact descriptor definition must match the policy's
 * canonical allowlist.
 */
export function authorizeRegisteredDescriptor(
  registry: DiagnosticDescriptorRegistry,
  semanticId: string,
  protocol: DiagnosticProtocol,
): DiagnosticSafetyDecision {
  if (registry.version !== CHECK_CORE_DESCRIPTOR_REGISTRY_V1.version) {
    return { disposition: 'BLOCK', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, reason: 'REGISTRY_NOT_ALLOWLISTED' };
  }

  const candidate = resolveDescriptorBySemanticId(registry, semanticId);
  if (!candidate) {
    return { disposition: 'BLOCK', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, reason: 'UNREGISTERED_DESCRIPTOR' };
  }

  const canonical = resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, semanticId);
  if (!canonical) {
    return { disposition: 'BLOCK', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, reason: 'UNREGISTERED_DESCRIPTOR', descriptor: candidate };
  }
  if (!matchesCanonicalDefinition(candidate, canonical)) {
    return { disposition: 'BLOCK', policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION, reason: 'DESCRIPTOR_DEFINITION_MISMATCH', descriptor: candidate };
  }

  return evaluateDescriptorSafety(canonical, protocol);
}
