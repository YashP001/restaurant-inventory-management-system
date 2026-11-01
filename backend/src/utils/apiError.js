/**
 * Custom Operational Application Error Class
 * Captures HTTP status, error codes, and field-level validation details
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (400, 401, 403, 404, 409, 500, etc.)
   * @param {string} message - Descriptive error message
   * @param {string} [errorCode='INTERNAL_ERROR'] - Machine-readable error code enum
   * @param {any[]} [details=[]] - Optional array of field-level errors or diagnostic details
   * @param {string} [stack=''] - Optional existing stack trace
   */
  constructor(
    statusCode = 500,
    message = 'Internal Server Error',
    errorCode = 'INTERNAL_ERROR',
    details = [],
    stack = ''
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = Array.isArray(details) ? details : [details];
    this.isOperational = true;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Common Operational Error Factories
  static badRequest(message = 'Bad Request', errorCode = 'BAD_REQUEST', details = []) {
    return new ApiError(400, message, errorCode, details);
  }

  static unauthorized(message = 'Unauthorized: Authentication required', errorCode = 'UNAUTHORIZED', details = []) {
    return new ApiError(401, message, errorCode, details);
  }

  static forbidden(message = 'Forbidden: Insufficient privileges', errorCode = 'FORBIDDEN', details = []) {
    return new ApiError(403, message, errorCode, details);
  }

  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND', details = []) {
    return new ApiError(404, message, errorCode, details);
  }

  static conflict(message = 'Conflict: Resource already exists or version mismatch', errorCode = 'CONFLICT', details = []) {
    return new ApiError(409, message, errorCode, details);
  }

  static unprocessable(message = 'Unprocessable Entity: Validation failed', errorCode = 'VALIDATION_ERROR', details = []) {
    return new ApiError(422, message, errorCode, details);
  }

  static internal(message = 'Internal Server Error', errorCode = 'INTERNAL_SERVER_ERROR', details = []) {
    return new ApiError(500, message, errorCode, details);
  }
}

export default ApiError;
