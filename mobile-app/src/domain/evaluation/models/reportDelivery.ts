import { ReportVersionId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';

export type DeliveryMethod = 'EMAIL' | 'WHATSAPP' | 'PRINT' | 'SYSTEM_LINK';
export type DeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';

export interface ReportDelivery {
  readonly id: string;
  readonly reportVersionId: ReportVersionId;
  readonly method: DeliveryMethod;
  readonly recipientInfo: string;
  readonly status: DeliveryStatus;
  readonly dispatchedAt: UtcIsoTimestamp;
  readonly deliveredAt?: UtcIsoTimestamp;
  readonly errorMessage?: string;
}
