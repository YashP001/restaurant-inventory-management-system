import { ProcurementService } from '../services/procurement.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const ProcurementController = {
  /**
   * GET /api/v1/procurement/recommendations
   * Evaluates inventory, expiry, inbound POs, lead times, MOQ, and generates purchase recommendations
   */
  async getRecommendations(req, res, next) {
    try {
      const horizonDays = Number(req.query.horizon_days || 7);
      const result = await ProcurementService.generateProcurementRecommendations({
        horizonDays
      });
      return ApiResponse.ok(res, result, 'Procurement recommendations generated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/procurement/recommendations/convert-to-po
   * Converts selected purchase recommendations into DRAFT purchase orders
   */
  async convertToPO(req, res, next) {
    try {
      const { items, notes } = req.body;
      const result = await ProcurementService.convertRecommendationsToPO({
        items,
        notes,
        actingUser: req.user,
        requestId: req.requestId
      });
      return ApiResponse.created(res, result, 'Purchase order(s) created successfully in DRAFT status');
    } catch (err) {
      next(err);
    }
  }
};
