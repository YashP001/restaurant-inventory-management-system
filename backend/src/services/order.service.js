import { OrderModel } from '../models/sql/order.model.js';
import { MenuItemModel } from '../models/sql/menuItem.model.js';
import { PaymentModel } from '../models/sql/payment.model.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { getMySQLPool } from '../config/mysql.js';

export const OrderService = {
  /**
   * Retrieves paginated orders list with status, type, and date filtering
   */
  async listOrders(filters = {}) {
    return await OrderModel.listOrders(filters);
  },

  /**
   * Retrieves detailed order record by ID or order_number with line items, payments, and consumptions
   */
  async getOrderById(idOrNumber) {
    const order = await OrderModel.findOrderById(idOrNumber);
    if (!order) {
      throw ApiError.notFound(`Order '${idOrNumber}' not found`, 'ORDER_NOT_FOUND');
    }

    const items = await OrderModel.findOrderItems(order.id);
    const payments = await PaymentModel.findPaymentsByOrderId(order.id);
    const consumptions = await OrderModel.findOrderConsumptions(order.id);

    return {
      ...order,
      items,
      payments,
      consumptions
    };
  },

  /**
   * Creates a new order in PENDING status with unique order_number and optional initial items
   * Executes within a dedicated MySQL InnoDB transaction
   */
  async createOrder(data, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Dining Table validation if specified
      let tableNumber = null;
      if (data.table_id) {
        const table = await OrderModel.findTableById(data.table_id, connection);
        if (!table) {
          throw ApiError.notFound(`Dining table with ID ${data.table_id} not found`, 'TABLE_NOT_FOUND');
        }
        if (table.status === 'OUT_OF_SERVICE') {
          throw ApiError.badRequest(`Dining table '${table.table_number}' is currently out of service`, 'TABLE_OUT_OF_SERVICE');
        }
        tableNumber = table.table_number;

        // Mark table as OCCUPIED for dine-in orders
        if (data.order_type === 'DINE_IN') {
          await OrderModel.updateTableStatus(data.table_id, 'OCCUPIED', connection);
        }
      }

      // 2. Generate unique order number (UB-ORD-XXXX)
      const orderNumber = await OrderModel.getNextOrderNumber(connection);

      // 3. Create order header
      const orderId = await OrderModel.createOrder({
        order_number: orderNumber,
        order_type: data.order_type,
        table_id: data.table_id || null,
        user_id: actingUser.id,
        status: 'PENDING',
        subtotal: 0.00,
        tax_amount: 0.00,
        discount_amount: 0.00,
        total_amount: 0.00,
        notes: data.notes || null
      }, connection);

      // 4. Add initial line items if provided
      if (data.items && data.items.length > 0) {
        let orderSubtotal = 0;

        for (const item of data.items) {
          const menuItem = await MenuItemModel.findById(item.menu_item_id);
          if (!menuItem) {
            throw ApiError.notFound(`Menu item with ID ${item.menu_item_id} not found`, 'MENU_ITEM_NOT_FOUND');
          }
          if (!menuItem.is_available) {
            throw ApiError.badRequest(`Menu item '${menuItem.name}' is currently unavailable`, 'MENU_ITEM_UNAVAILABLE');
          }

          if (item.quantity < 1) {
            throw ApiError.badRequest('Item quantity must be at least 1', 'INVALID_QUANTITY');
          }

          // Freeze live selling price snapshot
          const unitPrice = menuItem.selling_price;
          const lineSubtotal = Number((item.quantity * unitPrice).toFixed(2));
          orderSubtotal += lineSubtotal;

          await OrderModel.createOrderItem({
            order_id: orderId,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            unit_price: unitPrice,
            subtotal: lineSubtotal,
            special_instructions: item.special_instructions || null
          }, connection);
        }

        // Recalculate order totals (subtotal + 5% standard tax)
        await OrderModel.recalculateOrderTotals(orderId, connection);
      }

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'ORDER_CREATED',
        resourceType: 'ORDER',
        resourceId: String(orderId),
        requestId,
        metadata: {
          orderId,
          orderNumber,
          orderType: data.order_type,
          tableId: data.table_id || null,
          tableNumber,
          itemsCount: data.items ? data.items.length : 0
        }
      });

      return await this.getOrderById(orderId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Adds a line item to a PENDING customer order
   * Freezes current menu item selling price and recalculates totals under row lock
   */
  async addOrderItem(orderId, itemData, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock order
      const order = await OrderModel.findOrderWithLock(orderId, connection);
      if (!order) {
        throw ApiError.notFound(`Order with ID ${orderId} not found`, 'ORDER_NOT_FOUND');
      }

      // 2. State verification: items can only be modified in PENDING status
      if (order.status !== 'PENDING') {
        throw ApiError.badRequest(
          `Cannot add items to order '${order.order_number}' because it is in '${order.status}' status. Only PENDING orders can be modified.`,
          'ORDER_NOT_IN_PENDING_STATUS'
        );
      }

      // 3. Menu item verification & availability
      const menuItem = await MenuItemModel.findById(itemData.menu_item_id);
      if (!menuItem) {
        throw ApiError.notFound(`Menu item with ID ${itemData.menu_item_id} not found`, 'MENU_ITEM_NOT_FOUND');
      }
      if (!menuItem.is_available) {
        throw ApiError.badRequest(`Menu item '${menuItem.name}' is currently unavailable`, 'MENU_ITEM_UNAVAILABLE');
      }

      if (itemData.quantity < 1) {
        throw ApiError.badRequest('quantity must be at least 1', 'INVALID_QUANTITY');
      }

      // 4. Freeze selling price snapshot
      const unitPrice = menuItem.selling_price;
      const subtotal = Number((itemData.quantity * unitPrice).toFixed(2));

      // 5. Insert line item
      const itemId = await OrderModel.createOrderItem({
        order_id: order.id,
        menu_item_id: itemData.menu_item_id,
        quantity: itemData.quantity,
        unit_price: unitPrice,
        subtotal,
        special_instructions: itemData.special_instructions || null
      }, connection);

      // 6. Recalculate order totals
      await OrderModel.recalculateOrderTotals(order.id, connection);

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'ORDER_ITEM_ADDED',
        resourceType: 'ORDER_ITEM',
        resourceId: String(itemId),
        requestId,
        metadata: {
          orderId: order.id,
          orderNumber: order.order_number,
          itemId,
          menuItemId: itemData.menu_item_id,
          menuItemName: menuItem.name,
          quantity: itemData.quantity,
          unitPrice,
          subtotal
        }
      });

      return await this.getOrderById(order.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Updates line item quantity on a PENDING customer order
   * Recalculates subtotal and order totals under row lock
   */
  async updateOrderItem(orderId, itemId, updateData, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock order
      const order = await OrderModel.findOrderWithLock(orderId, connection);
      if (!order) {
        throw ApiError.notFound(`Order with ID ${orderId} not found`, 'ORDER_NOT_FOUND');
      }

      // 2. State verification
      if (order.status !== 'PENDING') {
        throw ApiError.badRequest(
          `Cannot modify items on order '${order.order_number}' because it is in '${order.status}' status. Only PENDING orders can be modified.`,
          'ORDER_NOT_IN_PENDING_STATUS'
        );
      }

      // 3. Lock item and verify ownership
      const item = await OrderModel.findOrderItemWithLock(itemId, connection);
      if (!item || item.order_id !== order.id) {
        throw ApiError.notFound(`Item with ID ${itemId} does not belong to order '${order.order_number}'`, 'ORDER_ITEM_NOT_FOUND');
      }

      const newQuantity = updateData.quantity !== undefined ? updateData.quantity : item.quantity;
      if (newQuantity < 1) {
        throw ApiError.badRequest('quantity must be at least 1', 'INVALID_QUANTITY');
      }

      const newSubtotal = Number((newQuantity * item.unit_price).toFixed(2));

      // 4. Update line item
      await OrderModel.updateOrderItem(itemId, {
        quantity: newQuantity,
        subtotal: newSubtotal,
        special_instructions: updateData.special_instructions
      }, connection);

      // 5. Recalculate order totals
      await OrderModel.recalculateOrderTotals(order.id, connection);

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'ORDER_ITEM_UPDATED',
        resourceType: 'ORDER_ITEM',
        resourceId: String(itemId),
        requestId,
        metadata: {
          orderId: order.id,
          orderNumber: order.order_number,
          itemId,
          previousQuantity: item.quantity,
          newQuantity,
          unitPrice: item.unit_price,
          newSubtotal
        }
      });

      return await this.getOrderById(order.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Removes a line item from a PENDING customer order
   * Recalculates order totals under row lock
   */
  async deleteOrderItem(orderId, itemId, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock order
      const order = await OrderModel.findOrderWithLock(orderId, connection);
      if (!order) {
        throw ApiError.notFound(`Order with ID ${orderId} not found`, 'ORDER_NOT_FOUND');
      }

      // 2. State verification
      if (order.status !== 'PENDING') {
        throw ApiError.badRequest(
          `Cannot remove items from order '${order.order_number}' because it is in '${order.status}' status. Only PENDING orders can be modified.`,
          'ORDER_NOT_IN_PENDING_STATUS'
        );
      }

      // 3. Lock item and verify ownership
      const item = await OrderModel.findOrderItemWithLock(itemId, connection);
      if (!item || item.order_id !== order.id) {
        throw ApiError.notFound(`Item with ID ${itemId} does not belong to order '${order.order_number}'`, 'ORDER_ITEM_NOT_FOUND');
      }

      // 4. Delete item
      await OrderModel.deleteOrderItem(itemId, connection);

      // 5. Recalculate order totals
      await OrderModel.recalculateOrderTotals(order.id, connection);

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'ORDER_ITEM_REMOVED',
        resourceType: 'ORDER_ITEM',
        resourceId: String(itemId),
        requestId,
        metadata: {
          orderId: order.id,
          orderNumber: order.order_number,
          itemId,
          menuItemId: item.menu_item_id,
          menuItemName: item.menu_item_name,
          removedQuantity: item.quantity
        }
      });

      return await this.getOrderById(order.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Confirms a PENDING order and triggers atomic FEFO inventory deduction procedure
   * Note: sp_process_order_fefo manages its own internal START TRANSACTION / COMMIT boundary.
   */
  async confirmOrder(orderId, actingUser, requestId = null) {
    // 1. Pre-validation on order state
    const order = await OrderModel.findOrderById(orderId);
    if (!order) {
      throw ApiError.notFound(`Order with ID ${orderId} not found`, 'ORDER_NOT_FOUND');
    }

    if (order.status === 'PREPARING') {
      throw ApiError.badRequest(`Order '${order.order_number}' has already been confirmed and is in PREPARING status`, 'ORDER_ALREADY_CONFIRMED');
    }
    if (order.status === 'COMPLETED') {
      throw ApiError.badRequest(`Cannot confirm completed order '${order.order_number}'`, 'ORDER_ALREADY_COMPLETED');
    }
    if (order.status === 'CANCELLED') {
      throw ApiError.badRequest(`Cannot confirm cancelled order '${order.order_number}'`, 'ORDER_CANCELLED');
    }
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw ApiError.badRequest(`Cannot confirm order in '${order.status}' status. Only PENDING orders can be confirmed.`, 'ORDER_CANNOT_BE_CONFIRMED');
    }

    // 2. Verify line items exist
    const items = await OrderModel.findOrderItems(order.id);
    if (items.length === 0) {
      throw ApiError.badRequest(`Cannot confirm order '${order.order_number}' with no line items. Please add at least one item before confirming.`, 'ORDER_HAS_NO_ITEMS');
    }

    // 3. Execute FEFO procedure on a dedicated MySQL connection
    // The procedure acquires SELECT ... FOR UPDATE on the order, executes pre-flight stock checks,
    // decrements batches, inserts consumptions, inserts stock movements, sets status = 'PREPARING', and commits.
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await OrderModel.callFEFOProcedure(order.id, connection);
    } catch (error) {
      // Catch procedure custom SIGNAL SQLSTATE '45000'
      const msg = error.sqlMessage || error.message || 'FEFO inventory deduction failed';
      if (msg.includes('Insufficient stock')) {
        throw ApiError.badRequest(msg, 'FEFO_INSUFFICIENT_STOCK');
      }
      if (msg.includes('Order items do not have configured recipe ingredients')) {
        throw ApiError.badRequest(msg, 'MISSING_RECIPE_BOM');
      }
      throw ApiError.badRequest(msg, 'FEFO_PROCESSING_FAILED');
    } finally {
      connection.release();
    }

    // 4. Audit Log
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'ORDER_CONFIRMED',
      resourceType: 'ORDER',
      resourceId: String(order.id),
      requestId,
      metadata: {
        orderId: order.id,
        orderNumber: order.order_number,
        itemsCount: items.length,
        totalAmount: order.total_amount,
        fefoExecuted: true
      }
    });

    return await this.getOrderById(order.id);
  },

  /**
   * Completes a customer order from PREPARING status
   * Ensures stock is NOT deducted again and frees dining table if occupied
   */
  async completeOrder(orderId, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock order
      const order = await OrderModel.findOrderWithLock(orderId, connection);
      if (!order) {
        throw ApiError.notFound(`Order with ID ${orderId} not found`, 'ORDER_NOT_FOUND');
      }

      // 2. Lifecycle state validation
      if (order.status === 'COMPLETED') {
        throw ApiError.badRequest(`Order '${order.order_number}' is already completed`, 'ORDER_ALREADY_COMPLETED');
      }
      if (order.status !== 'PREPARING') {
        throw ApiError.badRequest(
          `Cannot complete order '${order.order_number}' in '${order.status}' status. Only orders in PREPARING status can be completed.`,
          'ORDER_CANNOT_BE_COMPLETED'
        );
      }

      // 3. Advance status to COMPLETED
      const completedAt = new Date();
      await OrderModel.updateOrderStatus(order.id, 'COMPLETED', completedAt, connection);

      // 4. Free dining table if occupied by this order
      if (order.table_id) {
        await OrderModel.updateTableStatus(order.table_id, 'VACANT', connection);
      }

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'ORDER_COMPLETED',
        resourceType: 'ORDER',
        resourceId: String(order.id),
        requestId,
        metadata: {
          orderId: order.id,
          orderNumber: order.order_number,
          completedAt
        }
      });

      return await this.getOrderById(order.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Cancels a customer order with safe ledger preservation rules
   */
  async cancelOrder(orderId, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock order
      const order = await OrderModel.findOrderWithLock(orderId, connection);
      if (!order) {
        throw ApiError.notFound(`Order with ID ${orderId} not found`, 'ORDER_NOT_FOUND');
      }

      // 2. Validation
      if (order.status === 'COMPLETED') {
        throw ApiError.badRequest(`Cannot cancel completed order '${order.order_number}'`, 'ORDER_ALREADY_COMPLETED');
      }
      if (order.status === 'CANCELLED') {
        throw ApiError.badRequest(`Order '${order.order_number}' is already cancelled`, 'ORDER_ALREADY_CANCELLED');
      }

      const previousStatus = order.status;

      // 3. Transition status to CANCELLED
      // Note: If order was in 'PREPARING', ingredients were already physically consumed by FEFO.
      // In accordance with restaurant inventory standards and database ledger integrity,
      // order_ingredient_consumptions and stock_movements remain intact.
      await OrderModel.updateOrderStatus(order.id, 'CANCELLED', null, connection);

      // 4. Free dining table if attached
      if (order.table_id) {
        await OrderModel.updateTableStatus(order.table_id, 'VACANT', connection);
      }

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'ORDER_CANCELLED',
        resourceType: 'ORDER',
        resourceId: String(order.id),
        requestId,
        metadata: {
          orderId: order.id,
          orderNumber: order.order_number,
          previousStatus
        }
      });

      return await this.getOrderById(order.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

export default OrderService;
