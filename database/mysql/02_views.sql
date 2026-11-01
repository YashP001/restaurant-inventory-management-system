-- ============================================================================
-- Restaurant & Food Inventory Management System
-- Phase 1, Task 3A: Database Views and Reporting
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- ============================================================================

USE `restaurant_inventory_db`;

-- ============================================================================
-- VIEW 1: vw_current_stock
-- Description: Aggregates real-time available stock across active, non-expired
--              inventory batches per ingredient, compares against minimum
--              reorder thresholds, and determines stock sufficiency.
-- Prevents duplicate aggregation: Left joins on active batches grouped by
--                                 ingredient primary key.
-- ============================================================================
CREATE OR REPLACE VIEW `vw_current_stock` AS
SELECT 
    i.id AS ingredient_id,
    i.name AS ingredient_name,
    u.abbreviation AS unit,
    COALESCE(SUM(b.quantity_remaining), 0.000) AS total_available_stock,
    i.minimum_stock_level AS safety_stock_threshold,
    i.optimal_par_level AS optimal_par_level,
    CASE 
        WHEN COALESCE(SUM(b.quantity_remaining), 0.000) <= i.minimum_stock_level THEN 'LOW STOCK'
        ELSE 'SUFFICIENT'
    END AS reorder_status,
    GREATEST(0.000, i.optimal_par_level - COALESCE(SUM(b.quantity_remaining), 0.000)) AS suggested_reorder_quantity,
    COALESCE(SUM(b.quantity_remaining * b.unit_cost), 0.00) AS total_inventory_valuation
FROM `ingredients` i
JOIN `units_of_measure` u 
    ON i.unit_id = u.id
LEFT JOIN `inventory_batches` b 
    ON b.ingredient_id = i.id 
    AND b.status = 'ACTIVE' 
    AND b.expiry_date >= CURRENT_DATE()
GROUP BY 
    i.id, 
    i.name, 
    u.abbreviation, 
    i.minimum_stock_level, 
    i.optimal_par_level;


-- ============================================================================
-- VIEW 2: vw_expiring_batches_fefo
-- Description: Displays active physical inventory lots prioritized in FEFO
--              (First Expiry, First Out) sequence. Categorizes urgency to
--              proactively minimize waste before expiration occurs.
-- ============================================================================
CREATE OR REPLACE VIEW `vw_expiring_batches_fefo` AS
SELECT 
    b.id AS batch_id,
    i.id AS ingredient_id,
    i.name AS ingredient_name,
    b.batch_number,
    b.quantity_remaining,
    u.abbreviation AS unit,
    b.unit_cost,
    ROUND(b.quantity_remaining * b.unit_cost, 2) AS remaining_batch_value,
    b.received_date,
    b.expiry_date,
    DATEDIFF(b.expiry_date, CURRENT_DATE()) AS days_until_expiry,
    CASE 
        WHEN b.expiry_date < CURRENT_DATE() THEN 'EXPIRED'
        WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 3 THEN 'CRITICAL (<= 3 Days)'
        WHEN DATEDIFF(b.expiry_date, CURRENT_DATE()) <= 7 THEN 'WARNING (<= 7 Days)'
        ELSE 'GOOD'
    END AS urgency_status
FROM `inventory_batches` b
JOIN `ingredients` i 
    ON b.ingredient_id = i.id
JOIN `units_of_measure` u 
    ON i.unit_id = u.id
WHERE 
    b.status = 'ACTIVE' 
    AND b.quantity_remaining > 0
ORDER BY 
    b.expiry_date ASC, 
    b.quantity_remaining ASC;


