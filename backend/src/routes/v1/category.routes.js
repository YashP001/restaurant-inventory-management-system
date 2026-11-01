import { Router } from 'express';
import { CategoryController } from '../../controllers/category.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listCategoriesQuerySchema,
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema
} from '../../validations/category.validation.js';

const router = Router();

// All catalog endpoints require authenticated staff
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/categories
 * @desc    List categories with filtering & search
 * @access  Private (Authenticated Staff)
 */
router.get('/', validate(listCategoriesQuerySchema), CategoryController.getCategories);

/**
 * @route   GET /api/v1/categories/:id
 * @desc    Get category details by ID
 * @access  Private (Authenticated Staff)
 */
router.get('/:id', validate(categoryIdParamSchema), CategoryController.getCategoryById);

/**
 * @route   POST /api/v1/categories
 * @desc    Create a new category
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validate(createCategorySchema),
  CategoryController.createCategory
);

/**
 * @route   PATCH /api/v1/categories/:id
 * @desc    Update category details
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.patch(
  '/:id',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validate(updateCategorySchema),
  CategoryController.updateCategory
);

export default router;
