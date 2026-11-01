import bcrypt from 'bcryptjs';
import { UserModel } from '../models/sql/user.model.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { generateToken } from '../middleware/auth.js';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';

export const AuthService = {
  /**
   * Authenticates staff user via username or email and password
   * @param {object} params
   * @param {string} params.identifier - Username or Email
   * @param {string} params.password - Plaintext password
   * @param {string} [params.ipAddress] - Client IP for audit trail
   * @param {string} [params.userAgent] - Client User Agent
   * @param {string} [params.requestId] - Correlation Request ID
   */
  async login({ identifier, password, ipAddress = null, userAgent = null, requestId = null }) {
    // 1. Query user from MySQL by username or email
    const user = await UserModel.findByUsernameOrEmail(identifier);

    // 2. Generic invalid credentials error helper to prevent user enumeration
    const genericAuthError = () =>
      ApiError.unauthorized('Invalid username/email or password', 'INVALID_CREDENTIALS');

    if (!user) {
      // Record failed attempt for non-existent identifier
      await AuditLog.record({
        action: 'LOGIN_FAILED',
        resourceType: 'AUTH',
        resourceId: null,
        requestId,
        metadata: {
          reason: 'USER_NOT_FOUND',
          identifier,
          ipAddress,
          userAgent
        }
      });
      throw genericAuthError();
    }

    // 3. Verify account is active
    if (!user.is_active) {
      await AuditLog.record({
        userId: user.id,
        username: user.username,
        action: 'LOGIN_FAILED',
        resourceType: 'AUTH',
        resourceId: String(user.id),
        requestId,
        metadata: {
          reason: 'ACCOUNT_DEACTIVATED',
          ipAddress,
          userAgent
        }
      });
      // Return identical generic error response to prevent user and status enumeration
      throw genericAuthError();
    }

    // 4. Compare password with bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await AuditLog.record({
        userId: user.id,
        username: user.username,
        action: 'LOGIN_FAILED',
        resourceType: 'AUTH',
        resourceId: String(user.id),
        requestId,
        metadata: {
          reason: 'INVALID_PASSWORD',
          ipAddress,
          userAgent
        }
      });
      throw genericAuthError();
    }

    // 5. Generate signed JWT containing role and identity claims
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role_name
    };
    const token = generateToken(tokenPayload);

    // 6. Record successful login in MongoDB Atlas AuditLog (NEVER logs password or token)
    await AuditLog.record({
      userId: user.id,
      username: user.username,
      action: 'LOGIN_SUCCESS',
      resourceType: 'AUTH',
      resourceId: String(user.id),
      requestId,
      metadata: {
        role: user.role_name,
        ipAddress,
        userAgent
      }
    });

    // 7. Sanitize output (strictly exclude password_hash)
    const sanitizedUser = {
      id: user.id,
      role_id: user.role_id,
      role: user.role_name,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      is_active: Boolean(user.is_active),
      created_at: user.created_at
    };

    return {
      user: sanitizedUser,
      token,
      expiresIn: env.JWT.expiresIn
    };
  },

  /**
   * Retrieves fresh profile of currently authenticated user from MySQL
   * Does NOT rely solely on JWT claims to ensure role/status changes take immediate effect
   * @param {number} userId - Authenticated user's ID
   */
  async getProfile(userId) {
    const user = await UserModel.findById(userId);

    if (!user) {
      throw ApiError.notFound('Staff user account not found', 'USER_NOT_FOUND');
    }

    if (!user.is_active) {
      throw ApiError.unauthorized('Account has been deactivated. Access revoked.', 'ACCOUNT_DEACTIVATED');
    }

    return {
      user: {
        id: user.id,
        role_id: user.role_id,
        role: user.role_name,
        role_description: user.role_description,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        is_active: Boolean(user.is_active),
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    };
  }
};

export default AuthService;
