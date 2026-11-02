import { Router } from 'express';
import { OrderController } from '../../controllers/order.controller.js';
import { PaymentController } from '../../controllers/payment.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole, ROLES } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  addOrderItemSchema,
  updateOrderItemSchema,
  orderItemParamSchema,
  cancelOrderSchema
} from '../../validations/order.validation.js';
import { createPaymentSchema } from '../../validations/payment.validation.js';

const router = Router();

// Global authentication required for all customer order & payment endpoints
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/orders
 * @desc    List orders with pagination, status, order_type, table, and date filtering
 * @access  Private (All authenticated staff)
 */
router.get(
  '/',
  validate(listOrdersQuerySchema),
  OrderController.listOrders
);

/**
 * @route   POST /api/v1/orders
 * @desc    Create a new customer order in PENDING status
 * @access  Private (ADMIN, CASHIER, CHEF)
 */
router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.CASHIER, ROLES.CHEF),
  validate(createOrderSchema),
  OrderController.createOrder
);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get detailed customer order with items, payments, and consumptions
 * @access  Private (All authenticated staff)
 */
router.get(
  '/:id',
  validate(orderIdParamSchema),
  OrderController.getOrderById
);

/**
 * @route   POST /api/v1/orders/:id/items
 * @desc    Add a line item to a PENDING order
 * @access  Private (ADMIN, CASHIER, CHEF)
 */
router.post(
  '/:id/items',
  requireRole(ROLES.ADMIN, ROLES.CASHIER, ROLES.CHEF),
  validate(orderIdParamSchema),
  validate(addOrderItemSchema),
  OrderController.addOrderItem
);

/**
 * @route   PATCH /api/v1/orders/:id/items/:itemId
 * @desc    Update a line item on a PENDING order
 * @access  Private (ADMIN, CASHIER, CHEF)
 */
router.patch(
  '/:id/items/:itemId',
  requireRole(ROLES.ADMIN, ROLES.CASHIER, ROLES.CHEF),
  validate(orderItemParamSchema),
  validate(updateOrderItemSchema),
  OrderController.updateOrderItem
);

/**
 * @route   DELETE /api/v1/orders/:id/items/:itemId
 * @desc    Remove a line item from a PENDING order
 * @access  Private (ADMIN, CASHIER, CHEF)
 */
router.delete(
  '/:id/items/:itemId',
  requireRole(ROLES.ADMIN, ROLES.CASHIER, ROLES.CHEF),
  validate(orderItemParamSchema),
  OrderController.deleteOrderItem
);

/**
 * @route   POST /api/v1/orders/:id/confirm
 * @desc    Confirm a PENDING order and execute atomic FEFO inventory deduction procedure
 * @access  Private (ADMIN, CHEF, CASHIER)
 */
router.post(
  '/:id/confirm',
  requireRole(ROLES.ADMIN, ROLES.CHEF, ROLES.CASHIER),
  validate(orderIdParamSchema),
  OrderController.confirmOrder
);

/**
 * @route   POST /api/v1/orders/:id/ready
 * @desc    Advance order status from PREPARING to READY_FOR_PICKUP
 * @access  Private (ADMIN, CHEF)
 */
router.post(
  '/:id/ready',
  requireRole(ROLES.ADMIN, ROLES.CHEF),
  validate(orderIdParamSchema),
  OrderController.markOrderReady
);

/**
 * @route   POST /api/v1/orders/:id/deliver
 * @desc    Advance order status from READY_FOR_PICKUP to DELIVERED (ONLINE orders)
 * @access  Private (ADMIN, CASHIER)
 */
router.post(
  '/:id/deliver',
  requireRole(ROLES.ADMIN, ROLES.CASHIER),
  validate(orderIdParamSchema),
  OrderController.deliverOrder
);

/**
 * @route   POST /api/v1/orders/:id/complete
 * @desc    Complete an order from READY_FOR_PICKUP / DELIVERED / PREPARING status
 * @access  Private (ADMIN, CHEF, CASHIER)
 */
router.post(
  '/:id/complete',
  requireRole(ROLES.ADMIN, ROLES.CHEF, ROLES.CASHIER),
  validate(orderIdParamSchema),
  OrderController.completeOrder
);

/**
 * @route   POST /api/v1/orders/:id/cancel
 * @desc    Cancel a customer order (supports optional waste recording)
 * @access  Private (ADMIN, CASHIER, CHEF)
 */
router.post(
  '/:id/cancel',
  requireRole(ROLES.ADMIN, ROLES.CASHIER, ROLES.CHEF),
  validate(cancelOrderSchema),
  OrderController.cancelOrder
);

/**
 * @route   GET /api/v1/orders/:id/payments
 * @desc    List all payments recorded for an order
 * @access  Private (All authenticated staff)
 */
router.get(
  '/:id/payments',
  validate(orderIdParamSchema),
  PaymentController.getPaymentsByOrderId
);

/**
 * @route   POST /api/v1/orders/:id/payments
 * @desc    Record a payment against a customer order
 * @access  Private (ADMIN, CASHIER)
 */
router.post(
  '/:id/payments',
  requireRole(ROLES.ADMIN, ROLES.CASHIER),
  validate(orderIdParamSchema),
  validate(createPaymentSchema),
  PaymentController.recordPayment
);

export default router;
