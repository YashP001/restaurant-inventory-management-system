import { InventoryService } from '../services/inventory.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const InventoryController = {
  /**
   * @route   GET /api/v1/inventory
   * @desc    List ingredient stock levels, base units, thresholds, and stock status
   * @access  Private (Authenticated Staff)
   */
  async getOverview(req, res, next) {
    try {
      const { page, limit, search, stock_status, category_id } = req.query;
      const result = await InventoryService.getOverview({
        page,
        limit,
        search,
        stockStatus: stock_status,
        categoryId: category_id
      });

      return ApiResponse.ok(res, result.items, 'Inventory overview retrieved successfully', {
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
   * @route   GET /api/v1/inventory/summary
   * @desc    Retrieve high-level inventory KPIs, valuation, and stock health metrics
   * @access  Private (Authenticated Staff)
   */
  async getSummary(req, res, next) {
    try {
      const summary = await InventoryService.getSummary();
      return ApiResponse.ok(res, summary, 'Inventory summary KPIs retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/inventory/expiring
   * @desc    Retrieve batches expiring within configured days or already expired
   * @access  Private (Authenticated Staff)
   */
  async getExpiringBatches(req, res, next) {
    try {
      const { days, status, ingredient_id, page, limit } = req.query;
      const result = await InventoryService.getExpiringBatches({
        daysAhead: days,
        status,
        ingredientId: ingredient_id,
        page,
        limit
      });

      return ApiResponse.ok(res, result.batches, 'Expiring inventory batches retrieved successfully', {
        total: result.total,
        days_ahead: result.days_ahead,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/inventory/low-stock
   * @desc    Retrieve ingredients below safety stock or completely depleted
   * @access  Private (Authenticated Staff)
   */
  async getLowStockIngredients(req, res, next) {
    try {
      const { status, search, page, limit } = req.query;
      const result = await InventoryService.getLowStockIngredients({
        status,
        search,
        page,
        limit
      });

      return ApiResponse.ok(res, result.items, 'Low stock ingredients report retrieved successfully', {
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
   * @route   GET /api/v1/inventory/movements
   * @desc    Retrieve immutable stock movements audit ledger
   * @access  Private (Authenticated Staff)
   */
  async getStockMovements(req, res, next) {
    try {
      const { ingredient_id, batch_id, movement_type, start_date, end_date, page, limit } = req.query;
      const result = await InventoryService.getStockMovements({
        ingredientId: ingredient_id,
        batchId: batch_id,
        movementType: movement_type,
        startDate: start_date,
        endDate: end_date,
        page,
        limit
      });

      return ApiResponse.ok(res, result.movements, 'Stock movement history retrieved successfully', {
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
   * @route   GET /api/v1/inventory/batches
   * @desc    List physical inventory lots with FEFO sorting and filtering
   * @access  Private (Authenticated Staff)
   */
  async getBatches(req, res, next) {
    try {
      const {
        ingredient_id,
        status,
        expiring_before,
        expiring_after,
        sort_by,
        sort_order,
        page,
        limit
      } = req.query;

      const result = await InventoryService.getBatches({
        ingredientId: ingredient_id,
        status,
        expiringBefore: expiring_before,
        expiringAfter: expiring_after,
        sortBy: sort_by,
        sortOrder: sort_order,
        page,
        limit
      });

      return ApiResponse.ok(res, result.batches, 'Inventory batches retrieved successfully', {
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
   * @route   GET /api/v1/inventory/batches/:id
   * @desc    Get detailed inventory batch by ID with movement ledger
   * @access  Private (Authenticated Staff)
   */
  async getBatchById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const batch = await InventoryService.getBatchById(id);
      return ApiResponse.ok(res, batch, 'Inventory batch details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/inventory/:ingredientId
   * @desc    Get complete inventory breakdown for an ingredient including batches and suppliers
   * @access  Private (Authenticated Staff)
   */
  async getIngredientDetails(req, res, next) {
    try {
      const ingredientId = parseInt(req.params.ingredientId, 10);
      const details = await InventoryService.getIngredientDetails(ingredientId);
      return ApiResponse.ok(res, details, 'Ingredient inventory details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default InventoryController;
