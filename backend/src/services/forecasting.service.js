import { ForecastModel } from '../models/sql/forecast.model.js';
import { BOMService } from './bom.service.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { env } from '../config/env.js';

const FORECASTING_SERVICE_URL = env.FORECASTING_SERVICE_URL || 'http://localhost:8000';

export const ForecastingService = {
  /**
   * Orchestrates 7-day demand forecasting:
   * 1. Extracts real completed sales from MySQL.
   * 2. Calls Python FastAPI /api/v1/predict/demand.
   * 3. Validates response and data-through date.
   * 4. Persists menu-item forecasts in MySQL `demand_forecasts`.
   * 5. Logs to MongoDB audit trail non-blockingly.
   */
  async generateAndSaveForecasts({ actingUser, horizonDays = 7, requestId = null } = {}) {
    // 1. Extract historical completed sales from MySQL
    const salesHistory = await ForecastModel.getCompletedSalesHistory();
    if (!salesHistory || salesHistory.length === 0) {
      throw ApiError.badRequest('No completed sales records found in database to generate forecasts.', 'INSUFFICIENT_DATA');
    }

    // Determine data-through date
    const distinctDates = Array.from(new Set(salesHistory.map(r => r.date))).sort();
    if (distinctDates.length < 14) {
      throw ApiError.badRequest(
        `At least 14 days of completed historical sales are required for 7-day forecasting. Found ${distinctDates.length} days.`,
        'INSUFFICIENT_HISTORY'
      );
    }
    const dataThroughDate = distinctDates[distinctDates.length - 1];

    // 2. Call FastAPI microservice
    let forecastResponse;
    const url = `${FORECASTING_SERVICE_URL}/api/v1/predict/demand`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_history: salesHistory,
          forecast_horizon_days: horizonDays
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Forecasting microservice returned HTTP ${response.status}: ${errorText}`);
      }

      forecastResponse = await response.json();
    } catch (err) {
      const isTimeout = err.name === 'TimeoutError' || err.message.includes('timeout');
      const detail = isTimeout
        ? `Forecasting service request timed out after 30s (${url})`
        : `Forecasting service unavailable at ${url}: ${err.message}`;
      
      throw ApiError.serviceUnavailable(detail, 'FORECAST_SERVICE_UNAVAILABLE');
    }

    if (!forecastResponse || !Array.isArray(forecastResponse.forecasts) || forecastResponse.forecasts.length === 0) {
      throw ApiError.internal('Invalid or empty response payload from forecasting microservice', 'INVALID_FORECAST_PAYLOAD');
    }

    // 3. Prepare records for persistence
    const modelVersionStr = `${forecastResponse.model_name}@${forecastResponse.model_version || '1.0.0'}`;
    const persistRecords = forecastResponse.forecasts.map(f => ({
      forecast_date: f.date,
      target_type: 'MENU_ITEM',
      target_id: Number(f.menu_item_id),
      predicted_quantity: Number(f.predicted_quantity),
      confidence_lower_bound: Number(f.confidence_lower_bound),
      confidence_upper_bound: Number(f.confidence_upper_bound),
      model_version: modelVersionStr
    }));

    // 4. Upsert forecasts in MySQL demand_forecasts
    const affected = await ForecastModel.upsertForecasts(persistRecords);

    // 5. MongoDB Audit Log (non-blocking)
    if (actingUser) {
      AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'FORECAST_GENERATED',
        resourceType: 'DEMAND_FORECAST',
        resourceId: 'BATCH_GENERATE',
        metadata: {
          dataThroughDate,
          forecastStartDate: persistRecords[0]?.forecast_date,
          forecastEndDate: persistRecords[persistRecords.length - 1]?.forecast_date,
          totalForecasts: persistRecords.length,
          modelName: forecastResponse.model_name,
          modelVersion: modelVersionStr,
          affectedRows: affected
        },
        requestId
      }).catch(e => console.error('[AuditLog] Forecast logging error:', e.message));
    }

    return {
      status: 'success',
      data_through_date: dataThroughDate,
      forecast_start_date: persistRecords[0]?.forecast_date,
      forecast_end_date: persistRecords[persistRecords.length - 1]?.forecast_date,
      forecast_horizon_days: horizonDays,
      total_forecasts: persistRecords.length,
      model_name: forecastResponse.model_name,
      model_version: modelVersionStr,
      uncertainty_method: forecastResponse.uncertainty_method || 'empirical_residual_std_provisional',
      forecasts: persistRecords
    };
  },

  /**
   * Retrieves saved demand forecasts from MySQL
   */
  async getForecasts(filters = {}) {
    return await ForecastModel.findForecasts(filters);
  },

  /**
   * Calculates forecast accuracy where historical actuals are available.
   * Compares predicted quantity against realized sales on overlapping dates.
   */
  async getForecastAccuracy() {
    const pool = (await import('../config/mysql.js')).getMySQLPool();
    const sql = `
      SELECT 
        df.forecast_date,
        df.target_id AS menu_item_id,
        m.name AS menu_item_name,
        CAST(df.predicted_quantity AS DECIMAL(10, 3)) AS predicted_quantity,
        CAST(COALESCE(SUM(oi.quantity), 0.000) AS DECIMAL(10, 3)) AS actual_quantity,
        df.model_version
      FROM \`demand_forecasts\` df
      JOIN \`menu_items\` m ON df.target_id = m.id AND df.target_type = 'MENU_ITEM'
      LEFT JOIN \`orders\` o ON DATE(o.order_date) = df.forecast_date AND o.status = 'COMPLETED'
      LEFT JOIN \`order_items\` oi ON oi.order_id = o.id AND oi.menu_item_id = df.target_id
      GROUP BY df.forecast_date, df.target_id, m.name, df.predicted_quantity, df.model_version
      HAVING actual_quantity > 0
      ORDER BY df.forecast_date DESC, df.target_id ASC;
    `;
    const [rows] = await pool.query(sql);

    if (rows.length === 0) {
      return {
        message: 'No overlapping forecast dates with completed sales actuals found yet.',
        metrics: { mae: null, rmse: null, wmape: null, sample_size: 0 },
        evaluations: []
      };
    }

    let sumAbsError = 0;
    let sumSqError = 0;
    let sumActual = 0;

    const evaluations = rows.map(r => {
      const pred = Number(r.predicted_quantity);
      const actual = Number(r.actual_quantity);
      const error = actual - pred;
      const absError = Math.abs(error);

      sumAbsError += absError;
      sumSqError += (error * error);
      sumActual += actual;

      return {
        forecast_date: r.forecast_date instanceof Date ? r.forecast_date.toISOString().split('T')[0] : String(r.forecast_date),
        menu_item_id: r.menu_item_id,
        menu_item_name: r.menu_item_name,
        predicted_quantity: pred,
        actual_quantity: actual,
        absolute_error: Number(absError.toFixed(3)),
        model_version: r.model_version
      };
    });

    const n = evaluations.length;
    const mae = sumAbsError / n;
    const rmse = Math.sqrt(sumSqError / n);
    const wmape = sumActual > 0 ? (sumAbsError / sumActual) * 100 : 0.0;

    return {
      metrics: {
        mae: Number(mae.toFixed(4)),
        rmse: Number(rmse.toFixed(4)),
        wmape: Number(wmape.toFixed(2)),
        sample_size: n
      },
      evaluations
    };
  },

  /**
   * Expands current or specified menu forecasts into ingredient demand via recipe BOM.
   */
  async getIngredientDemand({ startDate = null, endDate = null } = {}) {
    // 1. Fetch menu forecasts
    const forecastResult = await ForecastModel.findForecasts({
      startDate,
      endDate,
      targetType: 'MENU_ITEM',
      limit: 500
    });

    if (forecastResult.forecasts.length === 0) {
      return {
        message: 'No menu forecasts found for the specified period. Run /forecasting/generate first.',
        dailyIngredientDemand: [],
        aggregatedIngredientDemand: [],
        summary: { totalMenuForecastLines: 0, totalExpandedLines: 0, uniqueIngredientsCount: 0 }
      };
    }

    // 2. Fetch active recipe BOM definitions
    const recipesBOM = await ForecastModel.getActiveRecipesWithBOM();

    // 3. Convert menu forecasts to ingredient demand
    return BOMService.expandMenuForecastsToIngredients(
      forecastResult.forecasts.map(f => ({
        date: f.forecast_date,
        menu_item_id: f.target_id,
        predicted_quantity: f.predicted_quantity
      })),
      recipesBOM
    );
  }
};
