import { Router } from 'express';
import { InventoryController } from '../../controllers/inventory.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  inventoryOverviewQuerySchema,
  ingredientIdParamSchema,
  batchIdParamSchema,
  listBatchesQuerySchema,
  expiringBatchesQuerySchema,
  lowStockQuerySchema,
  stockMovementsQuerySchema
} from '../../validations/inventory.validation.js';

const router = Router();

// All inventory endpoints require authenticated staff (live-role verification)
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/inventory
 * @desc    List ingredient stock levels, base units, thresholds, and stock status
 * @access  Private (Authenticated Staff)
 */
router.get('/', validate(inventoryOverviewQuerySchema), InventoryController.getOverview);

/**
 * @route   GET /api/v1/inventory/summary
 * @desc    Retrieve high-level inventory KPIs, valuation, and stock health metrics
 * @access  Private (Authenticated Staff)
 */
router.get('/summary', InventoryController.getSummary);

/**
 * @route   GET /api/v1/inventory/expiring
 * @desc    Retrieve batches expiring within configured days or already expired
 * @access  Private (Authenticated Staff)
 */
router.get('/expiring', validate(expiringBatchesQuerySchema), InventoryController.getExpiringBatches);

/**
 * @route   GET /api/v1/inventory/low-stock
 * @desc    Retrieve ingredients below safety stock or completely depleted
 * @access  Private (Authenticated Staff)
 */
router.get('/low-stock', validate(lowStockQuerySchema), InventoryController.getLowStockIngredients);

/**
 * @route   GET /api/v1/inventory/movements
 * @desc    Retrieve immutable stock movements audit ledger
 * @access  Private (Authenticated Staff)
 */
router.get('/movements', validate(stockMovementsQuerySchema), InventoryController.getStockMovements);

/**
 * @route   GET /api/v1/inventory/batches
 * @desc    List physical inventory lots with FEFO sorting and filtering
 * @access  Private (Authenticated Staff)
 */
router.get('/batches', validate(listBatchesQuerySchema), InventoryController.getBatches);

/**
 * @route   GET /api/v1/inventory/batches/:id
 * @desc    Get detailed inventory batch by ID with movement ledger
 * @access  Private (Authenticated Staff)
 */
router.get('/batches/:id', validate(batchIdParamSchema), InventoryController.getBatchById);

/**
 * @route   GET /api/v1/inventory/:ingredientId
 * @desc    Get complete inventory breakdown for an ingredient including batches and suppliers
 * @access  Private (Authenticated Staff)
 */
router.get('/:ingredientId', validate(ingredientIdParamSchema), InventoryController.getIngredientDetails);

export default router;
