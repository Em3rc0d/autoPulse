export interface DomainError {
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, any>;
}
