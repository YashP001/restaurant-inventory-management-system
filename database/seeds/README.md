# Database Seeds: Urban Bites Fictional Restaurant

This directory contains deterministic, production-grade seed datasets for **Urban Bites**, an artisanal multi-cuisine restaurant specializing in gourmet burgers, stone-baked pizzas, classic appetizers, handcrafted beverages, and desserts.

The dataset adheres strictly to 3NF relational modeling, MySQL 8 InnoDB constraints, strict foreign key references, and 100% mathematical reconciliation between inventory batches, stock movements, historical orders, ingredient consumptions, and waste records.

---

## Seed Script Inventory & Execution Sequence

Execute the SQL seed scripts sequentially in their numerical dependency order:

```bash
# 1. Reference Data: Roles, Staff Users (bcrypt hashed), Metric Units, Dining Tables
mysql -u root -p restaurant_inventory_db < database/seeds/01_reference_data.sql

# 2. Menu & Recipes: Food Categories, Master Ingredients, Dishes, Recipes, BOM
mysql -u root -p restaurant_inventory_db < database/seeds/02_menu_and_recipes.sql

# 3. Suppliers & Inventory: Suppliers, Multi-supplier Catalog, Physical Batches, Receipt Movements
mysql -u root -p restaurant_inventory_db < database/seeds/03_suppliers_and_inventory.sql

# 4. Transactions: Purchase Orders, Historical Dining Orders, Payments, Ingredient Consumptions
mysql -u root -p restaurant_inventory_db < database/seeds/04_historical_transactions.sql

# 5. Waste & Forecasting: Waste Incidents, Waste Disposal Movements, Demand Predictions
mysql -u root -p restaurant_inventory_db < database/seeds/05_waste_and_forecasts.sql
```

Alternatively, to regenerate the deterministic data files programmatically:
```bash
node database/seeds/generate_seeds.js
```

---

## Seed Dataset Overview

| File | Contents | Tables Populated |
| :--- | :--- | :--- |
| `01_reference_data.sql` | 4 Roles, 10 Fictional Staff, 6 Units of Measure with conversion factors, 12 Dining Tables | `roles`, `users`, `units_of_measure`, `dining_tables` |
| `02_menu_and_recipes.sql` | 5 Categories, 28 Raw Ingredients, 15 Menu Dishes (INR), 15 Recipes with Bill of Materials (BOM) | `categories`, `ingredients`, `menu_items`, `recipes`, `recipe_ingredients` |
| `03_suppliers_and_inventory.sql` | 6 Suppliers, 30 Supplier Catalog Mappings, 48 Physical Inventory Batches, 48 Purchase Receipt Movements | `suppliers`, `supplier_ingredients`, `inventory_batches`, `stock_movements` |
| `04_historical_transactions.sql` | 18 Purchase Orders, 45 PO Items, 250 Orders over 90 Days, 480 Order Items, 235 Payments, ~1517 Consumptions & Movements | `purchase_orders`, `purchase_order_items`, `orders`, `order_items`, `payments`, `order_ingredient_consumptions`, `stock_movements` |
| `05_waste_and_forecasts.sql` | 35 Food Waste Events, 28 Waste Disposal Stock Movements, 24 ML Demand Forecast Records | `waste_records`, `stock_movements`, `demand_forecasts` |

---

## Business Rules & Integrity Verification

1. **Security & Passwords:**
   - No plaintext passwords exist in the database.
   - All 10 staff accounts use bcrypt password hashes (`$2a$12$...`) with cost factor 12. Default testing staff password is `UrbanBites@2026`.
2. **Order & Payment Reconciliation:**
   - Completed orders have matching payment records with status `SUCCESSFUL`.
   - Cancelled orders have zero rows in `order_ingredient_consumptions`.
   - Refunded orders are recorded with `REFUNDED` status where applicable.
3. **Exact Inventory Reconciliation:**
   - Every physical batch adheres strictly to the ledger equation:
     $$\text{quantity\_received} - \sum(\text{ORDER\_CONSUMPTION}) - \sum(\text{WASTE\_DISPOSAL}) = \text{quantity\_remaining} \ge 0$$
   - Every stock movement maintains an exact running `balance_after` matching physical inventory.
   - Zero negative inventory exists anywhere in the system.
4. **FEFO & Low Stock Visibility:**
   - Active batches with shelf life $\le 3$ days are tagged as `CRITICAL (<= 3 Days)` in `vw_expiring_batches_fefo`.
   - Depleted batches have remaining quantity = 0 and status `DEPLETED`.
   - Expired batches with remaining shelf life past current date are marked `EXPIRED`.
   - Ingredients whose total active unexpired stock falls below `minimum_stock_level` are accurately flagged as `LOW STOCK` in `vw_current_stock`.
5. **Demand Predictions:**
   - Demonstration machine learning predictions are recorded with `model_version` (`v1.0.0-baseline` and `v1.2.0-lstm`) and confidence intervals.
   - Historical evaluated predictions record both predicted and actual observed quantities.
