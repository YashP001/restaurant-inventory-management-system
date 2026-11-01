import { getMySQLPool } from '../../config/mysql.js';

/**
 * Unit of Measure Data Access Object (DAO)
 * Provides read-only access to standard metric measurement units and conversion ratios
 */
export const UnitModel = {
  /**
   * Retrieves all units of measure with resolved base unit references
   * @param {Object} options
   * @param {string} [options.unitType] - Filter by unit_type ('WEIGHT', 'VOLUME', 'COUNT')
   * @param {string} [options.search] - Search string for unit name or abbreviation
   */
  async findAll({ unitType = null, search = '' } = {}) {
    const pool = getMySQLPool();
    const conditions = [];
    const params = [];

    if (unitType) {
      conditions.push('u.unit_type = ?');
      params.push(unitType.toUpperCase());
    }

    if (search && search.trim() !== '') {
      conditions.push('(u.name LIKE ? OR u.abbreviation LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        u.id,
        u.name,
        u.abbreviation,
        u.unit_type,
        u.base_unit_id,
        CAST(u.conversion_factor AS DECIMAL(12, 6)) AS conversion_factor,
        u.created_at,
        b.name AS base_unit_name,
        b.abbreviation AS base_unit_abbreviation
      FROM \`units_of_measure\` u
      LEFT JOIN \`units_of_measure\` b ON u.base_unit_id = b.id
      ${whereClause}
      ORDER BY u.unit_type ASC, u.conversion_factor ASC;
    `;

    const [rows] = await pool.query(query, params);

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      abbreviation: r.abbreviation,
      unit_type: r.unit_type,
      base_unit_id: r.base_unit_id,
      base_unit: r.base_unit_id ? {
        id: r.base_unit_id,
        name: r.base_unit_name,
        abbreviation: r.base_unit_abbreviation
      } : null,
      conversion_factor: Number(r.conversion_factor),
      created_at: r.created_at
    }));
  },

  /**
   * Retrieves a single unit of measure by primary key ID with base unit details
   * @param {number} id - Unit ID
   */
  async findById(id) {
    const pool = getMySQLPool();
    const query = `
      SELECT 
        u.id,
        u.name,
        u.abbreviation,
        u.unit_type,
        u.base_unit_id,
        CAST(u.conversion_factor AS DECIMAL(12, 6)) AS conversion_factor,
        u.created_at,
        b.name AS base_unit_name,
        b.abbreviation AS base_unit_abbreviation
      FROM \`units_of_measure\` u
      LEFT JOIN \`units_of_measure\` b ON u.base_unit_id = b.id
      WHERE u.id = ?
      LIMIT 1;
    `;
    const [rows] = await pool.query(query, [id]);
    if (!rows[0]) return null;

    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      abbreviation: r.abbreviation,
      unit_type: r.unit_type,
      base_unit_id: r.base_unit_id,
      base_unit: r.base_unit_id ? {
        id: r.base_unit_id,
        name: r.base_unit_name,
        abbreviation: r.base_unit_abbreviation
      } : null,
      conversion_factor: Number(r.conversion_factor),
      created_at: r.created_at
    };
  }
};

export default UnitModel;
