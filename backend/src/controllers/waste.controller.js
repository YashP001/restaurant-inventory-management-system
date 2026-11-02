import { WasteService } from '../services/waste.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const WasteController = {
  /**
   * @route   POST /api/v1/inventory/waste
   * @desc    Record food waste and deduct stock from inventory batch
   * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
   */
  async recordWaste(req, res, next) {
    try {
      const { ingredient_id, batch_id, quantity_wasted, waste_reason, unit_id, notes, waste_date } = req.body;
      const result = await WasteService.recordWaste({
        ingredientId: ingredient_id,
        batchId: batch_id,
        quantityWasted: quantity_wasted,
        wasteReason: waste_reason,
        unitId: unit_id,
        notes,
        wasteDate: waste_date,
        user: req.user
      });

      return ApiResponse.created(res, result, 'Waste recorded successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/inventory/waste
   * @desc    List recorded food waste events
   * @access  Private (Authenticated Staff)
   */
  async getWasteRecords(req, res, next) {
    try {
      const { page, limit, ingredient_id, batch_id, waste_reason, startDate, endDate } = req.query;
      const result = await WasteService.getWasteRecords({
        page,
        limit,
        ingredientId: ingredient_id,
        batchId: batch_id,
        wasteReason: waste_reason,
        startDate,
        endDate
      });

      return ApiResponse.ok(res, result.items, 'Waste records retrieved successfully', {
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
   * @route   GET /api/v1/inventory/waste/:id
   * @desc    Get detailed waste record by ID
   * @access  Private (Authenticated Staff)
   */
  async getWasteRecordById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await WasteService.getWasteRecordById(id);
      return ApiResponse.ok(res, result, 'Waste record details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
};
