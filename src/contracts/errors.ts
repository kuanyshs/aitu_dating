import { z } from 'zod';

export const ApiErrorCode = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'MEMBERSHIP_EXPIRED',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'NETWORK_ERROR',
  'UNKNOWN',
  /**
   * Mock only: the method is part of the frozen contract but its behaviour arrives in a
   * later spec. A real backend never returns it.
   */
  'NOT_IMPLEMENTED',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

/** The single error envelope every repository implementation returns. */
export const ApiError = z.object({
  code: ApiErrorCode,
  message: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiError>;

/** Thrown by repositories so callers can branch on `error.code`. */
export class RepositoryError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string>;
  readonly requestId?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'RepositoryError';
    this.code = error.code;
    this.fieldErrors = error.fieldErrors;
    this.requestId = error.requestId;
  }

  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      fieldErrors: this.fieldErrors,
      requestId: this.requestId,
    };
  }
}

export function isRepositoryError(error: unknown): error is RepositoryError {
  return error instanceof RepositoryError;
}
