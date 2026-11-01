import { getMySQLPool } from '../../config/mysql.js';

/**
 * User Data Access Object (DAO)
 * Executes strictly parameterized SQL queries against MySQL 8
 */
export const UserModel = {
  /**
   * Finds a staff user by username OR email for authentication
   * Returns user record with password_hash and role_name
   * @param {string} identifier - Username or Email address
   */
  async findByUsernameOrEmail(identifier) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        u.id,
        u.role_id,
        r.name AS role_name,
        u.username,
        u.email,
        u.password_hash,
        u.full_name,
        u.phone,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM \`users\` u
      JOIN \`roles\` r ON r.id = u.role_id
      WHERE u.username = ? OR u.email = ?
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [identifier, identifier]);
    return rows[0] || null;
  },

  /**
   * Finds a staff user by primary key ID (omits password_hash)
   * @param {number} id - User ID
   */
  async findById(id) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        u.id,
        u.role_id,
        r.name AS role_name,
        r.description AS role_description,
        u.username,
        u.email,
        u.full_name,
        u.phone,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM \`users\` u
      JOIN \`roles\` r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Retrieves all users with filtering and pagination (omits password_hash)
   */
  async findAll({ page = 1, limit = 20, role = null, isActive = null, search = null }) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (role) {
      conditions.push('r.name = ?');
      params.push(role.toUpperCase());
    }

    if (isActive !== null && isActive !== undefined) {
      conditions.push('u.is_active = ?');
      params.push(isActive === true || isActive === 'true' ? 1 : 0);
    }

    if (search) {
      conditions.push('(u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Math.max(1, page) - 1) * limit;

    const query = `
      SELECT 
        u.id,
        u.role_id,
        r.name AS role_name,
        u.username,
        u.email,
        u.full_name,
        u.phone,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM \`users\` u
      JOIN \`roles\` r ON r.id = u.role_id
      ${whereClause}
      ORDER BY u.id ASC
      LIMIT ? OFFSET ?;
    `;

    params.push(limit, offset);
    const [rows] = await pool.query(query, params);
    return rows;
  },

  /**
   * Counts total matching users for pagination
   */
  async countAll({ role = null, isActive = null, search = null }) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (role) {
      conditions.push('r.name = ?');
      params.push(role.toUpperCase());
    }

    if (isActive !== null && isActive !== undefined) {
      conditions.push('u.is_active = ?');
      params.push(isActive === true || isActive === 'true' ? 1 : 0);
    }

    if (search) {
      conditions.push('(u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT COUNT(*) AS total
      FROM \`users\` u
      JOIN \`roles\` r ON r.id = u.role_id
      ${whereClause};
    `;

    const [rows] = await pool.query(query, params);
    return rows[0]?.total || 0;
  },

  /**
   * Inserts a new staff member into MySQL
   */
  async create({ role_id, username, email, password_hash, full_name, phone = null, is_active = true }) {
    const pool = getMySQLPool();
    const query = `
      INSERT INTO \`users\` (
        role_id,
        username,
        email,
        password_hash,
        full_name,
        phone,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await pool.query(query, [
      role_id,
      username,
      email,
      password_hash,
      full_name,
      phone,
      is_active ? 1 : 0
    ]);
    return result.insertId;
  },

  /**
   * Updates specific columns for a user using parameterized query
   */
  async update(id, fields) {
    const pool = getMySQLPool();
    const setClauses = [];
    const params = [];

    const allowedFields = ['role_id', 'username', 'email', 'password_hash', 'full_name', 'phone', 'is_active'];

    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`\`${key}\` = ?`);
        params.push(key === 'is_active' ? (value ? 1 : 0) : value);
      }
    }

    if (setClauses.length === 0) {
      return false;
    }

    params.push(id);
    const query = `UPDATE \`users\` SET ${setClauses.join(', ')} WHERE \`id\` = ?;`;
    const [result] = await pool.query(query, params);
    return result.affectedRows > 0;
  },

  /**
   * Updates user activation status
   */
  async updateStatus(id, isActive) {
    const pool = getMySQLPool();
    const query = `UPDATE \`users\` SET \`is_active\` = ? WHERE \`id\` = ?;`;
    const [result] = await pool.query(query, [isActive ? 1 : 0, id]);
    return result.affectedRows > 0;
  },

  /**
   * Counts currently active ADMIN accounts (for last-admin protection)
   */
  async countActiveAdmins() {
    const pool = getMySQLPool();
    const query = `
      SELECT COUNT(*) AS active_admins
      FROM \`users\` u
      JOIN \`roles\` r ON r.id = u.role_id
      WHERE r.name = 'ADMIN' AND u.is_active = 1;
    `;
    const [rows] = await pool.query(query);
    return rows[0]?.active_admins || 0;
  },

  /**
   * Validates if a role exists by role_id
   */
  async findRoleById(roleId) {
    const pool = getMySQLPool();
    const query = `SELECT id, name, description FROM \`roles\` WHERE id = ? LIMIT 1;`;
    const [rows] = await pool.query(query, [roleId]);
    return rows[0] || null;
  },

  /**
   * Checks if username is already taken by another user
   */
  async isUsernameTaken(username, excludeId = null) {
    const pool = getMySQLPool();
    const query = excludeId 
      ? `SELECT id FROM \`users\` WHERE username = ? AND id != ? LIMIT 1;`
      : `SELECT id FROM \`users\` WHERE username = ? LIMIT 1;`;
    const params = excludeId ? [username, excludeId] : [username];
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
  },

  /**
   * Checks if email is already taken by another user
   */
  async isEmailTaken(email, excludeId = null) {
    const pool = getMySQLPool();
    const query = excludeId 
      ? `SELECT id FROM \`users\` WHERE email = ? AND id != ? LIMIT 1;`
      : `SELECT id FROM \`users\` WHERE email = ? LIMIT 1;`;
    const params = excludeId ? [email, excludeId] : [email];
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
  }
};

export default UserModel;
