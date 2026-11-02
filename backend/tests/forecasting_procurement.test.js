import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { BOMService } from '../src/services/bom.service.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api/v1`;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function loginUser(identifier, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });
  const body = await res.json();
  if (!body.success) {
    throw new Error(`Login failed for ${identifier}: ${JSON.stringify(body)}`);
  }
  return body.data.token;
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('  Urban Bites Task 7C: BOM & Procurement Engine Verification   ');
  console.log('================================================================\n');

  let adminToken, inventoryToken, chefToken, cashierToken;
  try {
    adminToken = await loginUser('rohit_admin', 'UrbanBites@2026');
    inventoryToken = await loginUser('priya_inventory', 'UrbanBites@2026');
    chefToken = await loginUser('vikram_headchef', 'UrbanBites@2026');
    cashierToken = await loginUser('arjun_cashier', 'UrbanBites@2026');
    assert(true, 'Authentication successful for all staff roles');
  } catch (err) {
    assert(false, `Authentication setup failed: ${err.message}`);
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  try {
    // --------------------------------------------------------------------------
    // PART 1: Bill of Materials (BOM) Mathematical Engine Unit Tests
    // --------------------------------------------------------------------------
    console.log('\n--- PART 1: BOM Expansion & Unit Conversion Unit Tests ---');

    // Test 1.1: Grams to Kilograms conversion (WEIGHT)
    const gToKgRatio = BOMService.calculateUnitConversionRatio({
      recipeUnitType: 'WEIGHT',
      recipeConversionFactor: 0.001, // Grams
      ingredientUnitType: 'WEIGHT',
      ingredientBaseConversionFactor: 1.000 // Kilograms
    });
    assert(Math.abs(gToKgRatio - 0.001) < 1e-6, 'Unit conversion Grams (0.001) to Kilograms (1.0) equals 0.001');

    // Test 1.2: Millilitres to Litres conversion (VOLUME)
    const mlToLRatio = BOMService.calculateUnitConversionRatio({
      recipeUnitType: 'VOLUME',
      recipeConversionFactor: 0.001, // Millilitres
      ingredientUnitType: 'VOLUME',
      ingredientBaseConversionFactor: 1.000 // Litres
    });
    assert(Math.abs(mlToLRatio - 0.001) < 1e-6, 'Unit conversion Millilitres (0.001) to Litres (1.0) equals 0.001');

    // Test 1.3: Dozen to Pieces conversion (COUNT)
    const dzToPcsRatio = BOMService.calculateUnitConversionRatio({
      recipeUnitType: 'COUNT',
      recipeConversionFactor: 12.0, // Dozen
      ingredientUnitType: 'COUNT',
      ingredientBaseConversionFactor: 1.0 // Piece
    });
    assert(Math.abs(dzToPcsRatio - 12.0) < 1e-6, 'Unit conversion Dozen (12.0) to Piece (1.0) equals 12.0');

    // Test 1.4: Incompatible unit dimensions throws error
    let incompatibleErrorCaught = false;
    try {
      BOMService.calculateUnitConversionRatio({
        recipeUnitType: 'WEIGHT',
        recipeConversionFactor: 1.0,
        ingredientUnitType: 'VOLUME',
        ingredientBaseConversionFactor: 1.0
      });
    } catch (e) {
      incompatibleErrorCaught = e.code === 'INCOMPATIBLE_UNIT_TYPES' || e.message.includes('incompatible');
    }
    assert(incompatibleErrorCaught, 'Incompatible unit dimensions (WEIGHT vs VOLUME) rejected with error');

    // Test 1.5: Recipe yield and wastage allowance formula
    // Recipe: predicted = 10, required = 200g (0.2kg), wastage = 10%, yield = 2 servings
    // Expected: 10 * 200 * (1 + 0.10) / 2 * 0.001 = 10 * 200 * 1.1 / 2 * 0.001 = 1.1 kg
    const reqQty = BOMService.calculateIngredientRequirement({
      predictedMenuQuantity: 10,
      quantityRequired: 200,
      wastageAllowancePercent: 10.0,
      yieldServings: 2,
      unitConversionRatio: 0.001
    });
    assert(Math.abs(reqQty - 1.100) < 1e-6, 'Recipe yield and wastage allowance applied accurately: 1.1 kg');

    // Test 1.6: Multiple menu items sharing an ingredient
    const mockForecasts = [
      { date: '2026-11-01', menu_item_id: 1, predicted_quantity: 5 }, // 5 * 100g = 500g = 0.5kg
      { date: '2026-11-01', menu_item_id: 2, predicted_quantity: 10 } // 10 * 150g = 1500g = 1.5kg
    ];
    const mockRecipes = [
      {
        menu_item_id: 1,
        menu_item_name: 'Burger',
        yield_servings: 1,
        ingredient_id: 10,
        ingredient_name: 'Cheese',
        ingredient_base_unit_id: 1,
        ingredient_base_unit_name: 'Kilogram',
        ingredient_base_unit_abbr: 'kg',
        ingredient_unit_type: 'WEIGHT',
        ingredient_base_conversion_factor: 1.0,
        quantity_required: 100,
        recipe_unit_id: 2,
        recipe_unit_name: 'Gram',
        recipe_unit_abbr: 'g',
        recipe_unit_type: 'WEIGHT',
        recipe_conversion_factor: 0.001,
        wastage_allowance_percent: 0.0
      },
      {
        menu_item_id: 2,
        menu_item_name: 'Pizza',
        yield_servings: 1,
        ingredient_id: 10,
        ingredient_name: 'Cheese',
        ingredient_base_unit_id: 1,
        ingredient_base_unit_name: 'Kilogram',
        ingredient_base_unit_abbr: 'kg',
        ingredient_unit_type: 'WEIGHT',
        ingredient_base_conversion_factor: 1.0,
        quantity_required: 150,
        recipe_unit_id: 2,
        recipe_unit_name: 'Gram',
        recipe_unit_abbr: 'g',
        recipe_unit_type: 'WEIGHT',
        recipe_conversion_factor: 0.001,
        wastage_allowance_percent: 0.0
      }
    ];

    const expanded = BOMService.expandMenuForecastsToIngredients(mockForecasts, mockRecipes);
    assert(expanded.dailyIngredientDemand.length === 1, 'Aggregated single shared ingredient for 2026-11-01');
    assert(Math.abs(expanded.dailyIngredientDemand[0].required_quantity - 2.0) < 1e-4, 'Shared ingredient required_quantity is 0.5 + 1.5 = 2.0 kg');
    assert(expanded.dailyIngredientDemand[0].menu_items_breakdown.length === 2, 'Breakdown tracks contributions from both Burger and Pizza');

    // --------------------------------------------------------------------------
    // PART 2: Forecasting Integration Endpoints
    // --------------------------------------------------------------------------
    console.log('\n--- PART 2: Forecasting API Endpoints ---');

    // Test 2.1: RBAC check - Cashier cannot generate forecasts (403)
    const cashierGenRes = await fetch(`${BASE_URL}/forecasting/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cashierToken}`
      },
      body: JSON.stringify({ horizon_days: 7 })
    });
    assert(cashierGenRes.status === 403, 'POST /forecasting/generate rejects CASHIER with 403 Forbidden');

    // Test 2.2: Unauthenticated cannot generate forecasts (401)
    const unauthGenRes = await fetch(`${BASE_URL}/forecasting/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horizon_days: 7 })
    });
    assert(unauthGenRes.status === 401, 'POST /forecasting/generate rejects unauthenticated request with 401');

    // Test 2.3: Admin successfully generates and persists 7-day demand forecasts
    const adminGenRes = await fetch(`${BASE_URL}/forecasting/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ horizon_days: 7 })
    });
    const adminGenBody = await adminGenRes.json();
    assert(adminGenRes.status === 200, 'POST /forecasting/generate succeeds with 200 OK');
    assert(adminGenBody.success === true, 'Generate response success is true');
    const adminGenData = adminGenBody.data;
    assert(adminGenData.total_forecasts === 105, 'Generated 105 predictions (15 menu items x 7 days)');
    assert(Boolean(adminGenData.data_through_date), `Reported valid data_through_date: ${adminGenData.data_through_date}`);
    assert(Boolean(adminGenData.model_name), `Reported selected model: ${adminGenData.model_name}`);

    // Verify persistence in MySQL demand_forecasts table
    const [dbForecasts] = await conn.execute(
      "SELECT COUNT(*) AS total FROM demand_forecasts WHERE target_type = 'MENU_ITEM'"
    );
    assert(dbForecasts[0].total >= 105, `Persisted ${dbForecasts[0].total} records in MySQL demand_forecasts`);

    // Test 2.4: Repeated forecast generation is idempotent (ON DUPLICATE KEY UPDATE)
    const secondGenRes = await fetch(`${BASE_URL}/forecasting/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${inventoryToken}`
      },
      body: JSON.stringify({ horizon_days: 7 })
    });
    assert(secondGenRes.status === 200, 'Repeated forecast generation executes idempotently without duplicate key errors');

    // Test 2.5: GET /forecasting listing with pagination and filters
    const listRes = await fetch(`${BASE_URL}/forecasting?page=1&limit=10&target_type=MENU_ITEM`, {
      headers: { 'Authorization': `Bearer ${chefToken}` }
    });
    const listBody = await listRes.json();
    assert(listRes.status === 200, 'GET /forecasting succeeds with 200 OK');
    assert(Array.isArray(listBody.data) && listBody.data.length === 10, 'Returned paginated batch of 10 forecasts');
    const firstForecast = listBody.data[0];
    assert(firstForecast.predicted_quantity >= 0, 'Predicted quantity is non-negative');
    assert(firstForecast.confidence_lower_bound >= 0, 'Confidence lower bound is non-negative');
    assert(firstForecast.confidence_upper_bound >= firstForecast.confidence_lower_bound, 'Upper bound >= lower bound');

    // Test 2.6: GET /forecasting/accuracy
    const accRes = await fetch(`${BASE_URL}/forecasting/accuracy`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const accBody = await accRes.json();
    assert(accRes.status === 200, 'GET /forecasting/accuracy succeeds with 200 OK');
    assert(accBody.data.metrics !== undefined, 'Returns metrics object (MAE, RMSE, WMAPE)');

    // Test 2.7: GET /forecasting/ingredient-demand (BOM expansion endpoint)
    const ingDemandRes = await fetch(`${BASE_URL}/forecasting/ingredient-demand`, {
      headers: { 'Authorization': `Bearer ${inventoryToken}` }
    });
    const ingDemandBody = await ingDemandRes.json();
    assert(ingDemandRes.status === 200, 'GET /forecasting/ingredient-demand succeeds with 200 OK');
    assert(Array.isArray(ingDemandBody.data.dailyIngredientDemand), 'Returns dailyIngredientDemand array');
    assert(Array.isArray(ingDemandBody.data.aggregatedIngredientDemand), 'Returns aggregatedIngredientDemand array');
    assert(ingDemandBody.data.aggregatedIngredientDemand.length > 0, `Derived demand for ${ingDemandBody.data.aggregatedIngredientDemand.length} distinct ingredients`);

    // --------------------------------------------------------------------------
    // PART 3: Intelligent Procurement Recommendations
    // --------------------------------------------------------------------------
    console.log('\n--- PART 3: Intelligent Procurement Recommendations ---');

    // Test 3.1: Cashier cannot access procurement recommendations (403)
    const cashierRecRes = await fetch(`${BASE_URL}/procurement/recommendations`, {
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    assert(cashierRecRes.status === 403, 'GET /procurement/recommendations rejects CASHIER with 403 Forbidden');

    // Test 3.2: Admin & Inventory Manager can access procurement recommendations
    const recRes = await fetch(`${BASE_URL}/procurement/recommendations?horizon_days=7`, {
      headers: { 'Authorization': `Bearer ${inventoryToken}` }
    });
    const recBody = await recRes.json();
    assert(recRes.status === 200, 'GET /procurement/recommendations succeeds with 200 OK');
    const recData = recBody.data;
    assert(recData.total_ingredients_evaluated > 0, `Evaluated ${recData.total_ingredients_evaluated} ingredients`);
    assert(Array.isArray(recData.recommendations), 'Returns recommendations array');

    // Verify structure of first recommendation
    const firstRec = recData.recommendations[0];
    assert(firstRec.ingredient_id > 0, 'Recommendation contains valid ingredient_id');
    assert(firstRec.lead_time_days >= 0, 'Lead time days is non-negative');
    assert(firstRec.reorder_point >= firstRec.safety_stock, 'Reorder point (lead_time_demand + safety_stock) >= safety_stock');
    assert(firstRec.recommended_order_quantity >= 0, 'Recommended order quantity is non-negative');
    if (firstRec.reorder_needed && firstRec.supplier) {
      assert(firstRec.recommended_order_quantity >= firstRec.minimum_order_quantity, 'MOQ respected for reorder: recommended >= MOQ');
      assert(firstRec.estimated_cost >= 0, 'Estimated cost is non-negative');
    }

    // --------------------------------------------------------------------------
    // PART 4: PO Conversion Engine
    // --------------------------------------------------------------------------
    console.log('\n--- PART 4: Purchase Order Conversion ---');

    // Test 4.1: Find a reorder item or valid supplier item to convert
    const [supplierIng] = await conn.execute(`
      SELECT si.ingredient_id, si.supplier_id, si.minimum_order_quantity, si.contract_unit_cost
      FROM supplier_ingredients si
      JOIN suppliers s ON si.supplier_id = s.id
      WHERE s.is_active = TRUE
      LIMIT 1;
    `);
    assert(supplierIng.length > 0, 'Found active supplier ingredient mapping for PO conversion test');

    const testItem = supplierIng[0];
    const validQty = Math.max(Number(testItem.minimum_order_quantity), 10.0);

    // Test 4.2: Quantity below MOQ rejected with 400
    const belowMoqRes = await fetch(`${BASE_URL}/procurement/recommendations/convert-to-po`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        items: [
          {
            ingredient_id: testItem.ingredient_id,
            supplier_id: testItem.supplier_id,
            quantity: Number(testItem.minimum_order_quantity) / 2.0 // below MOQ
          }
        ]
      })
    });
    assert(belowMoqRes.status === 400, 'Rejects purchase quantity below supplier MOQ with 400 Bad Request');

    // Test 4.3: Convert recommendation to DRAFT PO
    const convertRes = await fetch(`${BASE_URL}/procurement/recommendations/convert-to-po`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        items: [
          {
            ingredient_id: testItem.ingredient_id,
            supplier_id: testItem.supplier_id,
            quantity: validQty,
            unit_cost: Number(testItem.contract_unit_cost)
          }
        ],
        notes: 'TEST-CONVERT-PO-7C'
      })
    });
    const convertBody = await convertRes.json();
    assert(convertRes.status === 201, 'POST /procurement/recommendations/convert-to-po succeeds with 201 Created');
    assert(convertBody.success === true, 'PO conversion success is true');
    const convertData = convertBody.data;
    assert(convertData.purchase_orders.length === 1, 'Created exactly 1 purchase order for single supplier');

    const createdPO = convertData.purchase_orders[0];
    assert(createdPO.status === 'DRAFT', 'Created purchase order is strictly in DRAFT status (not auto-submitted)');
    assert(createdPO.po_number.startsWith('PO-'), `Generated unique PO number: ${createdPO.po_number}`);
    assert(createdPO.items_count === 1, 'PO has 1 line item');

    // Verify in database
    const [dbPO] = await conn.execute(
      "SELECT status, total_amount FROM purchase_orders WHERE id = ?",
      [createdPO.id]
    );
    assert(dbPO[0].status === 'DRAFT', 'Verified DRAFT status in MySQL purchase_orders table');
    assert(Number(dbPO[0].total_amount) > 0, `Verified total amount ${dbPO[0].total_amount} in MySQL`);

    // Clean up test PO
    await conn.execute("DELETE FROM purchase_orders WHERE notes = 'TEST-CONVERT-PO-7C'");
    assert(true, 'Cleaned up test purchase order');

  } catch (err) {
    console.error('Test Suite encountered fatal error:', err);
    assert(false, `Unexpected exception in test suite: ${err.message}`);
  } finally {
    await conn.end();
  }

  console.log('\n================================================================');
  console.log(`  Task 7C Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(e => {
  console.error(e);
  process.exit(1);
});
