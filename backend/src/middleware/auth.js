import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Generates a signed JWT for an authenticated user
 * @param {object} payload - Claims object containing { id, username, role, email }
 * @param {string} [expiresIn] - Optional custom expiration duration
 * @returns {string} Signed JWT string
 */
export function generateToken(payload, expiresIn = env.JWT.expiresIn) {
  return jwt.sign(payload, env.JWT.secret, {
    expiresIn,
    algorithm: 'HS256'
  });
}

/**
 * Authentication Middleware: Validates Bearer JWT in incoming HTTP requests
 * Populates `req.user` with decoded token claims
 */
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(ApiError.unauthorized('Authentication token missing. Please provide Authorization: Bearer <token>', 'TOKEN_MISSING'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return next(ApiError.unauthorized('Invalid authorization header format. Expected "Bearer <token>"', 'TOKEN_MALFORMED'));
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, env.JWT.secret);
    
    // Attach validated claims to the request context
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      email: decoded.email,
      iat: decoded.iat,
      exp: decoded.exp
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Authentication token has expired. Please log in again', 'TOKEN_EXPIRED'));
    }
    return next(new ApiError(401, 'Authentication token is invalid or has been tampered with', 'INVALID_TOKEN'));
  }
}

export default authenticateJWT;
