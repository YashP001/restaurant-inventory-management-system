import { Router } from 'express';
import { MenuItemController } from '../../controllers/menuItem.controller.js';
import { RecipeController } from '../../controllers/recipe.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listMenuItemsQuerySchema,
  menuItemIdParamSchema,
  createMenuItemSchema,
  updateMenuItemSchema
} from '../../validations/menuItem.validation.js';
import {
  createRecipeSchema
} from '../../validations/recipe.validation.js';

const router = Router();

// All menu item endpoints require authenticated staff
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/menu-items
 * @desc    List menu items with pagination, search, category filter, and availability status
 * @access  Private (Authenticated Staff)
 */
router.get('/', validate(listMenuItemsQuerySchema), MenuItemController.getMenuItems);

/**
 * @route   GET /api/v1/menu-items/:id/recipe
 * @desc    Get recipe and Bill of Materials for a specific menu item
 * @access  Private (Authenticated Staff)
 */
router.get('/:id/recipe', validate(menuItemIdParamSchema), RecipeController.getRecipeByMenuItemId);

/**
 * @route   POST /api/v1/menu-items/:id/recipe
 * @desc    Create a recipe and optional initial BOM for a menu item
 * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
 */
router.post(
  '/:id/recipe',
  requireRole('ADMIN', 'INVENTORY_MANAGER', 'CHEF'),
  validate(createRecipeSchema),
  RecipeController.createRecipe
);

/**
 * @route   GET /api/v1/menu-items/:id
 * @desc    Get menu item details by ID with category and recipe information
 * @access  Private (Authenticated Staff)
 */
router.get('/:id', validate(menuItemIdParamSchema), MenuItemController.getMenuItemById);

/**
 * @route   POST /api/v1/menu-items
 * @desc    Create a new sellable menu item
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validate(createMenuItemSchema),
  MenuItemController.createMenuItem
);

/**
 * @route   PATCH /api/v1/menu-items/:id
 * @desc    Update menu item details
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.patch(
  '/:id',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validate(updateMenuItemSchema),
  MenuItemController.updateMenuItem
);

export default router;

