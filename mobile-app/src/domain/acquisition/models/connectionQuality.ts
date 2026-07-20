export type QualityLevel = 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'POOR' | 'DISCONNECTED';

export interface ConnectionQualitySummary {
  readonly overallLevel: QualityLevel;
  readonly averageLatencyMs: number;
  readonly packetLossPercentage: number;
  readonly disconnectionsCount: number;
}
