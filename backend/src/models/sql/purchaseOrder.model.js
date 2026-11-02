import { getMySQLPool } from '../../config/mysql.js';

/**
 * Purchase Order Data Access Object (DAO)
 * Manages procurement lifecycle: draft, item composition, submission, and cancellation
 * Backed by MySQL `purchase_orders` and `purchase_order_items` tables
 */
export const PurchaseOrderModel = {
  /**
   * Retrieves purchase order with pessimistic row lock (FOR UPDATE)
   */
  async findPOWithLock(id, connection) {
    const sql = `
      SELECT 
        po.id,
        po.po_number,
        po.supplier_id,
        s.name AS supplier_name,
        s.is_active AS supplier_is_active,
        po.created_by_user_id,
        u.username AS created_by_username,
        po.status,
        CAST(po.total_amount AS DECIMAL(10, 2)) AS total_amount,
        po.order_date,
        po.expected_delivery_date,
        po.actual_delivery_date,
        po.notes,
        po.created_at
      FROM \`purchase_orders\` po
      JOIN \`suppliers\` s ON po.supplier_id = s.id
      LEFT JOIN \`users\` u ON po.created_by_user_id = u.id
      WHERE po.id = ?
      FOR UPDATE;
    `;
    const [rows] = await connection.query(sql, [id]);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      po_number: r.po_number,
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_name,
      supplier_is_active: Boolean(r.supplier_is_active),
      created_by_user_id: r.created_by_user_id,
      created_by_username: r.created_by_username,
      status: r.status,
      total_amount: Number(r.total_amount),
      order_date: r.order_date,
      expected_delivery_date: r.expected_delivery_date,
      actual_delivery_date: r.actual_delivery_date,
      notes: r.notes,
      created_at: r.created_at
    };
  },

  /**
   * Retrieves purchase order by ID or PO number (without row lock)
   */
  async findPOById(idOrNumber, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        po.id,
        po.po_number,
        po.supplier_id,
        s.name AS supplier_name,
        s.contact_person AS supplier_contact,
        s.email AS supplier_email,
        s.phone AS supplier_phone,
        s.is_active AS supplier_is_active,
        po.created_by_user_id,
        u.username AS created_by_username,
        po.status,
        CAST(po.total_amount AS DECIMAL(10, 2)) AS total_amount,
        po.order_date,
        po.expected_delivery_date,
        po.actual_delivery_date,
        po.notes,
        po.created_at,
        COUNT(DISTINCT poi.id) AS items_count
      FROM \`purchase_orders\` po
      JOIN \`suppliers\` s ON po.supplier_id = s.id
      LEFT JOIN \`users\` u ON po.created_by_user_id = u.id
      LEFT JOIN \`purchase_order_items\` poi ON po.id = poi.purchase_order_id
      WHERE po.id = ? OR po.po_number = ?
      GROUP BY 
        po.id, po.po_number, po.supplier_id, s.name, s.contact_person, s.email, s.phone,
        s.is_active, po.created_by_user_id, u.username, po.status, po.total_amount,
        po.order_date, po.expected_delivery_date, po.actual_delivery_date, po.notes, po.created_at
      LIMIT 1;
    `;
    const [rows] = await executor.query(sql, [idOrNumber, String(idOrNumber)]);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      po_number: r.po_number,
      supplier_id: r.supplier_id,
      supplier: {
        id: r.supplier_id,
        name: r.supplier_name,
        contact_person: r.supplier_contact,
        email: r.supplier_email,
        phone: r.supplier_phone,
        is_active: Boolean(r.supplier_is_active)
      },
      created_by_user_id: r.created_by_user_id,
      created_by_username: r.created_by_username,
      status: r.status,
      total_amount: Number(r.total_amount),
      order_date: r.order_date,
      expected_delivery_date: r.expected_delivery_date,
      actual_delivery_date: r.actual_delivery_date,
      notes: r.notes,
      created_at: r.created_at,
      items_count: Number(r.items_count)
    };
  },

  /**
   * Retrieves all items on a PO with row lock (FOR UPDATE)
   */
  async findPOItemsWithLock(poId, connection) {
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
        CAST(poi.subtotal AS DECIMAL(10, 2)) AS subtotal,
        poi.created_at
      FROM \`purchase_order_items\` poi
      JOIN \`ingredients\` i ON poi.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE poi.purchase_order_id = ?
      ORDER BY poi.id ASC
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
      subtotal: Number(r.subtotal),
      created_at: r.created_at
    }));
  },

  /**
   * Retrieves all items on a PO (without lock)
   */
  async findPOItems(poId, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        poi.id,
        poi.purchase_order_id,
        poi.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit,
        CAST(poi.quantity_ordered AS DECIMAL(10, 3)) AS quantity_ordered,
        CAST(poi.quantity_received AS DECIMAL(10, 3)) AS quantity_received,
        CAST(GREATEST(0.000, poi.quantity_ordered - poi.quantity_received) AS DECIMAL(10, 3)) AS quantity_outstanding,
        CAST(poi.unit_cost AS DECIMAL(10, 2)) AS unit_cost,
        CAST(poi.subtotal AS DECIMAL(10, 2)) AS subtotal,
        poi.created_at
      FROM \`purchase_order_items\` poi
      JOIN \`ingredients\` i ON poi.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE poi.purchase_order_id = ?
      ORDER BY poi.id ASC;
    `;
    const [rows] = await executor.query(sql, [poId]);
    return rows.map(r => ({
      id: r.id,
      purchase_order_id: r.purchase_order_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      unit: r.unit,
      quantity_ordered: Number(r.quantity_ordered),
      quantity_received: Number(r.quantity_received),
      quantity_outstanding: Number(r.quantity_outstanding),
      unit_cost: Number(r.unit_cost),
      subtotal: Number(r.subtotal),
      created_at: r.created_at
    }));
  },

  /**
   * Retrieves single PO item with row lock (FOR UPDATE)
   */
  async findPOItemByIdWithLock(itemId, connection) {
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
        CAST(poi.subtotal AS DECIMAL(10, 2)) AS subtotal,
        poi.created_at
      FROM \`purchase_order_items\` poi
      JOIN \`ingredients\` i ON poi.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE poi.id = ?
      FOR UPDATE;
    `;
    const [rows] = await connection.query(sql, [itemId]);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      purchase_order_id: r.purchase_order_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      unit: r.unit,
      quantity_ordered: Number(r.quantity_ordered),
      quantity_received: Number(r.quantity_received),
      unit_cost: Number(r.unit_cost),
      subtotal: Number(r.subtotal),
      created_at: r.created_at
    };
  },

  /**
   * Generates next unique PO number inside transaction
   * Format: PO-YYYY-NNN (e.g. PO-2026-019)
   */
  async getNextPONumber(year, connection) {
    const pattern = `PO-${year}-%`;
    const sql = `
      SELECT po_number 
      FROM \`purchase_orders\` 
      WHERE po_number LIKE ? 
      ORDER BY id DESC 
      LIMIT 1 
      FOR UPDATE;
    `;
    const [rows] = await connection.query(sql, [pattern]);
    let nextNum = 1;
    if (rows.length > 0) {
      const match = rows[0].po_number.match(/PO-\d{4}-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `PO-${year}-${String(nextNum).padStart(3, '0')}`;
  },

  /**
   * Inserts new purchase order header
   */
  async createPurchaseOrder({
    po_number,
    supplier_id,
    created_by_user_id = null,
    status = 'DRAFT',
    total_amount = 0.00,
    order_date,
    expected_delivery_date,
    notes = null
  }, connection) {
    const sql = `
      INSERT INTO \`purchase_orders\` (
        po_number,
        supplier_id,
        created_by_user_id,
        status,
        total_amount,
        order_date,
        expected_delivery_date,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await connection.query(sql, [
      po_number,
      supplier_id,
      created_by_user_id,
      status,
      total_amount,
      order_date,
      expected_delivery_date,
      notes
    ]);
    return result.insertId;
  },

  /**
   * Inserts line item into purchase order
   */
  async createPurchaseOrderItem({
    purchase_order_id,
    ingredient_id,
    quantity_ordered,
    quantity_received = 0.000,
    unit_cost,
    subtotal
  }, connection) {
    const sql = `
      INSERT INTO \`purchase_order_items\` (
        purchase_order_id,
        ingredient_id,
        quantity_ordered,
        quantity_received,
        unit_cost,
        subtotal
      ) VALUES (?, ?, ?, ?, ?, ?);
    `;
    const [result] = await connection.query(sql, [
      purchase_order_id,
      ingredient_id,
      quantity_ordered,
      quantity_received,
      unit_cost,
      subtotal
    ]);
    return result.insertId;
  },

  /**
   * Updates line item quantities and costs
   */
  async updatePurchaseOrderItem(itemId, { quantity_ordered, unit_cost, subtotal }, connection) {
    const sql = `
      UPDATE \`purchase_order_items\`
      SET 
        quantity_ordered = ?,
        unit_cost = ?,
        subtotal = ?
      WHERE id = ?;
    `;
    await connection.query(sql, [quantity_ordered, unit_cost, subtotal, itemId]);
  },

  /**
   * Deletes line item from purchase order
   */
  async deletePurchaseOrderItem(itemId, connection) {
    const sql = 'DELETE FROM `purchase_order_items` WHERE id = ?;';
    const [result] = await connection.query(sql, [itemId]);
    return result.affectedRows > 0;
  },

  /**
   * Recalculates and updates total_amount on purchase_orders header
   */
  async recalculatePOTotal(poId, connection) {
    const sql = `
      UPDATE \`purchase_orders\`
      SET total_amount = (
        SELECT COALESCE(SUM(subtotal), 0.00)
        FROM \`purchase_order_items\`
        WHERE purchase_order_id = ?
      )
      WHERE id = ?;
    `;
    await connection.query(sql, [poId, poId]);
  },

  /**
   * Updates purchase order status
   */
  async updatePOStatus(poId, status, connection) {
    const sql = 'UPDATE `purchase_orders` SET status = ? WHERE id = ?;';
    await connection.query(sql, [status, poId]);
  },

  /**
   * Retrieves paginated list of purchase orders with filtering and search
   */
  async listPurchaseOrders({
    page = 1,
    limit = 20,
    status = null,
    supplier_id = null,
    start_date = null,
    end_date = null,
    search = null
  } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('po.status = ?');
      params.push(status);
    }

    if (supplier_id) {
      conditions.push('po.supplier_id = ?');
      params.push(supplier_id);
    }

    if (start_date) {
      conditions.push('po.order_date >= ?');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('po.order_date <= ?');
      params.push(end_date);
    }

    if (search) {
      conditions.push('(po.po_number LIKE ? OR s.name LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(DISTINCT po.id) AS total
      FROM \`purchase_orders\` po
      JOIN \`suppliers\` s ON po.supplier_id = s.id
      ${whereClause};
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        po.id,
        po.po_number,
        po.supplier_id,
        s.name AS supplier_name,
        po.created_by_user_id,
        u.username AS created_by_username,
        po.status,
        CAST(po.total_amount AS DECIMAL(10, 2)) AS total_amount,
        po.order_date,
        po.expected_delivery_date,
        po.actual_delivery_date,
        po.notes,
        po.created_at,
        COUNT(DISTINCT poi.id) AS items_count,
        CAST(COALESCE(SUM(poi.quantity_ordered), 0.000) AS DECIMAL(10, 3)) AS total_quantity_ordered,
        CAST(COALESCE(SUM(poi.quantity_received), 0.000) AS DECIMAL(10, 3)) AS total_quantity_received
      FROM \`purchase_orders\` po
      JOIN \`suppliers\` s ON po.supplier_id = s.id
      LEFT JOIN \`users\` u ON po.created_by_user_id = u.id
      LEFT JOIN \`purchase_order_items\` poi ON po.id = poi.purchase_order_id
      ${whereClause}
      GROUP BY 
        po.id, po.po_number, po.supplier_id, s.name, po.created_by_user_id,
        u.username, po.status, po.total_amount, po.order_date, po.expected_delivery_date,
        po.actual_delivery_date, po.notes, po.created_at
      ORDER BY po.order_date DESC, po.id DESC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    return {
      purchase_orders: rows.map(r => ({
        id: r.id,
        po_number: r.po_number,
        supplier: {
          id: r.supplier_id,
          name: r.supplier_name
        },
        created_by: r.created_by_user_id ? {
          id: r.created_by_user_id,
          username: r.created_by_username
        } : null,
        status: r.status,
        total_amount: Number(r.total_amount),
        order_date: r.order_date,
        expected_delivery_date: r.expected_delivery_date,
        actual_delivery_date: r.actual_delivery_date,
        notes: r.notes,
        created_at: r.created_at,
        items_count: Number(r.items_count),
        total_quantity_ordered: Number(r.total_quantity_ordered),
        total_quantity_received: Number(r.total_quantity_received)
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
};

export default PurchaseOrderModel;
