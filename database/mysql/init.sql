-- ==========================================================
-- Phase 0: MySQL Database Initialization Script
-- Restaurant & Food Inventory Management System
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `restaurant_inventory_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `restaurant_inventory_db`;

-- Informational verification query
SELECT 'Database restaurant_inventory_db initialized successfully.' AS status;
