import { CoverageLevel } from './enums';

export interface CoverageAssessmentItem {
  readonly moduleName: string;
  readonly isCovered: boolean;
  readonly reasonIfNotCovered?: string;
}

export interface CoverageAssessment {
  readonly overallLevel: CoverageLevel;
  readonly assessedItems: readonly CoverageAssessmentItem[];
  readonly assessedAt: string;
}
