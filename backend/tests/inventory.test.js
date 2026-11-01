import mysql from 'mysql2/promise';
import { closeMySQLPool } from '../src/config/mysql.js';
import { env } from '../src/config/env.js';

const BASE_URL = `http://localhost:${env.PORT}/api/v1`;

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

async function runTestSuite() {
  console.log('===============================================================');
  console.log('  Urban Bites Inventory Read APIs & Stock Visibility Test Suite');
  console.log('===============================================================\n');

  let adminToken = '';
  let cashierToken = '';
  let chefToken = '';

  // 1. Authenticate Staff Accounts
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'rohit_admin',
      password: 'UrbanBites@2026'
    })
  });
  const adminLoginData = await adminLoginRes.json();
  adminToken = adminLoginData.data.token;

  const cashierLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'arjun_cashier',
      password: 'UrbanBites@2026'
    })
  });
  const cashierLoginData = await cashierLoginRes.json();
  cashierToken = cashierLoginData.data.token;

  const chefLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'vikram_headchef',
      password: 'UrbanBites@2026'
    })
  });
  const chefLoginData = await chefLoginRes.json();
  chefToken = chefLoginData.data.token;

  // --------------------------------------------------------------------------
  // TEST 1: Unauthenticated Access Rejection
  // --------------------------------------------------------------------------
  console.log('[Test 1] Unauthenticated Access Rejection');
  const noTokenRes = await fetch(`${BASE_URL}/inventory`);
  const noTokenData = await noTokenRes.json();
  assert(noTokenRes.status === 401, 'Unauthenticated GET /inventory rejected with 401');
  assert(noTokenData.error.code === 'TOKEN_MISSING', 'Error code is TOKEN_MISSING');

  const noTokenSummaryRes = await fetch(`${BASE_URL}/inventory/summary`);
  assert(noTokenSummaryRes.status === 401, 'Unauthenticated GET /inventory/summary rejected with 401');

  // --------------------------------------------------------------------------
  // TEST 2: Inventory Overview Listing & Staff Read Access (Cashier)
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] Inventory Overview Listing & Staff Read Access');
  const overviewRes = await fetch(`${BASE_URL}/inventory`, {
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  const overviewData = await overviewRes.json();

  assert(overviewRes.status === 200, 'HTTP status is 200 OK (Cashier has read access)');
  assert(overviewData.success === true, 'Response success is true');
  assert(Array.isArray(overviewData.data), 'Returns an array of inventory items');
  assert(overviewData.data.length >= 20, 'Page items length meets limit');
  assert(overviewData.meta && overviewData.meta.total === 28, 'Total tracked ingredients count matches 28 master ingredients');

  const flourItem = overviewData.data.find(i => i.name === 'All-Purpose Flour (Maida)');
  assert(Boolean(flourItem), 'Found All-Purpose Flour in inventory overview');
  assert(typeof flourItem.current_stock === 'number', 'Includes numeric current_stock');
  assert(typeof flourItem.minimum_stock_level === 'number', 'Includes numeric minimum_stock_level');
  assert(typeof flourItem.optimal_par_level === 'number', 'Includes numeric optimal_par_level');
  assert(typeof flourItem.stock_valuation === 'number', 'Includes numeric stock_valuation');
  assert(['OUT_OF_STOCK', 'LOW_STOCK', 'NORMAL'].includes(flourItem.stock_status), `Valid stock_status (${flourItem.stock_status})`);
  assert(flourItem.unit && flourItem.unit.abbreviation === 'kg', 'Includes base unit abbreviation kg');

  // --------------------------------------------------------------------------
  // TEST 3: Search & Stock Status Filtering
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Search & Stock Status Filtering');
  const searchRes = await fetch(`${BASE_URL}/inventory?search=Cheese`, {
    headers: { Authorization: `Bearer ${chefToken}` }
  });
  const searchData = await searchRes.json();

  assert(searchRes.status === 200, 'Search by keyword returns 200 OK');
  assert(searchData.data.length > 0, 'Found items matching search');
  assert(searchData.data.every(i => i.name.toLowerCase().includes('cheese')), 'All search results match "Cheese"');

  const filterStatusRes = await fetch(`${BASE_URL}/inventory?stock_status=LOW_STOCK`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const filterStatusData = await filterStatusRes.json();
  assert(filterStatusRes.status === 200, 'Filter by stock_status=LOW_STOCK returns 200 OK');
  assert(filterStatusData.data.every(i => i.stock_status === 'LOW_STOCK'), 'All results have stock_status LOW_STOCK');

  // --------------------------------------------------------------------------
  // TEST 4: Empty Search Results Handling
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] Empty Results Handling');
  const emptyRes = await fetch(`${BASE_URL}/inventory?search=NonExistentIngredientXYZ`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const emptyData = await emptyRes.json();
  assert(emptyRes.status === 200, 'Empty search returns 200 OK');
  assert(Array.isArray(emptyData.data) && emptyData.data.length === 0, 'Returns empty array');
  assert(emptyData.meta.total === 0, 'Metadata total is 0');

  // --------------------------------------------------------------------------
  // TEST 5: Inventory Summary KPIs & Stock Valuation
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Inventory Summary KPIs (GET /api/v1/inventory/summary)');
  const summaryRes = await fetch(`${BASE_URL}/inventory/summary`, {
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  const summaryData = await summaryRes.json();

  assert(summaryRes.status === 200, 'HTTP status is 200 OK');
  assert(summaryData.success === true, 'Response success is true');
  assert(summaryData.data.total_tracked_ingredients === 28, 'total_tracked_ingredients matches 28');
  assert(summaryData.data.total_batches === 48, 'total_batches matches 48 seeded physical batches');
  assert(typeof summaryData.data.active_batches === 'number' && summaryData.data.active_batches > 0, 'active_batches is positive');
  assert(typeof summaryData.data.expired_batches === 'number' && summaryData.data.expired_batches > 0, 'expired_batches is positive');
  assert(typeof summaryData.data.batches_expiring_soon === 'number', 'batches_expiring_soon is numeric');
  assert(typeof summaryData.data.low_stock_ingredients === 'number', 'low_stock_ingredients is numeric');
  assert(typeof summaryData.data.out_of_stock_ingredients === 'number', 'out_of_stock_ingredients is numeric');
  assert(typeof summaryData.data.total_inventory_valuation === 'number' && summaryData.data.total_inventory_valuation > 0, 'total_inventory_valuation is positive');

  // --------------------------------------------------------------------------
  // TEST 6: Single Ingredient Stock Details & Batch Breakdown
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] Single Ingredient Details (GET /api/v1/inventory/:ingredientId)');
  const ingDetailRes = await fetch(`${BASE_URL}/inventory/1`, {
    headers: { Authorization: `Bearer ${chefToken}` }
  });
  const ingDetailData = await ingDetailRes.json();

  assert(ingDetailRes.status === 200, 'HTTP status is 200 OK');
  assert(ingDetailData.data.ingredient.id === 1, 'Ingredient ID matches 1');
  assert(ingDetailData.data.ingredient.name === 'All-Purpose Flour (Maida)', 'Ingredient name matches');
  assert(ingDetailData.data.ingredient.unit.abbreviation === 'kg', 'Base unit is kg');
  assert(typeof ingDetailData.data.stock.current_stock === 'number', 'Current stock is numeric');
  assert(Array.isArray(ingDetailData.data.batches), 'Returns batches array');
  assert(ingDetailData.data.batches.length === 3, 'Flour has 3 seeded physical batches');
  assert(ingDetailData.data.batches[0].batch_number === 'BATCH-FLOUR-001', 'First batch is BATCH-FLOUR-001');
  assert(Array.isArray(ingDetailData.data.suppliers), 'Returns suppliers catalog matrix');
  assert(ingDetailData.data.suppliers.length > 0, 'Has linked suppliers for Flour');
  assert(Array.isArray(ingDetailData.data.recent_movements), 'Returns recent stock movements');

  // --------------------------------------------------------------------------
  // TEST 7: Invalid Ingredient ID Handling
  // --------------------------------------------------------------------------
  console.log('\n[Test 7] Invalid Ingredient ID Handling');
  const badIngRes = await fetch(`${BASE_URL}/inventory/99999`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const badIngData = await badIngRes.json();
  assert(badIngRes.status === 404, 'Non-existent ingredient returns 404 Not Found');
  assert(badIngData.error.code === 'INGREDIENT_NOT_FOUND', 'Error code is INGREDIENT_NOT_FOUND');

  // --------------------------------------------------------------------------
  // TEST 8: Physical Inventory Batches Listing & FEFO Sorting
  // --------------------------------------------------------------------------
  console.log('\n[Test 8] Batches Listing & FEFO Sorting (GET /api/v1/inventory/batches)');
  const batchesRes = await fetch(`${BASE_URL}/inventory/batches?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  const batchesData = await batchesRes.json();

  assert(batchesRes.status === 200, 'HTTP status is 200 OK');
  assert(batchesData.data.length === 10, 'Page limit respected (10 batches)');
  assert(batchesData.meta.total === 48, 'Total batches count is 48');
  assert(Boolean(batchesData.data[0].expiry_date), 'First batch has expiry_date');
  assert(typeof batchesData.data[0].days_until_expiry === 'number', 'Calculated days_until_expiry present');
  assert(typeof batchesData.data[0].remaining_value === 'number', 'Remaining batch monetary value present');

  // Verify default FEFO sorting (earliest expiry date first)
  const isAscendingExpiry = batchesData.data.every((b, idx, arr) => {
    if (idx === 0) return true;
    return new Date(b.expiry_date) >= new Date(arr[idx - 1].expiry_date);
  });
  assert(isAscendingExpiry, 'Batches are correctly ordered in ascending expiry date order (FEFO-first)');

  // --------------------------------------------------------------------------
  // TEST 9: Filter Batches by Ingredient and Status
  // --------------------------------------------------------------------------
  console.log('\n[Test 9] Filter Batches by Ingredient and Status');
  const flourBatchesRes = await fetch(`${BASE_URL}/inventory/batches?ingredient_id=1&status=ACTIVE`, {
    headers: { Authorization: `Bearer ${chefToken}` }
  });
  const flourBatchesData = await flourBatchesRes.json();

  assert(flourBatchesRes.status === 200, 'HTTP status is 200 OK');
  assert(flourBatchesData.data.length === 3, 'Flour has 3 active batches');
  assert(flourBatchesData.data.every(b => b.ingredient_id === 1), 'All returned batches belong to ingredient 1');
  assert(flourBatchesData.data.every(b => b.status === 'ACTIVE'), 'All returned batches have status ACTIVE');

  // --------------------------------------------------------------------------
  // TEST 10: Single Batch Details by ID
  // --------------------------------------------------------------------------
  console.log('\n[Test 10] Single Batch Details (GET /api/v1/inventory/batches/:id)');
  const batchDetailRes = await fetch(`${BASE_URL}/inventory/batches/1`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const batchDetailData = await batchDetailRes.json();

  assert(batchDetailRes.status === 200, 'HTTP status is 200 OK');
  assert(batchDetailData.data.id === 1, 'Batch ID matches 1');
  assert(batchDetailData.data.batch_number === 'BATCH-FLOUR-001', 'Batch number matches BATCH-FLOUR-001');
  assert(batchDetailData.data.ingredient.name === 'All-Purpose Flour (Maida)', 'Resolved ingredient name');
  assert(typeof batchDetailData.data.quantity_remaining === 'number', 'quantity_remaining is numeric');
  assert(Array.isArray(batchDetailData.data.movements), 'Batch contains audit stock movements ledger');

  const badBatchRes = await fetch(`${BASE_URL}/inventory/batches/99999`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(badBatchRes.status === 404, 'Non-existent batch ID returns 404 Not Found');

  // --------------------------------------------------------------------------
  // TEST 11: Expiring and Expired Batches Report
  // --------------------------------------------------------------------------
  console.log('\n[Test 11] Expiring Batches Report (GET /api/v1/inventory/expiring)');
  const expiringRes = await fetch(`${BASE_URL}/inventory/expiring?days=30&status=ALL`, {
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  const expiringData = await expiringRes.json();

  assert(expiringRes.status === 200, 'HTTP status is 200 OK');
  assert(Array.isArray(expiringData.data), 'Returns expiring batches array');
  assert(expiringData.meta.days_ahead === 30, 'Metadata reflects 30 days ahead filter');

  // Verify distinction between EXPIRED and EXPIRING SOON
  const expiredBatch = expiringData.data.find(b => b.urgency_status === 'EXPIRED');
  assert(Boolean(expiredBatch), 'Contains identified EXPIRED batch');
  assert(expiredBatch.is_expired === true, 'Flag is_expired is true for expired batch');

  const criticalOrWarningBatch = expiringData.data.find(b => ['CRITICAL', 'WARNING'].includes(b.urgency_status));
  if (criticalOrWarningBatch) {
    assert(criticalBatchNotExpired(criticalOrWarningBatch), 'Expiring soon batch is not labeled as already expired');
  }

  function criticalBatchNotExpired(batch) {
    return batch.is_expired === false && batch.days_until_expiry >= 0;
  }

  // Filter specifically by status=EXPIRED
  const onlyExpiredRes = await fetch(`${BASE_URL}/inventory/expiring?status=EXPIRED`, {
    headers: { Authorization: `Bearer ${chefToken}` }
  });
  const onlyExpiredData = await onlyExpiredRes.json();
  assert(onlyExpiredRes.status === 200, 'Status=EXPIRED returns 200 OK');
  assert(onlyExpiredData.data.every(b => b.urgency_status === 'EXPIRED'), 'All returned items have urgency_status EXPIRED');

  // --------------------------------------------------------------------------
  // TEST 12: Low-Stock Ingredients Report
  // --------------------------------------------------------------------------
  console.log('\n[Test 12] Low-Stock Report (GET /api/v1/inventory/low-stock)');
  const lowStockRes = await fetch(`${BASE_URL}/inventory/low-stock`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const lowStockData = await lowStockRes.json();

  assert(lowStockRes.status === 200, 'HTTP status is 200 OK');
  assert(Array.isArray(lowStockData.data), 'Returns low stock items array');
  assert(lowStockData.data.every(i => ['OUT_OF_STOCK', 'LOW_STOCK'].includes(i.stock_status)), 'All items are OUT_OF_STOCK or LOW_STOCK');
  assert(lowStockData.data.every(i => i.current_stock <= i.minimum_stock_level), 'Current stock is <= minimum_stock_level for all items');
  assert(lowStockData.data.every(i => typeof i.deficit_to_min === 'number'), 'Calculated deficit_to_min present');
  assert(lowStockData.data.every(i => typeof i.suggested_reorder_quantity === 'number'), 'Calculated suggested_reorder_quantity present');

  // --------------------------------------------------------------------------
  // TEST 13: Stock Movements Audit Ledger
  // --------------------------------------------------------------------------
  console.log('\n[Test 13] Stock Movements Audit Ledger (GET /api/v1/inventory/movements)');
  const movementsRes = await fetch(`${BASE_URL}/inventory/movements?page=1&limit=15`, {
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  const movementsData = await movementsRes.json();

  assert(movementsRes.status === 200, 'HTTP status is 200 OK');
  assert(Array.isArray(movementsData.data), 'Returns movements array');
  assert(movementsData.data.length === 15, 'Respects limit 15');
  assert(movementsData.meta.total >= 48, 'Contains all historical stock movements');

  const firstMove = movementsData.data[0];
  assert(Boolean(firstMove.movement_type), 'Includes movement_type');
  assert(typeof firstMove.quantity === 'number', 'Includes numeric movement quantity');
  assert(typeof firstMove.balance_after === 'number', 'Includes numeric balance_after');
  assert(Boolean(firstMove.batch.batch_number), 'Includes related batch_number');
  assert(Boolean(firstMove.ingredient.name), 'Includes related ingredient name');
  assert(Boolean(firstMove.created_at), 'Includes movement timestamp');

  // Filter movements by type
  const receiptMovementsRes = await fetch(`${BASE_URL}/inventory/movements?movement_type=PURCHASE_RECEIPT`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const receiptMovementsData = await receiptMovementsRes.json();
  assert(receiptMovementsRes.status === 200, 'Filter by movement_type returns 200 OK');
  assert(receiptMovementsData.data.every(m => m.movement_type === 'PURCHASE_RECEIPT'), 'All movements are PURCHASE_RECEIPT');

  // --------------------------------------------------------------------------
  // TEST 14: Seed Data & Database Preservation Check
  // --------------------------------------------------------------------------
  console.log('\n[Test 14] Seed Data Preservation Check');
  const conn = await mysql.createConnection({
    host: env.MYSQL.host,
    port: env.MYSQL.port,
    user: env.MYSQL.user,
    password: env.MYSQL.password,
    database: env.MYSQL.database
  });

  const [batchesCountRows] = await conn.execute('SELECT COUNT(*) AS total FROM inventory_batches');
  assert(batchesCountRows[0].total === 48, 'Database check: exactly 48 inventory batches exist');

  const [ingredientsCountRows] = await conn.execute('SELECT COUNT(*) AS total FROM ingredients');
  assert(ingredientsCountRows[0].total === 28, 'Database check: exactly 28 master ingredients exist');

  const [flourCheck] = await conn.execute('SELECT quantity_remaining FROM inventory_batches WHERE id = 1');
  assert(Number(flourCheck[0].quantity_remaining) === 36.453, 'Database check: Batch 1 stock remains exactly 36.453 kg (no deductions occurred)');

  await conn.end();
  await closeMySQLPool();

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  Tests Completed: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Inventory test suite unhandled failure:', err);
  process.exit(1);
});
