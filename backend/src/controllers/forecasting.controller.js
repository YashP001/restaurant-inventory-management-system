import { ForecastingService } from '../services/forecasting.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const ForecastingController = {
  /**
   * POST /api/v1/forecasting/generate
   * Generates and persists 7-day demand forecasts
   */
  async generateForecasts(req, res, next) {
    try {
      const horizonDays = req.body?.horizon_days || 7;
      const result = await ForecastingService.generateAndSaveForecasts({
        actingUser: req.user,
        horizonDays,
        requestId: req.requestId
      });
      return ApiResponse.ok(res, result, 'Demand forecasts generated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/forecasting
   * Retrieves saved demand forecasts
   */
  async getForecasts(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        target_type = 'MENU_ITEM',
        target_id,
        start_date,
        end_date
      } = req.query;

      const result = await ForecastingService.getForecasts({
        page: Number(page),
        limit: Number(limit),
        targetType: target_type,
        targetId: target_id ? Number(target_id) : null,
        startDate: start_date,
        endDate: end_date
      });

      return ApiResponse.ok(res, result.forecasts, 'Demand forecasts retrieved successfully', {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/forecasting/accuracy
   * Compares predicted demand against actual sales
   */
  async getAccuracy(req, res, next) {
    try {
      const result = await ForecastingService.getForecastAccuracy();
      return ApiResponse.ok(res, result, 'Forecast accuracy evaluated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/forecasting/ingredient-demand
   * Computes daily and aggregated ingredient demand via recipe BOM expansion
   */
  async getIngredientDemand(req, res, next) {
    try {
      const { start_date, end_date } = req.query;
      const result = await ForecastingService.getIngredientDemand({
        startDate: start_date,
        endDate: end_date
      });
      return ApiResponse.ok(res, result, 'Ingredient demand derived successfully from recipe BOM');
    } catch (err) {
      next(err);
    }
  }
};
