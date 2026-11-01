-- ============================================================================
-- Master MySQL Initialization Script
-- Restaurant & Food Inventory Management System
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `restaurant_inventory_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `restaurant_inventory_db`;

-- Source Schema v1 (Includes all 21 tables, constraints, foreign keys and indexes)
SOURCE 01_schema_v1.sql;

SELECT 'Database restaurant_inventory_db and Schema v1 initialized successfully.' AS status;
