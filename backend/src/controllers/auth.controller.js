import { AuthService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const AuthController = {
  /**
   * @route   POST /api/v1/auth/login
   * @desc    Authenticates user and returns JWT
   * @access  Public
   */
  async login(req, res, next) {
    try {
      const { identifier, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'] || null;
      const requestId = req.headers['x-request-id'] || null;

      const result = await AuthService.login({
        identifier,
        password,
        ipAddress,
        userAgent,
        requestId
      });

      return ApiResponse.ok(res, result, 'Login successful');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/auth/profile
   * @desc    Returns current authenticated user profile
   * @access  Private (Requires valid JWT)
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await AuthService.getProfile(userId);

      return ApiResponse.ok(res, result.user, 'Profile retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default AuthController;
