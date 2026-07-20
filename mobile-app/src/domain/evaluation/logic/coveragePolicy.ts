import { CoverageAssessment } from '../models/coverageAssessment';
import { CoverageLevel } from '../models/enums';

export function calculateOverallCoverage(assessment: Omit<CoverageAssessment, 'overallLevel'>): CoverageLevel {
  if (assessment.assessedItems.length === 0) return CoverageLevel.NOT_ASSESSED;
  
  const coveredCount = assessment.assessedItems.filter(i => i.isCovered).length;
  const ratio = coveredCount / assessment.assessedItems.length;

  if (ratio === 1) return CoverageLevel.HIGH;
  if (ratio >= 0.5) return CoverageLevel.PARTIAL;
  return CoverageLevel.LIMITED;
}
