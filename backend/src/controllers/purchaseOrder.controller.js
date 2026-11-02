import { PurchaseOrderService } from '../services/purchaseOrder.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const PurchaseOrderController = {
  /**
   * @route   GET /api/v1/purchase-orders
   * @desc    List purchase orders with pagination, status, supplier, date filters, and search
   * @access  Private (Authenticated Staff)
   */
  async listPurchaseOrders(req, res, next) {
    try {
      const { page, limit, status, supplier_id, start_date, end_date, search } = req.query;
      const result = await PurchaseOrderService.listPurchaseOrders({
        page,
        limit,
        status,
        supplier_id,
        start_date,
        end_date,
        search
      });

      return ApiResponse.ok(res, result.purchase_orders, 'Purchase orders retrieved successfully', {
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
   * @route   GET /api/v1/purchase-orders/:id
   * @desc    Get detailed purchase order by ID or PO number with line items
   * @access  Private (Authenticated Staff)
   */
  async getPurchaseOrderById(req, res, next) {
    try {
      const { id } = req.params;
      const po = await PurchaseOrderService.getPurchaseOrderById(id);
      return ApiResponse.ok(res, po, 'Purchase order retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/purchase-orders
   * @desc    Create a new purchase order in DRAFT status
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async createPurchaseOrder(req, res, next) {
    try {
      const po = await PurchaseOrderService.createPurchaseOrder(req.body, req.user, req.id);
      return ApiResponse.created(res, po, 'Purchase order created successfully in DRAFT status');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/purchase-orders/:id/items
   * @desc    Add a line item to a DRAFT purchase order
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async addPurchaseOrderItem(req, res, next) {
    try {
      const { id } = req.params;
      const po = await PurchaseOrderService.addPurchaseOrderItem(id, req.body, req.user, req.id);
      return ApiResponse.created(res, po, 'Line item added to purchase order successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/purchase-orders/:id/items/:itemId
   * @desc    Update an item on a DRAFT purchase order
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async updatePurchaseOrderItem(req, res, next) {
    try {
      const { id, itemId } = req.params;
      const po = await PurchaseOrderService.updatePurchaseOrderItem(id, itemId, req.body, req.user, req.id);
      return ApiResponse.ok(res, po, 'Purchase order item updated successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   DELETE /api/v1/purchase-orders/:id/items/:itemId
   * @desc    Remove an item from a DRAFT purchase order
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async deletePurchaseOrderItem(req, res, next) {
    try {
      const { id, itemId } = req.params;
      const po = await PurchaseOrderService.deletePurchaseOrderItem(id, itemId, req.user, req.id);
      return ApiResponse.ok(res, po, 'Purchase order item removed successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/purchase-orders/:id/submit
   * @desc    Submit a DRAFT purchase order
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async submitPurchaseOrder(req, res, next) {
    try {
      const { id } = req.params;
      const po = await PurchaseOrderService.submitPurchaseOrder(id, req.user, req.id);
      return ApiResponse.ok(res, po, 'Purchase order submitted successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/purchase-orders/:id/cancel
   * @desc    Cancel an eligible purchase order
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async cancelPurchaseOrder(req, res, next) {
    try {
      const { id } = req.params;
      const po = await PurchaseOrderService.cancelPurchaseOrder(id, req.user, req.id);
      return ApiResponse.ok(res, po, 'Purchase order cancelled successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default PurchaseOrderController;
