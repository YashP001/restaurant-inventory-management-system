/**
 * Phase 0: MongoDB Database Initialization Script
 * Database: restaurant_inventory_logs
 * 
 * MongoDB creates databases and collections lazily on first document write.
 * This script ensures the database exists and verifies connectivity.
 */

// Connect / switch to restaurant_inventory_logs
const dbTarget = db.getSiblingDB('restaurant_inventory_logs');

// Create initial operational collections with validation placeholders
dbTarget.createCollection('audit_logs', { capped: false });
dbTarget.createCollection('activity_history', { capped: false });
dbTarget.createCollection('notifications', { capped: false });
dbTarget.createCollection('prediction_runs', { capped: false });

print('MongoDB database restaurant_inventory_logs initialized successfully with operational collections.');
