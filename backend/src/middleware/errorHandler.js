import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { ZodError } from 'zod';

/**
 * Centralized Error Normalization and Response Middleware
 * Intercepts all operational and uncaught errors, mapping them to standard JSON:
 * {
 *   "success": false,
 *   "error": {
 *     "message": "...",
 *     "status": 400,
 *     "code": "ERROR_CODE",
 *     "timestamp": "...",
 *     "details": [ ... ],
 *     "stack": "..." // (only in development)
 *   }
 * }
 */
export function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let message = 'An unexpected internal server error occurred';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let details = [];

  // 1. Custom Operational ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.errorCode;
    details = err.details;
  }
  // 2. Zod Schema Validation Errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed for request data';
    details = err.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      rule: issue.code
    }));
  }
  // 3. JWT Token Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Authentication failed: Invalid or malformed token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication failed: Token has expired. Please log in again';
  }
  // 4. MySQL 8 Database Errors
  else if (err.code || err.sqlState) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        statusCode = 409;
        errorCode = 'DUPLICATE_ENTRY';
        // Extract duplicate key without exposing full SQL statement
        const match = err.sqlMessage ? err.sqlMessage.match(/Duplicate entry '(.+)' for key '(.+)'/) : null;
        message = match 
          ? `Resource with unique field '${match[1]}' already exists (${match[2]}).` 
          : 'A duplicate record exists in the database.';
        break;

      case 'ER_NO_REFERENCED_ROW_2':
        statusCode = 400;
        errorCode = 'FOREIGN_KEY_VIOLATION';
        message = 'Invalid reference: The associated parent entity does not exist.';
        break;

      case 'ER_ROW_IS_REFERENCED_2':
        statusCode = 409;
        errorCode = 'RESTRICT_CONSTRAINT_VIOLATION';
        message = 'Cannot delete or modify record because it is referenced by active child entities.';
        break;

      case 'ER_SIGNAL_EXCEPTION':
        statusCode = 400;
        errorCode = 'BUSINESS_RULE_VIOLATION';
        message = err.sqlMessage || 'A database business rule violation occurred.';
        break;

      case 'ECONNREFUSED':
      case 'PROTOCOL_CONNECTION_LOST':
        statusCode = 503;
        errorCode = 'DATABASE_UNAVAILABLE';
        message = 'Database service is currently unreachable. Please try again later.';
        break;

      default:
        statusCode = 500;
        errorCode = 'DATABASE_ERROR';
        message = env.NODE_ENV === 'development' 
          ? (err.sqlMessage || err.message) 
          : 'A database error occurred while processing the request.';
        break;
    }
  }
  // 5. Mongoose / MongoDB Errors
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_IDENTIFIER';
    message = `Invalid identifier format for field '${err.path}'`;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'MONGO_VALIDATION_ERROR';
    message = err.message;
    details = Object.values(err.errors || {}).map(e => ({
      field: e.path,
      message: e.message
    }));
  }
  // 6. Generic/Standard Errors
  else if (err instanceof Error) {
    statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
    message = (statusCode === 500 && env.NODE_ENV !== 'development') 
      ? 'An unexpected internal error occurred' 
      : err.message;
    errorCode = err.errorCode || 'APPLICATION_ERROR';
  }

  // Sanitize stack trace: Never leak in production
  const errorResponse = {
    success: false,
    error: {
      message,
      status: statusCode,
      code: errorCode,
      timestamp: new Date().toISOString(),
      ...(details && details.length > 0 ? { details } : {}),
      ...(env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {})
    }
  };

  // Structured server console output (omits sensitive headers or payloads)
  if (statusCode >= 500) {
    console.error(`[CRITICAL ERROR] ${req.method} ${req.originalUrl} (${statusCode}):`, err.message);
  }

  return res.status(statusCode).json(errorResponse);
}

/**
 * 404 Route Not Found Handler
 */
export function notFoundHandler(req, res, next) {
  return res.status(404).json({
    success: false,
    error: {
      message: `The requested endpoint '${req.method} ${req.originalUrl}' does not exist on this server.`,
      status: 404,
      code: 'ROUTE_NOT_FOUND',
      timestamp: new Date().toISOString()
    }
  });
}
