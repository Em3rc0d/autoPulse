export interface EvaluationScopeItem {
  readonly id: string;
  readonly description: string;
  readonly isMandatory: boolean;
}

export interface EvaluationScope {
  readonly requestedItems: readonly EvaluationScopeItem[];
  readonly description?: string;
}
