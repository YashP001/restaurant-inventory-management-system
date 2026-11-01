import { Router } from 'express';
import { UserController } from '../../controllers/user.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  userIdParamSchema,
  listUsersQuerySchema
} from '../../validations/user.validation.js';

const router = Router();

// Apply authentication and ADMIN role requirement across all staff management routes
router.use(authenticateJWT, requireRole('ADMIN'));

/**
 * @route   GET /api/v1/users
 * @desc    List staff members with pagination & filtering
 * @access  Private (ADMIN)
 */
router.get('/', validate(listUsersQuerySchema), UserController.getUsers);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get staff member details by ID
 * @access  Private (ADMIN)
 */
router.get('/:id', validate(userIdParamSchema), UserController.getUserById);

/**
 * @route   POST /api/v1/users
 * @desc    Create a new staff member account
 * @access  Private (ADMIN)
 */
router.post('/', validate(createUserSchema), UserController.createUser);

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Update staff member profile or credentials
 * @access  Private (ADMIN)
 */
router.patch('/:id', validate(updateUserSchema), UserController.updateUser);

/**
 * @route   PATCH /api/v1/users/:id/status
 * @desc    Activate or deactivate a staff member account
 * @access  Private (ADMIN)
 */
router.patch('/:id/status', validate(updateStatusSchema), UserController.updateUserStatus);

export default router;
