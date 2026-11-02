import { Router } from 'express';
import { InventoryController } from '../../controllers/inventory.controller.js';
import { ReceiptController } from '../../controllers/receipt.controller.js';
import { AdjustmentController } from '../../controllers/adjustment.controller.js';
import { WasteController } from '../../controllers/waste.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
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
import {
  createReceiptSchema,
  listReceiptsQuerySchema,
  receiptIdParamSchema
} from '../../validations/receipt.validation.js';
import {
  createAdjustmentSchema,
  listAdjustmentsQuerySchema,
  adjustmentIdParamSchema
} from '../../validations/adjustment.validation.js';
import {
  createWasteSchema,
  listWasteQuerySchema,
  wasteIdParamSchema
} from '../../validations/waste.validation.js';

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
 * @route   POST /api/v1/inventory/receipts
 * @desc    Receive inventory stock against a purchase order (atomic transaction)
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/receipts',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validate(createReceiptSchema),
  ReceiptController.receiveStock
);

/**
 * @route   GET /api/v1/inventory/receipts
 * @desc    List stock receipts grouped by purchase order
 * @access  Private (Authenticated Staff)
 */
router.get('/receipts', validate(listReceiptsQuerySchema), ReceiptController.getReceipts);

/**
 * @route   GET /api/v1/inventory/receipts/:id
 * @desc    Get detailed stock receipt breakdown for a purchase order
 * @access  Private (Authenticated Staff)
 */
router.get('/receipts/:id', validate(receiptIdParamSchema), ReceiptController.getReceiptById);

/**
 * @route   POST /api/v1/inventory/adjustments
 * @desc    Perform manual stock increase or decrease on an inventory batch (atomic transaction)
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/adjustments',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validate(createAdjustmentSchema),
  AdjustmentController.adjustStock
);

/**
 * @route   GET /api/v1/inventory/adjustments
 * @desc    List manual stock adjustments audit ledger
 * @access  Private (Authenticated Staff)
 */
router.get('/adjustments', validate(listAdjustmentsQuerySchema), AdjustmentController.getAdjustments);

/**
 * @route   GET /api/v1/inventory/adjustments/:id
 * @desc    Get detailed manual stock adjustment by ID
 * @access  Private (Authenticated Staff)
 */
router.get('/adjustments/:id', validate(adjustmentIdParamSchema), AdjustmentController.getAdjustmentById);

/**
 * @route   POST /api/v1/inventory/waste
 * @desc    Record food waste and deduct stock from inventory batch (atomic transaction)
 * @access  Private (ADMIN, INVENTORY_MANAGER, CHEF)
 */
router.post(
  '/waste',
  requireRole('ADMIN', 'INVENTORY_MANAGER', 'CHEF'),
  validate(createWasteSchema),
  WasteController.recordWaste
);

/**
 * @route   GET /api/v1/inventory/waste
 * @desc    List recorded food waste events
 * @access  Private (Authenticated Staff)
 */
router.get('/waste', validate(listWasteQuerySchema), WasteController.getWasteRecords);

/**
 * @route   GET /api/v1/inventory/waste/:id
 * @desc    Get detailed waste record by ID
 * @access  Private (Authenticated Staff)
 */
router.get('/waste/:id', validate(wasteIdParamSchema), WasteController.getWasteRecordById);

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
