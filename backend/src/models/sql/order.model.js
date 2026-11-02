import { getMySQLPool } from '../../config/mysql.js';

/**
 * Customer Order Data Access Object (DAO)
 * Manages restaurant POS orders, line items, dining tables, and FEFO inventory deduction procedure execution
 * Backed by MySQL `orders`, `order_items`, `dining_tables`, and `order_ingredient_consumptions`
 */
export const OrderModel = {
  /**
   * Retrieves order by ID with pessimistic row lock (FOR UPDATE)
   */
  async findOrderWithLock(id, connection) {
    const sql = `
      SELECT 
        o.id,
        o.order_number,
        o.order_type,
        o.table_id,
        dt.table_number,
        dt.status AS table_status,
        o.user_id,
        u.username AS staff_username,
        u.full_name AS staff_name,
        o.status,
        CAST(o.subtotal AS DECIMAL(10, 2)) AS subtotal,
        CAST(o.tax_amount AS DECIMAL(10, 2)) AS tax_amount,
        CAST(o.discount_amount AS DECIMAL(10, 2)) AS discount_amount,
        CAST(o.total_amount AS DECIMAL(10, 2)) AS total_amount,
        o.notes,
        o.order_date,
        o.completed_at
      FROM \`orders\` o
      LEFT JOIN \`dining_tables\` dt ON o.table_id = dt.id
      LEFT JOIN \`users\` u ON o.user_id = u.id
      WHERE o.id = ?
      FOR UPDATE;
    `;
    const [rows] = await connection.query(sql, [id]);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      order_number: r.order_number,
      order_type: r.order_type,
      table_id: r.table_id,
      table_number: r.table_number,
      table_status: r.table_status,
      user_id: r.user_id,
      staff_username: r.staff_username,
      staff_name: r.staff_name,
      status: r.status,
      subtotal: Number(r.subtotal),
      tax_amount: Number(r.tax_amount),
      discount_amount: Number(r.discount_amount),
      total_amount: Number(r.total_amount),
      notes: r.notes,
      order_date: r.order_date,
      completed_at: r.completed_at
    };
  },

  /**
   * Retrieves order by ID or order_number without lock
   */
  async findOrderById(idOrNumber, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        o.id,
        o.order_number,
        o.order_type,
        o.table_id,
        dt.table_number,
        dt.seating_capacity AS table_capacity,
        dt.status AS table_status,
        o.user_id,
        u.username AS staff_username,
        u.full_name AS staff_name,
        o.status,
        CAST(o.subtotal AS DECIMAL(10, 2)) AS subtotal,
        CAST(o.tax_amount AS DECIMAL(10, 2)) AS tax_amount,
        CAST(o.discount_amount AS DECIMAL(10, 2)) AS discount_amount,
        CAST(o.total_amount AS DECIMAL(10, 2)) AS total_amount,
        o.notes,
        o.order_date,
        o.completed_at,
        COUNT(DISTINCT oi.id) AS items_count,
        CAST(COALESCE(SUM(p.amount_paid), 0.00) AS DECIMAL(10, 2)) AS total_paid
      FROM \`orders\` o
      LEFT JOIN \`dining_tables\` dt ON o.table_id = dt.id
      LEFT JOIN \`users\` u ON o.user_id = u.id
      LEFT JOIN \`order_items\` oi ON o.id = oi.order_id
      LEFT JOIN \`payments\` p ON o.id = p.order_id AND p.payment_status = 'SUCCESSFUL'
      WHERE o.id = ? OR o.order_number = ?
      GROUP BY 
        o.id, o.order_number, o.order_type, o.table_id, dt.table_number, dt.seating_capacity, dt.status,
        o.user_id, u.username, u.full_name, o.status, o.subtotal, o.tax_amount,
        o.discount_amount, o.total_amount, o.notes, o.order_date, o.completed_at
      LIMIT 1;
    `;
    const [rows] = await executor.query(sql, [idOrNumber, String(idOrNumber)]);
    if (rows.length === 0) return null;

    const r = rows[0];
    const totalAmount = Number(r.total_amount);
    const totalPaid = Number(r.total_paid);
    const outstanding = Math.max(0, Number((totalAmount - totalPaid).toFixed(2)));

    let paymentStatus = 'UNPAID';
    if (totalPaid >= totalAmount && totalAmount > 0) {
      paymentStatus = 'PAID';
    } else if (totalPaid > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    return {
      id: r.id,
      order_number: r.order_number,
      order_type: r.order_type,
      table: r.table_id ? {
        id: r.table_id,
        table_number: r.table_number,
        seating_capacity: Number(r.table_capacity),
        status: r.table_status
      } : null,
      staff: r.user_id ? {
        id: r.user_id,
        username: r.staff_username,
        full_name: r.staff_name
      } : null,
      status: r.status,
      subtotal: Number(r.subtotal),
      tax_amount: Number(r.tax_amount),
      discount_amount: Number(r.discount_amount),
      total_amount: totalAmount,
      total_paid: totalPaid,
      outstanding_balance: outstanding,
      payment_status: paymentStatus,
      notes: r.notes,
      order_date: r.order_date,
      completed_at: r.completed_at,
      items_count: Number(r.items_count)
    };
  },

  /**
   * Retrieves all items for an order with menu item details
   */
  async findOrderItems(orderId, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        oi.id,
        oi.order_id,
        oi.menu_item_id,
        m.name AS menu_item_name,
        m.category_id,
        c.name AS category_name,
        oi.quantity,
        CAST(oi.unit_price AS DECIMAL(10, 2)) AS unit_price,
        CAST(oi.subtotal AS DECIMAL(10, 2)) AS subtotal,
        oi.special_instructions,
        oi.created_at
      FROM \`order_items\` oi
      JOIN \`menu_items\` m ON oi.menu_item_id = m.id
      LEFT JOIN \`categories\` c ON m.category_id = c.id
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC;
    `;
    const [rows] = await executor.query(sql, [orderId]);
    return rows.map(r => ({
      id: r.id,
      order_id: r.order_id,
      menu_item_id: r.menu_item_id,
      menu_item_name: r.menu_item_name,
      category_id: r.category_id,
      category_name: r.category_name,
      quantity: r.quantity,
      unit_price: Number(r.unit_price),
      subtotal: Number(r.subtotal),
      special_instructions: r.special_instructions,
      created_at: r.created_at
    }));
  },

  /**
   * Retrieves single order item with row lock (FOR UPDATE)
   */
  async findOrderItemWithLock(itemId, connection) {
    const sql = `
      SELECT 
        oi.id,
        oi.order_id,
        oi.menu_item_id,
        m.name AS menu_item_name,
        oi.quantity,
        CAST(oi.unit_price AS DECIMAL(10, 2)) AS unit_price,
        CAST(oi.subtotal AS DECIMAL(10, 2)) AS subtotal,
        oi.special_instructions,
        oi.created_at
      FROM \`order_items\` oi
      JOIN \`menu_items\` m ON oi.menu_item_id = m.id
      WHERE oi.id = ?
      FOR UPDATE;
    `;
    const [rows] = await connection.query(sql, [itemId]);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      order_id: r.order_id,
      menu_item_id: r.menu_item_id,
      menu_item_name: r.menu_item_name,
      quantity: r.quantity,
      unit_price: Number(r.unit_price),
      subtotal: Number(r.subtotal),
      special_instructions: r.special_instructions,
      created_at: r.created_at
    };
  },

  /**
   * Retrieves all FEFO ingredient consumptions recorded for an order
   */
  async findOrderConsumptions(orderId, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        oic.id,
        oic.order_item_id,
        m.name AS menu_item_name,
        oic.batch_id,
        b.batch_number,
        oic.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit,
        CAST(oic.quantity_consumed AS DECIMAL(10, 3)) AS quantity_consumed,
        CAST(oic.unit_cost_at_consumption AS DECIMAL(10, 2)) AS unit_cost_at_consumption,
        CAST(oic.total_cost AS DECIMAL(10, 2)) AS total_cost,
        oic.consumed_at
      FROM \`order_ingredient_consumptions\` oic
      JOIN \`order_items\` oi ON oic.order_item_id = oi.id
      JOIN \`menu_items\` m ON oi.menu_item_id = m.id
      JOIN \`inventory_batches\` b ON oic.batch_id = b.id
      JOIN \`ingredients\` i ON oic.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE oi.order_id = ?
      ORDER BY oic.id ASC;
    `;
    const [rows] = await executor.query(sql, [orderId]);
    return rows.map(r => ({
      id: r.id,
      order_item_id: r.order_item_id,
      menu_item_name: r.menu_item_name,
      batch_id: r.batch_id,
      batch_number: r.batch_number,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      unit: r.unit,
      quantity_consumed: Number(r.quantity_consumed),
      unit_cost_at_consumption: Number(r.unit_cost_at_consumption),
      total_cost: Number(r.total_cost),
      consumed_at: r.consumed_at
    }));
  },

  /**
   * Generates next unique order number inside transaction (UB-ORD-XXXX)
   */
  async getNextOrderNumber(connection) {
    const sql = `
      SELECT order_number 
      FROM \`orders\` 
      WHERE order_number LIKE 'UB-ORD-%' 
      ORDER BY id DESC 
      LIMIT 1 
      FOR UPDATE;
    `;
    const [rows] = await connection.query(sql);
    let nextNum = 1;
    if (rows.length > 0) {
      const match = rows[0].order_number.match(/UB-ORD-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `UB-ORD-${String(nextNum).padStart(4, '0')}`;
  },

  /**
   * Retrieves dining table by ID
   */
  async findTableById(tableId, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = 'SELECT * FROM `dining_tables` WHERE id = ?;';
    const [rows] = await executor.query(sql, [tableId]);
    return rows[0] || null;
  },

  /**
   * Updates dining table status
   */
  async updateTableStatus(tableId, status, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = 'UPDATE `dining_tables` SET status = ? WHERE id = ?;';
    await executor.query(sql, [status, tableId]);
  },

  /**
   * Inserts new customer order header
   */
  async createOrder({
    order_number,
    order_type,
    table_id = null,
    user_id = null,
    status = 'PENDING',
    subtotal = 0.00,
    tax_amount = 0.00,
    discount_amount = 0.00,
    total_amount = 0.00,
    notes = null
  }, connection) {
    const sql = `
      INSERT INTO \`orders\` (
        order_number,
        order_type,
        table_id,
        user_id,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await connection.query(sql, [
      order_number,
      order_type,
      table_id,
      user_id,
      status,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      notes
    ]);
    return result.insertId;
  },

  /**
   * Inserts line item into order
   */
  async createOrderItem({
    order_id,
    menu_item_id,
    quantity,
    unit_price,
    subtotal,
    special_instructions = null
  }, connection) {
    const sql = `
      INSERT INTO \`order_items\` (
        order_id,
        menu_item_id,
        quantity,
        unit_price,
        subtotal,
        special_instructions
      ) VALUES (?, ?, ?, ?, ?, ?);
    `;
    const [result] = await connection.query(sql, [
      order_id,
      menu_item_id,
      quantity,
      unit_price,
      subtotal,
      special_instructions
    ]);
    return result.insertId;
  },

  /**
   * Updates order item quantity and subtotal
   */
  async updateOrderItem(itemId, { quantity, subtotal, special_instructions }, connection) {
    const fields = ['quantity = ?', 'subtotal = ?'];
    const values = [quantity, subtotal];

    if (special_instructions !== undefined) {
      fields.push('special_instructions = ?');
      values.push(special_instructions);
    }

    fields.push('id = ?');
    values.push(itemId);

    const sql = `UPDATE \`order_items\` SET ${fields.slice(0, -1).join(', ')} WHERE id = ?;`;
    await connection.query(sql, values);
  },

  /**
   * Deletes order line item
   */
  async deleteOrderItem(itemId, connection) {
    const sql = 'DELETE FROM `order_items` WHERE id = ?;';
    const [result] = await connection.query(sql, [itemId]);
    return result.affectedRows > 0;
  },

  /**
   * Recalculates order subtotal, 5% standard tax, and total amount
   */
  async recalculateOrderTotals(orderId, connection) {
    // 1. Calculate sum of line item subtotals
    const sumSql = `
      SELECT COALESCE(SUM(subtotal), 0.00) AS subtotal
      FROM \`order_items\`
      WHERE order_id = ?;
    `;
    const [sumRows] = await connection.query(sumSql, [orderId]);
    const subtotal = Number(sumRows[0]?.subtotal || 0);

    // Standard 5% GST on food and restaurant dining
    const taxAmount = Number((subtotal * 0.05).toFixed(2));
    const discountAmount = 0.00;
    const totalAmount = Number((subtotal + taxAmount - discountAmount).toFixed(2));

    const updateSql = `
      UPDATE \`orders\`
      SET 
        subtotal = ?,
        tax_amount = ?,
        discount_amount = ?,
        total_amount = ?
      WHERE id = ?;
    `;
    await connection.query(updateSql, [subtotal, taxAmount, discountAmount, totalAmount, orderId]);
  },

  /**
   * Invokes the transaction-safe FEFO procedure
   * Note: The procedure controls its own internal START TRANSACTION / COMMIT boundary.
   */
  async callFEFOProcedure(orderId, connection) {
    const sql = 'CALL sp_process_order_fefo(?);';
    const [results] = await connection.query(sql, [orderId]);
    return results[0] ? results[0][0] : null;
  },

  /**
   * Updates order status and completed timestamp
   */
  async updateOrderStatus(orderId, status, completedAt = null, connection = null) {
    const executor = connection || getMySQLPool();
    const sql = `
      UPDATE \`orders\`
      SET 
        status = ?,
        completed_at = COALESCE(?, completed_at)
      WHERE id = ?;
    `;
    await executor.query(sql, [status, completedAt, orderId]);
  },

  /**
   * Retrieves paginated list of orders with filters and search
   */
  async listOrders({
    page = 1,
    limit = 20,
    status = null,
    order_type = null,
    table_id = null,
    start_date = null,
    end_date = null,
    search = null
  } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (order_type) {
      conditions.push('o.order_type = ?');
      params.push(order_type);
    }

    if (table_id) {
      conditions.push('o.table_id = ?');
      params.push(table_id);
    }

    if (start_date) {
      conditions.push('o.order_date >= ?');
      params.push(`${start_date} 00:00:00`);
    }

    if (end_date) {
      conditions.push('o.order_date <= ?');
      params.push(`${end_date} 23:59:59`);
    }

    if (search) {
      conditions.push('(o.order_number LIKE ? OR o.notes LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM \`orders\` o ${whereClause};`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        o.id,
        o.order_number,
        o.order_type,
        o.table_id,
        dt.table_number,
        o.user_id,
        u.username AS staff_username,
        o.status,
        CAST(o.subtotal AS DECIMAL(10, 2)) AS subtotal,
        CAST(o.tax_amount AS DECIMAL(10, 2)) AS tax_amount,
        CAST(o.discount_amount AS DECIMAL(10, 2)) AS discount_amount,
        CAST(o.total_amount AS DECIMAL(10, 2)) AS total_amount,
        o.notes,
        o.order_date,
        o.completed_at,
        COUNT(DISTINCT oi.id) AS items_count,
        CAST(COALESCE(SUM(p.amount_paid), 0.00) AS DECIMAL(10, 2)) AS total_paid
      FROM \`orders\` o
      LEFT JOIN \`dining_tables\` dt ON o.table_id = dt.id
      LEFT JOIN \`users\` u ON o.user_id = u.id
      LEFT JOIN \`order_items\` oi ON o.id = oi.order_id
      LEFT JOIN \`payments\` p ON o.id = p.order_id AND p.payment_status = 'SUCCESSFUL'
      ${whereClause}
      GROUP BY 
        o.id, o.order_number, o.order_type, o.table_id, dt.table_number,
        o.user_id, u.username, o.status, o.subtotal, o.tax_amount,
        o.discount_amount, o.total_amount, o.notes, o.order_date, o.completed_at
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    return {
      orders: rows.map(r => {
        const totalAmount = Number(r.total_amount);
        const totalPaid = Number(r.total_paid);
        let paymentStatus = 'UNPAID';
        if (totalPaid >= totalAmount && totalAmount > 0) {
          paymentStatus = 'PAID';
        } else if (totalPaid > 0) {
          paymentStatus = 'PARTIALLY_PAID';
        }

        return {
          id: r.id,
          order_number: r.order_number,
          order_type: r.order_type,
          table: r.table_id ? {
            id: r.table_id,
            table_number: r.table_number
          } : null,
          staff: r.user_id ? {
            id: r.user_id,
            username: r.staff_username
          } : null,
          status: r.status,
          subtotal: Number(r.subtotal),
          tax_amount: Number(r.tax_amount),
          discount_amount: Number(r.discount_amount),
          total_amount: totalAmount,
          total_paid: totalPaid,
          outstanding_balance: Math.max(0, Number((totalAmount - totalPaid).toFixed(2))),
          payment_status: paymentStatus,
          notes: r.notes,
          order_date: r.order_date,
          completed_at: r.completed_at,
          items_count: Number(r.items_count)
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
};

export default OrderModel;
