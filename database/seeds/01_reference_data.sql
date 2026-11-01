-- ============================================================================
-- Urban Bites Restaurant & Food Inventory System
-- Seed File 1: Master Reference Data (Roles, Users, Units, Dining Tables)
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- ============================================================================

USE `restaurant_inventory_db`;

-- Disable FK checks temporarily for clean idempotent seeding
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. ROLES (4 Core Roles)
-- ----------------------------------------------------------------------------
INSERT INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'ADMIN', 'Full system access, user management, and system configuration'),
(2, 'INVENTORY_MANAGER', 'Responsible for procurement, supplier orders, and stock reconciliation'),
(3, 'CHEF', 'Kitchen management, recipe creation, production, and food waste auditing'),
(4, 'CASHIER', 'Front-of-house operations, dining orders, POS transactions, and payments')
ON DUPLICATE KEY UPDATE 
    `name` = VALUES(`name`),
    `description` = VALUES(`description`);

-- ----------------------------------------------------------------------------
-- 2. USERS (10 Fictional Staff Members for Urban Bites)
-- Default Password: UrbanBites@2026 (bcrypt hash cost 12)
-- ----------------------------------------------------------------------------
INSERT INTO `users` (`id`, `role_id`, `username`, `email`, `password_hash`, `full_name`, `phone`, `is_active`) VALUES
(1, 1, 'rohit_admin', 'rohit.admin@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Rohit Sharma', '+91 98201 11223', TRUE),
(2, 2, 'priya_inventory', 'priya.patel@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Priya Patel', '+91 98202 22334', TRUE),
(3, 3, 'vikram_headchef', 'vikram.malhotra@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Vikram Malhotra', '+91 98203 33445', TRUE),
(4, 3, 'ananya_souschef', 'ananya.sen@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Ananya Sen', '+91 98204 44556', TRUE),
(5, 4, 'arjun_cashier', 'arjun.verma@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Arjun Verma', '+91 98205 55667', TRUE),
(6, 4, 'sneha_cashier', 'sneha.kulkarni@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Sneha Kulkarni', '+91 98206 66778', TRUE),
(7, 4, 'kabir_cashier', 'kabir.mehta@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Kabir Mehta', '+91 98207 77889', TRUE),
(8, 2, 'deepak_stock', 'deepak.joshi@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Deepak Joshi', '+91 98208 88990', TRUE),
(9, 3, 'rahul_cook', 'rahul.nair@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Rahul Nair', '+91 98209 99001', TRUE),
(10, 1, 'kavita_ops', 'kavita.rao@urbanbites.in', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4L5bep2eum', 'Kavita Rao', '+91 98210 00112', TRUE)
ON DUPLICATE KEY UPDATE 
    `full_name` = VALUES(`full_name`),
    `phone` = VALUES(`phone`);

-- ----------------------------------------------------------------------------
-- 3. UNITS OF MEASURE (Standard Metric Hierarchy & Conversion Ratios)
-- ----------------------------------------------------------------------------
INSERT INTO `units_of_measure` (`id`, `name`, `abbreviation`, `unit_type`, `base_unit_id`, `conversion_factor`) VALUES
(1, 'Kilogram', 'kg', 'WEIGHT', NULL, 1.000000),
(2, 'Gram', 'g', 'WEIGHT', 1, 0.001000),
(3, 'Liter', 'l', 'VOLUME', NULL, 1.000000),
(4, 'Milliliter', 'ml', 'VOLUME', 3, 0.001000),
(5, 'Piece', 'pcs', 'COUNT', NULL, 1.000000),
(6, 'Dozen', 'dz', 'COUNT', 5, 12.000000)
ON DUPLICATE KEY UPDATE 
    `conversion_factor` = VALUES(`conversion_factor`);

-- ----------------------------------------------------------------------------
-- 4. DINING TABLES (12 Restaurant Floor Tables)
-- ----------------------------------------------------------------------------
INSERT INTO `dining_tables` (`id`, `table_number`, `seating_capacity`, `status`) VALUES
(1, 'T-01', 2, 'VACANT'),
(2, 'T-02', 2, 'VACANT'),
(3, 'T-03', 4, 'OCCUPIED'),
(4, 'T-04', 4, 'VACANT'),
(5, 'T-05', 4, 'OCCUPIED'),
(6, 'T-06', 4, 'VACANT'),
(7, 'T-07', 6, 'RESERVED'),
(8, 'T-08', 6, 'VACANT'),
(9, 'T-09', 6, 'VACANT'),
(10, 'T-10', 8, 'VACANT'),
(11, 'T-11', 8, 'VACANT'),
(12, 'T-12', 10, 'VACANT')
ON DUPLICATE KEY UPDATE 
    `seating_capacity` = VALUES(`seating_capacity`),
    `status` = VALUES(`status`);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Seed File 1 (Reference Data) loaded successfully.' AS status;
