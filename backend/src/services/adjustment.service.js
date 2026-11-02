import { getMySQLPool } from '../config/mysql.js';
import { AdjustmentModel } from '../models/sql/adjustment.model.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { ApiError } from '../utils/apiError.js';

export const AdjustmentService = {
  /**
   * Performs an atomic manual stock adjustment with row locking
   * @param {object} params
   */
  async adjustStock({ ingredientId, batchId, adjustmentType, quantity, reason, notes, user }) {
    const pool = getMySQLPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Lock the target inventory batch
      const batch = await AdjustmentModel.findBatchWithLock(conn, batchId);
      if (!batch) {
        throw new ApiError(404, `Inventory batch with ID ${batchId} not found`, 'BATCH_NOT_FOUND');
      }

      // 2. Validate that batch belongs to the specified ingredient
      if (batch.ingredient_id !== ingredientId) {
        throw new ApiError(
          400,
          `Batch ID ${batchId} belongs to ingredient ID ${batch.ingredient_id} ("${batch.ingredient_name}"), not supplied ingredient ID ${ingredientId}`,
          'INGREDIENT_BATCH_MISMATCH'
        );
      }

      // 3. Validate batch eligibility (non-expired and not discarded)
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const expiryStr =
        typeof batch.expiry_date === 'string'
          ? batch.expiry_date.substring(0, 10)
          : new Date(batch.expiry_date).toISOString().substring(0, 10);

      if (batch.status === 'EXPIRED' || expiryStr < todayStr) {
        throw new ApiError(
          400,
          `Batch ${batch.batch_number} has expired on ${expiryStr} and cannot be manually adjusted. Dispose of expired items via waste recording.`,
          'BATCH_EXPIRED'
        );
      }

      if (batch.status === 'DISCARDED') {
        throw new ApiError(
          400,
          `Batch ${batch.batch_number} has status DISCARDED and cannot be adjusted.`,
          'BATCH_DISCARDED'
        );
      }

      const currentRemaining = Number(batch.quantity_remaining);
      const currentReceived = Number(batch.quantity_received);
      let newRemaining = 0;
      let newReceived = currentReceived;

      // 4. Calculate adjusted stock
      if (adjustmentType === 'INCREASE') {
        newRemaining = Number((currentRemaining + quantity).toFixed(3));
        // Preserve chk_batch_remaining_le_recv (quantity_remaining <= quantity_received)
        newReceived = Math.max(currentReceived, newRemaining);
      } else if (adjustmentType === 'DECREASE') {
        if (currentRemaining < quantity) {
          throw new ApiError(
            400,
            `Cannot decrease stock by ${quantity}. Batch only has ${currentRemaining} remaining.`,
            'INSUFFICIENT_BATCH_STOCK',
            [
              {
                batch_id: batchId,
                batch_number: batch.batch_number,
                current_remaining: currentRemaining,
                attempted_decrease: quantity
              }
            ]
          );
        }
        newRemaining = Number((currentRemaining - quantity).toFixed(3));
      }

      // 5. Update inventory batch in MySQL
      await AdjustmentModel.updateBatchQuantity(conn, batchId, newRemaining, newReceived);

      // 6. Record stock movement entry in ledger
      const referenceId = `ADJ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const movementNotes = `[${adjustmentType}] ${reason}${notes ? ` - ${notes}` : ''}`.trim().substring(0, 255);

      const movementId = await AdjustmentModel.createStockMovement(conn, {
        batchId,
        quantity,
        balanceAfter: newRemaining,
        referenceId,
        notes: movementNotes,
        userId: user?.id || null
      });

      // 7. Commit transaction
      await conn.commit();

      // 8. Record audit log asynchronously in MongoDB Atlas
      AuditLog.record({
        userId: user?.id || null,
        username: user?.username || 'system',
        action: 'STOCK_ADJUSTED',
        resourceType: 'INVENTORY_BATCH',
        resourceId: String(batchId),
        metadata: {
          ingredientId,
          batchId,
          batchNumber: batch.batch_number,
          adjustmentType,
          quantityAdjusted: quantity,
          previousRemaining: currentRemaining,
          newRemaining,
          reason,
          notes: notes || null,
          referenceId,
          movementId
        }
      });

      return {
        id: movementId,
        reference_id: referenceId,
        batch_id: batchId,
        batch_number: batch.batch_number,
        ingredient_id: ingredientId,
        ingredient_name: batch.ingredient_name,
        adjustment_type: adjustmentType,
        quantity_adjusted: quantity,
        previous_quantity_remaining: currentRemaining,
        new_quantity_remaining: newRemaining,
        unit: batch.unit_symbol,
        reason,
        notes: notes || null
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * Retrieves paginated manual stock adjustments
   * @param {object} params
   */
  async getAdjustments(params) {
    return AdjustmentModel.listAdjustments(params);
  },

  /**
   * Retrieves single adjustment details by movement ID
   * @param {number} id
   */
  async getAdjustmentById(id) {
    const adjustment = await AdjustmentModel.getAdjustmentById(id);
    if (!adjustment) {
      throw new ApiError(404, `Stock adjustment record with ID ${id} not found`, 'ADJUSTMENT_NOT_FOUND');
    }
    return adjustment;
  }
};
