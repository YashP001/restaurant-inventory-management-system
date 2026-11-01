import { CategoryService } from '../services/category.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const CategoryController = {
  /**
   * @route   GET /api/v1/categories
   * @desc    List categories with filtering, search, and pagination
   * @access  Private (Authenticated Staff)
   */
  async getCategories(req, res, next) {
    try {
      const { page, limit, search, isActive } = req.query;
      const result = await CategoryService.getCategories({ page, limit, search, isActive });
      return ApiResponse.ok(res, result.categories, 'Categories retrieved successfully', {
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
   * @route   GET /api/v1/categories/:id
   * @desc    Get category details by ID
   * @access  Private (Authenticated Staff)
   */
  async getCategoryById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const category = await CategoryService.getCategoryById(id);
      return ApiResponse.ok(res, category, 'Category details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/categories
   * @desc    Create a new menu category
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async createCategory(req, res, next) {
    try {
      const categoryData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const newCategory = await CategoryService.createCategory(categoryData, actingUser, requestId);
      return ApiResponse.created(res, newCategory, 'Category created successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/categories/:id
   * @desc    Update category details
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async updateCategory(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const updateData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const updatedCategory = await CategoryService.updateCategory(id, updateData, actingUser, requestId);
      return ApiResponse.ok(res, updatedCategory, 'Category updated successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default CategoryController;
