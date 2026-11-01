import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { UserModel } from '../models/sql/user.model.js';

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
 * Verifies that the user still exists in MySQL, is currently active, and attaches
 * their CURRENT role from the database to prevent stale token privilege retention.
 */
export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(ApiError.unauthorized('Authentication token missing. Please provide Authorization: Bearer <token>', 'TOKEN_MISSING'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return next(ApiError.unauthorized('Invalid authorization header format. Expected "Bearer <token>"', 'TOKEN_MALFORMED'));
  }

  const token = parts[1];

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Authentication token has expired. Please log in again', 'TOKEN_EXPIRED'));
    }
    return next(new ApiError(401, 'Authentication token is invalid or has been tampered with', 'INVALID_TOKEN'));
  }

  try {
    // Current-Role and Active Status Verification directly from MySQL:
    // Guarantees demoted administrators immediately lose admin privileges and
    // deactivated accounts immediately lose access even with an unexpired JWT.
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      return next(ApiError.unauthorized('Authentication failed: User account no longer exists', 'USER_NOT_FOUND'));
    }

    if (!user.is_active) {
      return next(ApiError.unauthorized('Authentication failed: Account has been deactivated. Access revoked.', 'ACCOUNT_DEACTIVATED'));
    }

    // Attach verified user with CURRENT database role (not trusting stale JWT claim)
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role_name, // Current role from MySQL
      email: user.email,
      fullName: user.full_name,
      is_active: Boolean(user.is_active),
      iat: decoded.iat,
      exp: decoded.exp
    };

    return next();
  } catch (dbError) {
    return next(dbError);
  }
}

export default authenticateJWT;
