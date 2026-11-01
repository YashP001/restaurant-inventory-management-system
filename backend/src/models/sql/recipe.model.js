import { getMySQLPool } from '../../config/mysql.js';

/**
 * Recipe & Bill of Materials (BOM) Data Access Object (DAO)
 * Executes strictly parameterized SQL queries against MySQL 8
 */
export const RecipeModel = {
  /**
   * Retrieves all recipes with menu item details, BOM line counts, and theoretical cost
   */
  async findAll({ search = '', menuItemId = null, page = 1, limit = 20 } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (menuItemId) {
      conditions.push('r.menu_item_id = ?');
      params.push(menuItemId);
    }

    if (search && search.trim() !== '') {
      conditions.push('(m.name LIKE ? OR r.instructions LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM \`recipes\` r
      JOIN \`menu_items\` m ON r.menu_item_id = m.id
      ${whereClause};
    `;
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].total;

    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT 
        r.id,
        r.menu_item_id,
        m.name AS menu_item_name,
        m.category_id,
        c.name AS category_name,
        CAST(m.selling_price AS DECIMAL(10, 2)) AS selling_price,
        r.yield_servings,
        r.instructions,
        r.created_at,
        r.updated_at,
        COUNT(ri.id) AS bom_items_count,
        ROUND(
          COALESCE(
            SUM(
              (ri.quantity_required * (1.0 + (ri.wastage_allowance_percent / 100.0))) 
              * (ri_uom.conversion_factor / ing_uom.conversion_factor) 
              * ing.cost_per_unit
            ) / r.yield_servings,
            0
          ),
          2
        ) AS cost_per_serving
      FROM \`recipes\` r
      JOIN \`menu_items\` m ON r.menu_item_id = m.id
      JOIN \`categories\` c ON m.category_id = c.id
      LEFT JOIN \`recipe_ingredients\` ri ON ri.recipe_id = r.id
      LEFT JOIN \`ingredients\` ing ON ing.id = ri.ingredient_id
      LEFT JOIN \`units_of_measure\` ri_uom ON ri_uom.id = ri.unit_id
      LEFT JOIN \`units_of_measure\` ing_uom ON ing_uom.id = ing.unit_id
      ${whereClause}
      GROUP BY r.id, r.menu_item_id, m.name, m.category_id, c.name, m.selling_price, r.yield_servings, r.instructions, r.created_at, r.updated_at
      ORDER BY r.id ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataQuery, [...params, limit, offset]);

    const recipes = rows.map(r => ({
      id: r.id,
      menu_item_id: r.menu_item_id,
      menu_item: {
        id: r.menu_item_id,
        name: r.menu_item_name,
        category_id: r.category_id,
        category_name: r.category_name,
        selling_price: Number(r.selling_price)
      },
      yield_servings: r.yield_servings,
      instructions: r.instructions,
      bom_items_count: Number(r.bom_items_count),
      ingredient_count: Number(r.bom_items_count),
      theoretical_cost_per_serving: Number(r.cost_per_serving),
      estimated_cost: Number(r.cost_per_serving),
      created_at: r.created_at,
      updated_at: r.updated_at
    }));

    return {
      recipes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves a single recipe by its primary key ID
   */
  async findById(id) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        r.id,
        r.menu_item_id,
        m.name AS menu_item_name,
        m.category_id,
        c.name AS category_name,
        CAST(m.selling_price AS DECIMAL(10, 2)) AS selling_price,
        r.yield_servings,
        r.instructions,
        r.created_at,
        r.updated_at
      FROM \`recipes\` r
      JOIN \`menu_items\` m ON r.menu_item_id = m.id
      JOIN \`categories\` c ON m.category_id = c.id
      WHERE r.id = ?
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [id]);
    if (!rows[0]) return null;

    const r = rows[0];
    return {
      id: r.id,
      menu_item_id: r.menu_item_id,
      menu_item: {
        id: r.menu_item_id,
        name: r.menu_item_name,
        category_id: r.category_id,
        category_name: r.category_name,
        selling_price: Number(r.selling_price)
      },
      yield_servings: r.yield_servings,
      instructions: r.instructions,
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  },

  /**
   * Retrieves a recipe by menu_item_id
   */
  async findByMenuItemId(menuItemId) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        r.id,
        r.menu_item_id,
        m.name AS menu_item_name,
        m.category_id,
        c.name AS category_name,
        CAST(m.selling_price AS DECIMAL(10, 2)) AS selling_price,
        r.yield_servings,
        r.instructions,
        r.created_at,
        r.updated_at
      FROM \`recipes\` r
      JOIN \`menu_items\` m ON r.menu_item_id = m.id
      JOIN \`categories\` c ON m.category_id = c.id
      WHERE r.menu_item_id = ?
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [menuItemId]);
    if (!rows[0]) return null;

    const r = rows[0];
    return {
      id: r.id,
      menu_item_id: r.menu_item_id,
      menu_item: {
        id: r.menu_item_id,
        name: r.menu_item_name,
        category_id: r.category_id,
        category_name: r.category_name,
        selling_price: Number(r.selling_price)
      },
      yield_servings: r.yield_servings,
      instructions: r.instructions,
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  },

  /**
   * Retrieves all Bill of Materials (BOM) ingredients for a recipe with units, conversion factors, and line costs
   */
  async getRecipeIngredients(recipeId) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        ri.id,
        ri.recipe_id,
        ri.ingredient_id,
        ing.name AS ingredient_name,
        CAST(ri.quantity_required AS DECIMAL(10, 3)) AS quantity_required,
        ri.unit_id,
        ri_uom.name AS unit_name,
        ri_uom.abbreviation AS unit_abbreviation,
        ri_uom.unit_type AS unit_type,
        CAST(ri_uom.conversion_factor AS DECIMAL(12, 6)) AS unit_conversion_factor,
        ing.unit_id AS ingredient_base_unit_id,
        ing_uom.name AS ingredient_base_unit_name,
        ing_uom.abbreviation AS ingredient_base_unit_abbreviation,
        CAST(ing_uom.conversion_factor AS DECIMAL(12, 6)) AS ingredient_base_conversion_factor,
        CAST(ri.wastage_allowance_percent AS DECIMAL(5, 2)) AS wastage_allowance_percent,
        CAST(ing.cost_per_unit AS DECIMAL(10, 2)) AS cost_per_unit,
        ROUND(
          (ri.quantity_required * (1.0 + (ri.wastage_allowance_percent / 100.0))) 
          * (ri_uom.conversion_factor / ing_uom.conversion_factor),
          4
        ) AS effective_quantity_base,
        ROUND(
          (ri.quantity_required * (1.0 + (ri.wastage_allowance_percent / 100.0))) 
          * (ri_uom.conversion_factor / ing_uom.conversion_factor) 
          * ing.cost_per_unit,
          2
        ) AS line_cost,
        ri.created_at
      FROM \`recipe_ingredients\` ri
      JOIN \`ingredients\` ing ON ri.ingredient_id = ing.id
      JOIN \`units_of_measure\` ri_uom ON ri.unit_id = ri_uom.id
      JOIN \`units_of_measure\` ing_uom ON ing.unit_id = ing_uom.id
      WHERE ri.recipe_id = ?
      ORDER BY ing.name ASC;
    `;
    const [rows] = await pool.query(query, [recipeId]);

    return rows.map(r => ({
      id: r.id,
      recipe_id: r.recipe_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      quantity_required: Number(r.quantity_required),
      unit_id: r.unit_id,
      unit: {
        id: r.unit_id,
        name: r.unit_name,
        abbreviation: r.unit_abbreviation,
        unit_type: r.unit_type,
        conversion_factor: Number(r.unit_conversion_factor)
      },
      ingredient_base_unit: {
        id: r.ingredient_base_unit_id,
        name: r.ingredient_base_unit_name,
        abbreviation: r.ingredient_base_unit_abbreviation,
        conversion_factor: Number(r.ingredient_base_conversion_factor)
      },
      wastage_allowance_percent: Number(r.wastage_allowance_percent),
      cost_per_unit: Number(r.cost_per_unit),
      effective_quantity_base: Number(r.effective_quantity_base),
      line_cost: Number(r.line_cost),
      created_at: r.created_at
    }));
  },

  /**
   * Retrieves a single BOM ingredient mapping by recipe_id and ingredient_id
   */
  async findRecipeIngredient(recipeId, ingredientId) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        ri.id,
        ri.recipe_id,
        ri.ingredient_id,
        ing.name AS ingredient_name,
        CAST(ri.quantity_required AS DECIMAL(10, 3)) AS quantity_required,
        ri.unit_id,
        ri_uom.name AS unit_name,
        ri_uom.abbreviation AS unit_abbreviation,
        ri_uom.unit_type AS unit_type,
        CAST(ri.wastage_allowance_percent AS DECIMAL(5, 2)) AS wastage_allowance_percent,
        ri.created_at
      FROM \`recipe_ingredients\` ri
      JOIN \`ingredients\` ing ON ri.ingredient_id = ing.id
      JOIN \`units_of_measure\` ri_uom ON ri.unit_id = ri_uom.id
      WHERE ri.recipe_id = ? AND ri.ingredient_id = ?
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [recipeId, ingredientId]);
    if (!rows[0]) return null;

    const r = rows[0];
    return {
      id: r.id,
      recipe_id: r.recipe_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      quantity_required: Number(r.quantity_required),
      unit_id: r.unit_id,
      unit: {
        id: r.unit_id,
        name: r.unit_name,
        abbreviation: r.unit_abbreviation,
        unit_type: r.unit_type
      },
      wastage_allowance_percent: Number(r.wastage_allowance_percent),
      created_at: r.created_at
    };
  },

  /**
   * Checks if an ingredient in a recipe has recorded historical order consumptions
   */
  async countHistoricalConsumptions(recipeId, ingredientId) {
    const pool = getMySQLPool();
    const query = `
      SELECT COUNT(oic.id) AS consumption_count
      FROM \`order_ingredient_consumptions\` oic
      JOIN \`order_items\` oi ON oic.order_item_id = oi.id
      JOIN \`recipes\` r ON oi.menu_item_id = r.menu_item_id
      WHERE r.id = ? AND oic.ingredient_id = ?;
    `;
    const [rows] = await pool.query(query, [recipeId, ingredientId]);
    return Number(rows[0]?.consumption_count || 0);
  },

  /**
   * Creates a new recipe for a menu item
   */
  async create({ menu_item_id, yield_servings = 1, instructions = null }, connection = null) {
    const client = connection || getMySQLPool();
    const query = `
      INSERT INTO \`recipes\` (menu_item_id, yield_servings, instructions)
      VALUES (?, ?, ?);
    `;
    const [result] = await client.query(query, [
      menu_item_id,
      yield_servings,
      instructions ? instructions.trim() : null
    ]);
    return result.insertId;
  },

  /**
   * Updates an existing recipe by ID
   */
  async update(id, fields, connection = null) {
    const client = connection || getMySQLPool();
    const setClauses = [];
    const params = [];

    if (fields.yield_servings !== undefined) {
      setClauses.push('`yield_servings` = ?');
      params.push(fields.yield_servings);
    }

    if (fields.instructions !== undefined) {
      setClauses.push('`instructions` = ?');
      params.push(fields.instructions !== null ? fields.instructions.trim() : null);
    }

    if (setClauses.length === 0) return false;

    params.push(id);
    const query = `UPDATE \`recipes\` SET ${setClauses.join(', ')} WHERE id = ?;`;
    const [result] = await client.query(query, params);
    return result.affectedRows > 0;
  },

  /**
   * Adds an ingredient to a recipe's Bill of Materials
   */
  async addIngredient({ recipe_id, ingredient_id, quantity_required, unit_id, wastage_allowance_percent = 0 }, connection = null) {
    const client = connection || getMySQLPool();
    const query = `
      INSERT INTO \`recipe_ingredients\` (
        recipe_id,
        ingredient_id,
        quantity_required,
        unit_id,
        wastage_allowance_percent
      ) VALUES (?, ?, ?, ?, ?);
    `;
    const [result] = await client.query(query, [
      recipe_id,
      ingredient_id,
      quantity_required,
      unit_id,
      wastage_allowance_percent
    ]);
    return result.insertId;
  },

  /**
   * Updates an existing recipe ingredient mapping
   */
  async updateIngredient(recipeId, ingredientId, fields, connection = null) {
    const client = connection || getMySQLPool();
    const setClauses = [];
    const params = [];

    if (fields.quantity_required !== undefined) {
      setClauses.push('`quantity_required` = ?');
      params.push(fields.quantity_required);
    }

    if (fields.unit_id !== undefined) {
      setClauses.push('`unit_id` = ?');
      params.push(fields.unit_id);
    }

    if (fields.wastage_allowance_percent !== undefined) {
      setClauses.push('`wastage_allowance_percent` = ?');
      params.push(fields.wastage_allowance_percent);
    }

    if (setClauses.length === 0) return false;

    params.push(recipeId, ingredientId);
    const query = `UPDATE \`recipe_ingredients\` SET ${setClauses.join(', ')} WHERE recipe_id = ? AND ingredient_id = ?;`;
    const [result] = await client.query(query, params);
    return result.affectedRows > 0;
  },

  /**
   * Removes an ingredient mapping from a recipe
   */
  async removeIngredient(recipeId, ingredientId, connection = null) {
    const client = connection || getMySQLPool();
    const query = 'DELETE FROM `recipe_ingredients` WHERE recipe_id = ? AND ingredient_id = ?;';
    const [result] = await client.query(query, [recipeId, ingredientId]);
    return result.affectedRows > 0;
  }
};

export default RecipeModel;
