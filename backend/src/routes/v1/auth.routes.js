import { Router } from 'express';
import { AuthController } from '../../controllers/auth.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema } from '../../validations/auth.validation.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Staff login endpoint
 * @access  Public
 */
router.post('/login', validate(loginSchema), AuthController.login);

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get currently logged-in staff profile
 * @access  Private (All authenticated staff)
 */
router.get('/profile', authenticateJWT, AuthController.getProfile);

export default router;
