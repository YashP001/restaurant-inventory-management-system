import { UserService } from '../services/user.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const UserController = {
  /**
   * @route   GET /api/v1/users
   * @desc    List staff members with pagination & filtering
   * @access  Private (ADMIN)
   */
  async getUsers(req, res, next) {
    try {
      const { page, limit, role, isActive, search } = req.query;
      const result = await UserService.getUsers({ page, limit, role, isActive, search });

      return ApiResponse.ok(res, result.users, 'Staff members retrieved successfully', result.meta);
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/users/:id
   * @desc    Get staff member by ID
   * @access  Private (ADMIN)
   */
  async getUserById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const user = await UserService.getUserById(id);

      return ApiResponse.ok(res, user, 'Staff member details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/users
   * @desc    Create a new staff member account
   * @access  Private (ADMIN)
   */
  async createUser(req, res, next) {
    try {
      const userData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const newUser = await UserService.createUser(userData, actingUser, requestId);

      return ApiResponse.created(res, newUser, 'Staff member account created successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/users/:id
   * @desc    Update staff member details
   * @access  Private (ADMIN)
   */
  async updateUser(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const updateData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const updatedUser = await UserService.updateUser(id, updateData, actingUser, requestId);

      return ApiResponse.ok(res, updatedUser, 'Staff member account updated successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/users/:id/status
   * @desc    Activate or deactivate a staff member account
   * @access  Private (ADMIN)
   */
  async updateUserStatus(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { is_active } = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const result = await UserService.updateUserStatus(id, is_active, actingUser, requestId);

      return ApiResponse.ok(res, result, result.message);
    } catch (error) {
      return next(error);
    }
  }
};

export default UserController;
