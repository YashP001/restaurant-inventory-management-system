import { OrderService } from '../services/order.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const OrderController = {
  /**
   * @route   GET /api/v1/orders
   * @desc    List customer orders with pagination, status, type, and date filters
   * @access  Private (Authenticated Staff)
   */
  async listOrders(req, res, next) {
    try {
      const { page, limit, status, order_type, table_id, start_date, end_date, search } = req.query;
      const result = await OrderService.listOrders({
        page,
        limit,
        status,
        order_type,
        table_id,
        start_date,
        end_date,
        search
      });

      return ApiResponse.ok(res, result.orders, 'Orders retrieved successfully', {
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
   * @route   GET /api/v1/orders/:id
   * @desc    Get detailed customer order by ID or order_number with line items and fulfillment history
   * @access  Private (Authenticated Staff)
   */
  async getOrderById(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderService.getOrderById(id);
      return ApiResponse.ok(res, order, 'Order retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/orders
   * @desc    Create a new customer order in PENDING status
   * @access  Private (ADMIN, CASHIER, CHEF)
   */
  async createOrder(req, res, next) {
    try {
      const order = await OrderService.createOrder(req.body, req.user, req.id);
      return ApiResponse.created(res, order, 'Order created successfully in PENDING status');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/orders/:id/items
   * @desc    Add a line item to a PENDING order
   * @access  Private (ADMIN, CASHIER, CHEF)
   */
  async addOrderItem(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderService.addOrderItem(id, req.body, req.user, req.id);
      return ApiResponse.created(res, order, 'Line item added to order successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/orders/:id/items/:itemId
   * @desc    Update a line item on a PENDING order
   * @access  Private (ADMIN, CASHIER, CHEF)
   */
  async updateOrderItem(req, res, next) {
    try {
      const { id, itemId } = req.params;
      const order = await OrderService.updateOrderItem(id, itemId, req.body, req.user, req.id);
      return ApiResponse.ok(res, order, 'Order line item updated successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   DELETE /api/v1/orders/:id/items/:itemId
   * @desc    Remove a line item from a PENDING order
   * @access  Private (ADMIN, CASHIER, CHEF)
   */
  async deleteOrderItem(req, res, next) {
    try {
      const { id, itemId } = req.params;
      const order = await OrderService.deleteOrderItem(id, itemId, req.user, req.id);
      return ApiResponse.ok(res, order, 'Order line item removed successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/orders/:id/confirm
   * @desc    Confirm a PENDING order and trigger atomic FEFO inventory deduction procedure
   * @access  Private (ADMIN, CHEF, CASHIER)
   */
  async confirmOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderService.confirmOrder(id, req.user, req.id);
      return ApiResponse.ok(res, order, 'Order confirmed and inventory deducted via FEFO procedure');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/orders/:id/ready
   * @desc    Advance order status from PREPARING to READY_FOR_PICKUP
   * @access  Private (ADMIN, CHEF)
   */
  async markOrderReady(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderService.markOrderReady(id, req.user, req.id);
      return ApiResponse.ok(res, order, 'Order marked as ready for pickup');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/orders/:id/deliver
   * @desc    Advance order status from READY_FOR_PICKUP to DELIVERED (ONLINE orders)
   * @access  Private (ADMIN, CASHIER)
   */
  async deliverOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderService.deliverOrder(id, req.user, req.id);
      return ApiResponse.ok(res, order, 'Order marked as delivered');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/orders/:id/complete
   * @desc    Complete a customer order
   * @access  Private (ADMIN, CHEF, CASHIER)
   */
  async completeOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderService.completeOrder(id, req.user, req.id);
      return ApiResponse.ok(res, order, 'Order completed successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/orders/:id/cancel
   * @desc    Cancel a customer order (with optional waste recording for prepared items)
   * @access  Private (ADMIN, CASHIER, CHEF)
   */
  async cancelOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderService.cancelOrder(id, req.user, req.body || {}, req.id);
      return ApiResponse.ok(res, order, 'Order cancelled successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default OrderController;
