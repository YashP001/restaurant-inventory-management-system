import { getMySQLPool } from '../../config/mysql.js';

/**
 * Inventory & Stock Visibility Data Access Object (DAO)
 * Executes strictly parameterized SQL queries against MySQL 8
 */
export const InventoryModel = {
  /**
   * Retrieves paginated ingredient inventory overview with real-time stock and status
   */
  async getOverview({ search = '', stockStatus = null, categoryId = null, page = 1, limit = 20 } = {}) {
    const pool = getMySQLPool();
    const conditions = ['i.is_active = TRUE'];
    const params = [];

    if (search && search.trim() !== '') {
      conditions.push('i.name LIKE ?');
      params.push(`%${search.trim()}%`);
    }

    if (categoryId) {
      conditions.push(`
        i.id IN (
          SELECT DISTINCT ri.ingredient_id
          FROM \`recipe_ingredients\` ri
          JOIN \`recipes\` r ON ri.recipe_id = r.id
          JOIN \`menu_items\` m ON r.menu_item_id = m.id
          WHERE m.category_id = ?
        )
      `);
      params.push(categoryId);
    }

    // Base subquery aggregating active, non-expired stock per ingredient
    // Avoids double counting and accurately handles zero-stock ingredients
    const baseQuery = `
      FROM \`ingredients\` i
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      LEFT JOIN \`inventory_batches\` b 
        ON b.ingredient_id = i.id 
        AND b.status = 'ACTIVE' 
        AND b.expiry_date >= CURRENT_DATE()
      WHERE ${conditions.join(' AND ')}
      GROUP BY i.id, i.name, i.unit_id, u.name, u.abbreviation, u.unit_type, i.minimum_stock_level, i.optimal_par_level, i.cost_per_unit
    `;

    // Having clause for stock status filter if provided
    let havingClause = '';
    if (stockStatus && stockStatus.toUpperCase() !== 'ALL') {
      const upperStatus = stockStatus.toUpperCase();
      if (upperStatus === 'OUT_OF_STOCK') {
        havingClause = 'HAVING COALESCE(SUM(b.quantity_remaining), 0.000) = 0.000';
      } else if (upperStatus === 'LOW_STOCK') {
        havingClause = 'HAVING COALESCE(SUM(b.quantity_remaining), 0.000) > 0.000 AND COALESCE(SUM(b.quantity_remaining), 0.000) <= i.minimum_stock_level';
      } else if (upperStatus === 'NORMAL') {
        havingClause = 'HAVING COALESCE(SUM(b.quantity_remaining), 0.000) > i.minimum_stock_level';
      }
    }

    // Count total matched ingredients
    const countSql = `
      SELECT COUNT(*) AS total FROM (
        SELECT i.id
        ${baseQuery}
        ${havingClause}
      ) AS filtered_ingredients;
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        i.unit_id,
        u.name AS unit_name,
        u.abbreviation AS unit_abbreviation,
        u.unit_type,
        CAST(COALESCE(SUM(b.quantity_remaining), 0.000) AS DECIMAL(10, 3)) AS current_stock,
        CAST(i.minimum_stock_level AS DECIMAL(10, 3)) AS minimum_stock_level,
        CAST(i.optimal_par_level AS DECIMAL(10, 3)) AS optimal_par_level,
        CAST(i.cost_per_unit AS DECIMAL(10, 2)) AS reference_cost_per_unit,
        CAST(COALESCE(SUM(b.quantity_remaining * b.unit_cost), 0.00) AS DECIMAL(10, 2)) AS stock_valuation,
        COUNT(b.id) AS active_batches_count,
        CASE 
          WHEN COALESCE(SUM(b.quantity_remaining), 0.000) = 0 THEN 'OUT_OF_STOCK'
          WHEN COALESCE(SUM(b.quantity_remaining), 0.000) <= i.minimum_stock_level THEN 'LOW_STOCK'
          ELSE 'NORMAL'
        END AS stock_status,
        CAST(GREATEST(0.000, i.optimal_par_level - COALESCE(SUM(b.quantity_remaining), 0.000)) AS DECIMAL(10, 3)) AS suggested_reorder_quantity
      ${baseQuery}
      ${havingClause}
      ORDER BY 
        CASE stock_status
          WHEN 'OUT_OF_STOCK' THEN 1
          WHEN 'LOW_STOCK' THEN 2
          ELSE 3
        END ASC,
        i.name ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    const items = rows.map(r => ({
      ingredient_id: r.ingredient_id,
      name: r.ingredient_name,
      unit: {
        id: r.unit_id,
        name: r.unit_name,
        abbreviation: r.unit_abbreviation,
        unit_type: r.unit_type
      },
      current_stock: Number(r.current_stock),
      minimum_stock_level: Number(r.minimum_stock_level),
      optimal_par_level: Number(r.optimal_par_level),
      reference_cost_per_unit: Number(r.reference_cost_per_unit),
      stock_valuation: Number(r.stock_valuation),
      active_batches_count: Number(r.active_batches_count),
      stock_status: r.stock_status,
      suggested_reorder_quantity: Number(r.suggested_reorder_quantity)
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Calculates high-level inventory KPI summary
   */
  async getSummary() {
    const pool = getMySQLPool();

    // 1. Total tracked ingredients, low stock count, out of stock count, and total valuation
    const stockStatsSql = `
      SELECT 
        COUNT(*) AS total_tracked_ingredients,
        COALESCE(SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_count,
        COALESCE(SUM(CASE WHEN current_stock > 0 AND current_stock <= minimum_stock_level THEN 1 ELSE 0 END), 0) AS low_stock_count,
        COALESCE(SUM(CASE WHEN current_stock > minimum_stock_level THEN 1 ELSE 0 END), 0) AS normal_stock_count,
        COALESCE(SUM(stock_valuation), 0.00) AS total_inventory_valuation
      FROM (
        SELECT 
          i.id,
          i.minimum_stock_level,
          COALESCE(SUM(b.quantity_remaining), 0.000) AS current_stock,
          COALESCE(SUM(b.quantity_remaining * b.unit_cost), 0.00) AS stock_valuation
        FROM \`ingredients\` i
        LEFT JOIN \`inventory_batches\` b 
          ON b.ingredient_id = i.id 
          AND b.status = 'ACTIVE' 
          AND b.expiry_date >= CURRENT_DATE()
        WHERE i.is_active = TRUE
        GROUP BY i.id, i.minimum_stock_level
      ) AS ing_summary;
    `;
    const [stockStatsRows] = await pool.query(stockStatsSql);
    const stockStats = stockStatsRows[0] || {};

    // 2. Batch-level counts: total batches, active, expired, expiring soon (<= 7 days)
    const batchStatsSql = `
      SELECT 
        COUNT(*) AS total_batches,
        COALESCE(SUM(CASE WHEN status = 'ACTIVE' AND expiry_date >= CURRENT_DATE() AND quantity_remaining > 0 THEN 1 ELSE 0 END), 0) AS active_batches,
        COALESCE(SUM(CASE WHEN status = 'DEPLETED' OR quantity_remaining = 0 THEN 1 ELSE 0 END), 0) AS depleted_batches,
        COALESCE(SUM(CASE WHEN status = 'EXPIRED' OR (expiry_date < CURRENT_DATE() AND quantity_remaining > 0) THEN 1 ELSE 0 END), 0) AS expired_batches,
        COALESCE(SUM(
          CASE 
            WHEN status = 'ACTIVE' 
              AND quantity_remaining > 0 
              AND expiry_date >= CURRENT_DATE() 
              AND DATEDIFF(expiry_date, CURRENT_DATE()) <= 7 
            THEN 1 ELSE 0 
          END
        ), 0) AS expiring_soon_batches
      FROM \`inventory_batches\`;
    `;
    const [batchStatsRows] = await pool.query(batchStatsSql);
    const batchStats = batchStatsRows[0] || {};

    return {
      total_tracked_ingredients: Number(stockStats.total_tracked_ingredients || 0),
      total_batches: Number(batchStats.total_batches || 0),
      active_batches: Number(batchStats.active_batches || 0),
      depleted_batches: Number(batchStats.depleted_batches || 0),
      expired_batches: Number(batchStats.expired_batches || 0),
      batches_expiring_soon: Number(batchStats.expiring_soon_batches || 0),
      low_stock_ingredients: Number(stockStats.low_stock_count || 0),
      out_of_stock_ingredients: Number(stockStats.out_of_stock_count || 0),
      normal_stock_ingredients: Number(stockStats.normal_stock_count || 0),
      total_inventory_valuation: Number(Number(stockStats.total_inventory_valuation || 0).toFixed(2))
    };
  },

  /**
   * Detailed inventory view for a single ingredient including batches, suppliers, and recent movements
   */
  async getIngredientDetails(ingredientId) {
    const pool = getMySQLPool();

    // 1. Ingredient & Current Stock
    const ingSql = `
      SELECT 
        i.id,
        i.name,
        i.unit_id,
        u.name AS unit_name,
        u.abbreviation AS unit_abbreviation,
        u.unit_type,
        CAST(i.minimum_stock_level AS DECIMAL(10, 3)) AS minimum_stock_level,
        CAST(i.optimal_par_level AS DECIMAL(10, 3)) AS optimal_par_level,
        CAST(i.cost_per_unit AS DECIMAL(10, 2)) AS cost_per_unit,
        i.is_active,
        CAST(COALESCE(SUM(b.quantity_remaining), 0.000) AS DECIMAL(10, 3)) AS current_stock,
        CAST(COALESCE(SUM(b.quantity_remaining * b.unit_cost), 0.00) AS DECIMAL(10, 2)) AS stock_valuation,
        CASE 
          WHEN COALESCE(SUM(b.quantity_remaining), 0.000) = 0 THEN 'OUT_OF_STOCK'
          WHEN COALESCE(SUM(b.quantity_remaining), 0.000) <= i.minimum_stock_level THEN 'LOW_STOCK'
          ELSE 'NORMAL'
        END AS stock_status,
        CAST(GREATEST(0.000, i.optimal_par_level - COALESCE(SUM(b.quantity_remaining), 0.000)) AS DECIMAL(10, 3)) AS suggested_reorder_quantity
      FROM \`ingredients\` i
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      LEFT JOIN \`inventory_batches\` b 
        ON b.ingredient_id = i.id 
        AND b.status = 'ACTIVE' 
        AND b.expiry_date >= CURRENT_DATE()
      WHERE i.id = ?
      GROUP BY i.id, i.name, i.unit_id, u.name, u.abbreviation, u.unit_type, i.minimum_stock_level, i.optimal_par_level, i.cost_per_unit, i.is_active;
    `;
    const [ingRows] = await pool.query(ingSql, [ingredientId]);
    if (ingRows.length === 0) {
      return null;
    }
    const ing = ingRows[0];

    // 2. All physical batches for this ingredient
    const batchesSql = `
      SELECT 
        b.id,
        b.batch_number,
        CAST(b.quantity_received AS DECIMAL(10, 3)) AS quantity_received,
        CAST(b.quantity_remaining AS DECIMAL(10, 3)) AS quantity_remaining,
        CAST(b.unit_cost AS DECIMAL(10, 2)) AS unit_cost,
        CAST(ROUND(b.quantity_remaining * b.unit_cost, 2) AS DECIMAL(10, 2)) AS remaining_value,
        b.received_date,
        b.expiry_date,
        DATEDIFF(b.expiry_date, CURRENT_DATE()) AS days_until_expiry,
        b.status,
        CASE 
          WHEN b.expiry_date < CURRENT_DATE() THEN 'EXPIRED'
          WHEN b.status = 'DEPLETED' OR b.quantity_remaining = 0 THEN 'DEPLETED'
          WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 3 THEN 'CRITICAL'
          WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 7 THEN 'WARNING'
          ELSE 'GOOD'
        END AS urgency_status,
        b.created_at
      FROM \`inventory_batches\` b
      WHERE b.ingredient_id = ?
      ORDER BY 
        CASE b.status
          WHEN 'ACTIVE' THEN 1
          WHEN 'EXPIRED' THEN 2
          ELSE 3
        END ASC,
        b.expiry_date ASC,
        b.id ASC;
    `;
    const [batchRows] = await pool.query(batchesSql, [ingredientId]);

    // 3. Suppliers catalog mapping
    const suppliersSql = `
      SELECT 
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.contact_person,
        s.email,
        s.phone,
        s.lead_time_days,
        CAST(si.contract_unit_cost AS DECIMAL(10, 2)) AS contract_unit_cost,
        CAST(si.minimum_order_quantity AS DECIMAL(10, 3)) AS minimum_order_quantity,
        si.is_preferred_supplier
      FROM \`supplier_ingredients\` si
      JOIN \`suppliers\` s ON si.supplier_id = s.id
      WHERE si.ingredient_id = ?
      ORDER BY si.is_preferred_supplier DESC, si.contract_unit_cost ASC;
    `;
    const [supplierRows] = await pool.query(suppliersSql, [ingredientId]);

    // 4. Recent stock movements (last 15 movements)
    const movementsSql = `
      SELECT 
        sm.id,
        sm.batch_id,
        b.batch_number,
        sm.movement_type,
        CAST(sm.quantity AS DECIMAL(10, 3)) AS quantity,
        CAST(sm.balance_after AS DECIMAL(10, 3)) AS balance_after,
        sm.reference_id,
        sm.notes,
        sm.created_at,
        u.id AS user_id,
        u.username AS created_by_username
      FROM \`stock_movements\` sm
      JOIN \`inventory_batches\` b ON sm.batch_id = b.id
      LEFT JOIN \`users\` u ON sm.created_by_user_id = u.id
      WHERE b.ingredient_id = ?
      ORDER BY sm.created_at DESC, sm.id DESC
      LIMIT 15;
    `;
    const [movementRows] = await pool.query(movementsSql, [ingredientId]);

    return {
      ingredient: {
        id: ing.id,
        name: ing.name,
        unit: {
          id: ing.unit_id,
          name: ing.unit_name,
          abbreviation: ing.unit_abbreviation,
          unit_type: ing.unit_type
        },
        cost_per_unit: Number(ing.cost_per_unit),
        is_active: Boolean(ing.is_active)
      },
      stock: {
        current_stock: Number(ing.current_stock),
        stock_valuation: Number(ing.stock_valuation),
        minimum_stock_level: Number(ing.minimum_stock_level),
        optimal_par_level: Number(ing.optimal_par_level),
        stock_status: ing.stock_status,
        suggested_reorder_quantity: Number(ing.suggested_reorder_quantity)
      },
      batches: batchRows.map(b => ({
        id: b.id,
        batch_number: b.batch_number,
        quantity_received: Number(b.quantity_received),
        quantity_remaining: Number(b.quantity_remaining),
        unit_cost: Number(b.unit_cost),
        remaining_value: Number(b.remaining_value),
        received_date: b.received_date,
        expiry_date: b.expiry_date,
        days_until_expiry: b.days_until_expiry,
        status: b.status,
        urgency_status: b.urgency_status,
        created_at: b.created_at
      })),
      suppliers: supplierRows.map(s => ({
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name,
        contact_person: s.contact_person,
        email: s.email,
        phone: s.phone,
        lead_time_days: s.lead_time_days,
        contract_unit_cost: Number(s.contract_unit_cost),
        minimum_order_quantity: Number(s.minimum_order_quantity),
        is_preferred_supplier: Boolean(s.is_preferred_supplier)
      })),
      recent_movements: movementRows.map(m => ({
        id: m.id,
        batch_id: m.batch_id,
        batch_number: m.batch_number,
        movement_type: m.movement_type,
        quantity: Number(m.quantity),
        balance_after: Number(m.balance_after),
        reference_id: m.reference_id,
        notes: m.notes,
        created_at: m.created_at,
        created_by: m.user_id ? { id: m.user_id, username: m.created_by_username } : null
      }))
    };
  },

  /**
   * Retrieves paginated batches with filtering and FEFO-first sorting
   */
  async getBatches({
    ingredientId = null,
    status = null,
    expiringBefore = null,
    expiringAfter = null,
    sortBy = 'expiry_date',
    sortOrder = 'ASC',
    page = 1,
    limit = 20
  } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (ingredientId) {
      conditions.push('b.ingredient_id = ?');
      params.push(ingredientId);
    }

    if (status && status.toUpperCase() !== 'ALL') {
      conditions.push('b.status = ?');
      params.push(status.toUpperCase());
    }

    if (expiringBefore) {
      conditions.push('b.expiry_date <= ?');
      params.push(expiringBefore);
    }

    if (expiringAfter) {
      conditions.push('b.expiry_date >= ?');
      params.push(expiringAfter);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM \`inventory_batches\` b
      ${whereClause};
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    // Sorting safe list
    const allowedSortFields = {
      expiry_date: 'b.expiry_date',
      received_date: 'b.received_date',
      quantity_remaining: 'b.quantity_remaining',
      unit_cost: 'b.unit_cost',
      batch_number: 'b.batch_number'
    };
    const sortField = allowedSortFields[sortBy] || 'b.expiry_date';
    const sortDirection = sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        b.id,
        b.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit_abbreviation,
        b.batch_number,
        CAST(b.quantity_received AS DECIMAL(10, 3)) AS quantity_received,
        CAST(b.quantity_remaining AS DECIMAL(10, 3)) AS quantity_remaining,
        CAST(b.unit_cost AS DECIMAL(10, 2)) AS unit_cost,
        CAST(ROUND(b.quantity_remaining * b.unit_cost, 2) AS DECIMAL(10, 2)) AS remaining_value,
        b.received_date,
        b.expiry_date,
        DATEDIFF(b.expiry_date, CURRENT_DATE()) AS days_until_expiry,
        b.status,
        CASE 
          WHEN b.expiry_date < CURRENT_DATE() THEN 'EXPIRED'
          WHEN b.status = 'DEPLETED' OR b.quantity_remaining = 0 THEN 'DEPLETED'
          WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 3 THEN 'CRITICAL'
          WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 7 THEN 'WARNING'
          ELSE 'GOOD'
        END AS urgency_status,
        b.created_at,
        b.updated_at
      FROM \`inventory_batches\` b
      JOIN \`ingredients\` i ON b.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}, b.id ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    const batches = rows.map(r => ({
      id: r.id,
      batch_number: r.batch_number,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      unit: r.unit_abbreviation,
      quantity_received: Number(r.quantity_received),
      quantity_remaining: Number(r.quantity_remaining),
      unit_cost: Number(r.unit_cost),
      remaining_value: Number(r.remaining_value),
      received_date: r.received_date,
      expiry_date: r.expiry_date,
      days_until_expiry: r.days_until_expiry,
      status: r.status,
      urgency_status: r.urgency_status,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));

    return {
      batches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves single batch by ID with audit movement records
   */
  async getBatchById(id) {
    const pool = getMySQLPool();

    const sql = `
      SELECT 
        b.id,
        b.ingredient_id,
        i.name AS ingredient_name,
        i.unit_id,
        u.name AS unit_name,
        u.abbreviation AS unit_abbreviation,
        u.unit_type,
        b.batch_number,
        CAST(b.quantity_received AS DECIMAL(10, 3)) AS quantity_received,
        CAST(b.quantity_remaining AS DECIMAL(10, 3)) AS quantity_remaining,
        CAST(b.unit_cost AS DECIMAL(10, 2)) AS unit_cost,
        CAST(ROUND(b.quantity_remaining * b.unit_cost, 2) AS DECIMAL(10, 2)) AS remaining_value,
        b.received_date,
        b.expiry_date,
        DATEDIFF(b.expiry_date, CURRENT_DATE()) AS days_until_expiry,
        b.status,
        CASE 
          WHEN b.expiry_date < CURRENT_DATE() THEN 'EXPIRED'
          WHEN b.status = 'DEPLETED' OR b.quantity_remaining = 0 THEN 'DEPLETED'
          WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 3 THEN 'CRITICAL'
          WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 7 THEN 'WARNING'
          ELSE 'GOOD'
        END AS urgency_status,
        b.created_at,
        b.updated_at
      FROM \`inventory_batches\` b
      JOIN \`ingredients\` i ON b.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE b.id = ?;
    `;
    const [rows] = await pool.query(sql, [id]);
    if (rows.length === 0) {
      return null;
    }
    const r = rows[0];

    // Fetch movements for this batch
    const movementsSql = `
      SELECT 
        sm.id,
        sm.movement_type,
        CAST(sm.quantity AS DECIMAL(10, 3)) AS quantity,
        CAST(sm.balance_after AS DECIMAL(10, 3)) AS balance_after,
        sm.reference_id,
        sm.notes,
        sm.created_at,
        u.id AS user_id,
        u.username AS created_by_username
      FROM \`stock_movements\` sm
      LEFT JOIN \`users\` u ON sm.created_by_user_id = u.id
      WHERE sm.batch_id = ?
      ORDER BY sm.created_at DESC, sm.id DESC;
    `;
    const [movements] = await pool.query(movementsSql, [id]);

    return {
      id: r.id,
      batch_number: r.batch_number,
      ingredient: {
        id: r.ingredient_id,
        name: r.ingredient_name,
        unit: {
          id: r.unit_id,
          name: r.unit_name,
          abbreviation: r.unit_abbreviation,
          unit_type: r.unit_type
        }
      },
      quantity_received: Number(r.quantity_received),
      quantity_remaining: Number(r.quantity_remaining),
      unit_cost: Number(r.unit_cost),
      remaining_value: Number(r.remaining_value),
      received_date: r.received_date,
      expiry_date: r.expiry_date,
      days_until_expiry: r.days_until_expiry,
      status: r.status,
      urgency_status: r.urgency_status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      movements: movements.map(m => ({
        id: m.id,
        movement_type: m.movement_type,
        quantity: Number(m.quantity),
        balance_after: Number(m.balance_after),
        reference_id: m.reference_id,
        notes: m.notes,
        created_at: m.created_at,
        created_by: m.user_id ? { id: m.user_id, username: m.created_by_username } : null
      }))
    };
  },

  /**
   * Retrieves batches that are either already expired or expiring within configurable days
   * Strictly distinguishes already-expired batches from batches expiring soon
   */
  async getExpiringBatches({ daysAhead = 7, status = 'ALL', ingredientId = null, page = 1, limit = 20 } = {}) {
    const pool = getMySQLPool();
    const conditions = ['b.quantity_remaining > 0'];
    const params = [];

    if (ingredientId) {
      conditions.push('b.ingredient_id = ?');
      params.push(ingredientId);
    }

    const upperStatus = status.toUpperCase();
    if (upperStatus === 'EXPIRED') {
      conditions.push('(b.expiry_date < CURRENT_DATE() OR b.status = \'EXPIRED\')');
    } else if (upperStatus === 'EXPIRING_SOON') {
      conditions.push('(b.status = \'ACTIVE\' AND b.expiry_date >= CURRENT_DATE() AND DATEDIFF(b.expiry_date, CURRENT_DATE()) <= ?)');
      params.push(daysAhead);
    } else {
      // ALL expiring or expired:
      conditions.push('(b.expiry_date < CURRENT_DATE() OR b.status = \'EXPIRED\' OR (b.status = \'ACTIVE\' AND DATEDIFF(b.expiry_date, CURRENT_DATE()) <= ?))');
      params.push(daysAhead);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM \`inventory_batches\` b
      ${whereClause};
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        b.id,
        b.ingredient_id,
        i.name AS ingredient_name,
        u.abbreviation AS unit,
        b.batch_number,
        CAST(b.quantity_remaining AS DECIMAL(10, 3)) AS quantity_remaining,
        CAST(b.unit_cost AS DECIMAL(10, 2)) AS unit_cost,
        CAST(ROUND(b.quantity_remaining * b.unit_cost, 2) AS DECIMAL(10, 2)) AS remaining_value,
        b.received_date,
        b.expiry_date,
        DATEDIFF(b.expiry_date, CURRENT_DATE()) AS days_until_expiry,
        b.status,
        CASE 
          WHEN b.expiry_date < CURRENT_DATE() OR b.status = 'EXPIRED' THEN 'EXPIRED'
          WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 3 THEN 'CRITICAL'
          WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 7 THEN 'WARNING'
          ELSE 'ATTENTION'
        END AS urgency_status
      FROM \`inventory_batches\` b
      JOIN \`ingredients\` i ON b.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN b.expiry_date < CURRENT_DATE() OR b.status = 'EXPIRED' THEN 1
          ELSE 2
        END ASC,
        b.expiry_date ASC,
        b.quantity_remaining ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    const batches = rows.map(r => ({
      id: r.id,
      batch_number: r.batch_number,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      unit: r.unit,
      quantity_remaining: Number(r.quantity_remaining),
      unit_cost: Number(r.unit_cost),
      remaining_value: Number(r.remaining_value),
      received_date: r.received_date,
      expiry_date: r.expiry_date,
      days_until_expiry: r.days_until_expiry,
      is_expired: r.expiry_date < new Date().toISOString().split('T')[0] || r.status === 'EXPIRED',
      status: r.status,
      urgency_status: r.urgency_status
    }));

    return {
      batches,
      total,
      days_ahead: daysAhead,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Identifies low-stock and out-of-stock ingredients requiring replenishment
   */
  async getLowStockIngredients({ status = 'ALL', search = '', page = 1, limit = 20 } = {}) {
    const pool = getMySQLPool();
    const conditions = ['i.is_active = TRUE'];
    const params = [];

    if (search && search.trim() !== '') {
      conditions.push('i.name LIKE ?');
      params.push(`%${search.trim()}%`);
    }

    let havingCondition = 'HAVING current_stock <= i.minimum_stock_level';
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'OUT_OF_STOCK') {
      havingCondition = 'HAVING current_stock = 0.000';
    } else if (upperStatus === 'LOW_STOCK') {
      havingCondition = 'HAVING current_stock > 0.000 AND current_stock <= i.minimum_stock_level';
    }

    const baseSql = `
      FROM \`ingredients\` i
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      LEFT JOIN \`inventory_batches\` b 
        ON b.ingredient_id = i.id 
        AND b.status = 'ACTIVE' 
        AND b.expiry_date >= CURRENT_DATE()
      WHERE ${conditions.join(' AND ')}
      GROUP BY i.id, i.name, u.name, u.abbreviation, u.unit_type, i.minimum_stock_level, i.optimal_par_level, i.cost_per_unit
    `;

    const countSql = `
      SELECT COUNT(*) AS total FROM (
        SELECT 
          i.id,
          COALESCE(SUM(b.quantity_remaining), 0.000) AS current_stock
        ${baseSql}
        ${havingCondition}
      ) AS low_stock_totals;
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        u.name AS unit_name,
        u.abbreviation AS unit_abbreviation,
        u.unit_type,
        CAST(COALESCE(SUM(b.quantity_remaining), 0.000) AS DECIMAL(10, 3)) AS current_stock,
        CAST(i.minimum_stock_level AS DECIMAL(10, 3)) AS minimum_stock_level,
        CAST(i.optimal_par_level AS DECIMAL(10, 3)) AS optimal_par_level,
        CAST(i.cost_per_unit AS DECIMAL(10, 2)) AS cost_per_unit,
        CASE 
          WHEN COALESCE(SUM(b.quantity_remaining), 0.000) = 0 THEN 'OUT_OF_STOCK'
          ELSE 'LOW_STOCK'
        END AS stock_status,
        CAST(GREATEST(0.000, i.minimum_stock_level - COALESCE(SUM(b.quantity_remaining), 0.000)) AS DECIMAL(10, 3)) AS deficit_to_min,
        CAST(GREATEST(0.000, i.optimal_par_level - COALESCE(SUM(b.quantity_remaining), 0.000)) AS DECIMAL(10, 3)) AS suggested_reorder_quantity
      ${baseSql}
      ${havingCondition}
      ORDER BY 
        CASE stock_status
          WHEN 'OUT_OF_STOCK' THEN 1
          ELSE 2
        END ASC,
        deficit_to_min DESC,
        i.name ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    const items = rows.map(r => ({
      ingredient_id: r.ingredient_id,
      name: r.ingredient_name,
      unit: {
        name: r.unit_name,
        abbreviation: r.unit_abbreviation,
        unit_type: r.unit_type
      },
      current_stock: Number(r.current_stock),
      minimum_stock_level: Number(r.minimum_stock_level),
      optimal_par_level: Number(r.optimal_par_level),
      cost_per_unit: Number(r.cost_per_unit),
      stock_status: r.stock_status,
      deficit_to_min: Number(r.deficit_to_min),
      suggested_reorder_quantity: Number(r.suggested_reorder_quantity)
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves immutable stock movement audit trail with comprehensive filtering
   */
  async getStockMovements({
    ingredientId = null,
    batchId = null,
    movementType = null,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 20
  } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (ingredientId) {
      conditions.push('b.ingredient_id = ?');
      params.push(ingredientId);
    }

    if (batchId) {
      conditions.push('sm.batch_id = ?');
      params.push(batchId);
    }

    if (movementType && movementType.toUpperCase() !== 'ALL') {
      conditions.push('sm.movement_type = ?');
      params.push(movementType.toUpperCase());
    }

    if (startDate) {
      conditions.push('sm.created_at >= ?');
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      conditions.push('sm.created_at <= ?');
      params.push(`${endDate} 23:59:59`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM \`stock_movements\` sm
      JOIN \`inventory_batches\` b ON sm.batch_id = b.id
      ${whereClause};
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        sm.id,
        sm.batch_id,
        b.batch_number,
        b.expiry_date,
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
        usr.username AS created_by_username,
        usr.full_name AS created_by_full_name
      FROM \`stock_movements\` sm
      JOIN \`inventory_batches\` b ON sm.batch_id = b.id
      JOIN \`ingredients\` i ON b.ingredient_id = i.id
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      LEFT JOIN \`users\` usr ON sm.created_by_user_id = usr.id
      ${whereClause}
      ORDER BY sm.created_at DESC, sm.id DESC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    const movements = rows.map(r => ({
      id: r.id,
      ingredient: {
        id: r.ingredient_id,
        name: r.ingredient_name,
        unit: r.unit
      },
      batch: {
        id: r.batch_id,
        batch_number: r.batch_number,
        expiry_date: r.expiry_date
      },
      movement_type: r.movement_type,
      quantity: Number(r.quantity),
      balance_after: Number(r.balance_after),
      reference_id: r.reference_id,
      notes: r.notes,
      created_at: r.created_at,
      created_by: r.user_id ? {
        id: r.user_id,
        username: r.created_by_username,
        full_name: r.created_by_full_name
      } : null
    }));

    return {
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
};

export default InventoryModel;
