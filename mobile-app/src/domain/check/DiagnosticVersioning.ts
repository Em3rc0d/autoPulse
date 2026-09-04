export interface DiagnosticVersioning {
  readonly scanSchemaVersion: string;
  readonly diagnosticEngineVersion: string;
  readonly decoderCatalogVersion: string;
  readonly dtcKnowledgeVersion: string;
  readonly correlationRulesVersion: string;
}

export interface DiagnosticInterpretationVersion {
  readonly interpretationId: string;
  readonly sourceReportId: string;
  readonly sourceEvidenceHash: string;
  readonly createdAt: number;
  readonly diagnosticEngineVersion: string;
  readonly dtcKnowledgeVersion: string;
  readonly correlationRulesVersion: string;
}

export function assertDiagnosticVersioning(versioning: DiagnosticVersioning): void {
  for (const [key, value] of Object.entries(versioning)) {
    if (value.trim().length === 0) throw new Error(`Diagnostic version is required: ${key}`);
  }
}
