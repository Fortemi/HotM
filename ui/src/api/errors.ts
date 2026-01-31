/**
 * Custom error classes for API client
 */

/**
 * Base API error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Network-level errors (connection failures, timeouts)
 */
export class NetworkError extends Error {
  public originalError: Error;

  constructor(error: Error | string) {
    const message = error instanceof Error
      ? `Network request failed: ${error.message}`
      : `Network request failed: ${error}`;
    super(message);
    this.name = 'NetworkError';
    this.originalError = error instanceof Error ? error : new Error(error);
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Validation errors (400 Bad Request with field errors)
 */
export class ValidationError extends ApiError {
  constructor(
    message: string,
    public fields: Record<string, string> = {}
  ) {
    super(message, 400, { error: message, fields });
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Not found errors (404)
 */
export class NotFoundError extends ApiError {
  constructor(
    public resourceType: string,
    public resourceId: string
  ) {
    super(`${resourceType} not found: ${resourceId}`, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Type guard for API errors
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
