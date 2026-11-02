import { getMySQLPool } from '../../config/mysql.js';

export const AdjustmentModel = {
  /**
   * Locks and retrieves an inventory batch inside a dedicated transaction
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
        u.abbreviation AS unit_symbol
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
   * Updates remaining and received quantities on an inventory batch
   * @param {import('mysql2/promise').Connection} conn
   * @param {number} batchId
   * @param {number} newRemaining
   * @param {number} newReceived
   */
  async updateBatchQuantity(conn, batchId, newRemaining, newReceived) {
    await conn.execute(
      `
      UPDATE inventory_batches
      SET 
        quantity_remaining = ?,
        quantity_received = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [newRemaining, newReceived, batchId]
    );
  },

  /**
   * Records an audit adjustment stock movement in the immutable ledger
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
      ) VALUES (?, 'AUDIT_ADJUSTMENT', ?, ?, ?, ?, ?)
    `,
      [batchId, quantity, balanceAfter, referenceId, notes || null, userId || null]
    );

    return result.insertId;
  },

  /**
   * Retrieves paginated list of manual stock adjustments
   * @param {object} params
   */
  async listAdjustments({ page = 1, limit = 20, ingredientId, batchId, startDate, endDate }) {
    const pool = getMySQLPool();
    const offset = (page - 1) * limit;
    const whereClauses = ["sm.movement_type = 'AUDIT_ADJUSTMENT'"];
    const queryParams = [];

    if (ingredientId) {
      whereClauses.push('b.ingredient_id = ?');
      queryParams.push(ingredientId);
    }

    if (batchId) {
      whereClauses.push('sm.batch_id = ?');
      queryParams.push(batchId);
    }

    if (startDate) {
      whereClauses.push('DATE(sm.created_at) >= ?');
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClauses.push('DATE(sm.created_at) <= ?');
      queryParams.push(endDate);
    }

    const whereSql = whereClauses.join(' AND ');

    // Total count query
    const [countRows] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM stock_movements sm
      JOIN inventory_batches b ON sm.batch_id = b.id
      WHERE ${whereSql}
    `,
      queryParams
    );

    const total = Number(countRows[0].total);

    // Data query with rich joins
    const dataSql = `
      SELECT 
        sm.id,
        sm.reference_id,
        sm.quantity,
        sm.balance_after,
        sm.notes,
        sm.created_at,
        b.id AS batch_id,
        b.batch_number,
        b.expiry_date,
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit_symbol,
        u.name AS unit_name,
        usr.id AS user_id,
        usr.username,
        usr.full_name
      FROM stock_movements sm
      JOIN inventory_batches b ON sm.batch_id = b.id
      JOIN ingredients i ON b.ingredient_id = i.id
      JOIN units_of_measure u ON i.unit_id = u.id
      LEFT JOIN users usr ON sm.created_by_user_id = usr.id
      WHERE ${whereSql}
      ORDER BY sm.created_at DESC, sm.id DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataSql, [...queryParams, Number(limit), Number(offset)]);

    const items = rows.map(r => {
      // Determine adjustment type from notes prefix if present, e.g. [INCREASE] or [DECREASE]
      let adjustmentType = 'UNKNOWN';
      let cleanReason = r.notes || '';
      const match = cleanReason.match(/^\[(INCREASE|DECREASE)\]\s*(.*)$/);
      if (match) {
        adjustmentType = match[1];
        cleanReason = match[2];
      }

      return {
        id: r.id,
        reference_id: r.reference_id,
        adjustment_type: adjustmentType,
        quantity: Number(r.quantity),
        balance_after: Number(r.balance_after),
        reason: cleanReason,
        raw_notes: r.notes,
        batch: {
          id: r.batch_id,
          batch_number: r.batch_number,
          expiry_date: r.expiry_date
        },
        ingredient: {
          id: r.ingredient_id,
          name: r.ingredient_name,
          unit: r.unit_symbol
        },
        created_by: r.user_id
          ? {
              id: r.user_id,
              username: r.username,
              full_name: r.full_name
            }
          : null,
        created_at: r.created_at
      };
    });

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1
    };
  },

  /**
   * Retrieves single adjustment record by movement ID
   * @param {number} id
   */
  async getAdjustmentById(id) {
    const pool = getMySQLPool();
    const [rows] = await pool.execute(
      `
      SELECT 
        sm.id,
        sm.reference_id,
        sm.quantity,
        sm.balance_after,
        sm.notes,
        sm.created_at,
        b.id AS batch_id,
        b.batch_number,
        b.expiry_date,
        b.quantity_remaining AS current_batch_remaining,
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit_symbol,
        u.name AS unit_name,
        usr.id AS user_id,
        usr.username,
        usr.full_name
      FROM stock_movements sm
      JOIN inventory_batches b ON sm.batch_id = b.id
      JOIN ingredients i ON b.ingredient_id = i.id
      JOIN units_of_measure u ON i.unit_id = u.id
      LEFT JOIN users usr ON sm.created_by_user_id = usr.id
      WHERE sm.id = ? AND sm.movement_type = 'AUDIT_ADJUSTMENT'
    `,
      [id]
    );

    if (rows.length === 0) return null;
    const r = rows[0];

    let adjustmentType = 'UNKNOWN';
    let cleanReason = r.notes || '';
    const match = cleanReason.match(/^\[(INCREASE|DECREASE)\]\s*(.*)$/);
    if (match) {
      adjustmentType = match[1];
      cleanReason = match[2];
    }

    return {
      id: r.id,
      reference_id: r.reference_id,
      adjustment_type: adjustmentType,
      quantity: Number(r.quantity),
      balance_after: Number(r.balance_after),
      reason: cleanReason,
      raw_notes: r.notes,
      batch: {
        id: r.batch_id,
        batch_number: r.batch_number,
        expiry_date: r.expiry_date,
        current_quantity_remaining: Number(r.current_batch_remaining)
      },
      ingredient: {
        id: r.ingredient_id,
        name: r.ingredient_name,
        unit: r.unit_symbol
      },
      created_by: r.user_id
        ? {
            id: r.user_id,
            username: r.username,
            full_name: r.full_name
          }
        : null,
      created_at: r.created_at
    };
  }
};
