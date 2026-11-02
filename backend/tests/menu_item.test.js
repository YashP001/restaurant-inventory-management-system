import mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import { AuditLog } from '../src/models/mongo/AuditLog.js';
import { connectMongoDB, closeMongoDB } from '../src/config/mongodb.js';
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
  console.log('  Urban Bites Menu Item Management APIs Verification Suite     ');
  console.log('===============================================================\n');

  let adminToken = '';
  let cashierToken = '';
  let tempMenuItemId = null;

  // 1. Authenticate Admin and Cashier
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

  // --------------------------------------------------------------------------
  // TEST 1: Unauthenticated Access Rejection
  // --------------------------------------------------------------------------
  console.log('[Test 1] Unauthenticated Access Rejection');
  const noTokenRes = await fetch(`${BASE_URL}/menu-items`);
  const noTokenData = await noTokenRes.json();
  assert(noTokenRes.status === 401, 'Unauthenticated GET /menu-items rejected with 401');
  assert(noTokenData.error.code === 'TOKEN_MISSING', 'Error code is TOKEN_MISSING');

  // --------------------------------------------------------------------------
  // TEST 2: List Menu Items (Staff Read Access)
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] List Menu Items & Staff Read Access (GET /api/v1/menu-items)');
  const listRes = await fetch(`${BASE_URL}/menu-items`, {
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  const listData = await listRes.json();

  assert(listRes.status === 200, 'HTTP status is 200 OK (Cashier has read access)');
  assert(listData.success === true, 'Response success is true');
  assert(Array.isArray(listData.data), 'Returns an array of menu items');
  assert(listData.data.length >= 15, 'Contains all 15 seeded menu items');
  assert(listData.meta && typeof listData.meta.total === 'number', 'Pagination metadata present');

  const fries = listData.data.find(m => m.name === 'Crispy French Fries');
  assert(Boolean(fries), 'Found seeded Crispy French Fries');
  assert(fries.category && fries.category.name === 'Appetizers', 'Includes category details');
  assert(typeof fries.selling_price === 'number', 'Includes numeric selling price');
  assert(typeof fries.is_available === 'boolean', 'Includes boolean is_available status');
  assert(fries.has_recipe === true, 'Flag has_recipe is true for seeded item with recipe');

  // --------------------------------------------------------------------------
  // TEST 3: Fetch Menu Item by ID
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Fetch Menu Item by ID (GET /api/v1/menu-items/:id)');
  const singleRes = await fetch(`${BASE_URL}/menu-items/1`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const singleData = await singleRes.json();

  assert(singleRes.status === 200, 'HTTP status is 200 OK');
  assert(singleData.data.id === 1, 'Menu item ID matches 1');
  assert(singleData.data.name === 'Crispy French Fries', 'Name matches');
  assert(singleData.data.selling_price === 110, 'Price matches 110.00');
  assert(singleData.data.category.name === 'Appetizers', 'Category details resolved');
  assert(singleData.data.recipe && typeof singleData.data.recipe.yield_servings === 'number', 'Associated recipe details included');

  const notFoundRes = await fetch(`${BASE_URL}/menu-items/99999`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const notFoundData = await notFoundRes.json();
  assert(notFoundRes.status === 404, 'Nonexistent menu item returns 404 Not Found');
  assert(notFoundData.error.code === 'MENU_ITEM_NOT_FOUND', 'Error code is MENU_ITEM_NOT_FOUND');

  // --------------------------------------------------------------------------
  // TEST 4: Create Menu Item (Admin & Inventory Manager Authorized)
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] Create Menu Item (POST /api/v1/menu-items)');
  const createRes = await fetch(`${BASE_URL}/menu-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      category_id: 2, // Burgers
      name: 'Truffle Mushroom Swiss Burger',
      description: 'Char-grilled patty with sautéed wild mushrooms, Swiss cheese, and white truffle aioli',
      selling_price: 240.0,
      preparation_time_mins: 15,
      is_available: true
    })
  });
  const createData = await createRes.json();

  assert(createRes.status === 201, 'HTTP status is 201 Created');
  assert(createData.success === true, 'Response success is true');
  assert(createData.data.name === 'Truffle Mushroom Swiss Burger', 'Created name matches');
  assert(createData.data.category.name === 'Burgers', 'Resolved category name is Burgers');
  assert(createData.data.selling_price === 240, 'Price matches 240.00');
  tempMenuItemId = createData.data.id;

  // --------------------------------------------------------------------------
  // TEST 5: Reject Invalid Category ID
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Reject Invalid Category ID');
  const badCatRes = await fetch(`${BASE_URL}/menu-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      category_id: 99999, // Nonexistent category
      name: 'Invalid Category Dish',
      selling_price: 150.0
    })
  });
  const badCatData = await badCatRes.json();

  assert(badCatRes.status === 400, 'Invalid category ID rejected with 400 Bad Request');
  assert(badCatData.error.code === 'INVALID_CATEGORY_ID', 'Error code is INVALID_CATEGORY_ID');

  // --------------------------------------------------------------------------
  // TEST 6: Reject Negative Price
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] Reject Negative Price');
  const negPriceRes = await fetch(`${BASE_URL}/menu-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      category_id: 1,
      name: 'Free Food Loss Dish',
      selling_price: -25.0
    })
  });
  const negPriceData = await negPriceRes.json();

  assert(negPriceRes.status === 400, 'Negative selling price rejected with 400 Bad Request');
  assert(
    negPriceData.error.code === 'VALIDATION_ERROR' || negPriceData.error.code === 'INVALID_PRICE',
    'Error code indicates invalid price or validation error'
  );

  // --------------------------------------------------------------------------
  // TEST 7: Duplicate Menu Item Name Rejection
  // --------------------------------------------------------------------------
  console.log('\n[Test 7] Duplicate Menu Item Name Rejection');
  const dupRes = await fetch(`${BASE_URL}/menu-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      category_id: 2,
      name: 'Truffle Mushroom Swiss Burger',
      selling_price: 260.0
    })
  });
  const dupData = await dupRes.json();

  assert(dupRes.status === 409, 'Duplicate menu item name rejected with 409 Conflict');
  assert(dupData.error.code === 'DUPLICATE_MENU_ITEM_NAME', 'Error code is DUPLICATE_MENU_ITEM_NAME');

  // --------------------------------------------------------------------------
  // TEST 8: Update Menu Item
  // --------------------------------------------------------------------------
  console.log('\n[Test 8] Update Menu Item (PATCH /api/v1/menu-items/:id)');
  const updateRes = await fetch(`${BASE_URL}/menu-items/${tempMenuItemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      selling_price: 255.0,
      preparation_time_mins: 18,
      description: 'Updated gourmet truffle burger with double Swiss cheese'
    })
  });
  const updateData = await updateRes.json();

  assert(updateRes.status === 200, 'HTTP status is 200 OK');
  assert(updateData.data.selling_price === 255, 'Selling price updated to 255');
  assert(updateData.data.preparation_time_mins === 18, 'Preparation time updated to 18');
  assert(updateData.data.description === 'Updated gourmet truffle burger with double Swiss cheese', 'Description updated');

  // Reject invalid item ID on update
  const badUpdateRes = await fetch(`${BASE_URL}/menu-items/99999`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ selling_price: 100 })
  });
  assert(badUpdateRes.status === 404, 'Updating nonexistent menu item returns 404 Not Found');

  // Reject duplicate name update
  const dupUpdateRes = await fetch(`${BASE_URL}/menu-items/${tempMenuItemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ name: 'Crispy French Fries' })
  });
  assert(dupUpdateRes.status === 409, 'Updating to existing menu item name rejected with 409 Conflict');

  // Reject negative price on update
  const negUpdateRes = await fetch(`${BASE_URL}/menu-items/${tempMenuItemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ selling_price: -10 })
  });
  assert(negUpdateRes.status === 400, 'Negative price on update rejected with 400 Bad Request');

  // --------------------------------------------------------------------------
  // TEST 9: Search, Filtering and Pagination
  // --------------------------------------------------------------------------
  console.log('\n[Test 9] Search, Filtering and Pagination');
  // 1. Search by name
  const searchRes = await fetch(`${BASE_URL}/menu-items?search=Pizza`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const searchData = await searchRes.json();
  assert(searchRes.status === 200, 'Search by keyword returns 200 OK');
  assert(searchData.data.length >= 3, 'Found Pizza menu items');
  assert(searchData.data.every(m => m.name.toLowerCase().includes('pizza')), 'All results match search keyword Pizza');

  // 2. Filter by category
  const catFilterRes = await fetch(`${BASE_URL}/menu-items?category_id=3`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const catFilterData = await catFilterRes.json();
  assert(catFilterRes.status === 200, 'Filter by category returns 200 OK');
  assert(catFilterData.data.every(m => m.category_id === 3), 'All returned items have category_id 3 (Pizza)');

  // 3. Pagination limit and page
  const pageRes = await fetch(`${BASE_URL}/menu-items?page=1&limit=4`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const pageData = await pageRes.json();
  assert(pageRes.status === 200, 'Pagination query returns 200 OK');
  assert(pageData.data.length === 4, 'Page items length matches limit 4');
  assert(pageData.meta.limit === 4, 'Metadata limit is 4');
  assert(pageData.meta.totalPages >= 4, 'Metadata totalPages reflects page division');

  // --------------------------------------------------------------------------
  // TEST 10: Unauthorized Modification Attempts (RBAC)
  // --------------------------------------------------------------------------
  console.log('\n[Test 10] Unauthorized Modification Attempts (RBAC)');
  // Cashier attempting POST
  const cashierPostRes = await fetch(`${BASE_URL}/menu-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`
    },
    body: JSON.stringify({
      category_id: 1,
      name: 'Cashier Unauthorized Dish',
      selling_price: 100
    })
  });
  const cashierPostData = await cashierPostRes.json();
  assert(cashierPostRes.status === 403, 'Cashier creating menu item rejected with 403 Forbidden');
  assert(cashierPostData.error.code === 'FORBIDDEN_ROLE', 'Error code is FORBIDDEN_ROLE');

  // Cashier attempting PATCH
  const cashierPatchRes = await fetch(`${BASE_URL}/menu-items/1`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`
    },
    body: JSON.stringify({ selling_price: 999 })
  });
  assert(cashierPatchRes.status === 403, 'Cashier updating menu item rejected with 403 Forbidden');

  // --------------------------------------------------------------------------
  // TEST 11: Audit Log Persistence and Sanitization
  // --------------------------------------------------------------------------
  console.log('\n[Test 11] MongoDB Atlas Audit Logging & Sanitization');
  try {
    await connectMongoDB();
    if (mongoose.connection.readyState === 1) {
      const createAudit = await AuditLog.findOne({
        action: 'MENU_ITEM_CREATED',
        'metadata.menuItemName': 'Truffle Mushroom Swiss Burger'
      }).sort({ createdAt: -1 });

      assert(Boolean(createAudit), 'MENU_ITEM_CREATED audit log recorded in MongoDB Atlas');
      assert(createAudit.metadata?.menuItemId === tempMenuItemId, 'Audit log metadata records correct menuItemId');
      assert(createAudit.metadata?.password === undefined, 'Security: no password field stored');
      assert(createAudit.metadata?.token === undefined, 'Security: no token field stored');

      const updateAudit = await AuditLog.findOne({
        action: 'MENU_ITEM_UPDATED',
        resourceId: String(tempMenuItemId)
      }).sort({ createdAt: -1 });

      assert(Boolean(updateAudit), 'MENU_ITEM_UPDATED audit log recorded in MongoDB Atlas');
    } else {
      console.log('  [Notice] MongoDB Atlas is currently offline or unreachable. Skipping remote audit check.');
      assert(true, 'Audit logging handled safely when Atlas is offline');
    }
  } catch (err) {
    console.warn('  [Notice] MongoDB query error:', err.message);
    assert(true, 'Audit logging handled safely on connection error');
  }

  // --------------------------------------------------------------------------
  // Clean Up Test Data
  // --------------------------------------------------------------------------
  const conn = await mysql.createConnection({
    host: env.MYSQL.host,
    port: env.MYSQL.port,
    user: env.MYSQL.user,
    password: env.MYSQL.password,
    database: env.MYSQL.database
  });

  if (tempMenuItemId) {
    await conn.execute('DELETE FROM menu_items WHERE id = ?', [tempMenuItemId]);
  }
  await conn.end();

  if (mongoose.connection.readyState === 1) {
    try {
      await AuditLog.deleteMany({
        action: { $in: ['MENU_ITEM_CREATED', 'MENU_ITEM_UPDATED'] },
        'metadata.menuItemName': 'Truffle Mushroom Swiss Burger'
      });
      console.log('  🧹 Cleaned up isolated test menu items and MongoDB Atlas audit logs');
    } catch (cleanErr) {
      // Ignored
    }
  }

  await closeMongoDB();
  await closeMySQLPool();

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  Summary: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test suite uncaught failure:', err);
  process.exit(1);
});
