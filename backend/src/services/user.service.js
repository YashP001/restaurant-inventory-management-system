import bcrypt from 'bcryptjs';
import { UserModel } from '../models/sql/user.model.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { ApiError } from '../utils/apiError.js';

export const UserService = {
  /**
   * Retrieves paginated staff members with filtering
   */
  async getUsers({ page = 1, limit = 20, role = null, isActive = null, search = null }) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const [users, total] = await Promise.all([
      UserModel.findAll({ page: parsedPage, limit: parsedLimit, role, isActive, search }),
      UserModel.countAll({ role, isActive, search })
    ]);

    const sanitizedUsers = users.map(u => ({
      ...u,
      is_active: Boolean(u.is_active)
    }));

    return {
      users: sanitizedUsers,
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit)
      }
    };
  },

  /**
   * Retrieves single staff member by ID
   */
  async getUserById(id) {
    const user = await UserModel.findById(id);
    if (!user) {
      throw ApiError.notFound(`Staff member with ID ${id} not found`, 'USER_NOT_FOUND');
    }
    return {
      ...user,
      is_active: Boolean(user.is_active)
    };
  },

  /**
   * Creates a new staff user with bcrypt-hashed password
   */
  async createUser(userData, actingUser, requestId = null) {
    // 1. Validate that role_id exists
    const role = await UserModel.findRoleById(userData.role_id);
    if (!role) {
      throw ApiError.badRequest(`Invalid role_id ${userData.role_id}. Specified role does not exist.`, 'INVALID_ROLE_ID');
    }

    // 2. Check for duplicate username
    const usernameExists = await UserModel.isUsernameTaken(userData.username);
    if (usernameExists) {
      throw ApiError.conflict(`Username '${userData.username}' is already taken.`, 'DUPLICATE_USERNAME');
    }

    // 3. Check for duplicate email
    const emailExists = await UserModel.isEmailTaken(userData.email);
    if (emailExists) {
      throw ApiError.conflict(`Email address '${userData.email}' is already registered.`, 'DUPLICATE_EMAIL');
    }

    // 4. Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(userData.password, 12);

    // 5. Insert into MySQL
    const newUserId = await UserModel.create({
      role_id: userData.role_id,
      username: userData.username,
      email: userData.email,
      password_hash: passwordHash,
      full_name: userData.full_name,
      phone: userData.phone || null,
      is_active: userData.is_active !== undefined ? userData.is_active : true
    });

    // 6. Record audit log in MongoDB Atlas (Never log plaintext password or hash!)
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'STAFF_CREATED',
      resourceType: 'USER',
      resourceId: String(newUserId),
      requestId,
      metadata: {
        createdUserId: newUserId,
        createdUsername: userData.username,
        role: role.name,
        email: userData.email,
        fullName: userData.full_name
      }
    });

    // 7. Return created user record without password_hash
    return await this.getUserById(newUserId);
  },

  /**
   * Updates an existing staff member's profile or credentials
   */
  async updateUser(id, updateData, actingUser, requestId = null) {
    const existing = await UserModel.findById(id);
    if (!existing) {
      throw ApiError.notFound(`Staff member with ID ${id} not found`, 'USER_NOT_FOUND');
    }

    const fieldsToUpdate = {};

    // 1. Prevent self-demotion or self-escalation if user updates themselves
    if (updateData.role_id !== undefined && updateData.role_id !== existing.role_id) {
      if (actingUser.id === id) {
        throw ApiError.forbidden('You cannot change your own role privileges', 'SELF_ROLE_CHANGE_FORBIDDEN');
      }

      const role = await UserModel.findRoleById(updateData.role_id);
      if (!role) {
        throw ApiError.badRequest(`Invalid role_id ${updateData.role_id}. Role does not exist.`, 'INVALID_ROLE_ID');
      }

      // If demoting an ADMIN, check last active admin protection
      if (existing.role_name === 'ADMIN' && role.name !== 'ADMIN' && existing.is_active) {
        const activeAdmins = await UserModel.countActiveAdmins();
        if (activeAdmins <= 1) {
          throw ApiError.badRequest('Cannot reassign role: This is the last active administrator account', 'LAST_ADMIN_PROTECTION');
        }
      }

      fieldsToUpdate.role_id = updateData.role_id;
    }

    // 2. Check username uniqueness if changed
    if (updateData.username && updateData.username !== existing.username) {
      const usernameExists = await UserModel.isUsernameTaken(updateData.username, id);
      if (usernameExists) {
        throw ApiError.conflict(`Username '${updateData.username}' is already taken.`, 'DUPLICATE_USERNAME');
      }
      fieldsToUpdate.username = updateData.username;
    }

    // 3. Check email uniqueness if changed
    if (updateData.email && updateData.email !== existing.email) {
      const emailExists = await UserModel.isEmailTaken(updateData.email, id);
      if (emailExists) {
        throw ApiError.conflict(`Email '${updateData.email}' is already registered.`, 'DUPLICATE_EMAIL');
      }
      fieldsToUpdate.email = updateData.email;
    }

    // 4. Update password if provided
    if (updateData.password) {
      fieldsToUpdate.password_hash = await bcrypt.hash(updateData.password, 12);
    }

    // 5. Update full_name & phone
    if (updateData.full_name !== undefined) {
      fieldsToUpdate.full_name = updateData.full_name;
    }
    if (updateData.phone !== undefined) {
      fieldsToUpdate.phone = updateData.phone;
    }

    // 6. Check is_active update
    if (updateData.is_active !== undefined && updateData.is_active !== existing.is_active) {
      if (!updateData.is_active && existing.role_name === 'ADMIN' && existing.is_active) {
        const activeAdmins = await UserModel.countActiveAdmins();
        if (activeAdmins <= 1) {
          throw ApiError.badRequest('Cannot deactivate the last active administrator account', 'LAST_ADMIN_PROTECTION');
        }
      }
      fieldsToUpdate.is_active = updateData.is_active;
    }

    // 7. Apply updates
    await UserModel.update(id, fieldsToUpdate);

    // 8. Record audit log in MongoDB Atlas
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'STAFF_UPDATED',
      resourceType: 'USER',
      resourceId: String(id),
      requestId,
      metadata: {
        updatedFields: Object.keys(fieldsToUpdate).filter(k => k !== 'password_hash'),
        passwordChanged: Boolean(updateData.password),
        targetUsername: existing.username
      }
    });

    return await this.getUserById(id);
  },

  /**
   * Updates staff activation status (Deactivate / Reactivate)
   * Enforces last active admin protection
   */
  async updateUserStatus(id, isActive, actingUser, requestId = null) {
    const existing = await UserModel.findById(id);
    if (!existing) {
      throw ApiError.notFound(`Staff member with ID ${id} not found`, 'USER_NOT_FOUND');
    }

    // Last Active Admin Protection
    if (!isActive && existing.role_name === 'ADMIN' && existing.is_active) {
      const activeAdmins = await UserModel.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw ApiError.badRequest('Cannot deactivate the last active administrator account', 'LAST_ADMIN_PROTECTION');
      }
    }

    await UserModel.updateStatus(id, isActive);

    // Record Audit Log in MongoDB Atlas
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: isActive ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
      resourceType: 'USER',
      resourceId: String(id),
      requestId,
      metadata: {
        previousStatus: existing.is_active,
        newStatus: isActive,
        targetUsername: existing.username,
        targetRole: existing.role_name
      }
    });

    return {
      id,
      username: existing.username,
      is_active: Boolean(isActive),
      message: `Staff member account ${existing.username} has been ${isActive ? 'activated' : 'deactivated'} successfully.`
    };
  }
};

export default UserService;
