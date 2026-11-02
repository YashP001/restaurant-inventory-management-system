import { PurchaseOrderModel } from '../models/sql/purchaseOrder.model.js';
import { SupplierModel } from '../models/sql/supplier.model.js';
import { IngredientModel } from '../models/sql/ingredient.model.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { getMySQLPool } from '../config/mysql.js';

export const PurchaseOrderService = {
  /**
   * Retrieves paginated purchase orders with filtering and search
   */
  async listPurchaseOrders(filters = {}) {
    return await PurchaseOrderModel.listPurchaseOrders(filters);
  },

  /**
   * Retrieves detailed purchase order by ID or PO number with line items
   */
  async getPurchaseOrderById(idOrNumber) {
    const po = await PurchaseOrderModel.findPOById(idOrNumber);
    if (!po) {
      throw ApiError.notFound(`Purchase order '${idOrNumber}' not found`, 'PURCHASE_ORDER_NOT_FOUND');
    }
    const items = await PurchaseOrderModel.findPOItems(po.id);
    return {
      ...po,
      items
    };
  },

  /**
   * Creates a new purchase order in DRAFT status with unique PO number and optional initial items
   * Executes within a dedicated MySQL InnoDB transaction
   */
  async createPurchaseOrder(data, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Validate supplier existence and active status
      const supplier = await SupplierModel.findById(data.supplier_id, connection);
      if (!supplier) {
        throw ApiError.notFound(`Supplier with ID ${data.supplier_id} not found`, 'SUPPLIER_NOT_FOUND');
      }
      if (!supplier.is_active) {
        throw ApiError.badRequest(`Cannot create purchase order for inactive supplier '${supplier.name}'`, 'SUPPLIER_INACTIVE');
      }

      // 2. Validate dates
      const orderDate = data.order_date || new Date().toISOString().split('T')[0];
      const expectedDeliveryDate = data.expected_delivery_date;
      if (expectedDeliveryDate < orderDate) {
        throw ApiError.badRequest('expected_delivery_date cannot be earlier than order_date', 'INVALID_PO_DATES');
      }

      // 3. Generate unique PO number inside transaction
      const year = orderDate.split('-')[0];
      const poNumber = await PurchaseOrderModel.getNextPONumber(year, connection);

      // 4. Create purchase order header
      const poId = await PurchaseOrderModel.createPurchaseOrder({
        po_number: poNumber,
        supplier_id: data.supplier_id,
        created_by_user_id: actingUser.id,
        status: 'DRAFT',
        total_amount: 0.00,
        order_date: orderDate,
        expected_delivery_date: expectedDeliveryDate,
        notes: data.notes || null
      }, connection);

      // 5. Add initial items if provided
      if (data.items && data.items.length > 0) {
        const seenIngredients = new Set();

        for (const item of data.items) {
          if (seenIngredients.has(item.ingredient_id)) {
            throw ApiError.badRequest(
              `Duplicate ingredient ID ${item.ingredient_id} in items list. Specify each ingredient once.`,
              'DUPLICATE_ITEM_IN_PAYLOAD'
            );
          }
          seenIngredients.add(item.ingredient_id);

          const ingredient = await IngredientModel.findById(item.ingredient_id);
          if (!ingredient) {
            throw ApiError.notFound(`Ingredient with ID ${item.ingredient_id} not found`, 'INGREDIENT_NOT_FOUND');
          }

          // Validate supplier-ingredient mapping
          const mapping = await SupplierModel.findSupplierIngredient(data.supplier_id, item.ingredient_id, connection);
          if (!mapping) {
            throw ApiError.badRequest(
              `Ingredient '${ingredient.name}' is not supplied by '${supplier.name}'`,
              'INVALID_SUPPLIER_INGREDIENT'
            );
          }

          const unitCost = item.unit_cost !== undefined ? item.unit_cost : mapping.contract_unit_cost;
          if (item.quantity_ordered <= 0) {
            throw ApiError.badRequest('quantity_ordered must be strictly greater than 0', 'INVALID_QUANTITY');
          }
          if (unitCost < 0) {
            throw ApiError.badRequest('unit_cost cannot be negative', 'INVALID_UNIT_COST');
          }

          const subtotal = Number((item.quantity_ordered * unitCost).toFixed(2));

          await PurchaseOrderModel.createPurchaseOrderItem({
            purchase_order_id: poId,
            ingredient_id: item.ingredient_id,
            quantity_ordered: item.quantity_ordered,
            quantity_received: 0.000,
            unit_cost: unitCost,
            subtotal
          }, connection);
        }

        // Recalculate PO total amount
        await PurchaseOrderModel.recalculatePOTotal(poId, connection);
      }

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'PURCHASE_ORDER_CREATED',
        resourceType: 'PURCHASE_ORDER',
        resourceId: String(poId),
        requestId,
        metadata: {
          purchaseOrderId: poId,
          poNumber,
          supplierId: data.supplier_id,
          supplierName: supplier.name,
          orderDate,
          expectedDeliveryDate,
          itemCount: data.items ? data.items.length : 0
        }
      });

      return await this.getPurchaseOrderById(poId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Adds a new line item to a DRAFT purchase order
   * Recalculates PO total transactionally under row locks
   */
  async addPurchaseOrderItem(poId, itemData, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock purchase order
      const po = await PurchaseOrderModel.findPOWithLock(poId, connection);
      if (!po) {
        throw ApiError.notFound(`Purchase order with ID ${poId} not found`, 'PURCHASE_ORDER_NOT_FOUND');
      }

      // 2. Only allow modifications while DRAFT
      if (po.status !== 'DRAFT') {
        throw ApiError.badRequest(
          `Cannot add items to purchase order '${po.po_number}' because it is in '${po.status}' status. Only DRAFT purchase orders can be modified.`,
          'PO_NOT_IN_DRAFT_STATUS'
        );
      }

      // 3. Validate ingredient exists
      const ingredient = await IngredientModel.findById(itemData.ingredient_id);
      if (!ingredient) {
        throw ApiError.notFound(`Ingredient with ID ${itemData.ingredient_id} not found`, 'INGREDIENT_NOT_FOUND');
      }

      // 4. Validate supplier-ingredient relationship
      const mapping = await SupplierModel.findSupplierIngredient(po.supplier_id, itemData.ingredient_id, connection);
      if (!mapping) {
        throw ApiError.badRequest(
          `Ingredient '${ingredient.name}' is not supplied by '${po.supplier_name}'`,
          'INVALID_SUPPLIER_INGREDIENT'
        );
      }

      // 5. Prevent duplicate line items for the same ingredient
      const existingItems = await PurchaseOrderModel.findPOItemsWithLock(po.id, connection);
      const duplicate = existingItems.find(i => i.ingredient_id === itemData.ingredient_id);
      if (duplicate) {
        throw ApiError.conflict(
          `Ingredient '${ingredient.name}' is already in purchase order '${po.po_number}'. Please update the existing line item instead.`,
          'DUPLICATE_PO_ITEM'
        );
      }

      // 6. Validate cost and quantity
      const unitCost = itemData.unit_cost !== undefined ? itemData.unit_cost : mapping.contract_unit_cost;
      if (itemData.quantity_ordered <= 0) {
        throw ApiError.badRequest('quantity_ordered must be strictly greater than 0', 'INVALID_QUANTITY');
      }
      if (unitCost < 0) {
        throw ApiError.badRequest('unit_cost cannot be negative', 'INVALID_UNIT_COST');
      }

      const subtotal = Number((itemData.quantity_ordered * unitCost).toFixed(2));

      // 7. Insert line item
      const itemId = await PurchaseOrderModel.createPurchaseOrderItem({
        purchase_order_id: po.id,
        ingredient_id: itemData.ingredient_id,
        quantity_ordered: itemData.quantity_ordered,
        quantity_received: 0.000,
        unit_cost: unitCost,
        subtotal
      }, connection);

      // 8. Recalculate PO total
      await PurchaseOrderModel.recalculatePOTotal(po.id, connection);

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'PURCHASE_ORDER_ITEM_ADDED',
        resourceType: 'PURCHASE_ORDER_ITEM',
        resourceId: String(itemId),
        requestId,
        metadata: {
          purchaseOrderId: po.id,
          poNumber: po.po_number,
          itemId,
          ingredientId: itemData.ingredient_id,
          ingredientName: ingredient.name,
          quantityOrdered: itemData.quantity_ordered,
          unitCost,
          subtotal
        }
      });

      return await this.getPurchaseOrderById(po.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Updates an existing line item on a DRAFT purchase order
   * Recalculates subtotal and PO total transactionally under row locks
   */
  async updatePurchaseOrderItem(poId, itemId, updateData, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock purchase order
      const po = await PurchaseOrderModel.findPOWithLock(poId, connection);
      if (!po) {
        throw ApiError.notFound(`Purchase order with ID ${poId} not found`, 'PURCHASE_ORDER_NOT_FOUND');
      }

      // 2. Only allow modifications while DRAFT
      if (po.status !== 'DRAFT') {
        throw ApiError.badRequest(
          `Cannot modify items on purchase order '${po.po_number}' because it is in '${po.status}' status. Only DRAFT purchase orders can be modified.`,
          'PO_NOT_IN_DRAFT_STATUS'
        );
      }

      // 3. Lock PO item and verify it belongs to this PO
      const item = await PurchaseOrderModel.findPOItemByIdWithLock(itemId, connection);
      if (!item || item.purchase_order_id !== po.id) {
        throw ApiError.notFound(`Item with ID ${itemId} does not belong to purchase order '${po.po_number}'`, 'PO_ITEM_NOT_FOUND');
      }

      // 4. Validate updated quantity and cost
      const newQuantity = updateData.quantity_ordered !== undefined ? updateData.quantity_ordered : item.quantity_ordered;
      const newUnitCost = updateData.unit_cost !== undefined ? updateData.unit_cost : item.unit_cost;

      if (newQuantity <= 0) {
        throw ApiError.badRequest('quantity_ordered must be strictly greater than 0', 'INVALID_QUANTITY');
      }
      if (newUnitCost < 0) {
        throw ApiError.badRequest('unit_cost cannot be negative', 'INVALID_UNIT_COST');
      }

      const newSubtotal = Number((newQuantity * newUnitCost).toFixed(2));

      // 5. Update line item
      await PurchaseOrderModel.updatePurchaseOrderItem(itemId, {
        quantity_ordered: newQuantity,
        unit_cost: newUnitCost,
        subtotal: newSubtotal
      }, connection);

      // 6. Recalculate PO total
      await PurchaseOrderModel.recalculatePOTotal(po.id, connection);

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'PURCHASE_ORDER_ITEM_UPDATED',
        resourceType: 'PURCHASE_ORDER_ITEM',
        resourceId: String(itemId),
        requestId,
        metadata: {
          purchaseOrderId: po.id,
          poNumber: po.po_number,
          itemId,
          ingredientId: item.ingredient_id,
          ingredientName: item.ingredient_name,
          previousQuantity: item.quantity_ordered,
          newQuantity,
          previousUnitCost: item.unit_cost,
          newUnitCost,
          newSubtotal
        }
      });

      return await this.getPurchaseOrderById(po.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Removes a line item from a DRAFT purchase order
   * Recalculates PO total transactionally under row locks
   */
  async deletePurchaseOrderItem(poId, itemId, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock purchase order
      const po = await PurchaseOrderModel.findPOWithLock(poId, connection);
      if (!po) {
        throw ApiError.notFound(`Purchase order with ID ${poId} not found`, 'PURCHASE_ORDER_NOT_FOUND');
      }

      // 2. Only allow modifications while DRAFT
      if (po.status !== 'DRAFT') {
        throw ApiError.badRequest(
          `Cannot delete items from purchase order '${po.po_number}' because it is in '${po.status}' status. Only DRAFT purchase orders can be modified.`,
          'PO_NOT_IN_DRAFT_STATUS'
        );
      }

      // 3. Lock PO item and verify it belongs to this PO
      const item = await PurchaseOrderModel.findPOItemByIdWithLock(itemId, connection);
      if (!item || item.purchase_order_id !== po.id) {
        throw ApiError.notFound(`Item with ID ${itemId} does not belong to purchase order '${po.po_number}'`, 'PO_ITEM_NOT_FOUND');
      }

      // 4. Delete line item
      await PurchaseOrderModel.deletePurchaseOrderItem(itemId, connection);

      // 5. Recalculate PO total
      await PurchaseOrderModel.recalculatePOTotal(po.id, connection);

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'PURCHASE_ORDER_ITEM_REMOVED',
        resourceType: 'PURCHASE_ORDER_ITEM',
        resourceId: String(itemId),
        requestId,
        metadata: {
          purchaseOrderId: po.id,
          poNumber: po.po_number,
          itemId,
          ingredientId: item.ingredient_id,
          ingredientName: item.ingredient_name,
          removedQuantity: item.quantity_ordered
        }
      });

      return await this.getPurchaseOrderById(po.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Submits a DRAFT purchase order
   * Requires at least one item, verifies supplier active status, and transitions to SUBMITTED
   */
  async submitPurchaseOrder(poId, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock purchase order
      const po = await PurchaseOrderModel.findPOWithLock(poId, connection);
      if (!po) {
        throw ApiError.notFound(`Purchase order with ID ${poId} not found`, 'PURCHASE_ORDER_NOT_FOUND');
      }

      // 2. Status verification
      if (po.status === 'SUBMITTED') {
        throw ApiError.badRequest(`Purchase order '${po.po_number}' is already submitted`, 'PO_ALREADY_SUBMITTED');
      }
      if (po.status !== 'DRAFT') {
        throw ApiError.badRequest(
          `Cannot submit purchase order '${po.po_number}' in '${po.status}' status. Only DRAFT purchase orders can be submitted.`,
          'PO_CANNOT_BE_SUBMITTED'
        );
      }

      // 3. Verify supplier is still active
      if (!po.supplier_is_active) {
        throw ApiError.badRequest(`Cannot submit purchase order for inactive supplier '${po.supplier_name}'`, 'SUPPLIER_INACTIVE');
      }

      // 4. Lock and verify line items exist
      const items = await PurchaseOrderModel.findPOItemsWithLock(po.id, connection);
      if (items.length === 0) {
        throw ApiError.badRequest(
          `Cannot submit purchase order '${po.po_number}' with no line items. Please add at least one line item before submitting.`,
          'PO_HAS_NO_ITEMS'
        );
      }

      // 5. Transition status to SUBMITTED
      await PurchaseOrderModel.updatePOStatus(po.id, 'SUBMITTED', connection);

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'PURCHASE_ORDER_SUBMITTED',
        resourceType: 'PURCHASE_ORDER',
        resourceId: String(po.id),
        requestId,
        metadata: {
          purchaseOrderId: po.id,
          poNumber: po.po_number,
          supplierId: po.supplier_id,
          supplierName: po.supplier_name,
          itemsCount: items.length,
          totalAmount: po.total_amount
        }
      });

      return await this.getPurchaseOrderById(po.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Cancels an eligible purchase order (DRAFT, SUBMITTED, or PARTIALLY_RECEIVED)
   * Protects already received batches and receipt history
   */
  async cancelPurchaseOrder(poId, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock purchase order
      const po = await PurchaseOrderModel.findPOWithLock(poId, connection);
      if (!po) {
        throw ApiError.notFound(`Purchase order with ID ${poId} not found`, 'PURCHASE_ORDER_NOT_FOUND');
      }

      // 2. Cancellation status lifecycle validation
      if (po.status === 'RECEIVED') {
        throw ApiError.badRequest(
          `Cannot cancel purchase order '${po.po_number}' because it has already been fully received`,
          'PO_ALREADY_RECEIVED'
        );
      }
      if (po.status === 'CANCELLED') {
        throw ApiError.badRequest(
          `Purchase order '${po.po_number}' is already cancelled`,
          'PO_ALREADY_CANCELLED'
        );
      }

      // Permitted statuses: DRAFT, SUBMITTED, PARTIALLY_RECEIVED
      const previousStatus = po.status;

      // 3. Transition status to CANCELLED
      // Note: If PARTIALLY_RECEIVED, existing inventory_batches and stock_movements
      // remain completely untouched. Cancellation prevents new receipts against this PO.
      await PurchaseOrderModel.updatePOStatus(po.id, 'CANCELLED', connection);

      await connection.commit();

      // Audit Log
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'PURCHASE_ORDER_CANCELLED',
        resourceType: 'PURCHASE_ORDER',
        resourceId: String(po.id),
        requestId,
        metadata: {
          purchaseOrderId: po.id,
          poNumber: po.po_number,
          previousStatus,
          supplierId: po.supplier_id,
          supplierName: po.supplier_name
        }
      });

      return await this.getPurchaseOrderById(po.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

export default PurchaseOrderService;
