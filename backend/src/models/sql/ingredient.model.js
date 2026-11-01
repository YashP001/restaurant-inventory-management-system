import { getMySQLPool } from '../../config/mysql.js';

/**
 * Ingredient Data Access Object (DAO)
 * Executes strictly parameterized SQL queries against MySQL 8
 */
export const IngredientModel = {
  /**
   * Retrieves ingredients with optional search, category filter, unit filter, active filter, and pagination
   */
  async findAll({ search = '', unitId = null, categoryId = null, isActive = null, page = 1, limit = 20 } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (isActive !== null && isActive !== undefined) {
      conditions.push('i.is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (unitId) {
      conditions.push('i.unit_id = ?');
      params.push(unitId);
    }

    if (search && search.trim() !== '') {
      conditions.push('i.name LIKE ?');
      params.push(`%${search.trim()}%`);
    }

    if (categoryId) {
      conditions.push(`
        EXISTS (
          SELECT 1 
          FROM \`recipe_ingredients\` ri2
          JOIN \`recipes\` r2 ON ri2.recipe_id = r2.id
          JOIN \`menu_items\` m2 ON r2.menu_item_id = m2.id
          WHERE ri2.ingredient_id = i.id AND m2.category_id = ?
        )
      `);
      params.push(categoryId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM \`ingredients\` i ${whereClause};`;
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].total;

    // Data query with unit JOIN and category aggregation
    const offset = (page - 1) * limit;
    const dataQuery = `
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
        i.created_at,
        i.updated_at,
        (
          SELECT GROUP_CONCAT(DISTINCT CONCAT(c.id, ':', c.name) SEPARATOR ';')
          FROM \`recipe_ingredients\` ri
          JOIN \`recipes\` r ON ri.recipe_id = r.id
          JOIN \`menu_items\` m ON r.menu_item_id = m.id
          JOIN \`categories\` c ON m.category_id = c.id
          WHERE ri.ingredient_id = i.id
        ) AS categories_concat
      FROM \`ingredients\` i
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      ${whereClause}
      ORDER BY i.name ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataQuery, [...params, limit, offset]);

    const ingredients = rows.map(r => {
      let categories = [];
      if (r.categories_concat) {
        categories = r.categories_concat.split(';').map(item => {
          const [catId, catName] = item.split(':');
          return { id: Number(catId), name: catName };
        });
      }

      return {
        id: r.id,
        name: r.name,
        unit_id: r.unit_id,
        unit: {
          id: r.unit_id,
          name: r.unit_name,
          abbreviation: r.unit_abbreviation,
          unit_type: r.unit_type
        },
        minimum_stock_level: Number(r.minimum_stock_level),
        optimal_par_level: Number(r.optimal_par_level),
        cost_per_unit: Number(r.cost_per_unit),
        is_active: Boolean(r.is_active),
        categories,
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    });

    return {
      ingredients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves a single ingredient by primary key ID with unit and category information
   * @param {number} id - Ingredient ID
   */
  async findById(id) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        i.id,
        i.name,
        i.unit_id,
        u.name AS unit_name,
        u.abbreviation AS unit_abbreviation,
        u.unit_type,
        CAST(u.conversion_factor AS DECIMAL(12, 6)) AS unit_conversion_factor,
        u.base_unit_id,
        CAST(i.minimum_stock_level AS DECIMAL(10, 3)) AS minimum_stock_level,
        CAST(i.optimal_par_level AS DECIMAL(10, 3)) AS optimal_par_level,
        CAST(i.cost_per_unit AS DECIMAL(10, 2)) AS cost_per_unit,
        i.is_active,
        i.created_at,
        i.updated_at,
        (
          SELECT GROUP_CONCAT(DISTINCT CONCAT(c.id, ':', c.name) SEPARATOR ';')
          FROM \`recipe_ingredients\` ri
          JOIN \`recipes\` r ON ri.recipe_id = r.id
          JOIN \`menu_items\` m ON r.menu_item_id = m.id
          JOIN \`categories\` c ON m.category_id = c.id
          WHERE ri.ingredient_id = i.id
        ) AS categories_concat
      FROM \`ingredients\` i
      JOIN \`units_of_measure\` u ON i.unit_id = u.id
      WHERE i.id = ?
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [id]);
    if (!rows[0]) return null;

    const r = rows[0];
    let categories = [];
    if (r.categories_concat) {
      categories = r.categories_concat.split(';').map(item => {
        const [catId, catName] = item.split(':');
        return { id: Number(catId), name: catName };
      });
    }

    return {
      id: r.id,
      name: r.name,
      unit_id: r.unit_id,
      unit: {
        id: r.unit_id,
        name: r.unit_name,
        abbreviation: r.unit_abbreviation,
        unit_type: r.unit_type,
        conversion_factor: Number(r.unit_conversion_factor),
        base_unit_id: r.base_unit_id
      },
      minimum_stock_level: Number(r.minimum_stock_level),
      optimal_par_level: Number(r.optimal_par_level),
      cost_per_unit: Number(r.cost_per_unit),
      is_active: Boolean(r.is_active),
      categories,
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  },

  /**
   * Checks if an ingredient name is already taken (case-insensitive)
   * @param {string} name - Ingredient name
   * @param {number|null} excludeId - ID to exclude for updates
   */
  async isNameTaken(name, excludeId = null) {
    const pool = getMySQLPool();
    let query = 'SELECT id FROM `ingredients` WHERE LOWER(name) = LOWER(?)';
    const params = [name.trim()];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    query += ' LIMIT 1;';
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
  },

  /**
   * Inserts a new raw ingredient
   */
  async create({ name, unit_id, minimum_stock_level = 0, optimal_par_level = 0, cost_per_unit = 0, is_active = true }) {
    const pool = getMySQLPool();
    const query = `
      INSERT INTO \`ingredients\` (
        name,
        unit_id,
        minimum_stock_level,
        optimal_par_level,
        cost_per_unit,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?);
    `;
    const [result] = await pool.query(query, [
      name.trim(),
      unit_id,
      minimum_stock_level,
      optimal_par_level,
      cost_per_unit,
      is_active ? 1 : 0
    ]);
    return result.insertId;
  },

  /**
   * Updates an existing ingredient by ID
   * @param {number} id - Ingredient ID
   * @param {Object} fields - Fields to update
   */
  async update(id, fields) {
    const pool = getMySQLPool();
    const setClauses = [];
    const params = [];

    if (fields.name !== undefined) {
      setClauses.push('`name` = ?');
      params.push(fields.name.trim());
    }

    if (fields.unit_id !== undefined) {
      setClauses.push('`unit_id` = ?');
      params.push(fields.unit_id);
    }

    if (fields.minimum_stock_level !== undefined) {
      setClauses.push('`minimum_stock_level` = ?');
      params.push(fields.minimum_stock_level);
    }

    if (fields.optimal_par_level !== undefined) {
      setClauses.push('`optimal_par_level` = ?');
      params.push(fields.optimal_par_level);
    }

    if (fields.cost_per_unit !== undefined) {
      setClauses.push('`cost_per_unit` = ?');
      params.push(fields.cost_per_unit);
    }

    if (fields.is_active !== undefined) {
      setClauses.push('`is_active` = ?');
      params.push(fields.is_active ? 1 : 0);
    }

    if (setClauses.length === 0) {
      return false;
    }

    params.push(id);
    const query = `UPDATE \`ingredients\` SET ${setClauses.join(', ')} WHERE id = ?;`;
    const [result] = await pool.query(query, params);
    return result.affectedRows > 0;
  }
};

export default IngredientModel;
