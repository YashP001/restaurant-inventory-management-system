import { Router } from 'express';
import { IngredientController } from '../../controllers/ingredient.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listIngredientsQuerySchema,
  ingredientIdParamSchema,
  createIngredientSchema,
  updateIngredientSchema
} from '../../validations/ingredient.validation.js';

const router = Router();

// All catalog endpoints require authenticated staff
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/ingredients
 * @desc    List raw ingredients with pagination, unit resolution, and category filters
 * @access  Private (Authenticated Staff)
 */
router.get('/', validate(listIngredientsQuerySchema), IngredientController.getIngredients);

/**
 * @route   GET /api/v1/ingredients/:id
 * @desc    Get ingredient details by ID
 * @access  Private (Authenticated Staff)
 */
router.get('/:id', validate(ingredientIdParamSchema), IngredientController.getIngredientById);

/**
 * @route   POST /api/v1/ingredients
 * @desc    Create a new raw ingredient
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validate(createIngredientSchema),
  IngredientController.createIngredient
);

/**
 * @route   PATCH /api/v1/ingredients/:id
 * @desc    Update raw ingredient details
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.patch(
  '/:id',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validate(updateIngredientSchema),
  IngredientController.updateIngredient
);

export default router;
