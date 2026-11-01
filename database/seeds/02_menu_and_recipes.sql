-- ============================================================================
-- Urban Bites Restaurant & Food Inventory System
-- Seed File 2: Categories, Ingredients, Menu Items, Recipes & Bill of Materials
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- ============================================================================

USE `restaurant_inventory_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. CATEGORIES (5 Categories)
-- ----------------------------------------------------------------------------
INSERT INTO `categories` (`id`, `name`, `description`, `is_active`) VALUES
(1, 'Appetizers', 'Starters, fried delicacies, and finger foods', TRUE),
(2, 'Burgers', 'Signature gourmet handcrafted burgers with house fries', TRUE),
(3, 'Pizza', 'Stone-baked thin-crust and pan pizzas with artisanal toppings', TRUE),
(4, 'Beverages', 'Hot teas, brewed coffees, milkshakes, and refreshing coolers', TRUE),
(5, 'Desserts', 'Decadent baked sweets, pastries, and classic Indian desserts', TRUE)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ----------------------------------------------------------------------------
-- 2. INGREDIENTS (28 Master Raw Ingredients)
-- Units: 1:kg, 2:g, 3:l, 4:ml, 5:pcs, 6:dz
-- ----------------------------------------------------------------------------
INSERT INTO `ingredients` (`id`, `name`, `unit_id`, `minimum_stock_level`, `optimal_par_level`, `cost_per_unit`, `is_active`) VALUES
(1, 'All-Purpose Flour (Maida)', 1, 20.000, 100.000, 42.00, TRUE),
(2, 'Mozzarella Cheese', 1, 10.000, 40.000, 420.00, TRUE),
(3, 'Fresh Tomatoes', 1, 15.000, 50.000, 35.00, TRUE),
(4, 'Red Onions', 1, 15.000, 50.000, 28.00, TRUE),
(5, 'Potatoes', 1, 25.000, 80.000, 24.00, TRUE),
(6, 'Boneless Chicken Breast', 1, 15.000, 60.000, 260.00, TRUE),
(7, 'Fresh Malai Paneer', 1, 10.000, 40.000, 320.00, TRUE),
(8, 'Crisp Iceberg Lettuce', 1, 5.000, 20.000, 85.00, TRUE),
(9, 'Full Cream Milk', 3, 20.000, 80.000, 64.00, TRUE),
(10, 'Dairy Butter', 1, 5.000, 25.000, 480.00, TRUE),
(11, 'Fresh Farm Eggs', 5, 60.000, 240.000, 6.50, TRUE),
(12, 'Refined White Sugar', 1, 10.000, 40.000, 44.00, TRUE),
(13, 'Iodized Table Salt', 1, 5.000, 25.000, 22.00, TRUE),
(14, 'Refined Sunflower Oil', 3, 25.000, 100.000, 135.00, TRUE),
(15, 'Sesame Burger Buns', 5, 40.000, 160.000, 12.00, TRUE),
(16, 'Artisanal Pizza Base Crust', 5, 30.000, 120.000, 25.00, TRUE),
(17, 'Fresh Garlic', 1, 3.000, 12.000, 180.00, TRUE),
(18, 'Fresh Ginger', 1, 3.000, 12.000, 140.00, TRUE),
(19, 'Classic Tomato Puree & Sauce', 1, 10.000, 40.000, 95.00, TRUE),
(20, 'Creamy Eggless Mayonnaise', 1, 5.000, 20.000, 160.00, TRUE),
(21, 'Spicy Green Chillies', 1, 2.000, 8.000, 60.00, TRUE),
(22, 'Traditional Garam Masala', 1, 2.000, 8.000, 550.00, TRUE),
(23, 'Premium Arabica Coffee Beans', 1, 5.000, 20.000, 750.00, TRUE),
(24, 'Assam CTC Tea Leaves', 1, 4.000, 16.000, 380.00, TRUE),
(25, 'Dark Cocoa Powder', 1, 3.000, 10.000, 620.00, TRUE),
(26, 'Active Dry Yeast', 1, 2.000, 8.000, 310.00, TRUE),
(27, 'Fresh Green Capsicum', 1, 8.000, 30.000, 55.00, TRUE),
(28, 'Dark Compound Chocolate', 1, 5.000, 20.000, 340.00, TRUE)
ON DUPLICATE KEY UPDATE 
    `minimum_stock_level` = VALUES(`minimum_stock_level`),
    `cost_per_unit` = VALUES(`cost_per_unit`);

-- ----------------------------------------------------------------------------
-- 3. MENU ITEMS (15 Dishes with Indian Restaurant Pricing in INR)
-- ----------------------------------------------------------------------------
INSERT INTO `menu_items` (`id`, `category_id`, `name`, `description`, `selling_price`, `preparation_time_mins`, `is_available`) VALUES
(1, 1, 'Crispy French Fries', 'Deep fried golden potato batons seasoned with rock salt and herbs', 110.00, 10, TRUE),
(2, 1, 'Samosa Platter with Chutney', 'Traditional spiced potato and green pea stuffed pastries served with mint dip', 120.00, 12, TRUE),
(3, 1, 'Cheesy Garlic Bread', 'Toasted herb baguette slices loaded with garlic butter and melted mozzarella', 140.00, 10, TRUE),
(4, 1, 'Paneer Tikka Bites', 'Clay-oven roasted cottage cheese cubes marinated in yoghurt and house spices', 220.00, 15, TRUE),
(5, 2, 'Classic Crispy Veg Burger', 'Golden vegetable patty topped with sliced onions, tomatoes, and mayo on sesame bun', 130.00, 12, TRUE),
(6, 2, 'Urban Paneer Makhani Burger', 'Grilled spiced paneer slab smothered in rich makhani gravy on toasted bun', 170.00, 15, TRUE),
(7, 2, 'Smoky Chicken Tikka Burger', 'Succulent tandoori chicken fillet topped with mint mayo and pickled onions', 190.00, 15, TRUE),
(8, 3, 'Classic Margherita Pizza', 'Hand-stretched crust, basil tomato marinara, and fresh mozzarella cheese', 260.00, 18, TRUE),
(9, 3, 'Farmhouse Veggie Feast Pizza', 'Crisp bell peppers, red onions, diced tomatoes, and stringy mozzarella', 320.00, 20, TRUE),
(10, 3, 'Tandoori Chicken Tikka Pizza', 'Spicy tandoori chicken chunks, red onions, green chillies, and double cheese', 380.00, 20, TRUE),
(11, 4, 'Masala Chai Pot', 'Steaming hot brewed Assam tea infused with cardamom, ginger, and full cream milk', 45.00, 8, TRUE),
(12, 4, 'Iced Caramel Cold Coffee', 'Chilled espresso blended with rich cream milk, sugar, and caramel drizzle', 130.00, 6, TRUE),
(13, 4, 'Fresh Lime Soda', 'Freshly squeezed lemon juice with sparkling soda water and sweet-salty seasoning', 65.00, 5, TRUE),
(14, 5, 'Warm Chocolate Walnut Brownie', 'Fudgy cocoa brownie baked with chocolate chunks, served warm', 150.00, 8, TRUE),
(15, 5, 'Royal Gulab Jamun (2 Pcs)', 'Golden fried milk-solid dumplings soaked in warm saffron-cardamom sugar syrup', 95.00, 5, TRUE)
ON DUPLICATE KEY UPDATE 
    `selling_price` = VALUES(`selling_price`),
    `is_available` = VALUES(`is_available`);

-- ----------------------------------------------------------------------------
-- 4. RECIPES (15 Recipes, 1 per Menu Item)
-- ----------------------------------------------------------------------------
INSERT INTO `recipes` (`id`, `menu_item_id`, `yield_servings`, `instructions`) VALUES
(1, 1, 1, 'Cut 250g potatoes into batons, blanch in salted water, and flash fry at 180C until crisp.'),
(2, 2, 1, 'Stuff dough pastry with spiced potato mixture, seal edges, and deep fry until golden.'),
(3, 3, 1, 'Spread garlic butter on crust, top with shredded mozzarella, and broil until bubbly.'),
(4, 4, 1, 'Marinate 150g paneer with yoghurt, spices, ginger-garlic paste; skewer and char in tandoor.'),
(5, 5, 1, 'Toast sesame bun, spread mayonnaise, layer iceberg lettuce, potato patty, tomato, and onion.'),
(6, 6, 1, 'Sear marinated paneer patty, glaze with rich makhani sauce, and assemble in toasted bun.'),
(7, 7, 1, 'Grill marinated chicken breast, layer with crisp lettuce, onion rings, and mint mayo on bun.'),
(8, 8, 1, 'Spread marinara sauce on pizza crust, top generously with 120g mozzarella, and stone-bake.'),
(9, 9, 1, 'Spread tomato sauce, layer onions, capsicum, tomatoes, and top with mozzarella cheese.'),
(10, 10, 1, 'Top pizza crust with marinara, diced tandoori chicken, red onions, green chillies, and cheese.'),
(11, 11, 1, 'Boil tea leaves, crushed ginger, and spices in water, add milk and sugar, simmer for 4 mins.'),
(12, 12, 1, 'Blend 25g ground coffee espresso with chilled milk, sugar, and ice cubes until frothy.'),
(13, 13, 1, 'Muddle fresh lemon juice with sugar syrup, black salt, and top with chilled club soda.'),
(14, 14, 1, 'Melt butter and dark chocolate, fold in flour, sugar, and cocoa powder; bake for 22 mins at 175C.'),
(15, 15, 1, 'Knead flour and milk solids, roll into smooth balls, deep fry slowly, and steep in sugar syrup.')
ON DUPLICATE KEY UPDATE `yield_servings` = VALUES(`yield_servings`);

-- ----------------------------------------------------------------------------
-- 5. RECIPE INGREDIENTS (Bill of Materials - BOM)
-- Units: 1:kg, 2:g, 3:l, 4:ml, 5:pcs
-- ----------------------------------------------------------------------------
INSERT INTO `recipe_ingredients` (`recipe_id`, `ingredient_id`, `quantity_required`, `unit_id`, `wastage_allowance_percent`) VALUES
-- Recipe 1: Crispy French Fries
(1, 5, 250.000, 2, 8.00), -- 250g Potatoes (8% peeling scrap)
(1, 14, 30.000, 4, 5.00), -- 30ml Cooking Oil
(1, 13, 3.000, 2, 0.00),  -- 3g Salt

-- Recipe 2: Samosa Platter
(2, 1, 80.000, 2, 2.00),  -- 80g Flour
(2, 5, 120.000, 2, 6.00), -- 120g Potatoes
(2, 4, 30.000, 2, 5.00),  -- 30g Onions
(2, 14, 25.000, 4, 4.00), -- 25ml Oil
(2, 22, 4.000, 2, 0.00),  -- 4g Garam Masala

-- Recipe 3: Cheesy Garlic Bread
(3, 1, 100.000, 2, 2.00), -- 100g Flour (base baguette)
(3, 2, 60.000, 2, 2.00),  -- 60g Mozzarella
(3, 10, 25.000, 2, 2.00), -- 25g Butter
(3, 17, 10.000, 2, 5.00), -- 10g Garlic

-- Recipe 4: Paneer Tikka Bites
(4, 7, 160.000, 2, 3.00), -- 160g Paneer
(4, 27, 40.000, 2, 5.00), -- 40g Capsicum
(4, 4, 40.000, 2, 5.00),  -- 40g Red Onions
(4, 10, 15.000, 2, 2.00), -- 15g Butter
(4, 22, 6.000, 2, 0.00),  -- 6g Garam Masala

-- Recipe 5: Classic Crispy Veg Burger
(5, 15, 1.000, 5, 0.00),  -- 1 Burger Bun
(5, 5, 100.000, 2, 5.00), -- 100g Potato
(5, 8, 20.000, 2, 5.00),  -- 20g Lettuce
(5, 3, 25.000, 2, 4.00),  -- 25g Tomato
(5, 4, 20.000, 2, 4.00),  -- 20g Onion
(5, 20, 20.000, 2, 2.00), -- 20g Mayonnaise

-- Recipe 6: Urban Paneer Makhani Burger
(6, 15, 1.000, 5, 0.00),  -- 1 Burger Bun
(6, 7, 90.000, 2, 2.00),  -- 90g Paneer
(6, 10, 15.000, 2, 2.00), -- 15g Butter
(6, 19, 40.000, 2, 3.00), -- 40g Tomato Sauce/Puree
(6, 8, 20.000, 2, 5.00),  -- 20g Lettuce

-- Recipe 7: Smoky Chicken Tikka Burger
(7, 15, 1.000, 5, 0.00),  -- 1 Burger Bun
(7, 6, 130.000, 2, 4.00), -- 130g Chicken Breast
(7, 8, 20.000, 2, 5.00),  -- 20g Lettuce
(7, 4, 25.000, 2, 4.00),  -- 25g Onion
(7, 20, 25.000, 2, 2.00), -- 25g Mayonnaise

-- Recipe 8: Classic Margherita Pizza
(8, 16, 1.000, 5, 0.00),  -- 1 Pizza Crust Base
(8, 19, 60.000, 2, 2.00), -- 60g Tomato Puree/Sauce
(8, 2, 130.000, 2, 2.00), -- 130g Mozzarella Cheese
(8, 14, 10.000, 4, 0.00), -- 10ml Oil

-- Recipe 9: Farmhouse Veggie Feast Pizza
(9, 16, 1.000, 5, 0.00),  -- 1 Pizza Crust Base
(9, 19, 60.000, 2, 2.00), -- 60g Tomato Sauce
(9, 2, 120.000, 2, 2.00), -- 120g Mozzarella Cheese
(9, 27, 40.000, 2, 5.00), -- 40g Capsicum
(9, 4, 35.000, 2, 5.00),  -- 35g Red Onion
(9, 3, 35.000, 2, 4.00),  -- 35g Fresh Tomato

-- Recipe 10: Tandoori Chicken Tikka Pizza
(10, 16, 1.000, 5, 0.00),  -- 1 Pizza Crust Base
(10, 19, 60.000, 2, 2.00), -- 60g Tomato Sauce
(10, 6, 120.000, 2, 4.00), -- 120g Chicken Breast
(10, 2, 120.000, 2, 2.00), -- 120g Mozzarella Cheese
(10, 4, 30.000, 2, 4.00),  -- 30g Onion
(10, 21, 5.000, 2, 2.00),  -- 5g Green Chillies

-- Recipe 11: Masala Chai Pot
(11, 24, 10.000, 2, 2.00), -- 10g Assam Tea Leaves
(11, 9, 120.000, 4, 3.00), -- 120ml Milk
(11, 12, 15.000, 2, 0.00), -- 15g Sugar
(11, 18, 5.000, 2, 5.00),  -- 5g Fresh Ginger

-- Recipe 12: Iced Caramel Cold Coffee
(12, 23, 22.000, 2, 3.00), -- 22g Coffee Beans
(12, 9, 200.000, 4, 2.00), -- 200ml Milk
(12, 12, 20.000, 2, 0.00), -- 20g Sugar

-- Recipe 13: Fresh Lime Soda
(13, 12, 25.000, 2, 0.00), -- 25g Sugar
(13, 13, 2.000, 2, 0.00),  -- 2g Salt

-- Recipe 14: Warm Chocolate Walnut Brownie
(14, 1, 45.000, 2, 2.00),   -- 45g Flour
(14, 28, 60.000, 2, 2.00),  -- 60g Dark Chocolate Compound
(14, 10, 30.000, 2, 2.00),  -- 30g Butter
(14, 12, 40.000, 2, 0.00),  -- 40g Sugar
(14, 25, 12.000, 2, 1.00),  -- 12g Cocoa Powder

-- Recipe 15: Royal Gulab Jamun
(15, 9, 150.000, 4, 4.00),  -- 150ml Milk
(15, 1, 30.000, 2, 2.00),   -- 30g Flour
(15, 12, 80.000, 2, 1.00),  -- 80g Sugar
(15, 14, 25.000, 4, 4.00)   -- 25ml Oil for frying
ON DUPLICATE KEY UPDATE 
    `quantity_required` = VALUES(`quantity_required`),
    `wastage_allowance_percent` = VALUES(`wastage_allowance_percent`);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Seed File 2 (Categories, Ingredients, Menu, Recipes & BOM) loaded successfully.' AS status;
