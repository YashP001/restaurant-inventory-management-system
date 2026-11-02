import { getMySQLPool } from '../../config/mysql.js';

/**
 * Forecast Data Access Object (DAO)
 * Manages sales extraction for forecasting, forecast persistence in `demand_forecasts`,
 * and recipe BOM queries for ingredient conversion.
 */
export const ForecastModel = {
  /**
   * Extracts historical completed sales grouped by date and menu_item_id.
   * Only strictly COMPLETED orders are included.
   */
  async getCompletedSalesHistory() {
    const pool = getMySQLPool();
    const sql = `
      SELECT 
        DATE(o.order_date) AS order_date,
        oi.menu_item_id,
        CAST(SUM(oi.quantity) AS DECIMAL(10, 3)) AS total_quantity,
        o.status
      FROM \`order_items\` oi
      JOIN \`orders\` o ON oi.order_id = o.id
      WHERE o.status = 'COMPLETED'
      GROUP BY DATE(o.order_date), oi.menu_item_id, o.status
      ORDER BY order_date ASC, oi.menu_item_id ASC;
    `;
    const [rows] = await pool.query(sql);
    return rows.map(r => ({
      date: r.order_date instanceof Date ? r.order_date.toISOString().split('T')[0] : String(r.order_date),
      menu_item_id: Number(r.menu_item_id),
      quantity_sold: Number(r.total_quantity),
      order_status: r.status
    }));
  },

  /**
   * Upserts menu-item forecasts in `demand_forecasts`.
   * Uses ON DUPLICATE KEY UPDATE against unique key (forecast_date, target_type, target_id, model_version).
   */
  async upsertForecasts(forecastRecords) {
    if (!forecastRecords || forecastRecords.length === 0) return 0;
    const pool = getMySQLPool();

    const sql = `
      INSERT INTO \`demand_forecasts\` (
        forecast_date,
        target_type,
        target_id,
        predicted_quantity,
        confidence_lower_bound,
        confidence_upper_bound,
        model_version,
        generated_at
      ) VALUES ?
      ON DUPLICATE KEY UPDATE
        predicted_quantity = VALUES(predicted_quantity),
        confidence_lower_bound = VALUES(confidence_lower_bound),
        confidence_upper_bound = VALUES(confidence_upper_bound),
        generated_at = CURRENT_TIMESTAMP;
    `;

    const values = forecastRecords.map(f => [
      f.forecast_date,
      f.target_type || 'MENU_ITEM',
      f.target_id,
      f.predicted_quantity,
      f.confidence_lower_bound,
      f.confidence_upper_bound,
      f.model_version || 'v1.0.0-rf',
      new Date()
    ]);

    const [result] = await pool.query(sql, [values]);
    return result.affectedRows;
  },

  /**
   * Retrieves saved forecasts with optional filtering
   */
  async findForecasts({
    startDate = null,
    endDate = null,
    targetType = 'MENU_ITEM',
    targetId = null,
    page = 1,
    limit = 50
  } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (targetType) {
      conditions.push('df.target_type = ?');
      params.push(targetType);
    }

    if (targetId) {
      conditions.push('df.target_id = ?');
      params.push(targetId);
    }

    if (startDate) {
      conditions.push('df.forecast_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('df.forecast_date <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM \`demand_forecasts\` df
      ${whereClause};
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0].total;

    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT 
        df.id,
        df.forecast_date,
        df.target_type,
        df.target_id,
        CASE 
          WHEN df.target_type = 'MENU_ITEM' THEN m.name
          WHEN df.target_type = 'INGREDIENT' THEN ing.name
          ELSE NULL 
        END AS target_name,
        CAST(df.predicted_quantity AS DECIMAL(10, 3)) AS predicted_quantity,
        CAST(df.confidence_lower_bound AS DECIMAL(10, 3)) AS confidence_lower_bound,
        CAST(df.confidence_upper_bound AS DECIMAL(10, 3)) AS confidence_upper_bound,
        CAST(df.actual_quantity_consumed AS DECIMAL(10, 3)) AS actual_quantity_consumed,
        df.model_version,
        df.generated_at
      FROM \`demand_forecasts\` df
      LEFT JOIN \`menu_items\` m ON df.target_type = 'MENU_ITEM' AND df.target_id = m.id
      LEFT JOIN \`ingredients\` ing ON df.target_type = 'INGREDIENT' AND df.target_id = ing.id
      ${whereClause}
      ORDER BY df.forecast_date ASC, df.target_id ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    return {
      forecasts: rows.map(r => ({
        id: r.id,
        forecast_date: r.forecast_date instanceof Date ? r.forecast_date.toISOString().split('T')[0] : String(r.forecast_date),
        target_type: r.target_type,
        target_id: r.target_id,
        target_name: r.target_name,
        predicted_quantity: Number(r.predicted_quantity),
        confidence_lower_bound: Number(r.confidence_lower_bound),
        confidence_upper_bound: Number(r.confidence_upper_bound),
        actual_quantity_consumed: r.actual_quantity_consumed !== null ? Number(r.actual_quantity_consumed) : null,
        model_version: r.model_version,
        generated_at: r.generated_at
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves active recipes along with recipe ingredients and unit conversions
   * for Bill of Materials (BOM) expansion.
   */
  async getActiveRecipesWithBOM() {
    const pool = getMySQLPool();
    const sql = `
      SELECT 
        r.id AS recipe_id,
        r.menu_item_id,
        m.name AS menu_item_name,
        r.yield_servings,
        ri.id AS recipe_ingredient_id,
        ri.ingredient_id,
        ing.name AS ingredient_name,
        ing.unit_id AS ingredient_base_unit_id,
        ing_uom.name AS ingredient_base_unit_name,
        ing_uom.abbreviation AS ingredient_base_unit_abbr,
        ing_uom.unit_type AS ingredient_unit_type,
        ing_uom.conversion_factor AS ingredient_base_conversion_factor,
        ri.quantity_required,
        ri.unit_id AS recipe_unit_id,
        ri_uom.name AS recipe_unit_name,
        ri_uom.abbreviation AS recipe_unit_abbr,
        ri_uom.unit_type AS recipe_unit_type,
        ri_uom.conversion_factor AS recipe_conversion_factor,
        ri.wastage_allowance_percent
      FROM \`recipes\` r
      JOIN \`menu_items\` m ON r.menu_item_id = m.id
      JOIN \`recipe_ingredients\` ri ON r.id = ri.recipe_id
      JOIN \`ingredients\` ing ON ri.ingredient_id = ing.id
      JOIN \`units_of_measure\` ri_uom ON ri.unit_id = ri_uom.id
      JOIN \`units_of_measure\` ing_uom ON ing.unit_id = ing_uom.id
      WHERE m.is_available = TRUE AND ing.is_active = TRUE
      ORDER BY r.menu_item_id ASC, ri.ingredient_id ASC;
    `;
    const [rows] = await pool.query(sql);
    return rows.map(r => ({
      recipe_id: r.recipe_id,
      menu_item_id: r.menu_item_id,
      menu_item_name: r.menu_item_name,
      yield_servings: Number(r.yield_servings),
      recipe_ingredient_id: r.recipe_ingredient_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      ingredient_base_unit_id: r.ingredient_base_unit_id,
      ingredient_base_unit_name: r.ingredient_base_unit_name,
      ingredient_base_unit_abbr: r.ingredient_base_unit_abbr,
      ingredient_unit_type: r.ingredient_unit_type,
      ingredient_base_conversion_factor: Number(r.ingredient_base_conversion_factor),
      quantity_required: Number(r.quantity_required),
      recipe_unit_id: r.recipe_unit_id,
      recipe_unit_name: r.recipe_unit_name,
      recipe_unit_abbr: r.recipe_unit_abbr,
      recipe_unit_type: r.recipe_unit_type,
      recipe_conversion_factor: Number(r.recipe_conversion_factor),
      wastage_allowance_percent: Number(r.wastage_allowance_percent)
    }));
  },

  /**
   * Retrieves active inventory batches grouped by ingredient, ordered by FEFO (expiry_date ASC).
   * Only batches with status 'ACTIVE' and remaining_quantity > 0 are selected.
   */
  async getActiveBatches() {
    const pool = getMySQLPool();
    const sql = `
      SELECT 
        ib.id,
        ib.ingredient_id,
        ib.batch_number,
        CAST(ib.quantity_received AS DECIMAL(10, 3)) AS quantity_received,
        CAST(ib.quantity_remaining AS DECIMAL(10, 3)) AS quantity_remaining,
        CAST(ib.unit_cost AS DECIMAL(10, 2)) AS unit_cost,
        ib.received_date,
        ib.expiry_date,
        ib.status
      FROM \`inventory_batches\` ib
      WHERE ib.status = 'ACTIVE' AND ib.quantity_remaining > 0
      ORDER BY ib.ingredient_id ASC, ib.expiry_date ASC, ib.id ASC;
    `;
    const [rows] = await pool.query(sql);
    return rows.map(r => ({
      id: r.id,
      ingredient_id: r.ingredient_id,
      batch_number: r.batch_number,
      quantity_received: Number(r.quantity_received),
      quantity_remaining: Number(r.quantity_remaining),
      unit_cost: Number(r.unit_cost),
      received_date: r.received_date instanceof Date ? r.received_date.toISOString().split('T')[0] : String(r.received_date),
      expiry_date: r.expiry_date instanceof Date ? r.expiry_date.toISOString().split('T')[0] : String(r.expiry_date),
      status: r.status
    }));
  },

  /**
   * Retrieves outstanding incoming purchase order line items.
   * Eligible statuses: 'SUBMITTED', 'PARTIALLY_RECEIVED'.
   */
  async getIncomingPurchaseOrders() {
    const pool = getMySQLPool();
    const sql = `
      SELECT 
        po.id AS po_id,
        po.po_number,
        po.supplier_id,
        s.name AS supplier_name,
        po.status AS po_status,
        po.order_date,
        po.expected_delivery_date,
        poi.id AS po_item_id,
        poi.ingredient_id,
        CAST(poi.quantity_ordered AS DECIMAL(10, 3)) AS quantity_ordered,
        CAST(poi.quantity_received AS DECIMAL(10, 3)) AS quantity_received,
        CAST((poi.quantity_ordered - poi.quantity_received) AS DECIMAL(10, 3)) AS outstanding_quantity,
        CAST(poi.unit_cost AS DECIMAL(10, 2)) AS unit_cost
      FROM \`purchase_orders\` po
      JOIN \`purchase_order_items\` poi ON po.id = poi.purchase_order_id
      JOIN \`suppliers\` s ON po.supplier_id = s.id
      WHERE po.status IN ('SUBMITTED', 'PARTIALLY_RECEIVED')
        AND (poi.quantity_ordered - poi.quantity_received) > 0
      ORDER BY po.expected_delivery_date ASC, po.id ASC;
    `;
    const [rows] = await pool.query(sql);
    return rows.map(r => ({
      po_id: r.po_id,
      po_number: r.po_number,
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_name,
      po_status: r.po_status,
      order_date: r.order_date instanceof Date ? r.order_date.toISOString().split('T')[0] : String(r.order_date),
      expected_delivery_date: r.expected_delivery_date instanceof Date ? r.expected_delivery_date.toISOString().split('T')[0] : String(r.expected_delivery_date),
      po_item_id: r.po_item_id,
      ingredient_id: r.ingredient_id,
      quantity_ordered: Number(r.quantity_ordered),
      quantity_received: Number(r.quantity_received),
      outstanding_quantity: Number(r.outstanding_quantity),
      unit_cost: Number(r.unit_cost)
    }));
  },

  /**
   * Retrieves active ingredients master data including min stock, par level,
   * unit details, and preferred supplier info from supplier_ingredients catalog.
   */
  async getIngredientsWithSupplierCatalog() {
    const pool = getMySQLPool();
    const sql = `
      SELECT 
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        i.unit_id,
        u.name AS unit_name,
        u.abbreviation AS unit_abbr,
        u.unit_type,
        CAST(i.minimum_stock_level AS DECIMAL(10, 3)) AS minimum_stock_level,
        CAST(i.optimal_par_level AS DECIMAL(10, 3)) AS optimal_par_level,
        CAST(i.cost_per_unit AS DECIMAL(10, 2)) AS cost_per_unit,
        si.id AS supplier_ingredient_id,
        si.supplier_id,
        s.name AS supplier_name,
        s.lead_time_days,
        s.is_active AS supplier_is_active,
        CAST(si.contract_unit_cost AS DECIMAL(10, 2)) AS contract_unit_cost,
        CAST(si.minimum_order_quantity AS DECIMAL(10, 3)) AS minimum_order_quantity,
        si.is_preferred_supplier
      FROM \`ingredients\` i
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      LEFT JOIN \`supplier_ingredients\` si ON i.id = si.ingredient_id
      LEFT JOIN \`suppliers\` s ON si.supplier_id = s.id AND s.is_active = TRUE
      WHERE i.is_active = TRUE
      ORDER BY i.id ASC, si.is_preferred_supplier DESC, si.contract_unit_cost ASC;
    `;
    const [rows] = await pool.query(sql);

    // Group suppliers per ingredient
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.ingredient_id)) {
        map.set(r.ingredient_id, {
          ingredient_id: r.ingredient_id,
          ingredient_name: r.ingredient_name,
          unit_id: r.unit_id,
          unit_name: r.unit_name,
          unit_abbr: r.unit_abbr,
          unit_type: r.unit_type,
          minimum_stock_level: Number(r.minimum_stock_level),
          optimal_par_level: Number(r.optimal_par_level),
          cost_per_unit: Number(r.cost_per_unit),
          suppliers: []
        });
      }
      if (r.supplier_id && r.supplier_is_active) {
        map.get(r.ingredient_id).suppliers.push({
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name,
          lead_time_days: Number(r.lead_time_days || 1),
          contract_unit_cost: Number(r.contract_unit_cost),
          minimum_order_quantity: Number(r.minimum_order_quantity),
          is_preferred_supplier: Boolean(r.is_preferred_supplier)
        });
      }
    }
    return Array.from(map.values());
  }
};

