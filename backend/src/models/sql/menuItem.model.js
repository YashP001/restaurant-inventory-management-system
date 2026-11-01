import { getMySQLPool } from '../../config/mysql.js';

/**
 * Menu Item Data Access Object (DAO)
 * Executes strictly parameterized SQL queries against MySQL 8
 */
export const MenuItemModel = {
  /**
   * Retrieves menu items with filtering, search, pagination, and category/recipe JOINs
   */
  async findAll({ search = '', categoryId = null, isAvailable = null, page = 1, limit = 20 } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (isAvailable !== null && isAvailable !== undefined) {
      conditions.push('m.is_available = ?');
      params.push(isAvailable ? 1 : 0);
    }

    if (categoryId) {
      conditions.push('m.category_id = ?');
      params.push(categoryId);
    }

    if (search && search.trim() !== '') {
      conditions.push('(m.name LIKE ? OR m.description LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM \`menu_items\` m ${whereClause};`;
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].total;

    // Data query
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT 
        m.id,
        m.category_id,
        c.name AS category_name,
        c.description AS category_description,
        m.name,
        m.description,
        CAST(m.selling_price AS DECIMAL(10, 2)) AS selling_price,
        m.preparation_time_mins,
        m.is_available,
        m.created_at,
        m.updated_at,
        r.id AS recipe_id,
        r.yield_servings AS recipe_yield_servings
      FROM \`menu_items\` m
      JOIN \`categories\` c ON m.category_id = c.id
      LEFT JOIN \`recipes\` r ON r.menu_item_id = m.id
      ${whereClause}
      ORDER BY m.id ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataQuery, [...params, limit, offset]);

    const menuItems = rows.map(r => ({
      id: r.id,
      category_id: r.category_id,
      category: {
        id: r.category_id,
        name: r.category_name,
        description: r.category_description
      },
      name: r.name,
      description: r.description,
      selling_price: Number(r.selling_price),
      preparation_time_mins: r.preparation_time_mins,
      is_available: Boolean(r.is_available),
      has_recipe: Boolean(r.recipe_id),
      recipe: r.recipe_id ? {
        id: r.recipe_id,
        yield_servings: r.recipe_yield_servings
      } : null,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));

    return {
      menuItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves a single menu item by ID with full category and recipe details
   */
  async findById(id) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        m.id,
        m.category_id,
        c.name AS category_name,
        c.description AS category_description,
        m.name,
        m.description,
        CAST(m.selling_price AS DECIMAL(10, 2)) AS selling_price,
        m.preparation_time_mins,
        m.is_available,
        m.created_at,
        m.updated_at,
        r.id AS recipe_id,
        r.yield_servings AS recipe_yield_servings,
        r.instructions AS recipe_instructions,
        r.created_at AS recipe_created_at
      FROM \`menu_items\` m
      JOIN \`categories\` c ON m.category_id = c.id
      LEFT JOIN \`recipes\` r ON r.menu_item_id = m.id
      WHERE m.id = ?
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [id]);
    if (!rows[0]) return null;

    const r = rows[0];
    return {
      id: r.id,
      category_id: r.category_id,
      category: {
        id: r.category_id,
        name: r.category_name,
        description: r.category_description
      },
      name: r.name,
      description: r.description,
      selling_price: Number(r.selling_price),
      preparation_time_mins: r.preparation_time_mins,
      is_available: Boolean(r.is_available),
      has_recipe: Boolean(r.recipe_id),
      recipe: r.recipe_id ? {
        id: r.recipe_id,
        yield_servings: r.recipe_yield_servings,
        instructions: r.recipe_instructions,
        created_at: r.recipe_created_at
      } : null,
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  },

  /**
   * Checks if a menu item name is already taken (case-insensitive)
   */
  async isNameTaken(name, excludeId = null) {
    const pool = getMySQLPool();
    let query = 'SELECT id FROM `menu_items` WHERE LOWER(name) = LOWER(?)';
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
   * Inserts a new menu item
   */
  async create({ category_id, name, description = null, selling_price, preparation_time_mins = 15, is_available = true }) {
    const pool = getMySQLPool();
    const query = `
      INSERT INTO \`menu_items\` (
        category_id,
        name,
        description,
        selling_price,
        preparation_time_mins,
        is_available
      ) VALUES (?, ?, ?, ?, ?, ?);
    `;
    const [result] = await pool.query(query, [
      category_id,
      name.trim(),
      description ? description.trim() : null,
      selling_price,
      preparation_time_mins,
      is_available ? 1 : 0
    ]);
    return result.insertId;
  },

  /**
   * Updates an existing menu item by ID
   */
  async update(id, fields) {
    const pool = getMySQLPool();
    const setClauses = [];
    const params = [];

    if (fields.category_id !== undefined) {
      setClauses.push('`category_id` = ?');
      params.push(fields.category_id);
    }

    if (fields.name !== undefined) {
      setClauses.push('`name` = ?');
      params.push(fields.name.trim());
    }

    if (fields.description !== undefined) {
      setClauses.push('`description` = ?');
      params.push(fields.description !== null ? fields.description.trim() : null);
    }

    if (fields.selling_price !== undefined) {
      setClauses.push('`selling_price` = ?');
      params.push(fields.selling_price);
    }

    if (fields.preparation_time_mins !== undefined) {
      setClauses.push('`preparation_time_mins` = ?');
      params.push(fields.preparation_time_mins);
    }

    if (fields.is_available !== undefined) {
      setClauses.push('`is_available` = ?');
      params.push(fields.is_available ? 1 : 0);
    }

    if (setClauses.length === 0) {
      return false;
    }

    params.push(id);
    const query = `UPDATE \`menu_items\` SET ${setClauses.join(', ')} WHERE id = ?;`;
    const [result] = await pool.query(query, params);
    return result.affectedRows > 0;
  }
};

export default MenuItemModel;
