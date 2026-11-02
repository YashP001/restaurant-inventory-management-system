import { SupplierService } from '../services/supplier.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const SupplierController = {
  /**
   * @route   GET /api/v1/suppliers
   * @desc    List suppliers with pagination, search, and active status filters
   * @access  Private (Authenticated Staff)
   */
  async listSuppliers(req, res, next) {
    try {
      const { page, limit, search, is_active } = req.query;
      const result = await SupplierService.listSuppliers({
        page,
        limit,
        search,
        is_active
      });

      return ApiResponse.ok(res, result.suppliers, 'Suppliers retrieved successfully', {
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
   * @route   GET /api/v1/suppliers/:id
   * @desc    Get detailed supplier record including mapped ingredients
   * @access  Private (Authenticated Staff)
   */
  async getSupplierById(req, res, next) {
    try {
      const { id } = req.params;
      const supplier = await SupplierService.getSupplierById(id);
      return ApiResponse.ok(res, supplier, 'Supplier retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/suppliers
   * @desc    Create a new supplier
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async createSupplier(req, res, next) {
    try {
      const supplier = await SupplierService.createSupplier(req.body, req.user, req.id);
      return ApiResponse.created(res, supplier, 'Supplier created successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/suppliers/:id
   * @desc    Update an existing supplier
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async updateSupplier(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await SupplierService.updateSupplier(id, req.body, req.user, req.id);
      return ApiResponse.ok(res, updated, 'Supplier updated successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/suppliers/:id/ingredients
   * @desc    List all ingredients mapped to a supplier
   * @access  Private (Authenticated Staff)
   */
  async getSupplierIngredients(req, res, next) {
    try {
      const { id } = req.params;
      const ingredients = await SupplierService.getSupplierIngredients(id);
      return ApiResponse.ok(res, ingredients, 'Supplier ingredients retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/suppliers/:id/ingredients
   * @desc    Map an ingredient to a supplier
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async mapSupplierIngredient(req, res, next) {
    try {
      const { id } = req.params;
      const mapping = await SupplierService.mapSupplierIngredient(id, req.body, req.user, req.id);
      return ApiResponse.created(res, mapping, 'Ingredient mapped to supplier successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   DELETE /api/v1/suppliers/:id/ingredients/:ingredientId
   * @desc    Unmap an ingredient from a supplier
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async unmapSupplierIngredient(req, res, next) {
    try {
      const { id, ingredientId } = req.params;
      const result = await SupplierService.unmapSupplierIngredient(id, ingredientId, req.user, req.id);
      return ApiResponse.ok(res, result, 'Ingredient unmapped from supplier successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default SupplierController;
