import mysql from 'mysql2/promise';
import { env } from './env.js';

let pool = null;

/**
 * Initializes the MySQL connection pool
 */
export function getMySQLPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.MYSQL.host,
      port: env.MYSQL.port,
      user: env.MYSQL.user,
      password: env.MYSQL.password,
      database: env.MYSQL.database,
      waitForConnections: env.MYSQL.waitForConnections,
      connectionLimit: env.MYSQL.connectionLimit,
      queueLimit: env.MYSQL.queueLimit,
      enableKeepAlive: env.MYSQL.enableKeepAlive,
      keepAliveInitialDelay: env.MYSQL.keepAliveInitialDelay
    });
  }
  return pool;
}

/**
 * Verifies MySQL connectivity
 * @returns {Promise<{connected: boolean, message: string, latencyMs?: number}>}
 */
export async function checkMySQLConnection() {
  const startTime = Date.now();
  try {
    const currentPool = getMySQLPool();
    const connection = await currentPool.getConnection();
    try {
      await connection.query('SELECT 1 AS health_check');
      const latencyMs = Date.now() - startTime;
      return {
        connected: true,
        status: 'UP',
        latencyMs,
        database: env.MYSQL.database,
        host: env.MYSQL.host,
        port: env.MYSQL.port
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    return {
      connected: false,
      status: 'DOWN',
      error: error.message || 'Unable to connect to MySQL',
      host: env.MYSQL.host,
      port: env.MYSQL.port,
      database: env.MYSQL.database
    };
  }
}

/**
 * Closes the MySQL connection pool gracefully
 */
export async function closeMySQLPool() {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('MySQL connection pool closed.');
    } catch (err) {
      console.error('Error closing MySQL pool:', err.message);
    }
  }
}
