# Dual-Database Strategy & Schema Boundaries

## 1. Relational Database: MySQL 8 (`restaurant_inventory_db`)
MySQL is the primary, authoritative source of truth for transactional data. All financial, stock, and customer-facing operations are bound by relational integrity and ACID constraints.

### Core Domain Models (Scheduled for Phase 1 DDL):
- **User & Access Management:** `users`, `roles`, `permissions`
- **Menu & Bill of Materials:** `menu_categories`, `menu_items`, `recipes`, `recipe_ingredients`, `units_of_measure`
- **Orders & POS:** `dining_tables`, `orders`, `order_items`, `payments`
- **Suppliers & Procurement:** `suppliers`, `purchase_orders`, `purchase_order_items`
- **Inventory & Batches:** `inventory_items`, `inventory_batches`, `stock_movements`, `waste_records`

---

## 2. NoSQL Database: MongoDB (`restaurant_inventory_logs`)
MongoDB is designated exclusively for high-volume, flexible operational records, system audit trails, and inference runs.

### Operational Collections:
1. **`audit_logs`**:
   - `timestamp`: Date
   - `actor_id`: MySQL user ID reference
   - `action`: e.g. "PRICE_MODIFIED", "STOCK_ADJUSTMENT"
   - `ip_address`: String
   - `previous_state`: JSON Object
   - `new_state`: JSON Object

2. **`activity_history`**:
   - Session telemetry, page visits, and operational timestamps.

3. **`notifications`**:
   - Alert dispatches, low-stock threshold warnings, expiry flags.

4. **`prediction_runs`**:
   - Model run timestamp, algorithm parameters, input historical range, output forecasts.

---

## 3. Strict Boundary Rules
- **No Entity Duplication:** Do not create duplicate tables or collections for the same domain entity across both databases.
- **Relational Integrity First:** Transactions involving money or inventory counts must always complete in MySQL.
- **Asynchronous Telemetry:** MongoDB audit writes must not block transactional MySQL operations.
