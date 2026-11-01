import { Router } from 'express';
import { RecipeController } from '../../controllers/recipe.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listRecipesQuerySchema,
  recipeIdParamSchema,
  recipeAndIngredientIdParamSchema,
  updateRecipeSchema,
  addRecipeIngredientSchema,
  updateRecipeIngredientSchema
} from '../../validations/recipe.validation.js';

const router = Router();

// All recipe endpoints require authenticated staff
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/recipes
 * @desc    List recipes with pagination and filtering
 * @access  Private (Authenticated Staff)
 */
router.get('/', validate(listRecipesQuerySchema), RecipeController.getRecipes);

/**
 * @route   GET /api/v1/recipes/:id/cost
 * @desc    Get detailed theoretical recipe costing breakdown
 * @access  Private (Authenticated Staff)
 */
router.get('/:id/cost', validate(recipeIdParamSchema), RecipeController.getRecipeCosting);

/**
 * @route   GET /api/v1/recipes/:id
 * @desc    Get recipe details by ID with Bill of Materials and costing
 * @access  Private (Authenticated Staff)
 */
router.get('/:id', validate(recipeIdParamSchema), RecipeController.getRecipeById);

/**
 * @route   PATCH /api/v1/recipes/:id
 * @desc    Update recipe yield servings and instructions
 * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
 */
router.patch(
  '/:id',
  requireRole('ADMIN', 'INVENTORY_MANAGER', 'CHEF'),
  validate(updateRecipeSchema),
  RecipeController.updateRecipe
);

/**
 * @route   POST /api/v1/recipes/:id/ingredients
 * @desc    Add raw ingredient to recipe Bill of Materials
 * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
 */
router.post(
  '/:id/ingredients',
  requireRole('ADMIN', 'INVENTORY_MANAGER', 'CHEF'),
  validate(addRecipeIngredientSchema),
  RecipeController.addRecipeIngredient
);

/**
 * @route   PATCH /api/v1/recipes/:id/ingredients/:ingredientId
 * @desc    Update quantity, unit, or wastage for recipe ingredient
 * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
 */
router.patch(
  '/:id/ingredients/:ingredientId',
  requireRole('ADMIN', 'INVENTORY_MANAGER', 'CHEF'),
  validate(updateRecipeIngredientSchema),
  RecipeController.updateRecipeIngredient
);

/**
 * @route   DELETE /api/v1/recipes/:id/ingredients/:ingredientId
 * @desc    Remove ingredient from recipe BOM (protected against historical consumptions)
 * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
 */
router.delete(
  '/:id/ingredients/:ingredientId',
  requireRole('ADMIN', 'INVENTORY_MANAGER', 'CHEF'),
  validate(recipeAndIngredientIdParamSchema),
  RecipeController.removeRecipeIngredient
);

export default router;
