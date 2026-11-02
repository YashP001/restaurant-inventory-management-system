-- ============================================================================
-- Restaurant & Food Inventory Management System with Demand Prediction
-- Relational Database Schema v1.0
-- Database: MySQL 8 (InnoDB Engine, utf8mb4)
-- Normalization: 3NF Compliant
-- ============================================================================

USE `restaurant_inventory_db`;

-- Drop tables in reverse topological order if rebuilding (safe idempotent script)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `demand_forecasts`;
DROP TABLE IF EXISTS `waste_records`;
DROP TABLE IF EXISTS `purchase_order_items`;
DROP TABLE IF EXISTS `purchase_orders`;
DROP TABLE IF EXISTS `supplier_ingredients`;
DROP TABLE IF EXISTS `suppliers`;
DROP TABLE IF EXISTS `order_ingredient_consumptions`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `dining_tables`;
DROP TABLE IF EXISTS `stock_movements`;
DROP TABLE IF EXISTS `inventory_batches`;
DROP TABLE IF EXISTS `recipe_ingredients`;
DROP TABLE IF EXISTS `recipes`;
DROP TABLE IF EXISTS `menu_items`;
DROP TABLE IF EXISTS `ingredients`;
DROP TABLE IF EXISTS `units_of_measure`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `roles`;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. AUTHENTICATION & ACCESS CONTROL
-- ============================================================================

