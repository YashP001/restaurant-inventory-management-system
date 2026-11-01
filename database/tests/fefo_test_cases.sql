-- ============================================================================
-- Restaurant & Food Inventory Management System
-- Phase 1, Task 3B: Automated FEFO & Trigger Test Runner
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- ============================================================================

USE `restaurant_inventory_db`;

DROP PROCEDURE IF EXISTS `sp_run_fefo_tests`;

DELIMITER //

CREATE PROCEDURE `sp_run_fefo_tests`()
BEGIN
    -- Variables for capturing test results
    DECLARE v_t3_error INT DEFAULT 0;
    DECLARE v_t4_error INT DEFAULT 0;
    
    -- Temporary table to collect test results
    CREATE TEMPORARY TABLE IF NOT EXISTS `tmp_test_results` (
        `test_id` INT AUTO_INCREMENT PRIMARY KEY,
        `test_name` VARCHAR(100),
        `status` VARCHAR(20),
        `details` TEXT
    ) ENGINE=InnoDB;

    TRUNCATE TABLE `tmp_test_results`;

    -- ------------------------------------------------------------------------
    -- 0. PRE-TEST CLEANUP
    -- ------------------------------------------------------------------------
    SET FOREIGN_KEY_CHECKS = 0;
    DELETE FROM `order_ingredient_consumptions` WHERE `order_item_id` IN (SELECT id FROM `order_items` WHERE `special_instructions` LIKE 'TEST_%');
    DELETE FROM `stock_movements` WHERE `reference_id` LIKE 'TEST_%' OR `reference_id` LIKE 'ORDER-90%';
    DELETE FROM `waste_records` WHERE `notes` LIKE 'TEST_%';
    DELETE FROM `order_items` WHERE `special_instructions` LIKE 'TEST_%';
    DELETE FROM `orders` WHERE `order_number` LIKE 'TEST-ORD-%';
    DELETE FROM `inventory_batches` WHERE `batch_number` LIKE 'TEST-BATCH-%';
    DELETE FROM `recipe_ingredients` WHERE `recipe_id` IN (SELECT id FROM `recipes` WHERE `instructions` LIKE 'TEST_%');
    DELETE FROM `recipes` WHERE `instructions` LIKE 'TEST_%';
    DELETE FROM `menu_items` WHERE `name` LIKE 'TEST %';
    DELETE FROM `ingredients` WHERE `name` LIKE 'TEST %';
    DELETE FROM `dining_tables` WHERE `table_number` LIKE 'TEST-T%';
    DELETE FROM `users` WHERE `username` LIKE 'test_%';
    DELETE FROM `roles` WHERE `name` LIKE 'TEST_%';
    DELETE FROM `units_of_measure` WHERE `name` LIKE 'TEST %';
    DELETE FROM `categories` WHERE `name` LIKE 'TEST %';
    SET FOREIGN_KEY_CHECKS = 1;

    -- ------------------------------------------------------------------------
    -- 1. SETUP ISOLATED TEST FIXTURES
    -- ------------------------------------------------------------------------
    INSERT INTO `roles` (`id`, `name`, `description`) 
    VALUES (999, 'TEST_ROLE', 'Test role for automated test suite');

    INSERT INTO `users` (`id`, `role_id`, `username`, `email`, `password_hash`, `full_name`) 
    VALUES (999, 999, 'test_chef', 'test_chef@restaurant.local', '$2b$12$testpasswordhash', 'Test Chef User');

    -- Units: kg, g (factor 0.001), pcs
    INSERT INTO `units_of_measure` (`id`, `name`, `abbreviation`, `unit_type`, `base_unit_id`, `conversion_factor`)
    VALUES 
    (901, 'TEST Kilogram', 't_kg', 'WEIGHT', NULL, 1.000000),
    (902, 'TEST Gram', 't_g', 'WEIGHT', 901, 0.001000),
    (903, 'TEST Piece', 't_pcs', 'COUNT', NULL, 1.000000);

    INSERT INTO `categories` (`id`, `name`, `description`) 
    VALUES (901, 'TEST Pizzas', 'Test pizza category');

    -- Ingredients: Mozzarella Cheese ($12.00/kg) and Pizza Dough Crust ($1.50/pcs)
    INSERT INTO `ingredients` (`id`, `name`, `unit_id`, `minimum_stock_level`, `optimal_par_level`, `cost_per_unit`)
    VALUES 
    (901, 'TEST Mozzarella Cheese', 901, 1.000, 10.000, 12.00),
    (902, 'TEST Pizza Dough Crust', 903, 5.000, 30.000, 1.50);

    -- Menu Item: Margherita Pizza ($15.00)
    INSERT INTO `menu_items` (`id`, `category_id`, `name`, `selling_price`, `preparation_time_mins`)
    VALUES (901, 901, 'TEST Margherita Pizza', 15.00, 12);

    -- Recipe: Yields 1 serving
    INSERT INTO `recipes` (`id`, `menu_item_id`, `yield_servings`, `instructions`)
    VALUES (901, 901, 1, 'TEST_Margherita preparation instructions');

    -- Recipe BOM: 200g Mozzarella (using gram unit 902 -> converts to 0.200 kg) + 1 piece Dough
    INSERT INTO `recipe_ingredients` (`id`, `recipe_id`, `ingredient_id`, `quantity_required`, `unit_id`, `wastage_allowance_percent`)
    VALUES 
    (901, 901, 901, 200.000, 902, 0.00),
    (902, 901, 902, 1.000, 903, 0.00);

    INSERT INTO `dining_tables` (`id`, `table_number`, `seating_capacity`, `status`)
    VALUES (901, 'TEST-T1', 4, 'OCCUPIED');

    -- Batches:
    -- Batch 901 (A): 0.500 kg, expires in 2 days (Earliest active FEFO candidate)
    -- Batch 902 (B): 1.000 kg, expires in 6 days (Later active candidate)
    -- Batch 903 (C): 0.500 kg, EXPIRED 3 days ago (Past date - MUST NEVER BE CONSUMED)
    -- Batch 904 (D): 20 pcs, expires in 15 days
    INSERT INTO `inventory_batches` (`id`, `ingredient_id`, `batch_number`, `quantity_received`, `quantity_remaining`, `unit_cost`, `received_date`, `expiry_date`, `status`)
    VALUES
    (901, 901, 'TEST-BATCH-MOZZ-A', 0.500, 0.500, 12.00, DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY), 'ACTIVE'),
    (902, 901, 'TEST-BATCH-MOZZ-B', 1.000, 1.000, 12.00, DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 6 DAY), 'ACTIVE'),
    (903, 901, 'TEST-BATCH-MOZZ-C-EXPIRED', 0.500, 0.500, 12.00, DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY), DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY), 'ACTIVE'),
    (904, 902, 'TEST-BATCH-DOUGH-D', 20.000, 20.000, 1.50, CURRENT_DATE(), DATE_ADD(CURRENT_DATE(), INTERVAL 15 DAY), 'ACTIVE');

    -- ------------------------------------------------------------------------
    -- TEST 1: Basic FEFO Deduction
    -- Order 901: 1 Pizza -> Requires 0.200 kg Mozzarella + 1 Dough
    -- Expected: Batch A (expires in 2 days) deducted 0.500 -> 0.300 kg.
    --           Batch B (expires in 6 days) untouched at 1.000 kg.
    -- ------------------------------------------------------------------------
    INSERT INTO `orders` (`id`, `order_number`, `order_type`, `table_id`, `user_id`, `status`, `total_amount`)
    VALUES (901, 'TEST-ORD-001', 'DINE_IN', 901, 999, 'PENDING', 15.00);

    INSERT INTO `order_items` (`id`, `order_id`, `menu_item_id`, `quantity`, `unit_price`, `subtotal`, `special_instructions`)
    VALUES (901, 901, 901, 1, 15.00, 15.00, 'TEST_Item_1');

    CALL `sp_process_order_fefo`(901);

    INSERT INTO `tmp_test_results` (`test_name`, `status`, `details`)
    SELECT 
        '1. Basic FEFO Deduction',
        CASE 
            WHEN bA.quantity_remaining = 0.300 AND bB.quantity_remaining = 1.000 AND o.status = 'PREPARING'
            THEN 'PASSED'
            ELSE 'FAILED'
        END,
        CONCAT('Batch A (earliest) deducted to: ', bA.quantity_remaining, ' kg (expected: 0.300). Batch B untouched at: ', bB.quantity_remaining, ' kg. Order status: ', o.status)
    FROM `inventory_batches` bA
    JOIN `inventory_batches` bB ON bB.id = 902
    JOIN `orders` o ON o.id = 901
    WHERE bA.id = 901;

    -- ------------------------------------------------------------------------
    -- TEST 2: Multi-Batch FEFO Allocation & Zero Remaining -> DEPLETED
    -- Order 902: 2 Pizzas -> Requires 0.400 kg Mozzarella
    -- Batch A has only 0.300 kg left.
    -- Expected: Exhausts Batch A (0.300 -> 0.000 kg, marked DEPLETED).
    --           Draws remaining 0.100 kg from Batch B (1.000 -> 0.900 kg).
    -- ------------------------------------------------------------------------
    INSERT INTO `orders` (`id`, `order_number`, `order_type`, `table_id`, `user_id`, `status`, `total_amount`)
    VALUES (902, 'TEST-ORD-002', 'DINE_IN', 901, 999, 'CONFIRMED', 30.00);

    INSERT INTO `order_items` (`id`, `order_id`, `menu_item_id`, `quantity`, `unit_price`, `subtotal`, `special_instructions`)
    VALUES (902, 902, 901, 2, 15.00, 30.00, 'TEST_Item_2');

    CALL `sp_process_order_fefo`(902);

    INSERT INTO `tmp_test_results` (`test_name`, `status`, `details`)
    SELECT 
        '2. Multi-Batch Deduction Across Expiries',
        CASE 
            WHEN bA.quantity_remaining = 0.000 AND bA.status = 'DEPLETED' 
             AND bB.quantity_remaining = 0.900 AND bB.status = 'ACTIVE'
            THEN 'PASSED'
            ELSE 'FAILED'
        END,
        CONCAT('Batch A exhausted to: ', bA.quantity_remaining, ' kg (Status: ', bA.status, '). Batch B deducted to: ', bB.quantity_remaining, ' kg (Status: ', bB.status, ')')
    FROM `inventory_batches` bA
    JOIN `inventory_batches` bB ON bB.id = 902
    WHERE bA.id = 901;

    -- ------------------------------------------------------------------------
    -- TEST 3: Insufficient Stock Rollback
    -- Order 903: 50 Pizzas -> Requires 10.000 kg Mozzarella (Only 0.900 kg available)
    -- Expected: Stored procedure signals exception, transaction rolls back.
    --           Batch B remains intact at 0.900 kg, Order stays PENDING.
    -- ------------------------------------------------------------------------
    INSERT INTO `orders` (`id`, `order_number`, `order_type`, `table_id`, `user_id`, `status`, `total_amount`)
    VALUES (903, 'TEST-ORD-003', 'DINE_IN', 901, 999, 'PENDING', 750.00);

    INSERT INTO `order_items` (`id`, `order_id`, `menu_item_id`, `quantity`, `unit_price`, `subtotal`, `special_instructions`)
    VALUES (903, 903, 901, 50, 15.00, 750.00, 'TEST_Item_3');

    test3_scope: BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_t3_error = 1;
        CALL `sp_process_order_fefo`(903);
    END test3_scope;

    INSERT INTO `tmp_test_results` (`test_name`, `status`, `details`)
    SELECT 
        '3. Insufficient Stock Entire Transaction Rollback',
        CASE 
            WHEN v_t3_error = 1 AND bB.quantity_remaining = 0.900 AND o.status = 'PENDING'
            THEN 'PASSED'
            ELSE 'FAILED'
        END,
        CONCAT('Exception properly caught: ', v_t3_error, ', Batch B stock unchanged at: ', bB.quantity_remaining, ' kg, Order status remains: ', o.status)
    FROM `inventory_batches` bB
    JOIN `orders` o ON o.id = 903
    WHERE bB.id = 902;

    -- ------------------------------------------------------------------------
    -- TEST 4: Duplicate Order Processing Prevention (Idempotency)
    -- Re-calling procedure on Order 901 (already in PREPARING status).
    -- Expected: Procedure aborts, prevents duplicate deduction.
    -- ------------------------------------------------------------------------
    test4_scope: BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_t4_error = 1;
        CALL `sp_process_order_fefo`(901);
    END test4_scope;

    INSERT INTO `tmp_test_results` (`test_name`, `status`, `details`)
    SELECT 
        '4. Duplicate Order Idempotency Protection',
        CASE 
            WHEN v_t4_error = 1 AND bB.quantity_remaining = 0.900
            THEN 'PASSED'
            ELSE 'FAILED'
        END,
        CONCAT('Re-execution blocked with error: ', v_t4_error, ', Batch B stock retained at: ', bB.quantity_remaining, ' kg')
    FROM `inventory_batches` bB
    WHERE bB.id = 902;

    -- ------------------------------------------------------------------------
    -- TEST 5: Expired Batches Protection
    -- Batch C was expired (expiry_date in past).
    -- Expected: Batch C remaining quantity is still 0.500 kg, NEVER touched.
    -- ------------------------------------------------------------------------
    INSERT INTO `tmp_test_results` (`test_name`, `status`, `details`)
    SELECT 
        '5. Expired Batch Consumption Protection',
        CASE 
            WHEN bC.quantity_remaining = 0.500
            THEN 'PASSED'
            ELSE 'FAILED'
        END,
        CONCAT('Expired Batch C untouched at: ', bC.quantity_remaining, ' kg (Expiry date: ', bC.expiry_date, ')')
    FROM `inventory_batches` bC
    WHERE bC.id = 903;

    -- ------------------------------------------------------------------------
    -- TEST 6: Zero Quantity Status DEPLETED Trigger
    -- Batch A quantity reached 0.000 in Test 2.
    -- ------------------------------------------------------------------------
    INSERT INTO `tmp_test_results` (`test_name`, `status`, `details`)
    SELECT 
        '6. Zero Quantity Status Transition to DEPLETED',
        CASE 
            WHEN status = 'DEPLETED' AND quantity_remaining = 0.000
            THEN 'PASSED'
            ELSE 'FAILED'
        END,
        CONCAT('Batch A status verified as: ', status, ' with 0.000 remaining.')
    FROM `inventory_batches`
    WHERE id = 901;

    -- ------------------------------------------------------------------------
    -- TEST 7: Waste Cost Calculation Trigger & Unit Conversion
    -- Sub-test 7A: Discard 0.200 kg from Batch B ($12.00/kg) with financial_loss = NULL.
    --              Expected: Trigger computes 0.200 * $12.00 = $2.40.
    -- Sub-test 7B: Discard 100 g from Batch B using grams unit (t_g = 0.001 kg).
    --              Expected: Trigger computes 100 * 0.001 * $12.00 = $1.20.
    -- ------------------------------------------------------------------------
    INSERT INTO `waste_records` (`id`, `batch_id`, `ingredient_id`, `quantity_wasted`, `unit_id`, `waste_reason`, `financial_loss`, `logged_by_user_id`, `notes`)
    VALUES 
    (901, 902, 901, 0.200, 901, 'SPOILED', 0.00, 999, 'TEST_Waste_Kg'),
    (902, 902, 901, 100.000, 902, 'OVERCOOKED', NULL, 999, 'TEST_Waste_Grams');

    INSERT INTO `tmp_test_results` (`test_name`, `status`, `details`)
    SELECT 
        '7A. Waste Cost Auto-Calculation (Standard Unit)',
        CASE 
            WHEN financial_loss = 2.40
            THEN 'PASSED'
            ELSE 'FAILED'
        END,
        CONCAT('Computed financial loss: $', financial_loss, ' (Expected: $2.40 for 0.200 kg @ $12/kg)')
    FROM `waste_records`
    WHERE id = 901;

    INSERT INTO `tmp_test_results` (`test_name`, `status`, `details`)
    SELECT 
        '7B. Waste Cost Auto-Calculation (Grams to Kg Conversion)',
        CASE 
            WHEN financial_loss = 1.20
            THEN 'PASSED'
            ELSE 'FAILED'
        END,
        CONCAT('Computed financial loss: $', financial_loss, ' (Expected: $1.20 for 100 g @ $12/kg)')
    FROM `waste_records`
    WHERE id = 902;

    -- ------------------------------------------------------------------------
    -- DISPLAY FINAL TEST REPORT
    -- ------------------------------------------------------------------------
    SELECT 
        test_id,
        test_name,
        status,
        details
    FROM `tmp_test_results`
    ORDER BY test_id ASC;

    -- ------------------------------------------------------------------------
    -- POST-TEST CLEANUP
    -- ------------------------------------------------------------------------
    SET FOREIGN_KEY_CHECKS = 0;
    DELETE FROM `order_ingredient_consumptions` WHERE `order_item_id` IN (SELECT id FROM `order_items` WHERE `special_instructions` LIKE 'TEST_%');
    DELETE FROM `stock_movements` WHERE `reference_id` LIKE 'TEST_%' OR `reference_id` LIKE 'ORDER-90%';
    DELETE FROM `waste_records` WHERE `notes` LIKE 'TEST_%';
    DELETE FROM `order_items` WHERE `special_instructions` LIKE 'TEST_%';
    DELETE FROM `orders` WHERE `order_number` LIKE 'TEST-ORD-%';
    DELETE FROM `inventory_batches` WHERE `batch_number` LIKE 'TEST-BATCH-%';
    DELETE FROM `recipe_ingredients` WHERE `recipe_id` IN (SELECT id FROM `recipes` WHERE `instructions` LIKE 'TEST_%');
    DELETE FROM `recipes` WHERE `instructions` LIKE 'TEST_%';
    DELETE FROM `menu_items` WHERE `name` LIKE 'TEST %';
    DELETE FROM `ingredients` WHERE `name` LIKE 'TEST %';
    DELETE FROM `dining_tables` WHERE `table_number` LIKE 'TEST-T%';
    DELETE FROM `users` WHERE `username` LIKE 'test_%';
    DELETE FROM `roles` WHERE `name` LIKE 'TEST_%';
    DELETE FROM `units_of_measure` WHERE `name` LIKE 'TEST %';
    DELETE FROM `categories` WHERE `name` LIKE 'TEST %';
    SET FOREIGN_KEY_CHECKS = 1;

END //

DELIMITER ;

-- Execute test runner
CALL `sp_run_fefo_tests`();

-- Clean up test runner procedure
DROP PROCEDURE IF EXISTS `sp_run_fefo_tests`;
