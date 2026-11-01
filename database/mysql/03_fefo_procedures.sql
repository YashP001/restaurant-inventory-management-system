-- ============================================================================
-- Restaurant & Food Inventory Management System
-- Phase 1, Task 3B: Transaction-Safe FEFO Inventory Management Procedures
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- ============================================================================

USE `restaurant_inventory_db`;

DROP PROCEDURE IF EXISTS `sp_process_order_fefo`;

DELIMITER //

CREATE PROCEDURE `sp_process_order_fefo`(
    IN p_order_id INT
)
proc_main: BEGIN
    -- ------------------------------------------------------------------------
    -- Variable Declarations
    -- ------------------------------------------------------------------------
    DECLARE v_order_id INT DEFAULT NULL;
    DECLARE v_order_number VARCHAR(50);
    DECLARE v_order_status VARCHAR(20);
    DECLARE v_order_user_id INT DEFAULT NULL;

    -- Iteration variables for temporary requirements table
    DECLARE v_curr_idx INT DEFAULT 1;
    DECLARE v_total_reqs INT DEFAULT 0;
    DECLARE v_order_item_id INT;
    DECLARE v_ingredient_id INT;
    DECLARE v_ingredient_name VARCHAR(150);
    DECLARE v_needed_qty DECIMAL(10, 3);
    DECLARE v_remaining_to_deduct DECIMAL(10, 3);

    -- Pre-flight validation variables
    DECLARE v_insufficient_ing VARCHAR(150) DEFAULT NULL;
    DECLARE v_req_qty DECIMAL(10, 3);
    DECLARE v_avail_qty DECIMAL(10, 3);

    -- Batch allocation variables
    DECLARE v_done_batches INT DEFAULT FALSE;
    DECLARE v_batch_id INT;
    DECLARE v_batch_remaining DECIMAL(10, 3);
    DECLARE v_batch_unit_cost DECIMAL(10, 2);
    DECLARE v_deduct_qty DECIMAL(10, 3);
    DECLARE v_new_balance DECIMAL(10, 3);

    -- Generic exception handler: roll back and re-signal on any SQL error
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- ------------------------------------------------------------------------
    -- Step 1: Start Transaction & Acquire Row Lock on the Order (Idempotency)
    -- ------------------------------------------------------------------------
    START TRANSACTION;

    SELECT 
        o.id, 
        o.order_number, 
        o.status, 
        o.user_id
    INTO 
        v_order_id, 
        v_order_number, 
        v_order_status, 
        v_order_user_id
    FROM `orders` o
    WHERE o.id = p_order_id
    FOR UPDATE;

    -- Validate order existence
    IF v_order_id IS NULL THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order not found.';
    END IF;

    -- Validate order processing status (Idempotency: prevent double deduction)
    IF v_order_status NOT IN ('PENDING', 'CONFIRMED') THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order cannot be processed: Order is not in PENDING or CONFIRMED status.';
    END IF;

    -- Validate that the order contains items
    IF (SELECT COUNT(*) FROM `order_items` WHERE `order_id` = p_order_id) = 0 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order has no items to process.';
    END IF;

    -- ------------------------------------------------------------------------
    -- Step 2: Populate Temporary Table with Ingredient Requirements
    -- Normalizes quantities to the base unit of measure for each ingredient
    -- ------------------------------------------------------------------------
    CREATE TEMPORARY TABLE IF NOT EXISTS `tmp_order_reqs` (
        `row_num` INT AUTO_INCREMENT PRIMARY KEY,
        `order_item_id` INT NOT NULL,
        `ingredient_id` INT NOT NULL,
        `ingredient_name` VARCHAR(150) NOT NULL,
        `quantity_needed` DECIMAL(10, 3) NOT NULL
    ) ENGINE=InnoDB;

    TRUNCATE TABLE `tmp_order_reqs`;

    INSERT INTO `tmp_order_reqs` (
        `order_item_id`,
        `ingredient_id`,
        `ingredient_name`,
        `quantity_needed`
    )
    SELECT 
        oi.id AS order_item_id,
        ri.ingredient_id,
        ing.name AS ingredient_name,
        ROUND(
            (oi.quantity * (ri.quantity_required * (1.0 + (ri.wastage_allowance_percent / 100.0))) / r.yield_servings)
            * (ri_uom.conversion_factor / ing_uom.conversion_factor),
            3
        ) AS quantity_needed
    FROM `order_items` oi
    JOIN `recipes` r 
        ON r.menu_item_id = oi.menu_item_id
    JOIN `recipe_ingredients` ri 
        ON ri.recipe_id = r.id
    JOIN `ingredients` ing 
        ON ing.id = ri.ingredient_id
    JOIN `units_of_measure` ri_uom 
        ON ri_uom.id = ri.unit_id
    JOIN `units_of_measure` ing_uom 
        ON ing_uom.id = ing.unit_id
    WHERE oi.order_id = p_order_id;

    SELECT COUNT(*) INTO v_total_reqs FROM `tmp_order_reqs`;

    IF v_total_reqs = 0 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order items do not have configured recipe ingredients.';
    END IF;

    -- ------------------------------------------------------------------------
    -- Step 3: Pre-Flight Inventory Availability Check
    -- Ensures sufficient active, non-expired stock before touching any batch
    -- ------------------------------------------------------------------------
    SELECT 
        req.ingredient_name,
        req.total_required,
        COALESCE(SUM(b.quantity_remaining), 0.000)
    INTO 
        v_insufficient_ing,
        v_req_qty,
        v_avail_qty
    FROM (
        SELECT 
            ingredient_id,
            ingredient_name,
            SUM(quantity_needed) AS total_required
        FROM `tmp_order_reqs`
        GROUP BY ingredient_id, ingredient_name
    ) req
    LEFT JOIN `inventory_batches` b 
        ON b.ingredient_id = req.ingredient_id 
        AND b.status = 'ACTIVE' 
        AND b.expiry_date >= CURRENT_DATE() 
        AND b.quantity_remaining > 0
    GROUP BY req.ingredient_id, req.ingredient_name, req.total_required
    HAVING COALESCE(SUM(b.quantity_remaining), 0.000) < req.total_required
    LIMIT 1;

    IF v_insufficient_ing IS NOT NULL THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insufficient stock for ingredient: transaction rolled back.';
    END IF;

    -- ------------------------------------------------------------------------
    -- Step 4: Iterate Requirements and Deduct Stock via FEFO Order
    -- ------------------------------------------------------------------------
    SET v_curr_idx = 1;

    WHILE v_curr_idx <= v_total_reqs DO
        SELECT 
            order_item_id, 
            ingredient_id, 
            ingredient_name, 
            quantity_needed
        INTO 
            v_order_item_id, 
            v_ingredient_id, 
            v_ingredient_name, 
            v_needed_qty
        FROM `tmp_order_reqs`
        WHERE row_num = v_curr_idx;

        SET v_remaining_to_deduct = v_needed_qty;

        -- Batch allocation block with cursor locked with FOR UPDATE
        batch_allocation_scope: BEGIN
            DECLARE cur_batches CURSOR FOR
                SELECT 
                    b.id,
                    b.quantity_remaining,
                    b.unit_cost
                FROM `inventory_batches` b
                WHERE b.ingredient_id = v_ingredient_id
                  AND b.status = 'ACTIVE'
                  AND b.expiry_date >= CURRENT_DATE()
                  AND b.quantity_remaining > 0
                ORDER BY b.expiry_date ASC, b.id ASC
                FOR UPDATE;

            DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done_batches = TRUE;

            SET v_done_batches = FALSE;
            OPEN cur_batches;

            batch_loop: LOOP
                FETCH cur_batches INTO v_batch_id, v_batch_remaining, v_batch_unit_cost;

                IF v_done_batches OR v_remaining_to_deduct <= 0.0001 THEN
                    LEAVE batch_loop;
                END IF;

                -- Deduct either remaining needed amount or the batch capacity
                SET v_deduct_qty = LEAST(v_batch_remaining, v_remaining_to_deduct);
                SET v_new_balance = v_batch_remaining - v_deduct_qty;

                -- 1. Update Inventory Batch (Status trigger updates to DEPLETED if 0)
                UPDATE `inventory_batches`
                SET 
                    quantity_remaining = v_new_balance,
                    status = CASE WHEN v_new_balance = 0 THEN 'DEPLETED' ELSE 'ACTIVE' END
                WHERE id = v_batch_id;

                -- 2. Insert into Order Ingredient Consumptions ledger
                INSERT INTO `order_ingredient_consumptions` (
                    `order_item_id`,
                    `batch_id`,
                    `ingredient_id`,
                    `quantity_consumed`,
                    `unit_cost_at_consumption`,
                    `total_cost`
                ) VALUES (
                    v_order_item_id,
                    v_batch_id,
                    v_ingredient_id,
                    v_deduct_qty,
                    v_batch_unit_cost,
                    ROUND(v_deduct_qty * v_batch_unit_cost, 2)
                );

                -- 3. Insert into immutable Stock Movement ledger
                INSERT INTO `stock_movements` (
                    `batch_id`,
                    `movement_type`,
                    `quantity`,
                    `balance_after`,
                    `reference_id`,
                    `notes`,
                    `created_by_user_id`
                ) VALUES (
                    v_batch_id,
                    'ORDER_CONSUMPTION',
                    v_deduct_qty,
                    v_new_balance,
                    CONCAT('ORDER-', p_order_id, '-ITEM-', v_order_item_id),
                    CONCAT('FEFO consumption for Order ', v_order_number),
                    v_order_user_id
                );

                -- Decrement remaining amount needed
                SET v_remaining_to_deduct = v_remaining_to_deduct - v_deduct_qty;

            END LOOP batch_loop;

            CLOSE cur_batches;
        END batch_allocation_scope;

        -- Verify that full required amount was allocated
        IF v_remaining_to_deduct > 0.0001 THEN
            ROLLBACK;
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Unexpected inventory shortfall during allocation: transaction rolled back.';
        END IF;

        SET v_curr_idx = v_curr_idx + 1;
    END WHILE;

    -- ------------------------------------------------------------------------
    -- Step 5: Advance Order Status and Commit Transaction
    -- ------------------------------------------------------------------------
    UPDATE `orders`
    SET 
        `status` = 'PREPARING'
    WHERE `id` = p_order_id;

    COMMIT;

    -- Return confirmation
    SELECT 
        p_order_id AS order_id,
        v_order_number AS order_number,
        'PREPARING' AS new_status,
        'Order processed successfully via FEFO inventory deduction.' AS message;

END proc_main //

DELIMITER ;
