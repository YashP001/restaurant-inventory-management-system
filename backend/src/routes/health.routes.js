import { Router } from 'express';
import { checkMySQLConnection } from '../config/mysql.js';
import { checkMongoDBConnection } from '../config/mongodb.js';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    Aggregate system health check (Backend, MySQL, MongoDB)
 */
router.get('/', async (req, res) => {
  const [mysqlStatus, mongoStatus] = await Promise.all([
    checkMySQLConnection(),
    checkMongoDBConnection()
  ]);

  const allHealthy = mysqlStatus.connected && mongoStatus.connected;

  res.status(allHealthy ? 200 : 207).json({
    status: allHealthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    services: {
      backend: {
        status: 'UP',
        nodeVersion: process.version
      },
      mysql: mysqlStatus,
      mongodb: mongoStatus
    }
  });
});

/**
 * @route   GET /api/health/mysql
 * @desc    Dedicated MySQL connectivity check
 */
router.get('/mysql', async (req, res) => {
  const result = await checkMySQLConnection();
  res.status(result.connected ? 200 : 503).json({
    service: 'mysql',
    timestamp: new Date().toISOString(),
    ...result
  });
});

/**
 * @route   GET /api/health/mongodb
 * @desc    Dedicated MongoDB connectivity check
 */
router.get('/mongodb', async (req, res) => {
  const result = await checkMongoDBConnection();
  res.status(result.connected ? 200 : 503).json({
    service: 'mongodb',
    timestamp: new Date().toISOString(),
    ...result
  });
});

export default router;
