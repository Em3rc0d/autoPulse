/**
 * Semantic classification only. Enforcement belongs to CHECK-MK5's
 * default-deny policy and planner boundary.
 */
export type DiagnosticSafetyClassification =
  | 'READ_ONLY_PROVEN'
  | 'READ_ONLY_EXPECTED'
  | 'UNKNOWN'
  | 'MUTATING';
