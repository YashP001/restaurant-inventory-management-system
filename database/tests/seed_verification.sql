-- ============================================================================
-- Urban Bites Database Seed Verification Suite
-- Phase 1, Task 4: Complete 8-Point Verification
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- ============================================================================

USE `restaurant_inventory_db`;

-- ----------------------------------------------------------------------------
-- CHECK 1: Table Record Counts Across All 21 Tables
-- ----------------------------------------------------------------------------
SELECT 'CHECK 1: Table Record Counts' AS verification_check;

SELECT 'roles' AS table_name, COUNT(*) AS row_count FROM `roles`
UNION ALL SELECT 'users', COUNT(*) FROM `users`
UNION ALL SELECT 'categories', COUNT(*) FROM `categories`
UNION ALL SELECT 'units_of_measure', COUNT(*) FROM `units_of_measure`
UNION ALL SELECT 'dining_tables', COUNT(*) FROM `dining_tables`
UNION ALL SELECT 'ingredients', COUNT(*) FROM `ingredients`
UNION ALL SELECT 'menu_items', COUNT(*) FROM `menu_items`
UNION ALL SELECT 'recipes', COUNT(*) FROM `recipes`
UNION ALL SELECT 'recipe_ingredients', COUNT(*) FROM `recipe_ingredients`
UNION ALL SELECT 'suppliers', COUNT(*) FROM `suppliers`
UNION ALL SELECT 'supplier_ingredients', COUNT(*) FROM `supplier_ingredients`
UNION ALL SELECT 'inventory_batches', COUNT(*) FROM `inventory_batches`
UNION ALL SELECT 'purchase_orders', COUNT(*) FROM `purchase_orders`
UNION ALL SELECT 'purchase_order_items', COUNT(*) FROM `purchase_order_items`
UNION ALL SELECT 'orders', COUNT(*) FROM `orders`
UNION ALL SELECT 'order_items', COUNT(*) FROM `order_items`
UNION ALL SELECT 'payments', COUNT(*) FROM `payments`
UNION ALL SELECT 'order_ingredient_consumptions', COUNT(*) FROM `order_ingredient_consumptions`
UNION ALL SELECT 'stock_movements', COUNT(*) FROM `stock_movements`
UNION ALL SELECT 'waste_records', COUNT(*) FROM `waste_records`
UNION ALL SELECT 'demand_forecasts', COUNT(*) FROM `demand_forecasts`;

-- ----------------------------------------------------------------------------
-- CHECK 2: Foreign Key Integrity Check (Orphaned Rows Audit)
-- ----------------------------------------------------------------------------
SELECT 'CHECK 2: Foreign Key Integrity Audit' AS verification_check;

SELECT 'Orphaned Users' AS check_name, COUNT(*) AS violations FROM `users` WHERE `role_id` NOT IN (SELECT `id` FROM `roles`)
UNION ALL SELECT 'Orphaned Recipe Ingredients', COUNT(*) FROM `recipe_ingredients` WHERE `recipe_id` NOT IN (SELECT `id` FROM `recipes`) OR `ingredient_id` NOT IN (SELECT `id` FROM `ingredients`)
UNION ALL SELECT 'Orphaned Batches', COUNT(*) FROM `inventory_batches` WHERE `ingredient_id` NOT IN (SELECT `id` FROM `ingredients`)
UNION ALL SELECT 'Orphaned Stock Movements', COUNT(*) FROM `stock_movements` WHERE `batch_id` NOT IN (SELECT `id` FROM `inventory_batches`)
UNION ALL SELECT 'Orphaned Order Items', COUNT(*) FROM `order_items` WHERE `order_id` NOT IN (SELECT `id` FROM `orders`) OR `menu_item_id` NOT IN (SELECT `id` FROM `menu_items`)
UNION ALL SELECT 'Orphaned Payments', COUNT(*) FROM `payments` WHERE `order_id` NOT IN (SELECT `id` FROM `orders`)
UNION ALL SELECT 'Orphaned Consumptions', COUNT(*) FROM `order_ingredient_consumptions` WHERE `order_item_id` NOT IN (SELECT `id` FROM `order_items`) OR `batch_id` NOT IN (SELECT `id` FROM `inventory_batches`)
UNION ALL SELECT 'Orphaned Waste Records', COUNT(*) FROM `waste_records` WHERE (`batch_id` IS NOT NULL AND `batch_id` NOT IN (SELECT `id` FROM `inventory_batches`)) OR (`ingredient_id` IS NOT NULL AND `ingredient_id` NOT IN (SELECT `id` FROM `ingredients`));

-- ----------------------------------------------------------------------------
-- CHECK 3 & 4: Five Reporting Views + Low Stock + Expiring Batches
-- ----------------------------------------------------------------------------
SELECT 'CHECK 3A: vw_current_stock (Low Stock Summary)' AS verification_check;
SELECT ingredient_id, ingredient_name, unit, total_available_stock, safety_stock_threshold, reorder_status, suggested_reorder_quantity
FROM `vw_current_stock`
WHERE reorder_status = 'LOW STOCK'
LIMIT 10;

