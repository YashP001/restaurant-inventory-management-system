import { AdjustmentService } from '../services/adjustment.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const AdjustmentController = {
  /**
   * @route   POST /api/v1/inventory/adjustments
   * @desc    Perform manual stock increase or decrease on an inventory batch
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async adjustStock(req, res, next) {
    try {
      const { ingredient_id, batch_id, adjustment_type, quantity, reason, notes } = req.body;
      const result = await AdjustmentService.adjustStock({
        ingredientId: ingredient_id,
        batchId: batch_id,
        adjustmentType: adjustment_type,
        quantity,
        reason,
        notes,
        user: req.user
      });

      return ApiResponse.created(res, result, 'Stock adjustment completed successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/inventory/adjustments
   * @desc    List manual stock adjustments
   * @access  Private (Authenticated Staff)
   */
  async getAdjustments(req, res, next) {
    try {
      const { page, limit, ingredient_id, batch_id, startDate, endDate } = req.query;
      const result = await AdjustmentService.getAdjustments({
        page,
        limit,
        ingredientId: ingredient_id,
        batchId: batch_id,
        startDate,
        endDate
      });

      return ApiResponse.ok(res, result.items, 'Stock adjustments retrieved successfully', {
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
   * @route   GET /api/v1/inventory/adjustments/:id
   * @desc    Get detailed stock adjustment by ID
   * @access  Private (Authenticated Staff)
   */
  async getAdjustmentById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdjustmentService.getAdjustmentById(id);
      return ApiResponse.ok(res, result, 'Stock adjustment details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
};
