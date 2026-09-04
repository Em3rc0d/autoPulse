import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { DiagnosticRequestDescriptor } from './DiagnosticRequestDescriptor';
import type { DiagnosticDescriptorRegistry } from './DiagnosticDescriptorRegistry';
import { CHECK_MUTATING_OBD_SERVICES, resolveDescriptorBySemanticId } from './DiagnosticDescriptorRegistry';

export const CHECK_COMMAND_SAFETY_POLICY_VERSION = 'check-command-safety/v1' as const;

export type DiagnosticSafetyBlockReason =
  | 'UNREGISTERED_DESCRIPTOR'
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

/**
 * Defense-in-depth check. Registry construction already rejects these states,
 * but policy does not trust a caller-provided registry object blindly.
 */
export function evaluateDescriptorSafety(
  descriptor: DiagnosticRequestDescriptor | undefined,
  protocol: DiagnosticProtocol,
): DiagnosticSafetyDecision {
  if (!descriptor) {
    return {
      disposition: 'BLOCK',
      policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION,
      reason: 'UNREGISTERED_DESCRIPTOR',
    };
  }

  if (descriptor.requestKind !== 'OBD_STANDARD') {
    return {
      disposition: 'BLOCK',
      policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION,
      reason: 'REQUEST_KIND_NOT_ALLOWED',
      descriptor,
    };
  }

  if (descriptor.safetyClassification !== 'READ_ONLY_PROVEN') {
    return {
      disposition: 'BLOCK',
      policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION,
      reason: 'CLASSIFICATION_NOT_PROVEN',
      descriptor,
    };
  }

  if ((CHECK_MUTATING_OBD_SERVICES as readonly string[]).includes(descriptor.service.toUpperCase())) {
    return {
      disposition: 'BLOCK',
      policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION,
      reason: 'MUTATING_SERVICE_BLOCKED',
      descriptor,
    };
  }

  if (!descriptor.supportedProtocols.includes(protocol)) {
    return {
      disposition: 'BLOCK',
      policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION,
      reason: 'PROTOCOL_NOT_PROMOTED',
      descriptor,
    };
  }

  return {
    disposition: 'ALLOW',
    policyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION,
    descriptor,
  };
}

/**
 * The only normal MK5 authorization entrypoint: semantic id -> exact registry
 * membership -> safety policy. There is no free-form service/PID authorization.
 */
export function authorizeRegisteredDescriptor(
  registry: DiagnosticDescriptorRegistry,
  semanticId: string,
  protocol: DiagnosticProtocol,
): DiagnosticSafetyDecision {
  return evaluateDescriptorSafety(resolveDescriptorBySemanticId(registry, semanticId), protocol);
}
