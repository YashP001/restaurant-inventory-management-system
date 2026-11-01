import { getMySQLPool } from '../../config/mysql.js';

/**
 * Category Data Access Object (DAO)
 * Executes strictly parameterized SQL queries against MySQL 8
 */
export const CategoryModel = {
  /**
   * Retrieves categories with optional search, active filtering, and pagination
   * Also computes the count of associated menu_items
   */
  async findAll({ search = '', isActive = null, page = 1, limit = 50 } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (isActive !== null && isActive !== undefined) {
      conditions.push('c.is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (search && search.trim() !== '') {
      conditions.push('(c.name LIKE ? OR c.description LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM \`categories\` c ${whereClause};`;
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].total;

    // Data query with menu_items count
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.is_active,
        c.created_at,
        COUNT(m.id) AS menu_items_count
      FROM \`categories\` c
      LEFT JOIN \`menu_items\` m ON m.category_id = c.id
      ${whereClause}
      GROUP BY c.id, c.name, c.description, c.is_active, c.created_at
      ORDER BY c.name ASC
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await pool.query(dataQuery, [...params, limit, offset]);

    return {
      categories: rows.map(r => ({
        ...r,
        is_active: Boolean(r.is_active),
        menu_items_count: Number(r.menu_items_count)
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves a single category by primary key ID
   * @param {number} id - Category ID
   */
  async findById(id) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.is_active,
        c.created_at,
        COUNT(m.id) AS menu_items_count
      FROM \`categories\` c
      LEFT JOIN \`menu_items\` m ON m.category_id = c.id
      WHERE c.id = ?
      GROUP BY c.id, c.name, c.description, c.is_active, c.created_at
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [id]);
    if (!rows[0]) return null;

    return {
      ...rows[0],
      is_active: Boolean(rows[0].is_active),
      menu_items_count: Number(rows[0].menu_items_count)
    };
  },

  /**
   * Finds a category by exact name (case-insensitive)
   * @param {string} name - Category name
   */
  async findByName(name) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        id,
        name,
        description,
        is_active,
        created_at
      FROM \`categories\`
      WHERE LOWER(name) = LOWER(?)
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [name.trim()]);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      is_active: Boolean(rows[0].is_active)
    };
  },

  /**
   * Checks if a category name is already taken by another category
   * @param {string} name - Category name
   * @param {number|null} excludeId - ID to exclude during update
   */
  async isNameTaken(name, excludeId = null) {
    const pool = getMySQLPool();
    let query = 'SELECT id FROM `categories` WHERE LOWER(name) = LOWER(?)';
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
   * Creates a new category
   * @param {Object} categoryData
   */
  async create({ name, description = null, is_active = true }) {
    const pool = getMySQLPool();
    const query = `
      INSERT INTO \`categories\` (name, description, is_active)
      VALUES (?, ?, ?);
    `;
    const [result] = await pool.query(query, [
      name.trim(),
      description ? description.trim() : null,
      is_active ? 1 : 0
    ]);
    return result.insertId;
  },

  /**
   * Updates an existing category by ID
   * @param {number} id - Category ID
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

    if (fields.description !== undefined) {
      setClauses.push('`description` = ?');
      params.push(fields.description !== null ? fields.description.trim() : null);
    }

    if (fields.is_active !== undefined) {
      setClauses.push('`is_active` = ?');
      params.push(fields.is_active ? 1 : 0);
    }

    if (setClauses.length === 0) {
      return false;
    }

    params.push(id);
    const query = `UPDATE \`categories\` SET ${setClauses.join(', ')} WHERE id = ?;`;
    const [result] = await pool.query(query, params);
    return result.affectedRows > 0;
  }
};

export default CategoryModel;
