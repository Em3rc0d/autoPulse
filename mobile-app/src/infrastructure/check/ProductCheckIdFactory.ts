import { AutoPulseCheckIdFactory } from '../../application/check/AutoPulseCheckEngine';
import {
  createEvaluationId,
  createEvidenceItemId,
} from '../../domain/shared/identifiers';
import { ProductIdGenerator } from '../database/product/uuidv7';

export const productCheckIdFactory: AutoPulseCheckIdFactory = {
  nextEvaluationId: () => createEvaluationId(ProductIdGenerator.generate()),
  nextEvidenceItemId: () => createEvidenceItemId(ProductIdGenerator.generate()),
};
