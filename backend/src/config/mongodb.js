import mongoose from 'mongoose';
import { env } from './env.js';

let isConnecting = false;

/**
 * Initializes connection to MongoDB with Mongoose
 */
export async function connectMongoDB() {
  if (mongoose.connection.readyState === 1 || isConnecting) {
    return;
  }

  isConnecting = true;
  try {
    // Configure mongoose connection options
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log(`[MongoDB] Connected successfully to ${mongoose.connection.name}`);
  } catch (error) {
    console.warn(`[MongoDB] Initial connection warning: ${error.message}`);
  } finally {
    isConnecting = false;
  }
}

// Connection lifecycle event handlers
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Connection state: Connected');
});

mongoose.connection.on('error', (err) => {
  console.warn(`[MongoDB] Connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('[MongoDB] Connection state: Disconnected');
});

/**
 * Checks MongoDB connectivity and readyState
 * @returns {Promise<{connected: boolean, status: string, latencyMs?: number, message?: string}>}
 */
export async function checkMongoDBConnection() {
  const startTime = Date.now();
  const state = mongoose.connection.readyState;
  
  // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  if (state !== 1) {
    // Attempt reconnect if disconnected
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000
      });
    } catch (err) {
      return {
        connected: false,
        status: 'DOWN',
        readyState: mongoose.connection.readyState,
        error: err.message || 'MongoDB is not reachable'
      };
    }
  }

  try {
    // Ping admin database
    await mongoose.connection.db.admin().ping();
    const latencyMs = Date.now() - startTime;
    return {
      connected: true,
      status: 'UP',
      latencyMs,
      database: mongoose.connection.name || 'restaurant_inventory_logs',
      readyState: mongoose.connection.readyState
    };
  } catch (error) {
    return {
      connected: false,
      status: 'DOWN',
      readyState: mongoose.connection.readyState,
      error: error.message || 'Failed to ping MongoDB database'
    };
  }
}

/**
 * Gracefully closes MongoDB connection
 */
export async function closeMongoDB() {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.close();
      console.log('[MongoDB] Connection gracefully closed.');
    } catch (err) {
      console.error('[MongoDB] Error during disconnect:', err.message);
    }
  }
}
