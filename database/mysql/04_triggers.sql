-- ============================================================================
-- Restaurant & Food Inventory Management System
-- Phase 1, Task 3B: Database Triggers for Inventory & Waste Tracking
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- ============================================================================

USE `restaurant_inventory_db`;

-- Drop existing triggers if re-running
DROP TRIGGER IF EXISTS `trg_batch_status_maintenance`;
DROP TRIGGER IF EXISTS `trg_calculate_waste_cost`;

DELIMITER //

-- ============================================================================
-- TRIGGER 1: trg_batch_status_maintenance
-- Table: inventory_batches (BEFORE UPDATE)
-- Description: Automatically marks an inventory batch as 'DEPLETED' when its
--              remaining stock reaches zero, and restores 'ACTIVE' if adjusted.
-- ============================================================================
CREATE TRIGGER `trg_batch_status_maintenance`
BEFORE UPDATE ON `inventory_batches`
FOR EACH ROW
BEGIN
    IF NEW.quantity_remaining = 0.000 AND NEW.status = 'ACTIVE' THEN
        SET NEW.status = 'DEPLETED';
    ELSEIF NEW.quantity_remaining > 0.000 AND NEW.status = 'DEPLETED' THEN
        SET NEW.status = 'ACTIVE';
    END IF;
END //


-- ============================================================================
-- TRIGGER 2: trg_calculate_waste_cost
-- Table: waste_records (BEFORE INSERT)
-- Description: Automatically calculates the financial dollar loss when food
--              waste is logged, using the specific batch's purchase unit cost
--              or falling back to the ingredient standard reference cost.
--              Handles unit-of-measure conversion factors seamlessly.
-- ============================================================================
CREATE TRIGGER `trg_calculate_waste_cost`
BEFORE INSERT ON `waste_records`
FOR EACH ROW
BEGIN
    DECLARE v_unit_cost DECIMAL(10, 2) DEFAULT 0.00;
    DECLARE v_ing_id INT DEFAULT NULL;
    DECLARE v_waste_conv DECIMAL(12, 6) DEFAULT 1.000000;
    DECLARE v_ing_conv DECIMAL(12, 6) DEFAULT 1.000000;

    -- Only calculate if financial_loss was not explicitly provided or is 0
    IF NEW.financial_loss IS NULL OR NEW.financial_loss = 0.00 THEN
        -- 1. If batch_id is provided, retrieve batch's purchase unit cost
        IF NEW.batch_id IS NOT NULL THEN
            SELECT b.unit_cost, b.ingredient_id
            INTO v_unit_cost, v_ing_id
            FROM `inventory_batches` b
            WHERE b.id = NEW.batch_id;

            -- Backfill ingredient_id on the waste record if it was omitted
            IF NEW.ingredient_id IS NULL AND v_ing_id IS NOT NULL THEN
                SET NEW.ingredient_id = v_ing_id;
            END IF;

        -- 2. Fallback to ingredient master standard reference cost
        ELSEIF NEW.ingredient_id IS NOT NULL THEN
            SELECT i.cost_per_unit
            INTO v_unit_cost
            FROM `ingredients` i
            WHERE i.id = NEW.ingredient_id;
            
            SET v_ing_id = NEW.ingredient_id;
        END IF;

        -- 3. Resolve unit conversion ratio if waste unit differs from base ingredient unit
        IF v_ing_id IS NOT NULL AND NEW.unit_id IS NOT NULL THEN
            SELECT 
                u_waste.conversion_factor,
                u_ing.conversion_factor
            INTO 
                v_waste_conv,
                v_ing_conv
            FROM `units_of_measure` u_waste
            JOIN `ingredients` ing ON ing.id = v_ing_id
            JOIN `units_of_measure` u_ing ON u_ing.id = ing.unit_id
            WHERE u_waste.id = NEW.unit_id;

            IF v_ing_conv > 0 THEN
                SET NEW.financial_loss = ROUND(NEW.quantity_wasted * (v_waste_conv / v_ing_conv) * v_unit_cost, 2);
            ELSE
                SET NEW.financial_loss = ROUND(NEW.quantity_wasted * v_unit_cost, 2);
            END IF;
        ELSE
            SET NEW.financial_loss = ROUND(NEW.quantity_wasted * v_unit_cost, 2);
        END IF;
    END IF;
END //

DELIMITER ;
