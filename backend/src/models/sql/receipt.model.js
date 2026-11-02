import { getMySQLPool } from '../../config/mysql.js';

/**
 * Stock Receipt Data Access Object (DAO)
 * Manages atomic inventory batch creation, stock movements, and purchase order fulfillment
 * Uses existing purchase_orders, purchase_order_items, inventory_batches, and stock_movements tables
 */
export const ReceiptModel = {
  /**
   * Retrieves purchase order by ID with row lock (FOR UPDATE)
   */
  async findPurchaseOrderWithLock(poId, connection) {
    const sql = `
      SELECT 
        po.id,
        po.po_number,
        po.supplier_id,
        po.created_by_user_id,
        po.status,
        CAST(po.total_amount AS DECIMAL(10, 2)) AS total_amount,
        po.order_date,
        po.expected_delivery_date,
        po.actual_delivery_date,
        po.notes,
        po.created_at,
        s.name AS supplier_name
      FROM \`purchase_orders\` po
      JOIN \`suppliers\` s ON po.supplier_id = s.id
      WHERE po.id = ?
      FOR UPDATE;
    `;
    const [rows] = await connection.query(sql, [poId]);
    return rows[0] || null;
  },

  /**
   * Retrieves all purchase order items for a PO with row lock (FOR UPDATE)
   */
  async findPurchaseOrderItemsWithLock(poId, connection) {
    const sql = `
      SELECT 
        poi.id,
        poi.purchase_order_id,
        poi.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit,
        CAST(poi.quantity_ordered AS DECIMAL(10, 3)) AS quantity_ordered,
        CAST(poi.quantity_received AS DECIMAL(10, 3)) AS quantity_received,
        CAST(poi.unit_cost AS DECIMAL(10, 2)) AS unit_cost,
        CAST(poi.subtotal AS DECIMAL(10, 2)) AS subtotal
      FROM \`purchase_order_items\` poi
      JOIN \`ingredients\` i ON poi.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE poi.purchase_order_id = ?
      FOR UPDATE;
    `;
    const [rows] = await connection.query(sql, [poId]);
    return rows.map(r => ({
      id: r.id,
      purchase_order_id: r.purchase_order_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      unit: r.unit,
      quantity_ordered: Number(r.quantity_ordered),
      quantity_received: Number(r.quantity_received),
      unit_cost: Number(r.unit_cost),
      subtotal: Number(r.subtotal)
    }));
  },

  /**
   * Checks if an inventory batch with the specified batch_number already exists for this ingredient
   */
  async checkBatchExists(ingredientId, batchNumber, connectionOrPool) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT id 
      FROM \`inventory_batches\` 
      WHERE ingredient_id = ? AND batch_number = ?
      LIMIT 1;
    `;
    const [rows] = await executor.query(sql, [ingredientId, batchNumber]);
    return rows.length > 0;
  },

  /**
   * Creates a new physical inventory batch
   */
  async createBatch({
    ingredient_id,
    batch_number,
    quantity_received,
    unit_cost,
    received_date,
    expiry_date
  }, connection) {
    const sql = `
      INSERT INTO \`inventory_batches\` (
        ingredient_id,
        batch_number,
        quantity_received,
        quantity_remaining,
        unit_cost,
        received_date,
        expiry_date,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE');
    `;
    const [result] = await connection.query(sql, [
      ingredient_id,
      batch_number,
      quantity_received,
      quantity_received, // Initial remaining stock equals received stock
      unit_cost,
      received_date,
      expiry_date
    ]);
    return result.insertId;
  },

  /**
   * Inserts an immutable stock movement record
   */
  async createStockMovement({
    batch_id,
    movement_type = 'PURCHASE_RECEIPT',
    quantity,
    balance_after,
    reference_id,
    notes = null,
    created_by_user_id = null
  }, connection) {
    const sql = `
      INSERT INTO \`stock_movements\` (
        batch_id,
        movement_type,
        quantity,
        balance_after,
        reference_id,
        notes,
        created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await connection.query(sql, [
      batch_id,
      movement_type,
      quantity,
      balance_after,
      reference_id,
      notes,
      created_by_user_id
    ]);
    return result.insertId;
  },

  /**
   * Updates received quantity on a purchase order item
   */
  async incrementPOItemReceivedQuantity(poItemId, additionalReceived, connection) {
    const sql = `
      UPDATE \`purchase_order_items\`
      SET quantity_received = quantity_received + ?
      WHERE id = ?;
    `;
    await connection.query(sql, [additionalReceived, poItemId]);
  },

  /**
   * Updates overall purchase order status and delivery date
   */
  async updatePurchaseOrderStatus(poId, status, actualDeliveryDate, connection) {
    const sql = `
      UPDATE \`purchase_orders\`
      SET 
        status = ?,
        actual_delivery_date = COALESCE(?, actual_delivery_date)
      WHERE id = ?;
    `;
    await connection.query(sql, [status, actualDeliveryDate, poId]);
  },

  /**
   * Retrieves paginated receipt events grouped by purchase order
   */
  async getReceipts({
    supplierId = null,
    purchaseOrderId = null,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 20
  } = {}) {
    const pool = getMySQLPool();
    const conditions = ["sm.movement_type = 'PURCHASE_RECEIPT'"];
    const params = [];

    if (supplierId) {
      conditions.push('po.supplier_id = ?');
      params.push(supplierId);
    }

    if (purchaseOrderId) {
      conditions.push('po.id = ?');
      params.push(purchaseOrderId);
    }

    if (startDate) {
      conditions.push('sm.created_at >= ?');
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      conditions.push('sm.created_at <= ?');
      params.push(`${endDate} 23:59:59`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total distinct receipt reference groups
    const countSql = `
      SELECT COUNT(DISTINCT po.id) AS total
      FROM \`stock_movements\` sm
      JOIN \`inventory_batches\` b ON sm.batch_id = b.id
      JOIN \`purchase_orders\` po ON sm.reference_id = po.po_number
      ${whereClause};
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        po.id AS purchase_order_id,
        po.po_number,
        po.supplier_id,
        s.name AS supplier_name,
        po.status AS po_status,
        po.order_date,
        po.expected_delivery_date,
        po.actual_delivery_date,
        COUNT(DISTINCT b.id) AS batches_received_count,
        CAST(SUM(sm.quantity) AS DECIMAL(10, 3)) AS total_quantity_received,
        CAST(SUM(sm.quantity * b.unit_cost) AS DECIMAL(10, 2)) AS total_received_valuation,
        MAX(sm.created_at) AS last_receipt_timestamp
      FROM \`stock_movements\` sm
      JOIN \`inventory_batches\` b ON sm.batch_id = b.id
      JOIN \`purchase_orders\` po ON sm.reference_id = po.po_number
      JOIN \`suppliers\` s ON po.supplier_id = s.id
      ${whereClause}
      GROUP BY 
        po.id,
        po.po_number,
        po.supplier_id,
        s.name,
        po.status,
        po.order_date,
        po.expected_delivery_date,
        po.actual_delivery_date
      ORDER BY last_receipt_timestamp DESC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    const receipts = rows.map(r => ({
      purchase_order_id: r.purchase_order_id,
      po_number: r.po_number,
      supplier: {
        id: r.supplier_id,
        name: r.supplier_name
      },
      po_status: r.po_status,
      order_date: r.order_date,
      expected_delivery_date: r.expected_delivery_date,
      actual_delivery_date: r.actual_delivery_date,
      batches_received_count: Number(r.batches_received_count),
      total_quantity_received: Number(r.total_quantity_received),
      total_received_valuation: Number(r.total_received_valuation),
      last_receipt_at: r.last_receipt_timestamp
    }));

    return {
      receipts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves full receipt details by purchase order ID or PO number
   */
  async getReceiptDetailsByPO(poIdOrNumber) {
    const pool = getMySQLPool();

    const poSql = `
      SELECT 
        po.id,
        po.po_number,
        po.supplier_id,
        s.name AS supplier_name,
        s.contact_person,
        s.email AS supplier_email,
        s.phone AS supplier_phone,
        po.status,
        CAST(po.total_amount AS DECIMAL(10, 2)) AS total_amount,
        po.order_date,
        po.expected_delivery_date,
        po.actual_delivery_date,
        po.notes,
        po.created_at
      FROM \`purchase_orders\` po
      JOIN \`suppliers\` s ON po.supplier_id = s.id
      WHERE po.id = ? OR po.po_number = ?
      LIMIT 1;
    `;
    const [poRows] = await pool.query(poSql, [poIdOrNumber, String(poIdOrNumber)]);
    if (poRows.length === 0) {
      return null;
    }
    const po = poRows[0];

    // Ordered vs Received PO items status
    const itemsSql = `
      SELECT 
        poi.id,
        poi.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit,
        CAST(poi.quantity_ordered AS DECIMAL(10, 3)) AS quantity_ordered,
        CAST(poi.quantity_received AS DECIMAL(10, 3)) AS quantity_received,
        CAST(GREATEST(0.000, poi.quantity_ordered - poi.quantity_received) AS DECIMAL(10, 3)) AS quantity_outstanding,
        CAST(poi.unit_cost AS DECIMAL(10, 2)) AS unit_cost,
        CAST(poi.subtotal AS DECIMAL(10, 2)) AS subtotal
      FROM \`purchase_order_items\` poi
      JOIN \`ingredients\` i ON poi.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE poi.purchase_order_id = ?
      ORDER BY poi.id ASC;
    `;
    const [poItems] = await pool.query(itemsSql, [po.id]);

    // All received batches associated with this PO
    const batchesSql = `
      SELECT 
        b.id,
        b.batch_number,
        b.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit,
        CAST(b.quantity_received AS DECIMAL(10, 3)) AS quantity_received,
        CAST(b.quantity_remaining AS DECIMAL(10, 3)) AS quantity_remaining,
        CAST(b.unit_cost AS DECIMAL(10, 2)) AS unit_cost,
        CAST(ROUND(b.quantity_remaining * b.unit_cost, 2) AS DECIMAL(10, 2)) AS remaining_value,
        b.received_date,
        b.expiry_date,
        DATEDIFF(b.expiry_date, CURRENT_DATE()) AS days_until_expiry,
        b.status,
        b.created_at
      FROM \`inventory_batches\` b
      JOIN \`ingredients\` i ON b.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      JOIN \`stock_movements\` sm ON sm.batch_id = b.id
      WHERE sm.reference_id = ? AND sm.movement_type = 'PURCHASE_RECEIPT'
      GROUP BY b.id, b.batch_number, b.ingredient_id, i.name, u.abbreviation, 
               b.quantity_received, b.quantity_remaining, b.unit_cost, 
               b.received_date, b.expiry_date, b.status, b.created_at
      ORDER BY b.id ASC;
    `;
    const [batches] = await pool.query(batchesSql, [po.po_number]);

    // Stock movements recorded
    const movementsSql = `
      SELECT 
        sm.id,
        sm.batch_id,
        b.batch_number,
        b.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit,
        sm.movement_type,
        CAST(sm.quantity AS DECIMAL(10, 3)) AS quantity,
        CAST(sm.balance_after AS DECIMAL(10, 3)) AS balance_after,
        sm.reference_id,
        sm.notes,
        sm.created_at,
        usr.id AS user_id,
        usr.username AS created_by_username
      FROM \`stock_movements\` sm
      JOIN \`inventory_batches\` b ON sm.batch_id = b.id
      JOIN \`ingredients\` i ON b.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      LEFT JOIN \`users\` usr ON sm.created_by_user_id = usr.id
      WHERE sm.reference_id = ? AND sm.movement_type = 'PURCHASE_RECEIPT'
      ORDER BY sm.created_at ASC, sm.id ASC;
    `;
    const [movements] = await pool.query(movementsSql, [po.po_number]);

    return {
      purchase_order: {
        id: po.id,
        po_number: po.po_number,
        status: po.status,
        order_date: po.order_date,
        expected_delivery_date: po.expected_delivery_date,
        actual_delivery_date: po.actual_delivery_date,
        total_amount: Number(po.total_amount),
        notes: po.notes
      },
      supplier: {
        id: po.supplier_id,
        name: po.supplier_name,
        contact_person: po.contact_person,
        email: po.supplier_email,
        phone: po.supplier_phone
      },
      order_items: poItems.map(item => ({
        id: item.id,
        ingredient_id: item.ingredient_id,
        ingredient_name: item.ingredient_name,
        unit: item.unit,
        quantity_ordered: Number(item.quantity_ordered),
        quantity_received: Number(item.quantity_received),
        quantity_outstanding: Number(item.quantity_outstanding),
        unit_cost: Number(item.unit_cost),
        subtotal: Number(item.subtotal)
      })),
      received_batches: batches.map(b => ({
        id: b.id,
        batch_number: b.batch_number,
        ingredient_id: b.ingredient_id,
        ingredient_name: b.ingredient_name,
        unit: b.unit,
        quantity_received: Number(b.quantity_received),
        quantity_remaining: Number(b.quantity_remaining),
        unit_cost: Number(b.unit_cost),
        remaining_value: Number(b.remaining_value),
        received_date: b.received_date,
        expiry_date: b.expiry_date,
        days_until_expiry: b.days_until_expiry,
        status: b.status
      })),
      stock_movements: movements.map(m => ({
        id: m.id,
        batch_id: m.batch_id,
        batch_number: m.batch_number,
        ingredient_name: m.ingredient_name,
        unit: m.unit,
        quantity: Number(m.quantity),
        balance_after: Number(m.balance_after),
        reference_id: m.reference_id,
        notes: m.notes,
        created_at: m.created_at,
        created_by: m.user_id ? { id: m.user_id, username: m.created_by_username } : null
      }))
    };
  }
};

export default ReceiptModel;
