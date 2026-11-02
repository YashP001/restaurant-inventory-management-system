import { getMySQLPool } from '../../config/mysql.js';

/**
 * Supplier Data Access Object (DAO)
 * Manages vendor catalog, contact details, and supplier-ingredient relationships
 * Backed by MySQL `suppliers` and `supplier_ingredients` tables
 */
export const SupplierModel = {
  /**
   * Retrieves paginated list of suppliers with optional search and active status filters
   */
  async listSuppliers({ page = 1, limit = 20, search = null, is_active = null } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(s.name LIKE ? OR s.contact_person LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (is_active !== null && is_active !== undefined) {
      const activeVal = is_active === 'true' || is_active === '1' || is_active === true ? 1 : 0;
      conditions.push('s.is_active = ?');
      params.push(activeVal);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total Count
    const countSql = `SELECT COUNT(*) AS total FROM \`suppliers\` s ${whereClause};`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    // Paginated Data with aggregate counts
    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        s.id,
        s.name,
        s.contact_person,
        s.email,
        s.phone,
        s.address,
        s.lead_time_days,
        s.payment_terms,
        s.is_active,
        s.created_at,
        COUNT(DISTINCT si.id) AS mapped_ingredients_count,
        COUNT(DISTINCT po.id) AS purchase_orders_count
      FROM \`suppliers\` s
      LEFT JOIN \`supplier_ingredients\` si ON s.id = si.supplier_id
      LEFT JOIN \`purchase_orders\` po ON s.id = po.supplier_id
      ${whereClause}
      GROUP BY 
        s.id, s.name, s.contact_person, s.email, s.phone,
        s.address, s.lead_time_days, s.payment_terms, s.is_active, s.created_at
      ORDER BY s.id ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    return {
      suppliers: rows.map(r => ({
        id: r.id,
        name: r.name,
        contact_person: r.contact_person,
        email: r.email,
        phone: r.phone,
        address: r.address,
        lead_time_days: Number(r.lead_time_days),
        payment_terms: r.payment_terms,
        is_active: Boolean(r.is_active),
        created_at: r.created_at,
        mapped_ingredients_count: Number(r.mapped_ingredients_count),
        purchase_orders_count: Number(r.purchase_orders_count)
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves supplier by ID with aggregate counts
   */
  async findById(id, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        s.id,
        s.name,
        s.contact_person,
        s.email,
        s.phone,
        s.address,
        s.lead_time_days,
        s.payment_terms,
        s.is_active,
        s.created_at,
        COUNT(DISTINCT si.id) AS mapped_ingredients_count,
        COUNT(DISTINCT po.id) AS purchase_orders_count
      FROM \`suppliers\` s
      LEFT JOIN \`supplier_ingredients\` si ON s.id = si.supplier_id
      LEFT JOIN \`purchase_orders\` po ON s.id = po.supplier_id
      WHERE s.id = ?
      GROUP BY 
        s.id, s.name, s.contact_person, s.email, s.phone,
        s.address, s.lead_time_days, s.payment_terms, s.is_active, s.created_at
      LIMIT 1;
    `;
    const [rows] = await executor.query(sql, [id]);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      contact_person: r.contact_person,
      email: r.email,
      phone: r.phone,
      address: r.address,
      lead_time_days: Number(r.lead_time_days),
      payment_terms: r.payment_terms,
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      mapped_ingredients_count: Number(r.mapped_ingredients_count),
      purchase_orders_count: Number(r.purchase_orders_count)
    };
  },

  /**
   * Finds supplier by name, optionally excluding a specific supplier ID
   */
  async findByName(name, excludeId = null, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    let sql = 'SELECT id, name FROM `suppliers` WHERE name = ?';
    const params = [name];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await executor.query(sql, params);
    return rows[0] || null;
  },

  /**
   * Finds supplier by email, optionally excluding a specific supplier ID
   */
  async findByEmail(email, excludeId = null, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    let sql = 'SELECT id, email FROM `suppliers` WHERE email = ?';
    const params = [email];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await executor.query(sql, params);
    return rows[0] || null;
  },

  /**
   * Inserts a new supplier record
   */
  async createSupplier({
    name,
    contact_person = null,
    email,
    phone,
    address = null,
    lead_time_days = 1,
    payment_terms = 'Net 30',
    is_active = true
  }, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      INSERT INTO \`suppliers\` (
        name,
        contact_person,
        email,
        phone,
        address,
        lead_time_days,
        payment_terms,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await executor.query(sql, [
      name,
      contact_person,
      email,
      phone,
      address,
      lead_time_days,
      payment_terms,
      is_active ? 1 : 0
    ]);
    return result.insertId;
  },

  /**
   * Updates an existing supplier record
   */
  async updateSupplier(id, updateData, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const fields = [];
    const values = [];

    if (updateData.name !== undefined) {
      fields.push('name = ?');
      values.push(updateData.name);
    }
    if (updateData.contact_person !== undefined) {
      fields.push('contact_person = ?');
      values.push(updateData.contact_person);
    }
    if (updateData.email !== undefined) {
      fields.push('email = ?');
      values.push(updateData.email);
    }
    if (updateData.phone !== undefined) {
      fields.push('phone = ?');
      values.push(updateData.phone);
    }
    if (updateData.address !== undefined) {
      fields.push('address = ?');
      values.push(updateData.address);
    }
    if (updateData.lead_time_days !== undefined) {
      fields.push('lead_time_days = ?');
      values.push(updateData.lead_time_days);
    }
    if (updateData.payment_terms !== undefined) {
      fields.push('payment_terms = ?');
      values.push(updateData.payment_terms);
    }
    if (updateData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updateData.is_active ? 1 : 0);
    }

    if (fields.length === 0) return false;

    const sql = `UPDATE \`suppliers\` SET ${fields.join(', ')} WHERE id = ?;`;
    values.push(id);
    await executor.query(sql, values);
    return true;
  },

  /**
   * Retrieves all ingredients mapped to a specific supplier
   */
  async getSupplierIngredients(supplierId, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        si.id,
        si.supplier_id,
        si.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit,
        CAST(si.contract_unit_cost AS DECIMAL(10, 2)) AS contract_unit_cost,
        CAST(si.minimum_order_quantity AS DECIMAL(10, 3)) AS minimum_order_quantity,
        si.is_preferred_supplier,
        si.created_at
      FROM \`supplier_ingredients\` si
      JOIN \`ingredients\` i ON si.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE si.supplier_id = ?
      ORDER BY i.name ASC;
    `;
    const [rows] = await executor.query(sql, [supplierId]);
    return rows.map(r => ({
      id: r.id,
      supplier_id: r.supplier_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      unit: r.unit,
      contract_unit_cost: Number(r.contract_unit_cost),
      minimum_order_quantity: Number(r.minimum_order_quantity),
      is_preferred_supplier: Boolean(r.is_preferred_supplier),
      created_at: r.created_at
    }));
  },

  /**
   * Finds specific supplier-ingredient mapping
   */
  async findSupplierIngredient(supplierId, ingredientId, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      SELECT 
        si.id,
        si.supplier_id,
        si.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit,
        CAST(si.contract_unit_cost AS DECIMAL(10, 2)) AS contract_unit_cost,
        CAST(si.minimum_order_quantity AS DECIMAL(10, 3)) AS minimum_order_quantity,
        si.is_preferred_supplier,
        si.created_at
      FROM \`supplier_ingredients\` si
      JOIN \`ingredients\` i ON si.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE si.supplier_id = ? AND si.ingredient_id = ?
      LIMIT 1;
    `;
    const [rows] = await executor.query(sql, [supplierId, ingredientId]);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      supplier_id: r.supplier_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      unit: r.unit,
      contract_unit_cost: Number(r.contract_unit_cost),
      minimum_order_quantity: Number(r.minimum_order_quantity),
      is_preferred_supplier: Boolean(r.is_preferred_supplier),
      created_at: r.created_at
    };
  },

  /**
   * Maps an ingredient to a supplier
   */
  async mapSupplierIngredient({
    supplier_id,
    ingredient_id,
    contract_unit_cost,
    minimum_order_quantity = 1.000,
    is_preferred_supplier = false
  }, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      INSERT INTO \`supplier_ingredients\` (
        supplier_id,
        ingredient_id,
        contract_unit_cost,
        minimum_order_quantity,
        is_preferred_supplier
      ) VALUES (?, ?, ?, ?, ?);
    `;
    const [result] = await executor.query(sql, [
      supplier_id,
      ingredient_id,
      contract_unit_cost,
      minimum_order_quantity,
      is_preferred_supplier ? 1 : 0
    ]);
    return result.insertId;
  },

  /**
   * Unmaps an ingredient from a supplier
   */
  async unmapSupplierIngredient(supplierId, ingredientId, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = `
      DELETE FROM \`supplier_ingredients\`
      WHERE supplier_id = ? AND ingredient_id = ?;
    `;
    const [result] = await executor.query(sql, [supplierId, ingredientId]);
    return result.affectedRows > 0;
  },

  /**
   * Counts purchase orders referencing a supplier
   */
  async countPurchaseOrdersBySupplier(supplierId, connectionOrPool = null) {
    const executor = connectionOrPool || getMySQLPool();
    const sql = 'SELECT COUNT(*) AS count FROM `purchase_orders` WHERE supplier_id = ?;';
    const [rows] = await executor.query(sql, [supplierId]);
    return rows[0]?.count || 0;
  }
};

export default SupplierModel;