-- Table 1: roles
CREATE TABLE `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: users
CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `role_id` INT NOT NULL,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) 
        REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. MENU, RECIPES & BILL OF MATERIALS (BOM)
-- ============================================================================

-- Table 3: categories
CREATE TABLE `categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL UNIQUE,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 4: units_of_measure
CREATE TABLE `units_of_measure` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `abbreviation` VARCHAR(10) NOT NULL UNIQUE,
    `unit_type` ENUM('WEIGHT', 'VOLUME', 'COUNT') NOT NULL,
    `base_unit_id` INT NULL,
    `conversion_factor` DECIMAL(12, 6) NOT NULL DEFAULT 1.000000,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_uom_base_unit` FOREIGN KEY (`base_unit_id`) 
        REFERENCES `units_of_measure` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_uom_conversion` CHECK (`conversion_factor` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 5: ingredients
CREATE TABLE `ingredients` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL UNIQUE,
    `unit_id` INT NOT NULL,
    `minimum_stock_level` DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    `optimal_par_level` DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    `cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_ingredients_uom` FOREIGN KEY (`unit_id`) 
        REFERENCES `units_of_measure` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_ing_min_stock` CHECK (`minimum_stock_level` >= 0),
    CONSTRAINT `chk_ing_par_level` CHECK (`optimal_par_level` >= `minimum_stock_level`),
    CONSTRAINT `chk_ing_cost` CHECK (`cost_per_unit` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 6: menu_items
CREATE TABLE `menu_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `category_id` INT NOT NULL,
    `name` VARCHAR(150) NOT NULL UNIQUE,
    `description` TEXT NULL,
    `selling_price` DECIMAL(10, 2) NOT NULL,
    `preparation_time_mins` INT NOT NULL DEFAULT 15,
    `is_available` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_menu_category` FOREIGN KEY (`category_id`) 
        REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_menu_selling_price` CHECK (`selling_price` >= 0),
    CONSTRAINT `chk_menu_prep_time` CHECK (`preparation_time_mins` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 7: recipes
CREATE TABLE `recipes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `menu_item_id` INT NOT NULL UNIQUE,
    `yield_servings` INT NOT NULL DEFAULT 1,
    `instructions` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_recipes_menu_item` FOREIGN KEY (`menu_item_id`) 
        REFERENCES `menu_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `chk_recipe_yield` CHECK (`yield_servings` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 8: recipe_ingredients (Bill of Materials junction table)
CREATE TABLE `recipe_ingredients` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `recipe_id` INT NOT NULL,
    `ingredient_id` INT NOT NULL,
    `quantity_required` DECIMAL(10, 3) NOT NULL,
    `unit_id` INT NOT NULL,
    `wastage_allowance_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_recipe_ingredient` (`recipe_id`, `ingredient_id`),
    CONSTRAINT `fk_recipe_ing_recipe` FOREIGN KEY (`recipe_id`) 
        REFERENCES `recipes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_recipe_ing_ingredient` FOREIGN KEY (`ingredient_id`) 
        REFERENCES `ingredients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_recipe_ing_uom` FOREIGN KEY (`unit_id`) 
        REFERENCES `units_of_measure` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_recipe_ing_qty` CHECK (`quantity_required` > 0),
    CONSTRAINT `chk_recipe_ing_waste` CHECK (`wastage_allowance_percent` >= 0 AND `wastage_allowance_percent` < 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. INVENTORY BATCHES & STOCK MOVEMENTS (FEFO SUPPORT)
-- ============================================================================

-- Table 9: inventory_batches
CREATE TABLE `inventory_batches` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `ingredient_id` INT NOT NULL,
    `batch_number` VARCHAR(50) NOT NULL,
    `quantity_received` DECIMAL(10, 3) NOT NULL,
    `quantity_remaining` DECIMAL(10, 3) NOT NULL,
    `unit_cost` DECIMAL(10, 2) NOT NULL,
    `received_date` DATE NOT NULL,
    `expiry_date` DATE NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'DEPLETED', 'DISCARDED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_ingredient_batch` (`ingredient_id`, `batch_number`),
    INDEX `idx_batch_fefo` (`ingredient_id`, `status`, `expiry_date`, `quantity_remaining`),
    INDEX `idx_batch_expiry` (`expiry_date`),
    CONSTRAINT `fk_batch_ingredient` FOREIGN KEY (`ingredient_id`) 
        REFERENCES `ingredients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_batch_received_qty` CHECK (`quantity_received` >= 0),
    CONSTRAINT `chk_batch_remaining_qty` CHECK (`quantity_remaining` >= 0),
    CONSTRAINT `chk_batch_remaining_le_recv` CHECK (`quantity_remaining` <= `quantity_received`),
    CONSTRAINT `chk_batch_cost` CHECK (`unit_cost` >= 0),
    CONSTRAINT `chk_batch_dates` CHECK (`expiry_date` >= `received_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 10: stock_movements (Immutable Inventory Ledger)
CREATE TABLE `stock_movements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `batch_id` INT NOT NULL,
    `movement_type` ENUM('PURCHASE_RECEIPT', 'ORDER_CONSUMPTION', 'WASTE_DISPOSAL', 'AUDIT_ADJUSTMENT', 'RETURN_TO_SUPPLIER') NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `balance_after` DECIMAL(10, 3) NOT NULL,
    `reference_id` VARCHAR(100) NULL,
    `notes` VARCHAR(255) NULL,
    `created_by_user_id` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_movement_batch` (`batch_id`),
    INDEX `idx_movement_type` (`movement_type`),
    INDEX `idx_movement_created` (`created_at`),
    CONSTRAINT `fk_movement_batch` FOREIGN KEY (`batch_id`) 
        REFERENCES `inventory_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_movement_user` FOREIGN KEY (`created_by_user_id`) 
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_movement_qty` CHECK (`quantity` > 0),
    CONSTRAINT `chk_movement_balance` CHECK (`balance_after` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. DINING, ORDERS & POINT OF SALE (POS)
-- ============================================================================

-- Table 11: dining_tables
CREATE TABLE `dining_tables` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `table_number` VARCHAR(20) NOT NULL UNIQUE,
    `seating_capacity` INT NOT NULL DEFAULT 4,
    `status` ENUM('VACANT', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE') NOT NULL DEFAULT 'VACANT',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `chk_table_capacity` CHECK (`seating_capacity` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 12: orders
CREATE TABLE `orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_number` VARCHAR(50) NOT NULL UNIQUE,
    `order_type` ENUM('DINE_IN', 'TAKEAWAY', 'ONLINE') NOT NULL,
    `table_id` INT NULL,
    `user_id` INT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `order_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `completed_at` TIMESTAMP NULL,
    INDEX `idx_order_date` (`order_date`),
    INDEX `idx_order_status` (`status`),
    INDEX `idx_order_type` (`order_type`),
    CONSTRAINT `fk_orders_table` FOREIGN KEY (`table_id`) 
        REFERENCES `dining_tables` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) 
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_order_subtotal` CHECK (`subtotal` >= 0),
    CONSTRAINT `chk_order_tax` CHECK (`tax_amount` >= 0),
    CONSTRAINT `chk_order_discount` CHECK (`discount_amount` >= 0),
    CONSTRAINT `chk_order_total` CHECK (`total_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 13: order_items
CREATE TABLE `order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `menu_item_id` INT NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `special_instructions` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_order_items_order` (`order_id`),
    INDEX `idx_order_items_menu_item` (`menu_item_id`),
    CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) 
        REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_order_items_menu` FOREIGN KEY (`menu_item_id`) 
        REFERENCES `menu_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_order_items_qty` CHECK (`quantity` >= 1),
    CONSTRAINT `chk_order_items_price` CHECK (`unit_price` >= 0),
    CONSTRAINT `chk_order_items_subtotal` CHECK (`subtotal` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 14: payments
CREATE TABLE `payments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `payment_method` ENUM('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'ONLINE') NOT NULL,
    `amount_paid` DECIMAL(10, 2) NOT NULL,
    `transaction_reference` VARCHAR(100) NULL,
    `payment_status` ENUM('PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'SUCCESSFUL',
    `paid_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_payments_order` (`order_id`),
    INDEX `idx_payments_status` (`payment_status`),
    CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) 
        REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_payment_amount` CHECK (`amount_paid` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 15: order_ingredient_consumptions (Exact batch deduction tracking)
CREATE TABLE `order_ingredient_consumptions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_item_id` INT NOT NULL,
    `batch_id` INT NOT NULL,
    `ingredient_id` INT NOT NULL,
    `quantity_consumed` DECIMAL(10, 3) NOT NULL,
    `unit_cost_at_consumption` DECIMAL(10, 2) NOT NULL,
    `total_cost` DECIMAL(10, 2) NOT NULL,
    `consumed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_consumption_order_item` (`order_item_id`),
    INDEX `idx_consumption_batch` (`batch_id`),
    INDEX `idx_consumption_ingredient` (`ingredient_id`),
    CONSTRAINT `fk_consump_order_item` FOREIGN KEY (`order_item_id`) 
        REFERENCES `order_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_consump_batch` FOREIGN KEY (`batch_id`) 
        REFERENCES `inventory_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_consump_ingredient` FOREIGN KEY (`ingredient_id`) 
        REFERENCES `ingredients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_consump_qty` CHECK (`quantity_consumed` > 0),
    CONSTRAINT `chk_consump_unit_cost` CHECK (`unit_cost_at_consumption` >= 0),
    CONSTRAINT `chk_consump_total_cost` CHECK (`total_cost` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. SUPPLIERS & PROCUREMENT
-- ============================================================================

-- Table 16: suppliers
CREATE TABLE `suppliers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL UNIQUE,
    `contact_person` VARCHAR(100) NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `phone` VARCHAR(20) NOT NULL,
    `address` TEXT NULL,
    `lead_time_days` INT NOT NULL DEFAULT 1,
    `payment_terms` VARCHAR(100) DEFAULT 'Net 30',
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `chk_supplier_lead_time` CHECK (`lead_time_days` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 17: supplier_ingredients (Multi-supplier ingredient price catalog)
CREATE TABLE `supplier_ingredients` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `supplier_id` INT NOT NULL,
    `ingredient_id` INT NOT NULL,
    `contract_unit_cost` DECIMAL(10, 2) NOT NULL,
    `minimum_order_quantity` DECIMAL(10, 3) NOT NULL DEFAULT 1.000,
    `is_preferred_supplier` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_supplier_ingredient` (`supplier_id`, `ingredient_id`),
    INDEX `idx_sup_ing_ingredient` (`ingredient_id`),
    CONSTRAINT `fk_sup_ing_supplier` FOREIGN KEY (`supplier_id`) 
        REFERENCES `suppliers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_sup_ing_ingredient` FOREIGN KEY (`ingredient_id`) 
        REFERENCES `ingredients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_sup_ing_cost` CHECK (`contract_unit_cost` >= 0),
    CONSTRAINT `chk_sup_ing_moq` CHECK (`minimum_order_quantity` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 18: purchase_orders
CREATE TABLE `purchase_orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `po_number` VARCHAR(50) NOT NULL UNIQUE,
    `supplier_id` INT NOT NULL,
    `created_by_user_id` INT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `order_date` DATE NOT NULL,
    `expected_delivery_date` DATE NOT NULL,
    `actual_delivery_date` DATE NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_po_supplier` (`supplier_id`),
    INDEX `idx_po_status` (`status`),
    INDEX `idx_po_order_date` (`order_date`),
    CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) 
        REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_po_user` FOREIGN KEY (`created_by_user_id`) 
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_po_total` CHECK (`total_amount` >= 0),
    CONSTRAINT `chk_po_dates` CHECK (`expected_delivery_date` >= `order_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 19: purchase_order_items
CREATE TABLE `purchase_order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `purchase_order_id` INT NOT NULL,
    `ingredient_id` INT NOT NULL,
    `quantity_ordered` DECIMAL(10, 3) NOT NULL,
    `quantity_received` DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    `unit_cost` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_po_items_po` (`purchase_order_id`),
    INDEX `idx_po_items_ingredient` (`ingredient_id`),
    CONSTRAINT `fk_po_items_po` FOREIGN KEY (`purchase_order_id`) 
        REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_po_items_ingredient` FOREIGN KEY (`ingredient_id`) 
        REFERENCES `ingredients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_po_item_qty_ord` CHECK (`quantity_ordered` > 0),
    CONSTRAINT `chk_po_item_qty_recv` CHECK (`quantity_received` >= 0),
    CONSTRAINT `chk_po_item_recv_le_ord` CHECK (`quantity_received` <= `quantity_ordered`),
    CONSTRAINT `chk_po_item_cost` CHECK (`unit_cost` >= 0),
    CONSTRAINT `chk_po_item_subtotal` CHECK (`subtotal` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. FOOD WASTE MONITORING
-- ============================================================================

-- Table 20: waste_records
CREATE TABLE `waste_records` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `batch_id` INT NULL,
    `ingredient_id` INT NULL,
    `menu_item_id` INT NULL,
    `quantity_wasted` DECIMAL(10, 3) NOT NULL,
    `unit_id` INT NOT NULL,
    `waste_reason` ENUM('EXPIRED', 'SPOILED', 'PREPARATION_SCRAP', 'OVERCOOKED', 'CUSTOMER_RETURN', 'STORAGE_CONTAMINATION') NOT NULL,
    `financial_loss` DECIMAL(10, 2) NOT NULL,
    `logged_by_user_id` INT NULL,
    `notes` TEXT NULL,
    `logged_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_waste_reason` (`waste_reason`),
    INDEX `idx_waste_batch` (`batch_id`),
    INDEX `idx_waste_ingredient` (`ingredient_id`),
    INDEX `idx_waste_menu_item` (`menu_item_id`),
    CONSTRAINT `fk_waste_batch` FOREIGN KEY (`batch_id`) 
        REFERENCES `inventory_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_waste_ingredient` FOREIGN KEY (`ingredient_id`) 
        REFERENCES `ingredients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_waste_menu_item` FOREIGN KEY (`menu_item_id`) 
        REFERENCES `menu_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_waste_unit` FOREIGN KEY (`unit_id`) 
        REFERENCES `units_of_measure` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_waste_user` FOREIGN KEY (`logged_by_user_id`) 
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_waste_quantity` CHECK (`quantity_wasted` > 0),
    CONSTRAINT `chk_waste_loss` CHECK (`financial_loss` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. DEMAND FORECASTING INTEGRATION
-- ============================================================================

-- Table 21: demand_forecasts
CREATE TABLE `demand_forecasts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `forecast_date` DATE NOT NULL,
    `target_type` ENUM('MENU_ITEM', 'INGREDIENT') NOT NULL,
    `target_id` INT NOT NULL,
    `predicted_quantity` DECIMAL(10, 3) NOT NULL,
    `confidence_lower_bound` DECIMAL(10, 3) NOT NULL,
    `confidence_upper_bound` DECIMAL(10, 3) NOT NULL,
    `actual_quantity_consumed` DECIMAL(10, 3) NULL,
    `model_version` VARCHAR(50) NOT NULL DEFAULT 'v1.0.0-baseline',
    `generated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_forecast_target_model` (`forecast_date`, `target_type`, `target_id`, `model_version`),
    INDEX `idx_forecast_lookup` (`target_type`, `target_id`, `forecast_date`),
    INDEX `idx_forecast_date` (`forecast_date`),
    CONSTRAINT `chk_forecast_predicted` CHECK (`predicted_quantity` >= 0),
    CONSTRAINT `chk_forecast_ci_low` CHECK (`confidence_lower_bound` >= 0),
    CONSTRAINT `chk_forecast_ci_high` CHECK (`confidence_upper_bound` >= `confidence_lower_bound`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
