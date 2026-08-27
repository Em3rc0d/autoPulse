import { CheckFindingIdFactory } from '../../application/check/CheckFindingEngine';
import { createFindingId } from '../../domain/shared/identifiers';
import { ProductIdGenerator } from '../database/product/uuidv7';

export const productCheckFindingIdFactory: CheckFindingIdFactory = {
  nextFindingId: () => createFindingId(ProductIdGenerator.generate()),
};
