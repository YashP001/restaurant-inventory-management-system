import { getMySQLPool } from '../config/mysql.js';
import { WasteModel } from '../models/sql/waste.model.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { ApiError } from '../utils/apiError.js';

export const WasteService = {
  /**
   * Records an inventory waste event with atomic batch deduction and financial loss evaluation
   * @param {object} params
   */
  async recordWaste({
    ingredientId,
    batchId,
    quantityWasted,
    wasteReason,
    unitId,
    notes,
    wasteDate,
    user
  }) {
    const pool = getMySQLPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Lock the inventory batch
      const batch = await WasteModel.findBatchWithLock(conn, batchId);
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

      // 3. Stock sufficiency check: Cannot waste more than available batch stock
      const currentRemaining = Number(batch.quantity_remaining);
      if (currentRemaining < quantityWasted) {
        throw new ApiError(
          400,
          `Waste quantity (${quantityWasted}) exceeds remaining batch stock (${currentRemaining})`,
          'INSUFFICIENT_STOCK_FOR_WASTE',
          [
            {
              batch_id: batchId,
              batch_number: batch.batch_number,
              current_remaining: currentRemaining,
              attempted_waste: quantityWasted
            }
          ]
        );
      }

      // 4. Resolve measurement unit (defaults to ingredient's base unit)
      const resolvedUnitId = unitId || batch.ingredient_unit_id;

      // 5. Deduct quantity from inventory batch
      const newRemaining = Number((currentRemaining - quantityWasted).toFixed(3));
      await WasteModel.updateBatchRemaining(conn, batchId, newRemaining);

      // 6. Create waste_records record (trg_calculate_waste_cost computes financial_loss)
      const wasteRecordId = await WasteModel.createWasteRecord(conn, {
        batchId,
        ingredientId,
        quantityWasted,
        unitId: resolvedUnitId,
        wasteReason,
        userId: user?.id || null,
        notes: notes || null,
        wasteDate: wasteDate || null
      });

      // 7. Record stock movement entry in ledger
      const movementNotes = `[WASTE: ${wasteReason}] ${notes || ''}`.trim().substring(0, 255);
      const movementId = await WasteModel.createStockMovement(conn, {
        batchId,
        quantity: quantityWasted,
        balanceAfter: newRemaining,
        referenceId: `WASTE-${wasteRecordId}`,
        notes: movementNotes,
        userId: user?.id || null
      });

      // 8. Commit transaction
      await conn.commit();

      // 9. Fetch inserted record to retrieve trigger-computed financial_loss
      const wasteRecord = await WasteModel.getWasteRecordById(wasteRecordId);

      // 10. Record audit log asynchronously in MongoDB Atlas
      AuditLog.record({
        userId: user?.id || null,
        username: user?.username || 'system',
        action: 'WASTE_RECORDED',
        resourceType: 'WASTE_RECORD',
        resourceId: String(wasteRecordId),
        metadata: {
          wasteRecordId,
          ingredientId,
          batchId,
          batchNumber: batch.batch_number,
          quantityWasted,
          wasteReason,
          financialLoss: wasteRecord.financial_loss,
          notes: notes || null,
          movementId
        }
      });

      return {
        ...wasteRecord,
        stock_movement_id: movementId,
        remaining_batch_quantity: newRemaining
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * Retrieves paginated waste records
   * @param {object} params
   */
  async getWasteRecords(params) {
    return WasteModel.listWasteRecords(params);
  },

  /**
   * Retrieves single waste record details by ID
   * @param {number} id
   */
  async getWasteRecordById(id) {
    const record = await WasteModel.getWasteRecordById(id);
    if (!record) {
      throw new ApiError(404, `Waste record with ID ${id} not found`, 'WASTE_RECORD_NOT_FOUND');
    }
    return record;
  }
};
