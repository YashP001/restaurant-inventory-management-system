# Database Architecture & Relational Schema v1.0

This directory contains schemas, migrations, seed data, and connection utilities for the **Restaurant & Food Inventory Management System with Demand Prediction and Food Waste Reduction**.

---

## 1. Dual-Database Strategy & Separation of Concerns

- **MySQL 8 (`restaurant_inventory_db`):** Primary relational database and authoritative source of truth for all transactional domain entities (Users, Menu, Recipes/BOM, Stock Batches, Dining, Orders, Suppliers, and Food Waste).
- **MongoDB Atlas (`restaurant_inventory_logs`):** Dedicated operational NoSQL store for unstructured, high-velocity records (system audit logs, user activity history, notifications, and machine learning prediction execution runs).

> **Architectural Rule:** Authoritative transactional entities exist strictly in MySQL. Operational telemetry exists in MongoDB. No duplicate business data across databases.

---

## 2. MySQL Schema v1.0 Overview (21 Tables)

The relational schema is implemented in [01_schema_v1.sql](file:///e:/Inventory%20Management%20System%20Project/database/mysql/01_schema_v1.sql) using the **InnoDB** storage engine with `utf8mb4` character set and `utf8mb4_unicode_ci` collation.

### Domain 1: Authentication & Access Control
1. **`roles`**: System role definitions (`ADMIN`, `CHEF`, `INVENTORY_MANAGER`, `CASHIER`).
   - PK: `id` | Unique: `name`
2. **`users`**: Staff accounts, credentials, contact information, and active status.
   - PK: `id` | Unique: `username`, `email`
   - FK: `role_id -> roles(id)` (ON DELETE RESTRICT)

### Domain 2: Menu, Recipes & Bill of Materials (BOM)
3. **`categories`**: Menu hierarchy classifications (Appetizers, Mains, Beverages, Desserts).
   - PK: `id` | Unique: `name`
4. **`units_of_measure`**: Standard measurement units with recursive base-unit conversion factors.
   - PK: `id` | Unique: `name`, `abbreviation`
   - FK: `base_unit_id -> units_of_measure(id)` (ON DELETE RESTRICT)
   - CHECK: `conversion_factor > 0`
5. **`ingredients`**: Master list of raw ingredients, standard units, safety reorder thresholds, and par levels.
   - PK: `id` | Unique: `name`
   - FK: `unit_id -> units_of_measure(id)` (ON DELETE RESTRICT)
   - CHECK: `minimum_stock_level >= 0`, `optimal_par_level >= minimum_stock_level`, `cost_per_unit >= 0`
6. **`menu_items`**: Sellable dishes, selling prices, preparation times, and category links.
   - PK: `id` | Unique: `name`
   - FK: `category_id -> categories(id)` (ON DELETE RESTRICT)
   - CHECK: `selling_price >= 0`, `preparation_time_mins >= 0`
7. **`recipes`**: Preparation metadata and serving yields per menu item.
   - PK: `id` | Unique: `menu_item_id` (1:1 with `menu_items`)
   - FK: `menu_item_id -> menu_items(id)` (ON DELETE CASCADE)
   - CHECK: `yield_servings >= 1`
8. **`recipe_ingredients`**: Bill of Materials (BOM) junction mapping required ingredient quantities per recipe.
   - PK: `id` | Unique: `(recipe_id, ingredient_id)`
   - FK: `recipe_id -> recipes(id)` (ON DELETE CASCADE)
   - FK: `ingredient_id -> ingredients(id)` (ON DELETE RESTRICT)
   - FK: `unit_id -> units_of_measure(id)` (ON DELETE RESTRICT)
   - CHECK: `quantity_required > 0`, `wastage_allowance_percent >= 0 AND < 100`

### Domain 3: Inventory Batches & Stock Movements (FEFO)
9. **`inventory_batches`**: Physical delivery lots tracking batch numbers, purchase costs, remaining quantities, and expiration dates.
   - PK: `id` | Unique: `(ingredient_id, batch_number)`
   - FK: `ingredient_id -> ingredients(id)` (ON DELETE RESTRICT)
   - CHECK: `quantity_received >= 0`, `quantity_remaining >= 0`, `quantity_remaining <= quantity_received`, `expiry_date >= received_date`, `unit_cost >= 0`
   - INDEX: `idx_batch_fefo` (`ingredient_id`, `status`, `expiry_date`, `quantity_remaining`)
10. **`stock_movements`**: Immutable inventory ledger recording all physical stock additions, deductions, waste disposals, and adjustments.
    - PK: `id`
    - FK: `batch_id -> inventory_batches(id)` (ON DELETE RESTRICT)
    - FK: `created_by_user_id -> users(id)` (ON DELETE SET NULL)
    - CHECK: `quantity > 0`, `balance_after >= 0`

### Domain 4: Dining, Orders & Point of Sale (POS)
11. **`dining_tables`**: Physical restaurant floor tables and seating capacities.
    - PK: `id` | Unique: `table_number`
    - CHECK: `seating_capacity >= 1`
12. **`orders`**: Dining tickets, order types (`DINE_IN`, `TAKEAWAY`, `ONLINE`), status progression, and financial totals.
    - PK: `id` | Unique: `order_number`
    - FK: `table_id -> dining_tables(id)` (ON DELETE SET NULL)
    - FK: `user_id -> users(id)` (ON DELETE SET NULL)
    - CHECK: `subtotal >= 0`, `tax_amount >= 0`, `discount_amount >= 0`, `total_amount >= 0`
13. **`order_items`**: Line items per order freezing historical selling prices at time of order.
    - PK: `id`
    - FK: `order_id -> orders(id)` (ON DELETE CASCADE)
    - FK: `menu_item_id -> menu_items(id)` (ON DELETE RESTRICT)
    - CHECK: `quantity >= 1`, `unit_price >= 0`, `subtotal >= 0`
14. **`payments`**: Payment transactions, tender types, and settlement statuses.
    - PK: `id`
    - FK: `order_id -> orders(id)` (ON DELETE RESTRICT)
    - CHECK: `amount_paid >= 0`
15. **`order_ingredient_consumptions`**: Traceability ledger linking each ordered dish item to the exact inventory batch and quantity deducted.
    - PK: `id`
    - FK: `order_item_id -> order_items(id)` (ON DELETE CASCADE)
    - FK: `batch_id -> inventory_batches(id)` (ON DELETE RESTRICT)
    - FK: `ingredient_id -> ingredients(id)` (ON DELETE RESTRICT)
    - CHECK: `quantity_consumed > 0`, `unit_cost_at_consumption >= 0`, `total_cost >= 0`

### Domain 5: Suppliers & Procurement
16. **`suppliers`**: Vendor profiles, contact details, payment terms, and delivery lead times.
    - PK: `id` | Unique: `name`, `email`
    - CHECK: `lead_time_days >= 0`
17. **`supplier_ingredients`**: Multi-supplier catalog defining contractual pricing and minimum order quantities per ingredient.
    - PK: `id` | Unique: `(supplier_id, ingredient_id)`
    - FK: `supplier_id -> suppliers(id)` (ON DELETE CASCADE)
    - FK: `ingredient_id -> ingredients(id)` (ON DELETE RESTRICT)
    - CHECK: `contract_unit_cost >= 0`, `minimum_order_quantity > 0`
18. **`purchase_orders`**: Procurement orders tracking delivery scheduling and status lifecycle.
    - PK: `id` | Unique: `po_number`
    - FK: `supplier_id -> suppliers(id)` (ON DELETE RESTRICT)
    - FK: `created_by_user_id -> users(id)` (ON DELETE SET NULL)
    - CHECK: `total_amount >= 0`, `expected_delivery_date >= order_date`
19. **`purchase_order_items`**: Purchase order line items freezing contractual unit cost at time of order.
    - PK: `id`
    - FK: `purchase_order_id -> purchase_orders(id)` (ON DELETE CASCADE)
    - FK: `ingredient_id -> ingredients(id)` (ON DELETE RESTRICT)
    - CHECK: `quantity_ordered > 0`, `quantity_received >= 0`, `quantity_received <= quantity_ordered`, `unit_cost >= 0`, `subtotal >= 0`

### Domain 6: Food Waste Monitoring
20. **`waste_records`**: Food loss auditing logging wasted physical quantities, financial loss, root causes (`EXPIRED`, `SPOILED`, `PREPARATION_SCRAP`, `OVERCOOKED`), and responsible staff.
    - PK: `id`
    - FK: `batch_id -> inventory_batches(id)` (ON DELETE RESTRICT)
    - FK: `ingredient_id -> ingredients(id)` (ON DELETE RESTRICT)
    - FK: `menu_item_id -> menu_items(id)` (ON DELETE RESTRICT)
    - FK: `unit_id -> units_of_measure(id)` (ON DELETE RESTRICT)
    - FK: `logged_by_user_id -> users(id)` (ON DELETE SET NULL)
    - CHECK: `quantity_wasted > 0`, `financial_loss >= 0`

### Domain 7: Demand Forecasting Integration
21. **`demand_forecasts`**: Model output cache storing predicted demand per menu item or ingredient, confidence intervals, and comparison to actual consumption.
    - PK: `id` | Unique: `(forecast_date, target_type, target_id, model_version)`
    - CHECK: `predicted_quantity >= 0`, `confidence_lower_bound >= 0`, `confidence_upper_bound >= confidence_lower_bound`

---

## 3. How the Schema Satisfies Third Normal Form (3NF)

1. **First Normal Form (1NF):**
   - All attributes are atomic (no repeating groups, CSV lists, or JSON arrays in transactional columns).
   - Each column stores a single scalar value. Standardized units of measure are normalized via foreign keys rather than mixed string units.
   - Each table has a defined primary key (`id`).

2. **Second Normal Form (2NF):**
   - The schema is in 1NF.
   - All non-key attributes are fully functionally dependent on the entire primary key (no partial dependencies on composite keys).
   - All composite associations (`recipe_ingredients`, `supplier_ingredients`) isolate foreign keys into junction tables with dedicated surrogate PKs and unique candidate keys.

3. **Third Normal Form (3NF):**
   - The schema is in 2NF.
   - There are no transitive dependencies: non-key attributes depend only on the primary key, not on another non-key attribute.
   - **Historical Prices Frozen:** `order_items.unit_price` depends on the order item transaction, not transitively on `menu_items.selling_price` (which can change later).
   - **Supplier Costs Frozen:** `purchase_order_items.unit_cost` depends on the purchase order line item, not transitively on current `ingredients.cost_per_unit` or `supplier_ingredients.contract_unit_cost`.
   - **Batch Stock Isolated:** Inventory expiration dates and batch counts belong to `inventory_batches`, never transitively crammed into `ingredients`.

---

## 4. Execution & Verification Commands

To execute or re-apply the schema v1.0 script in Windows PowerShell:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p restaurant_inventory_db < "e:\Inventory Management System Project\database\mysql\01_schema_v1.sql"
```

To verify all 21 tables:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "USE restaurant_inventory_db; SHOW TABLES;"
```
