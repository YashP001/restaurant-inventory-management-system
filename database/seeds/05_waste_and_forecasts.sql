-- ============================================================================
-- Urban Bites Restaurant & Food Inventory System
-- Seed File 5: Food Waste Records, Waste Movements & Demand Forecasts
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- Records: 35 Waste Events across 6 reasons, 28 Waste Movements, 24 Forecasts
-- ============================================================================

USE `restaurant_inventory_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. WASTE RECORDS (35 Realistic Food Loss Events)
-- ----------------------------------------------------------------------------
INSERT INTO `waste_records` (`id`, `batch_id`, `ingredient_id`, `menu_item_id`, `quantity_wasted`, `unit_id`, `waste_reason`, `financial_loss`, `logged_by_user_id`, `notes`, `logged_at`) VALUES
(1, 4, 2, NULL, 1.500, 1, 'EXPIRED', 615.00, 3, 'Expired Mozzarella lot scrap', '2026-09-16 10:00:00'),
(2, 5, 2, NULL, 0.800, 1, 'SPOILED', 332.00, 4, 'Refrigeration temperature spike', '2026-10-08 09:30:00'),
(3, 15, 5, NULL, 4.000, 1, 'SPOILED', 88.00, 9, 'Sprouted soft potatoes sorted out', '2026-08-22 11:00:00'),
(4, 16, 5, 1, 3.500, 1, 'PREPARATION_SCRAP', 80.50, 3, 'Potato peeling and trimming scrap', '2026-10-18 15:00:00'),
(5, 18, 6, NULL, 1.200, 1, 'STORAGE_CONTAMINATION', 294.00, 3, 'Punctured vacuum bag in storage', '2026-08-20 08:30:00'),
(6, 22, 7, NULL, 0.800, 1, 'EXPIRED', 244.00, 4, 'Paneer block past best-before', '2026-08-29 09:00:00'),
(7, 28, 9, NULL, 3.000, 3, 'SPOILED', 180.00, 9, 'Milk curdled in ambient morning heat', '2026-08-21 14:00:00'),
(8, NULL, NULL, 8, 1.000, 5, 'OVERCOOKED', 104.00, 4, 'Crust scorched in stone oven hot pocket', '2026-09-12 19:30:00'),
(9, NULL, NULL, 10, 1.000, 5, 'CUSTOMER_RETURN', 152.00, 3, 'Customer ordered mild, served tandoori spicy', '2026-09-25 21:00:00'),
(10, 40, 15, NULL, 6.000, 5, 'EXPIRED', 66.00, 4, 'Burger buns dried and stale', '2026-08-26 10:00:00'),
(11, 43, 16, NULL, 5.000, 5, 'EXPIRED', 115.00, 3, 'Pizza bases past shelf life', '2026-08-27 10:00:00'),
(12, 8, 3, NULL, 1.800, 1, 'SPOILED', 57.60, 9, 'Bruised soft overripe tomatoes', '2026-08-24 08:30:00'),
(13, 12, 4, NULL, 2.200, 1, 'PREPARATION_SCRAP', 55.00, 4, 'Onion skin and end peelings', '2026-08-28 16:00:00'),
(14, 26, 8, NULL, 1.000, 1, 'SPOILED', 75.00, 3, 'Wilting outer lettuce leaves', '2026-09-18 09:00:00'),
(15, 34, 11, NULL, 8.000, 5, 'SPOILED', 46.40, 9, 'Cracked eggs during crate transfer', '2026-08-25 11:30:00'),
(16, 19, 6, NULL, 0.900, 1, 'PREPARATION_SCRAP', 225.00, 3, 'Chicken fat and tendon trimmings', '2026-09-28 11:00:00'),
(17, NULL, NULL, 14, 1.000, 5, 'OVERCOOKED', 60.00, 4, 'Brownie edges overbaked and dry', '2026-09-22 17:00:00'),
(18, 46, 19, NULL, 1.000, 1, 'STORAGE_CONTAMINATION', 90.00, 4, 'Puree can dented with broken seal', '2026-09-15 14:00:00'),
(19, 47, 27, NULL, 0.800, 1, 'PREPARATION_SCRAP', 41.60, 9, 'Capsicum seeds and core scrap', '2026-10-29 15:30:00'),
(20, 1, 1, NULL, 2.000, 1, 'STORAGE_CONTAMINATION', 80.00, 3, 'Flour sack corner tear during shelf move', '2026-08-30 11:30:00'),
(21, 17, 5, NULL, 3.000, 1, 'PREPARATION_SCRAP', 72.00, 4, 'Scrap from french fry batoning', '2026-10-28 10:00:00'),
(22, 20, 6, NULL, 0.600, 1, 'PREPARATION_SCRAP', 156.00, 3, 'Chicken trimmings from tikka prep', '2026-10-30 11:00:00'),
(23, 24, 7, NULL, 0.500, 1, 'PREPARATION_SCRAP', 160.00, 4, 'Paneer block trimming edges', '2026-10-29 10:30:00'),
(24, 30, 9, NULL, 2.000, 3, 'SPOILED', 128.00, 9, 'Leftover warmed milk at shift close', '2026-10-31 23:00:00'),
(25, NULL, NULL, 5, 1.000, 5, 'CUSTOMER_RETURN', 52.00, 4, 'Customer asked for no onions', '2026-10-28 13:30:00'),
(26, 42, 15, NULL, 4.000, 5, 'PREPARATION_SCRAP', 48.00, 9, 'Crushed buns during bag opening', '2026-10-31 12:00:00'),
(27, 45, 16, NULL, 2.000, 5, 'PREPARATION_SCRAP', 50.00, 3, 'Torn pizza dough during stretching', '2026-10-30 19:00:00'),
(28, 33, 10, NULL, 0.400, 1, 'PREPARATION_SCRAP', 192.00, 4, 'Melted butter burnt on pan bottom', '2026-10-27 22:00:00'),
(29, 35, 11, NULL, 4.000, 5, 'SPOILED', 26.00, 9, 'Damaged eggs in delivery tray', '2026-10-29 08:30:00'),
(30, 10, 3, NULL, 1.200, 1, 'PREPARATION_SCRAP', 42.00, 4, 'Tomato cores removed during dicing', '2026-10-30 15:00:00'),
(31, 14, 4, NULL, 1.500, 1, 'PREPARATION_SCRAP', 42.00, 9, 'Onion end trimmings', '2026-10-30 16:30:00'),
(32, 27, 8, NULL, 0.600, 1, 'PREPARATION_SCRAP', 51.00, 3, 'Tough outer lettuce core', '2026-10-31 11:00:00'),
(33, NULL, NULL, 12, 1.000, 5, 'OVERCOOKED', 52.00, 4, 'Espresso shot scorched on group head', '2026-10-29 16:00:00'),
(34, 48, 28, NULL, 0.300, 1, 'PREPARATION_SCRAP', 97.50, 3, 'Chocolate block shaving scrap', '2026-10-28 10:00:00'),
(35, 38, 14, NULL, 1.000, 3, 'STORAGE_CONTAMINATION', 128.00, 2, 'Can leakage during shelving', '2026-09-02 12:00:00')
ON DUPLICATE KEY UPDATE `financial_loss` = VALUES(`financial_loss`);

-- ----------------------------------------------------------------------------
-- 2. STOCK MOVEMENTS (Waste Disposal Deductions)
-- ----------------------------------------------------------------------------
INSERT INTO `stock_movements` (`id`, `batch_id`, `movement_type`, `quantity`, `balance_after`, `reference_id`, `notes`, `created_by_user_id`, `created_at`) VALUES
(49, 4, 'WASTE_DISPOSAL', 1.500, 13.500, 'WASTE-1', 'Food waste deduction: EXPIRED', 3, '2026-09-16 10:00:00'),
(50, 5, 'WASTE_DISPOSAL', 0.800, 29.200, 'WASTE-2', 'Food waste deduction: SPOILED', 4, '2026-10-08 09:30:00'),
(51, 15, 'WASTE_DISPOSAL', 4.000, 46.000, 'WASTE-3', 'Food waste deduction: SPOILED', 9, '2026-08-22 11:00:00'),
(52, 16, 'WASTE_DISPOSAL', 3.500, 96.500, 'WASTE-4', 'Food waste deduction: PREPARATION_SCRAP', 3, '2026-10-18 15:00:00'),
(53, 18, 'WASTE_DISPOSAL', 1.200, 18.800, 'WASTE-5', 'Food waste deduction: STORAGE_CONTAMINATION', 3, '2026-08-20 08:30:00'),
(54, 22, 'WASTE_DISPOSAL', 0.800, 14.200, 'WASTE-6', 'Food waste deduction: EXPIRED', 4, '2026-08-29 09:00:00'),
(55, 28, 'WASTE_DISPOSAL', 3.000, 37.000, 'WASTE-7', 'Food waste deduction: SPOILED', 9, '2026-08-21 14:00:00'),
(56, 40, 'WASTE_DISPOSAL', 6.000, 54.000, 'WASTE-10', 'Food waste deduction: EXPIRED', 4, '2026-08-26 10:00:00'),
(57, 43, 'WASTE_DISPOSAL', 5.000, 45.000, 'WASTE-11', 'Food waste deduction: EXPIRED', 3, '2026-08-27 10:00:00'),
(58, 8, 'WASTE_DISPOSAL', 1.800, 23.200, 'WASTE-12', 'Food waste deduction: SPOILED', 9, '2026-08-24 08:30:00'),
(59, 12, 'WASTE_DISPOSAL', 2.200, 27.800, 'WASTE-13', 'Food waste deduction: PREPARATION_SCRAP', 4, '2026-08-28 16:00:00'),
(60, 26, 'WASTE_DISPOSAL', 1.000, 9.000, 'WASTE-14', 'Food waste deduction: SPOILED', 3, '2026-09-18 09:00:00'),
(61, 34, 'WASTE_DISPOSAL', 8.000, 112.000, 'WASTE-15', 'Food waste deduction: SPOILED', 9, '2026-08-25 11:30:00'),
(62, 19, 'WASTE_DISPOSAL', 0.900, 34.100, 'WASTE-16', 'Food waste deduction: PREPARATION_SCRAP', 3, '2026-09-28 11:00:00'),
(63, 46, 'WASTE_DISPOSAL', 1.000, 59.000, 'WASTE-18', 'Food waste deduction: STORAGE_CONTAMINATION', 4, '2026-09-15 14:00:00'),
(64, 47, 'WASTE_DISPOSAL', 0.800, 39.200, 'WASTE-19', 'Food waste deduction: PREPARATION_SCRAP', 9, '2026-10-29 15:30:00'),
(65, 1, 'WASTE_DISPOSAL', 2.000, 48.000, 'WASTE-20', 'Food waste deduction: STORAGE_CONTAMINATION', 3, '2026-08-30 11:30:00'),
(66, 17, 'WASTE_DISPOSAL', 3.000, 147.000, 'WASTE-21', 'Food waste deduction: PREPARATION_SCRAP', 4, '2026-10-28 10:00:00'),
(67, 20, 'WASTE_DISPOSAL', 0.600, 34.400, 'WASTE-22', 'Food waste deduction: PREPARATION_SCRAP', 3, '2026-10-30 11:00:00'),
(68, 24, 'WASTE_DISPOSAL', 0.500, 29.500, 'WASTE-23', 'Food waste deduction: PREPARATION_SCRAP', 4, '2026-10-29 10:30:00'),
(69, 30, 'WASTE_DISPOSAL', 2.000, 78.000, 'WASTE-24', 'Food waste deduction: SPOILED', 9, '2026-10-31 23:00:00'),
(70, 42, 'WASTE_DISPOSAL', 4.000, 116.000, 'WASTE-26', 'Food waste deduction: PREPARATION_SCRAP', 9, '2026-10-31 12:00:00'),
(71, 45, 'WASTE_DISPOSAL', 2.000, 98.000, 'WASTE-27', 'Food waste deduction: PREPARATION_SCRAP', 3, '2026-10-30 19:00:00'),
(72, 33, 'WASTE_DISPOSAL', 0.400, 29.600, 'WASTE-28', 'Food waste deduction: PREPARATION_SCRAP', 4, '2026-10-27 22:00:00'),
(73, 35, 'WASTE_DISPOSAL', 4.000, 296.000, 'WASTE-29', 'Food waste deduction: SPOILED', 9, '2026-10-29 08:30:00'),
(74, 10, 'WASTE_DISPOSAL', 1.200, 43.800, 'WASTE-30', 'Food waste deduction: PREPARATION_SCRAP', 4, '2026-10-30 15:00:00'),
(75, 14, 'WASTE_DISPOSAL', 1.500, 58.500, 'WASTE-31', 'Food waste deduction: PREPARATION_SCRAP', 9, '2026-10-30 16:30:00'),
(76, 27, 'WASTE_DISPOSAL', 0.600, 11.400, 'WASTE-32', 'Food waste deduction: PREPARATION_SCRAP', 3, '2026-10-31 11:00:00'),
(77, 48, 'WASTE_DISPOSAL', 0.300, 29.700, 'WASTE-34', 'Food waste deduction: PREPARATION_SCRAP', 3, '2026-10-28 10:00:00'),
(78, 38, 'WASTE_DISPOSAL', 1.000, 59.000, 'WASTE-35', 'Food waste deduction: STORAGE_CONTAMINATION', 2, '2026-09-02 12:00:00')
ON DUPLICATE KEY UPDATE `quantity` = VALUES(`quantity`);

-- ----------------------------------------------------------------------------
-- 3. DEMAND FORECASTS (24 Model Predictions for ML Microservice Verification)
-- ----------------------------------------------------------------------------
INSERT INTO `demand_forecasts` (`id`, `forecast_date`, `target_type`, `target_id`, `predicted_quantity`, `confidence_lower_bound`, `confidence_upper_bound`, `actual_quantity_consumed`, `model_version`, `generated_at`) VALUES
(1, '2026-11-03', 'MENU_ITEM', 8, 24.000, 20.000, 28.000, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(2, '2026-11-03', 'MENU_ITEM', 5, 30.000, 26.000, 35.000, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(3, '2026-11-03', 'MENU_ITEM', 1, 45.000, 38.000, 52.000, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(4, '2026-11-03', 'MENU_ITEM', 10, 18.000, 14.000, 22.000, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(5, '2026-11-03', 'INGREDIENT', 2, 5.500, 4.800, 6.200, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(6, '2026-11-03', 'INGREDIENT', 6, 4.800, 4.000, 5.600, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(7, '2026-11-03', 'INGREDIENT', 5, 14.000, 12.000, 16.500, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(8, '2026-11-04', 'MENU_ITEM', 8, 22.000, 18.000, 26.000, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(9, '2026-11-04', 'MENU_ITEM', 5, 28.000, 24.000, 32.000, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(10, '2026-11-04', 'INGREDIENT', 2, 5.100, 4.400, 5.800, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(11, '2026-11-04', 'INGREDIENT', 7, 3.500, 2.900, 4.100, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(12, '2026-11-05', 'MENU_ITEM', 8, 26.000, 21.000, 30.000, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(13, '2026-11-05', 'INGREDIENT', 2, 5.900, 5.000, 6.800, NULL, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(14, '2026-11-06', 'MENU_ITEM', 8, 38.000, 32.000, 44.000, NULL, 'v1.2.0-lstm', '2026-11-01 02:00:00'),
(15, '2026-11-06', 'MENU_ITEM', 10, 28.000, 23.000, 33.000, NULL, 'v1.2.0-lstm', '2026-11-01 02:00:00'),
(16, '2026-11-06', 'INGREDIENT', 2, 8.800, 7.500, 10.000, NULL, 'v1.2.0-lstm', '2026-11-01 02:00:00'),
(17, '2026-11-06', 'INGREDIENT', 6, 7.200, 6.100, 8.300, NULL, 'v1.2.0-lstm', '2026-11-01 02:00:00'),
(18, '2026-11-07', 'MENU_ITEM', 8, 42.000, 36.000, 48.000, NULL, 'v1.2.0-lstm', '2026-11-01 02:00:00'),
(19, '2026-11-07', 'MENU_ITEM', 1, 65.000, 55.000, 75.000, NULL, 'v1.2.0-lstm', '2026-11-01 02:00:00'),
(20, '2026-11-07', 'INGREDIENT', 5, 20.000, 17.500, 23.000, NULL, 'v1.2.0-lstm', '2026-11-01 02:00:00'),
(21, '2026-10-28', 'MENU_ITEM', 8, 20.000, 16.000, 24.000, 22.000, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(22, '2026-10-28', 'INGREDIENT', 2, 4.600, 3.900, 5.300, 4.900, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(23, '2026-10-29', 'MENU_ITEM', 8, 21.000, 17.000, 25.000, 19.000, 'v1.0.0-baseline', '2026-11-01 02:00:00'),
(24, '2026-10-30', 'MENU_ITEM', 5, 32.000, 27.000, 37.000, 34.000, 'v1.0.0-baseline', '2026-11-01 02:00:00')
ON DUPLICATE KEY UPDATE `predicted_quantity` = VALUES(`predicted_quantity`);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Seed File 5 (Waste Records & Demand Forecasts) loaded successfully.' AS status;
