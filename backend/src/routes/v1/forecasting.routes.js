import { Router } from 'express';
import { ForecastingController } from '../../controllers/forecasting.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole, ROLES } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  generateForecastSchema,
  listForecastsQuerySchema,
  ingredientDemandQuerySchema
} from '../../validations/forecasting.validation.js';

const router = Router();

// Authentication required for all forecasting endpoints
router.use(authenticateJWT);

/**
 * @route   POST /api/v1/forecasting/generate
 * @desc    Generate and persist 7-day demand forecasts
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/generate',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(generateForecastSchema),
  ForecastingController.generateForecasts
);

/**
 * @route   GET /api/v1/forecasting
 * @desc    Retrieve saved forecasts with date and target filters
 * @access  Private (All authenticated staff)
 */
router.get(
  '/',
  validate(listForecastsQuerySchema),
  ForecastingController.getForecasts
);

/**
 * @route   GET /api/v1/forecasting/accuracy
 * @desc    Compare actual and predicted quantities
 * @access  Private (All authenticated staff)
 */
router.get(
  '/accuracy',
  ForecastingController.getAccuracy
);

/**
 * @route   GET /api/v1/forecasting/ingredient-demand
 * @desc    Return daily and aggregated ingredient demand via recipe BOM expansion
 * @access  Private (All authenticated staff)
 */
router.get(
  '/ingredient-demand',
  validate(ingredientDemandQuerySchema),
  ForecastingController.getIngredientDemand
);

export default router;

