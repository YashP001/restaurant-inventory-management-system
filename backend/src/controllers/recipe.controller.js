import { RecipeService } from '../services/recipe.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const RecipeController = {
  /**
   * @route   GET /api/v1/recipes
   * @desc    List recipes with pagination, search, and category filters
   * @access  Private (Authenticated Staff)
   */
  async getRecipes(req, res, next) {
    try {
      const { page, limit, search, category_id } = req.query;
      const result = await RecipeService.getRecipes({
        page,
        limit,
        search,
        categoryId: category_id
      });

      return ApiResponse.ok(res, result.recipes, 'Recipes retrieved successfully', {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/recipes/:id
   * @desc    Get detailed recipe by recipe ID with full BOM and theoretical costing
   * @access  Private (Authenticated Staff)
   */
  async getRecipeById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const recipe = await RecipeService.getRecipeById(id);
      return ApiResponse.ok(res, recipe, 'Recipe details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/menu-items/:id/recipe
   * @desc    Get recipe and BOM for a specific menu item
   * @access  Private (Authenticated Staff)
   */
  async getRecipeByMenuItemId(req, res, next) {
    try {
      const menuItemId = parseInt(req.params.id, 10);
      const recipe = await RecipeService.getRecipeByMenuItemId(menuItemId);
      return ApiResponse.ok(res, recipe, 'Menu item recipe retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/menu-items/:id/recipe
   * @desc    Create a recipe and optional initial BOM for a menu item
   * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
   */
  async createRecipe(req, res, next) {
    try {
      const menuItemId = parseInt(req.params.id, 10);
      const recipeData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const newRecipe = await RecipeService.createRecipe(menuItemId, recipeData, actingUser, requestId);
      return ApiResponse.created(res, newRecipe, 'Recipe created successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/recipes/:id
   * @desc    Update recipe yield servings and preparation instructions
   * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
   */
  async updateRecipe(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const updateData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const updatedRecipe = await RecipeService.updateRecipe(id, updateData, actingUser, requestId);
      return ApiResponse.ok(res, updatedRecipe, 'Recipe updated successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/recipes/:id/ingredients
   * @desc    Add a raw ingredient to recipe Bill of Materials (BOM)
   * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
   */
  async addRecipeIngredient(req, res, next) {
    try {
      const recipeId = parseInt(req.params.id, 10);
      const ingredientData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const addedIngredient = await RecipeService.addRecipeIngredient(recipeId, ingredientData, actingUser, requestId);
      return ApiResponse.created(res, addedIngredient, 'Ingredient added to recipe BOM successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/recipes/:id/ingredients/:ingredientId
   * @desc    Update quantity, unit, or wastage for an ingredient in recipe BOM
   * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
   */
  async updateRecipeIngredient(req, res, next) {
    try {
      const recipeId = parseInt(req.params.id, 10);
      const ingredientId = parseInt(req.params.ingredientId, 10);
      const updateData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const updatedIngredient = await RecipeService.updateRecipeIngredient(recipeId, ingredientId, updateData, actingUser, requestId);
      return ApiResponse.ok(res, updatedIngredient, 'Recipe BOM ingredient updated successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   DELETE /api/v1/recipes/:id/ingredients/:ingredientId
   * @desc    Remove an ingredient from recipe BOM (with historical consumption protection)
   * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
   */
  async removeRecipeIngredient(req, res, next) {
    try {
      const recipeId = parseInt(req.params.id, 10);
      const ingredientId = parseInt(req.params.ingredientId, 10);
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const result = await RecipeService.removeRecipeIngredient(recipeId, ingredientId, actingUser, requestId);
      return ApiResponse.ok(res, result, 'Ingredient removed from recipe BOM successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/recipes/:id/cost
   * @desc    Retrieve detailed theoretical recipe costing breakdown and profitability metrics
   * @access  Private (Authenticated Staff)
   */
  async getRecipeCosting(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const costing = await RecipeService.getRecipeCosting(id);
      return ApiResponse.ok(res, costing, 'Recipe theoretical costing calculated successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default RecipeController;
