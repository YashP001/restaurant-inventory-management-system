import app from './src/app.js';
import { env } from './src/config/env.js';
import { checkMySQLConnection, closeMySQLPool } from './src/config/mysql.js';
import { connectMongoDB, closeMongoDB } from './src/config/mongodb.js';

const PORT = env.PORT;

const server = app.listen(PORT, async () => {
  console.log(`=================================================`);
  console.log(`  Restaurant Management Backend Service Started   `);
  console.log(`  Port: http://localhost:${PORT}                  `);
  console.log(`  Health Check: http://localhost:${PORT}/api/health`);
  console.log(`=================================================`);

  // Verify initial database connections
  console.log('\n[Database Diagnostics]');
  
  // Test MySQL
  const mysqlStatus = await checkMySQLConnection();
  if (mysqlStatus.connected) {
    console.log(`[MySQL] Connected successfully to "${mysqlStatus.database}" on ${mysqlStatus.host}:${mysqlStatus.port} (${mysqlStatus.latencyMs}ms)`);
  } else {
    console.warn(`[MySQL] Connection warning: ${mysqlStatus.error}`);
  }

  // Test MongoDB
  await connectMongoDB();
});

// Graceful Shutdown Handlers
async function handleShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
  
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    await closeMySQLPool();
    await closeMongoDB();
    console.log('[Server] All connections closed. Exiting process.');
    process.exit(0);
  });

  // Force exit after 10 seconds if hanging
  setTimeout(() => {
    console.error('[Server] Forcefully shutting down after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
