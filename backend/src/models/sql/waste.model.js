import { getMySQLPool } from '../../config/mysql.js';

export const WasteModel = {
  /**
   * Locks and retrieves an inventory batch along with its ingredient and base unit
   * @param {import('mysql2/promise').Connection} conn
   * @param {number} batchId
   * @returns {Promise<object|null>}
   */
  async findBatchWithLock(conn, batchId) {
    const [rows] = await conn.execute(
      `
      SELECT 
        b.id,
        b.ingredient_id,
        b.batch_number,
        b.quantity_received,
        b.quantity_remaining,
        b.unit_cost,
        b.received_date,
        b.expiry_date,
        b.status,
        i.name AS ingredient_name,
        i.unit_id AS ingredient_unit_id,
        u.abbreviation AS unit_symbol,
        u.name AS unit_name
      FROM inventory_batches b
      JOIN ingredients i ON b.ingredient_id = i.id
      JOIN units_of_measure u ON i.unit_id = u.id
      WHERE b.id = ?
      FOR UPDATE
    `,
      [batchId]
    );

    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Updates remaining quantity on an inventory batch
   * @param {import('mysql2/promise').Connection} conn
   * @param {number} batchId
   * @param {number} newRemaining
   */
  async updateBatchRemaining(conn, batchId, newRemaining) {
    await conn.execute(
      `
      UPDATE inventory_batches
      SET 
        quantity_remaining = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [newRemaining, batchId]
    );
  },

  /**
   * Inserts a record into waste_records.
   * Trigger trg_calculate_waste_cost automatically evaluates financial_loss.
   * @param {import('mysql2/promise').Connection} conn
   * @param {object} params
   * @returns {Promise<number>} Inserted waste record ID
   */
  async createWasteRecord(conn, {
    batchId,
    ingredientId,
    quantityWasted,
    unitId,
    wasteReason,
    userId,
    notes,
    wasteDate
  }) {
    const [result] = await conn.execute(
      `
      INSERT INTO waste_records (
        batch_id,
        ingredient_id,
        quantity_wasted,
        unit_id,
        waste_reason,
        financial_loss,
        logged_by_user_id,
        notes,
        logged_at
      ) VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `,
      [
        batchId,
        ingredientId,
        quantityWasted,
        unitId,
        wasteReason,
        userId || null,
        notes || null,
        wasteDate ? `${wasteDate} 00:00:00` : null
      ]
    );

    return result.insertId;
  },

  /**
   * Records a waste disposal stock movement in the ledger
   * @param {import('mysql2/promise').Connection} conn
   * @param {object} params
   * @returns {Promise<number>} Inserted movement ID
   */
  async createStockMovement(conn, { batchId, quantity, balanceAfter, referenceId, notes, userId }) {
    const [result] = await conn.execute(
      `
      INSERT INTO stock_movements (
        batch_id,
        movement_type,
        quantity,
        balance_after,
        reference_id,
        notes,
        created_by_user_id
      ) VALUES (?, 'WASTE_DISPOSAL', ?, ?, ?, ?, ?)
    `,
      [batchId, quantity, balanceAfter, referenceId, notes || null, userId || null]
    );

    return result.insertId;
  },

  /**
   * Retrieves single waste record by ID with resolved ingredient, batch, unit, and user
   * @param {number} id
   * @param {import('mysql2/promise').Connection} [conn] Optional connection for in-transaction reads
   */
  async getWasteRecordById(id, conn = null) {
    const executor = conn || getMySQLPool();
    const [rows] = await executor.execute(
      `
      SELECT 
        w.id,
        w.quantity_wasted,
        w.waste_reason,
        w.financial_loss,
        w.notes,
        w.logged_at,
        b.id AS batch_id,
        b.batch_number,
        b.expiry_date,
        b.quantity_remaining AS current_batch_remaining,
        b.unit_cost AS batch_unit_cost,
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        u.id AS unit_id,
        u.name AS unit_name,
        u.abbreviation AS unit_symbol,
        usr.id AS user_id,
        usr.username,
        usr.full_name
      FROM waste_records w
      JOIN ingredients i ON w.ingredient_id = i.id
      JOIN units_of_measure u ON w.unit_id = u.id
      LEFT JOIN inventory_batches b ON w.batch_id = b.id
      LEFT JOIN users usr ON w.logged_by_user_id = usr.id
      WHERE w.id = ?
    `,
      [id]
    );

    if (rows.length === 0) return null;
    const r = rows[0];

    return {
      id: r.id,
      waste_reason: r.waste_reason,
      quantity_wasted: Number(r.quantity_wasted),
      financial_loss: Number(r.financial_loss),
      notes: r.notes,
      logged_at: r.logged_at,
      ingredient: {
        id: r.ingredient_id,
        name: r.ingredient_name
      },
      batch: r.batch_id
        ? {
            id: r.batch_id,
            batch_number: r.batch_number,
            expiry_date: r.expiry_date,
            unit_cost: Number(r.batch_unit_cost)
          }
        : null,
      unit: {
        id: r.unit_id,
        name: r.unit_name,
        abbreviation: r.unit_symbol
      },
      logged_by: r.user_id
        ? {
            id: r.user_id,
            username: r.username,
            full_name: r.full_name
          }
        : null
    };
  },

  /**
   * Retrieves paginated waste records
   * @param {object} params
   */
  async listWasteRecords({ page = 1, limit = 20, ingredientId, batchId, wasteReason, startDate, endDate }) {
    const pool = getMySQLPool();
    const offset = (page - 1) * limit;
    const whereClauses = [];
    const queryParams = [];

    if (ingredientId) {
      whereClauses.push('w.ingredient_id = ?');
      queryParams.push(ingredientId);
    }

    if (batchId) {
      whereClauses.push('w.batch_id = ?');
      queryParams.push(batchId);
    }

    if (wasteReason) {
      whereClauses.push('w.waste_reason = ?');
      queryParams.push(wasteReason);
    }

    if (startDate) {
      whereClauses.push('DATE(w.logged_at) >= ?');
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClauses.push('DATE(w.logged_at) <= ?');
      queryParams.push(endDate);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count query
    const [countRows] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM waste_records w
      ${whereSql}
    `,
      queryParams
    );

    const total = Number(countRows[0].total);

    // Data query with joins
    const dataSql = `
      SELECT 
        w.id,
        w.quantity_wasted,
        w.waste_reason,
        w.financial_loss,
        w.notes,
        w.logged_at,
        b.id AS batch_id,
        b.batch_number,
        b.expiry_date,
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        u.id AS unit_id,
        u.name AS unit_name,
        u.abbreviation AS unit_symbol,
        usr.id AS user_id,
        usr.username,
        usr.full_name
      FROM waste_records w
      JOIN ingredients i ON w.ingredient_id = i.id
      JOIN units_of_measure u ON w.unit_id = u.id
      LEFT JOIN inventory_batches b ON w.batch_id = b.id
      LEFT JOIN users usr ON w.logged_by_user_id = usr.id
      ${whereSql}
      ORDER BY w.logged_at DESC, w.id DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataSql, [...queryParams, Number(limit), Number(offset)]);

    const items = rows.map(r => ({
      id: r.id,
      waste_reason: r.waste_reason,
      quantity_wasted: Number(r.quantity_wasted),
      financial_loss: Number(r.financial_loss),
      notes: r.notes,
      logged_at: r.logged_at,
      ingredient: {
        id: r.ingredient_id,
        name: r.ingredient_name
      },
      batch: r.batch_id
        ? {
            id: r.batch_id,
            batch_number: r.batch_number,
            expiry_date: r.expiry_date
          }
        : null,
      unit: {
        id: r.unit_id,
        name: r.unit_name,
        abbreviation: r.unit_symbol
      },
      logged_by: r.user_id
        ? {
            id: r.user_id,
            username: r.username,
            full_name: r.full_name
          }
        : null
    }));

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1
    };
  }
};