SELECT 'CHECK 3B: vw_expiring_batches_fefo (Near-Expiry Batches)' AS verification_check;
SELECT batch_id, ingredient_name, batch_number, quantity_remaining, unit, expiry_date, days_until_expiry, urgency_status
FROM `vw_expiring_batches_fefo`
WHERE urgency_status IN ('CRITICAL (<= 3 Days)', 'WARNING (<= 7 Days)')
ORDER BY days_until_expiry ASC
LIMIT 10;

SELECT 'CHECK 3C: vw_recipe_costs (Top 5 Margin Dishes)' AS verification_check;
SELECT menu_item_name, selling_price, ingredient_cost_per_serving, gross_profit_per_serving, food_cost_percentage
FROM `vw_recipe_costs`
ORDER BY food_cost_percentage ASC
LIMIT 5;

SELECT 'CHECK 3D: vw_waste_analytics (Waste Loss by Root Cause)' AS verification_check;
SELECT waste_month, waste_reason, total_incidents, total_quantity_wasted, total_financial_loss, avg_financial_loss_per_event
FROM `vw_waste_analytics`
ORDER BY waste_month DESC, total_financial_loss DESC
LIMIT 8;

-- ----------------------------------------------------------------------------
-- CHECK 5: Historical Daily Sales Summary (Recent 7 Days)
-- ----------------------------------------------------------------------------
SELECT 'CHECK 5: vw_daily_sales (Recent 7 Days)' AS verification_check;
SELECT sales_date, total_completed_orders, total_subtotal, total_tax_collected, total_discounts_granted, total_revenue, average_order_value
FROM `vw_daily_sales`
ORDER BY sales_date DESC
LIMIT 7;

-- ----------------------------------------------------------------------------
-- CHECK 6: Batch Reconciliation vs Stock Movements Ledger
-- ----------------------------------------------------------------------------
SELECT 'CHECK 6: Batch Reconciliation with Stock Movements Ledger' AS verification_check;

SELECT 
    COUNT(*) AS total_batches_checked,
    SUM(CASE WHEN reconciliation_difference = 0.000 THEN 1 ELSE 0 END) AS fully_reconciled_batches,
    SUM(CASE WHEN reconciliation_difference != 0.000 THEN 1 ELSE 0 END) AS discrepant_batches
FROM (
    SELECT 
        b.id AS batch_id,
        b.batch_number,
        b.quantity_received,
        b.quantity_remaining,
        ROUND(COALESCE(SUM(CASE WHEN sm.movement_type = 'PURCHASE_RECEIPT' THEN sm.quantity ELSE 0 END), 0), 3) AS m_recv,
        ROUND(COALESCE(SUM(CASE WHEN sm.movement_type = 'ORDER_CONSUMPTION' THEN sm.quantity ELSE 0 END), 0), 3) AS m_consumed,
        ROUND(COALESCE(SUM(CASE WHEN sm.movement_type = 'WASTE_DISPOSAL' THEN sm.quantity ELSE 0 END), 0), 3) AS m_waste,
        ROUND(b.quantity_remaining - (
            COALESCE(SUM(CASE WHEN sm.movement_type = 'PURCHASE_RECEIPT' THEN sm.quantity ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN sm.movement_type IN ('ORDER_CONSUMPTION', 'WASTE_DISPOSAL') THEN sm.quantity ELSE 0 END), 0)
        ), 3) AS reconciliation_difference
    FROM `inventory_batches` b
    LEFT JOIN `stock_movements` sm ON sm.batch_id = b.id
    GROUP BY b.id, b.batch_number, b.quantity_received, b.quantity_remaining
) sub;

-- ----------------------------------------------------------------------------
-- CHECK 7: Cancelled Orders vs Ingredient Consumption
-- ----------------------------------------------------------------------------
SELECT 'CHECK 7: Cancelled Orders Ingredient Consumption Audit' AS verification_check;

SELECT 
    COUNT(o.id) AS total_cancelled_orders,
    COALESCE(SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS invalid_consumptions_for_cancelled_orders
FROM `orders` o
LEFT JOIN `order_items` oi ON oi.order_id = o.id
LEFT JOIN `order_ingredient_consumptions` c ON c.order_item_id = oi.id
WHERE o.status = 'CANCELLED';

-- ----------------------------------------------------------------------------
-- CHECK 8: Non-Negative Inventory Check
-- ----------------------------------------------------------------------------
SELECT 'CHECK 8: Non-Negative Inventory Audit' AS verification_check;

SELECT 
    COUNT(*) AS negative_quantity_batches,
    (SELECT COUNT(*) FROM `stock_movements` WHERE `balance_after` < 0) AS negative_movement_balances
FROM `inventory_batches` 
WHERE `quantity_remaining` < 0;
