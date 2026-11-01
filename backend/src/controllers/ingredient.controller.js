import { IngredientService } from '../services/ingredient.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const IngredientController = {
  /**
   * @route   GET /api/v1/ingredients
   * @desc    List raw ingredients with pagination, unit resolution, and category filters
   * @access  Private (Authenticated Staff)
   */
  async getIngredients(req, res, next) {
    try {
      const { page, limit, search, unit_id, category_id, isActive } = req.query;
      const result = await IngredientService.getIngredients({
        page,
        limit,
        search,
        unitId: unit_id,
        categoryId: category_id,
        isActive
      });

      return ApiResponse.ok(res, result.ingredients, 'Ingredients retrieved successfully', {
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
   * @route   GET /api/v1/ingredients/:id
   * @desc    Get ingredient details by ID
   * @access  Private (Authenticated Staff)
   */
  async getIngredientById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const ingredient = await IngredientService.getIngredientById(id);
      return ApiResponse.ok(res, ingredient, 'Ingredient details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/ingredients
   * @desc    Create a new raw ingredient
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async createIngredient(req, res, next) {
    try {
      const ingredientData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const newIngredient = await IngredientService.createIngredient(ingredientData, actingUser, requestId);
      return ApiResponse.created(res, newIngredient, 'Ingredient created successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/ingredients/:id
   * @desc    Update raw ingredient details
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async updateIngredient(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const updateData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const updated = await IngredientService.updateIngredient(id, updateData, actingUser, requestId);
      return ApiResponse.ok(res, updated, 'Ingredient updated successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default IngredientController;