-- ============================================================================
-- VIEW 3: vw_recipe_costs
-- Description: Calculates theoretical food production cost, gross margin,
--              and food cost percentage per recipe serving.
-- Costing Assumption:
--   Costing is calculated on a standard reference cost basis using
--   `ingredients.cost_per_unit`. For each ingredient in the Bill of Materials
--   (`recipe_ingredients`), the required quantity is adjusted for expected
--   preparation wastage (`1 + wastage_allowance_percent / 100.0`), normalized
--   to the ingredient base unit via `(ri_uom.conversion_factor / ing_uom.conversion_factor)`,
--   multiplied by the unit cost, and divided by `recipes.yield_servings`.
-- ============================================================================
CREATE OR REPLACE VIEW `vw_recipe_costs` AS
SELECT 
    m.id AS menu_item_id,
    m.name AS menu_item_name,
    r.id AS recipe_id,
    r.yield_servings,
    m.selling_price,
    ROUND(
        SUM(
            (ri.quantity_required * (1.0 + (ri.wastage_allowance_percent / 100.0))) 
            * (ri_uom.conversion_factor / ing_uom.conversion_factor) 
            * ing.cost_per_unit
        ) / r.yield_servings,
        2
    ) AS ingredient_cost_per_serving,
    ROUND(
        m.selling_price - (
            SUM(
                (ri.quantity_required * (1.0 + (ri.wastage_allowance_percent / 100.0))) 
                * (ri_uom.conversion_factor / ing_uom.conversion_factor) 
                * ing.cost_per_unit
            ) / r.yield_servings
        ),
        2
    ) AS gross_profit_per_serving,
    CASE 
        WHEN m.selling_price > 0 THEN
            ROUND(
                (
                    (
                        SUM(
                            (ri.quantity_required * (1.0 + (ri.wastage_allowance_percent / 100.0))) 
                            * (ri_uom.conversion_factor / ing_uom.conversion_factor) 
                            * ing.cost_per_unit
                        ) / r.yield_servings
                    ) / m.selling_price
                ) * 100.0,
                2
            )
        ELSE 0.00
    END AS food_cost_percentage
FROM `menu_items` m
JOIN `recipes` r 
    ON r.menu_item_id = m.id
JOIN `recipe_ingredients` ri 
    ON ri.recipe_id = r.id
JOIN `ingredients` ing 
    ON ing.id = ri.ingredient_id
JOIN `units_of_measure` ri_uom 
    ON ri_uom.id = ri.unit_id
JOIN `units_of_measure` ing_uom 
    ON ing_uom.id = ing.unit_id
GROUP BY 
    m.id, 
    m.name, 
    m.selling_price, 
    r.id, 
    r.yield_servings;


-- ============================================================================
-- VIEW 4: vw_waste_analytics
-- Description: Aggregates food loss metrics grouped by month and root cause
--              (spoilage, expiration, overcooking, prep scrap).
-- ============================================================================
CREATE OR REPLACE VIEW `vw_waste_analytics` AS
SELECT 
    DATE_FORMAT(w.logged_at, '%Y-%m') AS waste_month,
    w.waste_reason,
    COUNT(w.id) AS total_incidents,
    ROUND(SUM(w.quantity_wasted), 3) AS total_quantity_wasted,
    ROUND(SUM(w.financial_loss), 2) AS total_financial_loss,
    ROUND(AVG(w.financial_loss), 2) AS avg_financial_loss_per_event
FROM `waste_records` w
GROUP BY 
    DATE_FORMAT(w.logged_at, '%Y-%m'), 
    w.waste_reason
ORDER BY 
    waste_month DESC, 
    total_financial_loss DESC;


-- ============================================================================
-- VIEW 5: vw_daily_sales
-- Description: Summarizes sales transactions by day for completed orders.
-- Prevents duplicate aggregation: Aggregates directly on orders table
--                                 without joining child line items/payments.
-- ============================================================================
CREATE OR REPLACE VIEW `vw_daily_sales` AS
SELECT 
    DATE(o.order_date) AS sales_date,
    COUNT(o.id) AS total_completed_orders,
    ROUND(SUM(o.subtotal), 2) AS total_subtotal,
    ROUND(SUM(o.tax_amount), 2) AS total_tax_collected,
    ROUND(SUM(o.discount_amount), 2) AS total_discounts_granted,
    ROUND(SUM(o.total_amount), 2) AS total_revenue,
    ROUND(AVG(o.total_amount), 2) AS average_order_value,
    ROUND(MIN(o.total_amount), 2) AS min_order_value,
    ROUND(MAX(o.total_amount), 2) AS max_order_value
FROM `orders` o
WHERE 
    o.status = 'COMPLETED'
GROUP BY 
    DATE(o.order_date)
ORDER BY 
    sales_date DESC;
