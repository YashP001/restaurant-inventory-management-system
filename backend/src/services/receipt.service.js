import { ReceiptModel } from '../models/sql/receipt.model.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { getMySQLPool } from '../config/mysql.js';

export const ReceiptService = {
  /**
   * Processes an incoming stock receipt against a purchase order
   * Executes within a dedicated MySQL InnoDB transaction with row-level locks
   */
  async processStockReceipt(receiptData, actingUser, requestId = null) {
    const pool = getMySQLPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Lock and validate purchase order
      const po = await ReceiptModel.findPurchaseOrderWithLock(receiptData.purchase_order_id, connection);
      if (!po) {
        throw ApiError.notFound(`Purchase order with ID ${receiptData.purchase_order_id} not found`, 'PURCHASE_ORDER_NOT_FOUND');
      }

      // 2. Verify purchase order belongs to the specified supplier
      if (po.supplier_id !== receiptData.supplier_id) {
        throw ApiError.badRequest(
          `Purchase order '${po.po_number}' does not belong to supplier ID ${receiptData.supplier_id}`,
          'SUPPLIER_MISMATCH'
        );
      }

      // 3. Verify purchase order is in a receivable status
      if (po.status === 'RECEIVED') {
        throw ApiError.badRequest(`Purchase order '${po.po_number}' has already been fully received`, 'PO_ALREADY_RECEIVED');
      }
      if (po.status === 'CANCELLED') {
        throw ApiError.badRequest(`Cannot receive stock against a CANCELLED purchase order '${po.po_number}'`, 'PO_NOT_RECEIVABLE');
      }
      if (po.status === 'DRAFT') {
        throw ApiError.badRequest(`Purchase order '${po.po_number}' is in DRAFT status and must be SUBMITTED before receiving`, 'PO_NOT_RECEIVABLE');
      }
      if (!['SUBMITTED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
        throw ApiError.badRequest(`Purchase order '${po.po_number}' is in invalid status '${po.status}' for receiving`, 'PO_NOT_RECEIVABLE');
      }

      // 4. Lock and load all items on this purchase order
      const poItems = await ReceiptModel.findPurchaseOrderItemsWithLock(po.id, connection);
      if (poItems.length === 0) {
        throw ApiError.badRequest(`Purchase order '${po.po_number}' contains no line items to receive`, 'PO_HAS_NO_ITEMS');
      }

      const receivedDate = receiptData.received_date || new Date().toISOString().split('T')[0];
      const createdBatches = [];
      const createdMovements = [];
      const seenBatchNumbers = new Set();

      // 5. Process each incoming item
      for (const item of receiptData.items) {
        // Prevent duplicate batch numbers in the same receipt payload
        const batchKey = `${item.ingredient_id}:${item.batch_number}`;
        if (seenBatchNumbers.has(batchKey)) {
          throw ApiError.badRequest(`Duplicate batch number '${item.batch_number}' specified in payload for ingredient ID ${item.ingredient_id}`, 'DUPLICATE_BATCH_IN_PAYLOAD');
        }
        seenBatchNumbers.add(batchKey);

        // Find matching purchase order item
        let poItem = null;
        if (item.purchase_order_item_id) {
          poItem = poItems.find(p => p.id === item.purchase_order_item_id && p.ingredient_id === item.ingredient_id);
        } else {
          poItem = poItems.find(p => p.ingredient_id === item.ingredient_id);
        }

        if (!poItem) {
          throw ApiError.badRequest(
            `Ingredient ID ${item.ingredient_id} is not part of purchase order '${po.po_number}'`,
            'INVALID_PO_ITEM'
          );
        }

        // Validate outstanding quantity to prevent over-receiving
        const outstanding = Number((poItem.quantity_ordered - poItem.quantity_received).toFixed(3));
        if (item.quantity_received > outstanding) {
          throw ApiError.badRequest(
            `Received quantity (${item.quantity_received} ${poItem.unit}) exceeds outstanding quantity (${outstanding} ${poItem.unit}) for ingredient '${poItem.ingredient_name}'`,
            'OVER_RECEIVING_NOT_ALLOWED'
          );
        }

        // Validate batch number uniqueness in database for this ingredient
        const batchExists = await ReceiptModel.checkBatchExists(item.ingredient_id, item.batch_number, connection);
        if (batchExists) {
          throw ApiError.conflict(
            `Batch number '${item.batch_number}' already exists for ingredient '${poItem.ingredient_name}'`,
            'DUPLICATE_BATCH_NUMBER'
          );
        }

        // Validate that expiry date is not earlier than received date
        if (item.expiry_date < receivedDate) {
          throw ApiError.badRequest(
            `Expiry date (${item.expiry_date}) cannot be earlier than received date (${receivedDate}) for batch '${item.batch_number}'`,
            'INVALID_EXPIRY_DATE'
          );
        }

        // Unit cost resolution (use specified or fall back to PO line item cost)
        const unitCost = item.unit_cost !== undefined ? item.unit_cost : poItem.unit_cost;

        // 6. Create inventory batch
        const batchId = await ReceiptModel.createBatch({
          ingredient_id: item.ingredient_id,
          batch_number: item.batch_number,
          quantity_received: item.quantity_received,
          unit_cost: unitCost,
          received_date: receivedDate,
          expiry_date: item.expiry_date
        }, connection);

        // 7. Record stock movement
        const movementId = await ReceiptModel.createStockMovement({
          batch_id: batchId,
          movement_type: 'PURCHASE_RECEIPT',
          quantity: item.quantity_received,
          balance_after: item.quantity_received,
          reference_id: po.po_number,
          notes: receiptData.notes || `Stock received against purchase order ${po.po_number}`,
          created_by_user_id: actingUser.id
        }, connection);

        // 8. Increment received quantity on PO line item
        await ReceiptModel.incrementPOItemReceivedQuantity(poItem.id, item.quantity_received, connection);
        poItem.quantity_received = Number((poItem.quantity_received + item.quantity_received).toFixed(3));

        createdBatches.push({
          batch_id: batchId,
          batch_number: item.batch_number,
          ingredient_id: item.ingredient_id,
          ingredient_name: poItem.ingredient_name,
          quantity_received: item.quantity_received,
          unit: poItem.unit,
          unit_cost: unitCost,
          expiry_date: item.expiry_date
        });

        createdMovements.push({
          movement_id: movementId,
          batch_id: batchId,
          quantity: item.quantity_received
        });
      }

      // 9. Update overall purchase order status
      const allFullyReceived = poItems.every(i => i.quantity_received >= i.quantity_ordered);
      const newStatus = allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      const actualDeliveryDate = allFullyReceived ? receivedDate : null;

      await ReceiptModel.updatePurchaseOrderStatus(po.id, newStatus, actualDeliveryDate, connection);

      // Commit transaction atomically
      await connection.commit();

      // 10. Audit logging in MongoDB Atlas
      await AuditLog.record({
        userId: actingUser.id,
        username: actingUser.username,
        action: 'STOCK_BATCH_RECEIVED',
        resourceType: 'PURCHASE_ORDER',
        resourceId: String(po.id),
        requestId,
        metadata: {
          purchaseOrderId: po.id,
          poNumber: po.po_number,
          supplierId: po.supplier_id,
          supplierName: po.supplier_name,
          receivedDate,
          previousStatus: po.status,
          newStatus,
          batchesCreatedCount: createdBatches.length,
          totalQuantityReceived: createdBatches.reduce((sum, b) => sum + b.quantity_received, 0),
          batches: createdBatches.map(b => ({
            batchId: b.batch_id,
            batchNumber: b.batch_number,
            ingredientName: b.ingredient_name,
            quantity: b.quantity_received
          }))
        }
      });

      // Return complete receipt fulfillment confirmation
      return await ReceiptModel.getReceiptDetailsByPO(po.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Retrieves list of receipt events grouped by purchase order
   */
  async getReceipts(filters = {}) {
    return await ReceiptModel.getReceipts(filters);
  },

  /**
   * Retrieves detailed receipt summary for a specific purchase order
   */
  async getReceiptById(id) {
    const receipt = await ReceiptModel.getReceiptDetailsByPO(id);
    if (!receipt) {
      throw ApiError.notFound(`Stock receipt record for purchase order '${id}' not found`, 'RECEIPT_NOT_FOUND');
    }
    return receipt;
  }
};

export default ReceiptService;
