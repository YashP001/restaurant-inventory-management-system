-- ============================================================================
-- Urban Bites Restaurant & Food Inventory System
-- Seed File 3: Suppliers, Supplier Catalogs, Inventory Batches & Receipt Movements
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- ============================================================================

USE `restaurant_inventory_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. SUPPLIERS (6 Fictional Vendors)
-- ----------------------------------------------------------------------------
INSERT INTO `suppliers` (`id`, `name`, `contact_person`, `email`, `phone`, `address`, `lead_time_days`, `payment_terms`, `is_active`) VALUES
(1, 'FarmFresh Organics Pvt Ltd', 'Ramesh Patel', 'orders@farmfreshorganics.in', '+91 98330 11221', 'Plot 42, Vashi APMC Market, Navi Mumbai, MH', 1, 'Net 15', TRUE),
(2, 'MilkyWay Dairy Products Co', 'Suresh Deshmukh', 'sales@milkywaydairy.in', '+91 98330 22332', 'Survey 108, Anand Milk Corridor, Anand, GJ', 1, 'Net 30', TRUE),
(3, 'Royal Poultry & Meats Ltd', 'Farhan Qureshi', 'supply@royalpoultry.in', '+91 98330 33443', 'Gala 12, Deonar Abattoir Road, Mumbai, MH', 1, 'Cash on Delivery', TRUE),
(4, 'Golden Grain Flour Mills', 'Harpreet Singh', 'contact@goldengrain.in', '+91 98330 44554', 'Industrial Area Phase 2, Ludhiana, PB', 3, 'Net 30', TRUE),
(5, 'SpiceRoute Agro Traders', 'Meenakshi Iyer', 'orders@spicerouteagro.in', '+91 98330 55665', 'Wholesale Spice Yard, Mattancherry, Kochi, KL', 4, 'Net 30', TRUE),
(6, 'BakerBros Food Supplies Ltd', 'Nikhil Agarwal', 'info@bakerbros.in', '+91 98330 66776', 'Bhiwandi Logistics Hub, Thane, MH', 2, 'Net 15', TRUE)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ----------------------------------------------------------------------------
-- 2. SUPPLIER INGREDIENTS (Multi-Supplier Catalog Matrix)
-- ----------------------------------------------------------------------------
INSERT INTO `supplier_ingredients` (`supplier_id`, `ingredient_id`, `contract_unit_cost`, `minimum_order_quantity`, `is_preferred_supplier`) VALUES
-- FarmFresh Organics (Produce)
(1, 3, 33.50, 10.000, TRUE),   -- Tomatoes
(1, 4, 26.50, 10.000, TRUE),   -- Red Onions
(1, 5, 22.00, 20.000, TRUE),   -- Potatoes
(1, 8, 80.00, 5.000, TRUE),    -- Lettuce
(1, 17, 175.00, 2.000, TRUE),  -- Garlic
(1, 18, 135.00, 2.000, TRUE),  -- Ginger
(1, 21, 55.00, 2.000, TRUE),   -- Green Chillies
(1, 27, 52.00, 5.000, TRUE),   -- Capsicum

-- MilkyWay Dairy (Dairy & Cheese)
(2, 2, 410.00, 5.000, TRUE),   -- Mozzarella Cheese
(2, 7, 310.00, 5.000, TRUE),   -- Paneer
(2, 9, 62.00, 20.000, TRUE),   -- Milk
(2, 10, 470.00, 5.000, TRUE),  -- Butter
-- Backup Supplier for Dairy
(6, 2, 430.00, 5.000, FALSE),  -- Mozzarella Cheese from BakerBros

-- Royal Poultry & Meats
(3, 6, 250.00, 10.000, TRUE),  -- Chicken Breast
(3, 11, 6.00, 60.000, TRUE),   -- Eggs

-- Golden Grain Flour Mills (Dry Grains & Staple)
(4, 1, 40.00, 25.000, TRUE),   -- Flour
(4, 12, 42.00, 20.000, TRUE),  -- Sugar
(4, 13, 20.00, 10.000, TRUE),  -- Salt
(4, 14, 130.00, 20.000, TRUE), -- Oil
(4, 26, 300.00, 2.000, TRUE),  -- Yeast

-- SpiceRoute Agro Traders
(5, 19, 90.00, 10.000, TRUE),  -- Tomato Sauce Puree
(5, 20, 150.00, 5.000, TRUE),  -- Mayonnaise
(5, 22, 530.00, 2.000, TRUE),  -- Garam Masala
(5, 23, 720.00, 5.000, TRUE),  -- Coffee Beans
(5, 24, 360.00, 5.000, TRUE),  -- Tea Leaves
(5, 25, 600.00, 2.000, TRUE),  -- Cocoa Powder
-- Secondary Supplier for Spices & Sauces
(1, 19, 98.00, 5.000, FALSE),  -- Tomato Sauce from FarmFresh

-- BakerBros Food Supplies Ltd
(6, 15, 11.50, 40.000, TRUE),  -- Burger Buns
(6, 16, 24.00, 30.000, TRUE),  -- Pizza Base
(6, 28, 325.00, 5.000, TRUE),  -- Dark Chocolate
-- Secondary Supplier for Buns & Bases
(4, 15, 12.50, 40.000, FALSE), -- Burger Buns from Golden Grain
(4, 16, 26.00, 30.000, FALSE)  -- Pizza Base from Golden Grain
ON DUPLICATE KEY UPDATE `contract_unit_cost` = VALUES(`contract_unit_cost`);

-- ----------------------------------------------------------------------------
-- 3. INVENTORY BATCHES (48 Physical Batches across 28 Ingredients)
-- Reconciles 100% with historical consumptions and waste records
-- ----------------------------------------------------------------------------
INSERT INTO `inventory_batches` (`id`, `ingredient_id`, `batch_number`, `quantity_received`, `quantity_remaining`, `unit_cost`, `received_date`, `expiry_date`, `status`) VALUES
(1, 1, 'BATCH-FLOUR-001', 50.000, 36.453, 40.00, '2026-08-08', '2026-11-08', 'ACTIVE'),
(2, 1, 'BATCH-FLOUR-002', 120.000, 120.000, 41.00, '2026-09-20', '2027-01-20', 'ACTIVE'),
(3, 1, 'BATCH-FLOUR-003', 120.000, 120.000, 42.00, '2026-10-25', '2027-02-25', 'ACTIVE'),
(4, 2, 'BATCH-MOZZ-001', 15.000, 0.000, 410.00, '2026-08-15', '2026-09-15', 'DEPLETED'),
(5, 2, 'BATCH-MOZZ-002', 30.000, 24.502, 415.00, '2026-09-25', '2026-10-25', 'EXPIRED'),
(6, 2, 'BATCH-MOZZ-003', 35.000, 35.000, 420.00, '2026-10-20', '2026-11-05', 'ACTIVE'),
(7, 2, 'BATCH-MOZZ-004', 30.000, 30.000, 420.00, '2026-10-30', '2026-11-25', 'ACTIVE'),
(8, 3, 'BATCH-TOM-001', 25.000, 20.457, 32.00, '2026-08-10', '2026-08-25', 'EXPIRED'),
(9, 3, 'BATCH-TOM-002', 45.000, 45.000, 34.00, '2026-09-15', '2026-09-30', 'EXPIRED'),
(10, 3, 'BATCH-TOM-003', 45.000, 43.800, 35.00, '2026-10-26', '2026-11-04', 'ACTIVE'),
(11, 3, 'BATCH-TOM-004', 40.000, 40.000, 35.00, '2026-10-31', '2026-11-10', 'ACTIVE'),
(12, 4, 'BATCH-ONION-001', 30.000, 19.520, 25.00, '2026-08-10', '2026-09-20', 'EXPIRED'),
(13, 4, 'BATCH-ONION-002', 60.000, 60.000, 26.50, '2026-09-20', '2026-10-30', 'EXPIRED'),
(14, 4, 'BATCH-ONION-003', 60.000, 58.500, 28.00, '2026-10-24', '2026-11-25', 'ACTIVE'),
(15, 5, 'BATCH-POT-001', 50.000, 23.035, 22.00, '2026-08-05', '2026-09-15', 'EXPIRED'),
(16, 5, 'BATCH-POT-002', 100.000, 96.500, 23.00, '2026-09-15', '2026-10-25', 'EXPIRED'),
(17, 5, 'BATCH-POT-003', 150.000, 147.000, 24.00, '2026-10-24', '2026-12-05', 'ACTIVE'),
(18, 6, 'BATCH-CHKN-001', 20.000, 7.775, 245.00, '2026-08-15', '2026-08-25', 'EXPIRED'),
(19, 6, 'BATCH-CHKN-002', 35.000, 34.100, 250.00, '2026-09-20', '2026-09-30', 'EXPIRED'),
(20, 6, 'BATCH-CHKN-003', 35.000, 34.400, 260.00, '2026-10-28', '2026-11-04', 'ACTIVE'),
(21, 6, 'BATCH-CHKN-004', 30.000, 30.000, 260.00, '2026-10-31', '2026-11-08', 'ACTIVE'),
(22, 7, 'BATCH-PAN-001', 15.000, 4.618, 305.00, '2026-08-20', '2026-08-30', 'EXPIRED'),
(23, 7, 'BATCH-PAN-002', 30.000, 30.000, 310.00, '2026-09-22', '2026-10-02', 'EXPIRED'),
(24, 7, 'BATCH-PAN-003', 30.000, 29.500, 320.00, '2026-10-27', '2026-11-04', 'ACTIVE'),
(25, 7, 'BATCH-PAN-004', 30.000, 30.000, 320.00, '2026-10-31', '2026-11-10', 'ACTIVE'),
(26, 8, 'BATCH-LET-001', 10.000, 7.299, 75.00, '2026-09-10', '2026-09-20', 'EXPIRED'),
(27, 8, 'BATCH-LET-002', 12.000, 11.400, 85.00, '2026-10-28', '2026-11-04', 'ACTIVE'),
(28, 9, 'BATCH-MILK-001', 40.000, 17.294, 60.00, '2026-08-15', '2026-08-22', 'EXPIRED'),
(29, 9, 'BATCH-MILK-002', 80.000, 80.000, 62.00, '2026-09-20', '2026-09-27', 'EXPIRED'),
(30, 9, 'BATCH-MILK-003', 80.000, 78.000, 64.00, '2026-10-28', '2026-11-03', 'ACTIVE'),
(31, 9, 'BATCH-MILK-004', 80.000, 80.000, 64.00, '2026-10-31', '2026-11-06', 'ACTIVE'),
(32, 10, 'BATCH-BTR-001', 20.000, 16.288, 460.00, '2026-08-10', '2026-11-10', 'ACTIVE'),
(33, 10, 'BATCH-BTR-002', 30.000, 29.600, 480.00, '2026-10-15', '2027-01-15', 'ACTIVE'),
(34, 11, 'BATCH-EGG-001', 120.000, 112.000, 5.80, '2026-08-20', '2026-09-15', 'EXPIRED'),
(35, 11, 'BATCH-EGG-002', 300.000, 296.000, 6.50, '2026-10-20', '2026-11-18', 'ACTIVE'),
(36, 12, 'BATCH-SUG-001', 80.000, 71.860, 42.00, '2026-08-05', '2027-08-05', 'ACTIVE'),
(37, 13, 'BATCH-SLT-001', 40.000, 39.772, 20.00, '2026-08-05', '2027-08-05', 'ACTIVE'),
(38, 14, 'BATCH-OIL-001', 60.000, 54.919, 128.00, '2026-08-10', '2027-02-10', 'ACTIVE'),
(39, 14, 'BATCH-OIL-002', 150.000, 150.000, 135.00, '2026-10-18', '2027-04-18', 'ACTIVE'),
(40, 15, 'BATCH-BUN-001', 60.000, 0.000, 11.00, '2026-08-20', '2026-08-27', 'DEPLETED'),
(41, 15, 'BATCH-BUN-002', 140.000, 82.000, 11.50, '2026-09-25', '2026-10-02', 'EXPIRED'),
(42, 15, 'BATCH-BUN-003', 120.000, 116.000, 12.00, '2026-10-28', '2026-11-04', 'ACTIVE'),
(43, 16, 'BATCH-BASE-001', 50.000, 0.000, 23.00, '2026-08-20', '2026-08-28', 'DEPLETED'),
(44, 16, 'BATCH-BASE-002', 120.000, 60.000, 24.00, '2026-09-25', '2026-10-03', 'EXPIRED'),
(45, 16, 'BATCH-BASE-003', 100.000, 98.000, 25.00, '2026-10-28', '2026-11-04', 'ACTIVE'),
(46, 19, 'BATCH-PUR-001', 60.000, 49.776, 90.00, '2026-08-15', '2027-02-15', 'ACTIVE'),
(47, 27, 'BATCH-CAP-001', 40.000, 39.032, 52.00, '2026-10-27', '2026-11-05', 'ACTIVE'),
(48, 28, 'BATCH-CHOC-001', 30.000, 27.748, 325.00, '2026-09-01', '2027-03-01', 'ACTIVE')
ON DUPLICATE KEY UPDATE 
    `quantity_remaining` = VALUES(`quantity_remaining`),
    `status` = VALUES(`status`);

-- ----------------------------------------------------------------------------
-- 4. STOCK MOVEMENTS (Initial Receipt Movements for All Batches)
-- ----------------------------------------------------------------------------
INSERT INTO `stock_movements` (`id`, `batch_id`, `movement_type`, `quantity`, `balance_after`, `reference_id`, `notes`, `created_by_user_id`, `created_at`) VALUES
(1, 1, 'PURCHASE_RECEIPT', 50.000, 50.000, 'PO-REC-001', 'Initial lot receipt for BATCH-FLOUR-001', 2, '2026-08-08 08:00:00'),
(2, 2, 'PURCHASE_RECEIPT', 120.000, 120.000, 'PO-REC-002', 'Initial lot receipt for BATCH-FLOUR-002', 2, '2026-09-20 08:00:00'),
(3, 3, 'PURCHASE_RECEIPT', 120.000, 120.000, 'PO-REC-003', 'Initial lot receipt for BATCH-FLOUR-003', 2, '2026-10-25 08:00:00'),
(4, 4, 'PURCHASE_RECEIPT', 15.000, 15.000, 'PO-REC-004', 'Initial lot receipt for BATCH-MOZZ-001', 2, '2026-08-15 08:00:00'),
(5, 5, 'PURCHASE_RECEIPT', 30.000, 30.000, 'PO-REC-005', 'Initial lot receipt for BATCH-MOZZ-002', 2, '2026-09-25 08:00:00'),
(6, 6, 'PURCHASE_RECEIPT', 35.000, 35.000, 'PO-REC-006', 'Initial lot receipt for BATCH-MOZZ-003', 2, '2026-10-20 08:00:00'),
(7, 7, 'PURCHASE_RECEIPT', 30.000, 30.000, 'PO-REC-007', 'Initial lot receipt for BATCH-MOZZ-004', 2, '2026-10-30 08:00:00'),
(8, 8, 'PURCHASE_RECEIPT', 25.000, 25.000, 'PO-REC-008', 'Initial lot receipt for BATCH-TOM-001', 2, '2026-08-10 08:00:00'),
(9, 9, 'PURCHASE_RECEIPT', 45.000, 45.000, 'PO-REC-009', 'Initial lot receipt for BATCH-TOM-002', 2, '2026-09-15 08:00:00'),
(10, 10, 'PURCHASE_RECEIPT', 45.000, 45.000, 'PO-REC-010', 'Initial lot receipt for BATCH-TOM-003', 2, '2026-10-26 08:00:00'),
(11, 11, 'PURCHASE_RECEIPT', 40.000, 40.000, 'PO-REC-011', 'Initial lot receipt for BATCH-TOM-004', 2, '2026-10-31 08:00:00'),
(12, 12, 'PURCHASE_RECEIPT', 30.000, 30.000, 'PO-REC-012', 'Initial lot receipt for BATCH-ONION-001', 2, '2026-08-10 08:00:00'),
(13, 13, 'PURCHASE_RECEIPT', 60.000, 60.000, 'PO-REC-013', 'Initial lot receipt for BATCH-ONION-002', 2, '2026-09-20 08:00:00'),
(14, 14, 'PURCHASE_RECEIPT', 60.000, 60.000, 'PO-REC-014', 'Initial lot receipt for BATCH-ONION-003', 2, '2026-10-24 08:00:00'),
(15, 15, 'PURCHASE_RECEIPT', 50.000, 50.000, 'PO-REC-015', 'Initial lot receipt for BATCH-POT-001', 2, '2026-08-05 08:00:00'),
(16, 16, 'PURCHASE_RECEIPT', 100.000, 100.000, 'PO-REC-016', 'Initial lot receipt for BATCH-POT-002', 2, '2026-09-15 08:00:00'),
(17, 17, 'PURCHASE_RECEIPT', 150.000, 150.000, 'PO-REC-017', 'Initial lot receipt for BATCH-POT-003', 2, '2026-10-24 08:00:00'),
(18, 18, 'PURCHASE_RECEIPT', 20.000, 20.000, 'PO-REC-018', 'Initial lot receipt for BATCH-CHKN-001', 2, '2026-08-15 08:00:00'),
(19, 19, 'PURCHASE_RECEIPT', 35.000, 35.000, 'PO-REC-019', 'Initial lot receipt for BATCH-CHKN-002', 2, '2026-09-20 08:00:00'),
(20, 20, 'PURCHASE_RECEIPT', 35.000, 35.000, 'PO-REC-020', 'Initial lot receipt for BATCH-CHKN-003', 2, '2026-10-28 08:00:00'),
(21, 21, 'PURCHASE_RECEIPT', 30.000, 30.000, 'PO-REC-021', 'Initial lot receipt for BATCH-CHKN-004', 2, '2026-10-31 08:00:00'),
(22, 22, 'PURCHASE_RECEIPT', 15.000, 15.000, 'PO-REC-022', 'Initial lot receipt for BATCH-PAN-001', 2, '2026-08-20 08:00:00'),
(23, 23, 'PURCHASE_RECEIPT', 30.000, 30.000, 'PO-REC-023', 'Initial lot receipt for BATCH-PAN-002', 2, '2026-09-22 08:00:00'),
(24, 24, 'PURCHASE_RECEIPT', 30.000, 30.000, 'PO-REC-024', 'Initial lot receipt for BATCH-PAN-003', 2, '2026-10-27 08:00:00'),
(25, 25, 'PURCHASE_RECEIPT', 30.000, 30.000, 'PO-REC-025', 'Initial lot receipt for BATCH-PAN-004', 2, '2026-10-31 08:00:00'),
(26, 26, 'PURCHASE_RECEIPT', 10.000, 10.000, 'PO-REC-026', 'Initial lot receipt for BATCH-LET-001', 2, '2026-09-10 08:00:00'),
(27, 27, 'PURCHASE_RECEIPT', 12.000, 12.000, 'PO-REC-027', 'Initial lot receipt for BATCH-LET-002', 2, '2026-10-28 08:00:00'),
(28, 28, 'PURCHASE_RECEIPT', 40.000, 40.000, 'PO-REC-028', 'Initial lot receipt for BATCH-MILK-001', 2, '2026-08-15 08:00:00'),
(29, 29, 'PURCHASE_RECEIPT', 80.000, 80.000, 'PO-REC-029', 'Initial lot receipt for BATCH-MILK-002', 2, '2026-09-20 08:00:00'),
(30, 30, 'PURCHASE_RECEIPT', 80.000, 80.000, 'PO-REC-030', 'Initial lot receipt for BATCH-MILK-003', 2, '2026-10-28 08:00:00'),
(31, 31, 'PURCHASE_RECEIPT', 80.000, 80.000, 'PO-REC-031', 'Initial lot receipt for BATCH-MILK-004', 2, '2026-10-31 08:00:00'),
(32, 32, 'PURCHASE_RECEIPT', 20.000, 20.000, 'PO-REC-032', 'Initial lot receipt for BATCH-BTR-001', 2, '2026-08-10 08:00:00'),
(33, 33, 'PURCHASE_RECEIPT', 30.000, 30.000, 'PO-REC-033', 'Initial lot receipt for BATCH-BTR-002', 2, '2026-10-15 08:00:00'),
(34, 34, 'PURCHASE_RECEIPT', 120.000, 120.000, 'PO-REC-034', 'Initial lot receipt for BATCH-EGG-001', 2, '2026-08-20 08:00:00'),
(35, 35, 'PURCHASE_RECEIPT', 300.000, 300.000, 'PO-REC-035', 'Initial lot receipt for BATCH-EGG-002', 2, '2026-10-20 08:00:00'),
(36, 36, 'PURCHASE_RECEIPT', 80.000, 80.000, 'PO-REC-036', 'Initial lot receipt for BATCH-SUG-001', 2, '2026-08-05 08:00:00'),
(37, 37, 'PURCHASE_RECEIPT', 40.000, 40.000, 'PO-REC-037', 'Initial lot receipt for BATCH-SLT-001', 2, '2026-08-05 08:00:00'),
(38, 38, 'PURCHASE_RECEIPT', 60.000, 60.000, 'PO-REC-038', 'Initial lot receipt for BATCH-OIL-001', 2, '2026-08-10 08:00:00'),
(39, 39, 'PURCHASE_RECEIPT', 150.000, 150.000, 'PO-REC-039', 'Initial lot receipt for BATCH-OIL-002', 2, '2026-10-18 08:00:00'),
(40, 40, 'PURCHASE_RECEIPT', 60.000, 60.000, 'PO-REC-040', 'Initial lot receipt for BATCH-BUN-001', 2, '2026-08-20 08:00:00'),
(41, 41, 'PURCHASE_RECEIPT', 140.000, 140.000, 'PO-REC-041', 'Initial lot receipt for BATCH-BUN-002', 2, '2026-09-25 08:00:00'),
(42, 42, 'PURCHASE_RECEIPT', 120.000, 120.000, 'PO-REC-042', 'Initial lot receipt for BATCH-BUN-003', 2, '2026-10-28 08:00:00'),
(43, 43, 'PURCHASE_RECEIPT', 50.000, 50.000, 'PO-REC-043', 'Initial lot receipt for BATCH-BASE-001', 2, '2026-08-20 08:00:00'),
(44, 44, 'PURCHASE_RECEIPT', 120.000, 120.000, 'PO-REC-044', 'Initial lot receipt for BATCH-BASE-002', 2, '2026-09-25 08:00:00'),
(45, 45, 'PURCHASE_RECEIPT', 100.000, 100.000, 'PO-REC-045', 'Initial lot receipt for BATCH-BASE-003', 2, '2026-10-28 08:00:00'),
(46, 46, 'PURCHASE_RECEIPT', 60.000, 60.000, 'PO-REC-046', 'Initial lot receipt for BATCH-PUR-001', 2, '2026-08-15 08:00:00'),
(47, 47, 'PURCHASE_RECEIPT', 40.000, 40.000, 'PO-REC-047', 'Initial lot receipt for BATCH-CAP-001', 2, '2026-10-27 08:00:00'),
(48, 48, 'PURCHASE_RECEIPT', 30.000, 30.000, 'PO-REC-048', 'Initial lot receipt for BATCH-CHOC-001', 2, '2026-09-01 08:00:00')
ON DUPLICATE KEY UPDATE `quantity` = VALUES(`quantity`);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Seed File 3 (Suppliers, Catalogs, Batches & Receipts) loaded successfully.' AS status;
