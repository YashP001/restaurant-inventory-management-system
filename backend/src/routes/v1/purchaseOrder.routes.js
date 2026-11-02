import { Router } from 'express';
import { PurchaseOrderController } from '../../controllers/purchaseOrder.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole, ROLES } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createPurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
  purchaseOrderIdParamSchema,
  addPurchaseOrderItemSchema,
  updatePurchaseOrderItemSchema,
  purchaseOrderItemParamSchema
} from '../../validations/purchaseOrder.validation.js';

const router = Router();

// Global authentication required for all purchase order endpoints
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/purchase-orders
 * @desc    List purchase orders with pagination, status, supplier, and date filtering
 * @access  Private (All authenticated staff)
 */
router.get(
  '/',
  validate(listPurchaseOrdersQuerySchema),
  PurchaseOrderController.listPurchaseOrders
);

/**
 * @route   POST /api/v1/purchase-orders
 * @desc    Create a new purchase order in DRAFT status
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(createPurchaseOrderSchema),
  PurchaseOrderController.createPurchaseOrder
);

/**
 * @route   GET /api/v1/purchase-orders/:id
 * @desc    Get detailed purchase order by ID or PO number with line items
 * @access  Private (All authenticated staff)
 */
router.get(
  '/:id',
  validate(purchaseOrderIdParamSchema),
  PurchaseOrderController.getPurchaseOrderById
);

/**
 * @route   POST /api/v1/purchase-orders/:id/items
 * @desc    Add a line item to a DRAFT purchase order
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/:id/items',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(purchaseOrderIdParamSchema),
  validate(addPurchaseOrderItemSchema),
  PurchaseOrderController.addPurchaseOrderItem
);

/**
 * @route   PATCH /api/v1/purchase-orders/:id/items/:itemId
 * @desc    Update a line item on a DRAFT purchase order
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.patch(
  '/:id/items/:itemId',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(purchaseOrderItemParamSchema),
  validate(updatePurchaseOrderItemSchema),
  PurchaseOrderController.updatePurchaseOrderItem
);

/**
 * @route   DELETE /api/v1/purchase-orders/:id/items/:itemId
 * @desc    Remove a line item from a DRAFT purchase order
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.delete(
  '/:id/items/:itemId',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(purchaseOrderItemParamSchema),
  PurchaseOrderController.deletePurchaseOrderItem
);

/**
 * @route   POST /api/v1/purchase-orders/:id/submit
 * @desc    Submit a DRAFT purchase order
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/:id/submit',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(purchaseOrderIdParamSchema),
  PurchaseOrderController.submitPurchaseOrder
);

/**
 * @route   POST /api/v1/purchase-orders/:id/cancel
 * @desc    Cancel an eligible purchase order
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/:id/cancel',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(purchaseOrderIdParamSchema),
  PurchaseOrderController.cancelPurchaseOrder
);

export default router;
