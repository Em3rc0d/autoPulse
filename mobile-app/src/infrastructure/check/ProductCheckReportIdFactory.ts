import {
  ManifestId,
  ReportDraftId,
  ReportVersionId,
  createManifestId,
  createReportDraftId,
  createReportVersionId,
} from '../../domain/shared/identifiers';
import { ProductIdGenerator } from '../database/product/uuidv7';

export interface ProductCheckReportIds {
  nextDraftId(): ReportDraftId;
  nextManifestId(): ManifestId;
  nextVersionId(): ReportVersionId;
}

export const productCheckReportIds: ProductCheckReportIds = {
  nextDraftId: () => createReportDraftId(ProductIdGenerator.generate()),
  nextManifestId: () => createManifestId(ProductIdGenerator.generate()),
  nextVersionId: () => createReportVersionId(ProductIdGenerator.generate()),
};
