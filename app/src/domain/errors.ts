export type DomainErrorCode =
  | 'invalid_custom_minutes'
  | 'step_unavailable'
  | 'last_cigarette_in_future'
  | 'invalid_transition'
  | 'smoked_at_out_of_range'
  | 'confirmation_pending';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
  }
}
