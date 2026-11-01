import mysql from 'mysql2/promise';
import { AuditLog } from '../src/models/mongo/AuditLog.js';
import { connectMongoDB, closeMongoDB } from '../src/config/mongodb.js';
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
  console.log('  Urban Bites Auth & Staff Management API Verification Suite   ');
  console.log('===============================================================\n');

  let adminToken = '';
  let cashierToken = '';
  let tempUserId = null;
  let tempDeactUserId = null;

  // --------------------------------------------------------------------------
  // TEST 1: Valid Login
  // --------------------------------------------------------------------------
  console.log('[Test 1] Valid Login (POST /api/v1/auth/login)');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'rohit_admin',
      password: 'UrbanBites@2026'
    })
  });
  const loginData = await loginRes.json();

  assert(loginRes.status === 200, 'HTTP status is 200 OK');
  assert(loginData.success === true, 'Response success is true');
  assert(Boolean(loginData.data.token), 'JWT token string returned');
  assert(loginData.data.user.username === 'rohit_admin', 'Username matches rohit_admin');
  assert(loginData.data.user.role === 'ADMIN', 'Role matches ADMIN');
  assert(loginData.data.user.password_hash === undefined, 'Security: password_hash is omitted');
  adminToken = loginData.data.token;

  // --------------------------------------------------------------------------
  // TEST 2: Incorrect Password
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] Incorrect Password');
  const badPassRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'rohit_admin',
      password: 'WrongPassword@123'
    })
  });
  const badPassData = await badPassRes.json();

  assert(badPassRes.status === 401, 'HTTP status is 401 Unauthorized');
  assert(badPassData.success === false, 'success is false');
  assert(badPassData.error.code === 'INVALID_CREDENTIALS', 'Error code is INVALID_CREDENTIALS');
  assert(badPassData.error.message.includes('Invalid username/email or password'), 'Generic error message returned');

  // --------------------------------------------------------------------------
  // TEST 3: Unknown Username (Anti-User Enumeration)
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Unknown Username');
  const unknownUserRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'non_existent_staff_xyz',
      password: 'AnyPassword@123'
    })
  });
  const unknownUserData = await unknownUserRes.json();

  assert(unknownUserRes.status === 401, 'HTTP status is 401 Unauthorized');
  assert(unknownUserData.error.message.includes('Invalid username/email or password'), 'Same generic error message returned (avoids user enumeration)');

  // --------------------------------------------------------------------------
  // TEST 4: Inactive Account Login
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] Inactive Account Login');
  // Create isolated inactive user via Admin API
  const createInactiveRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      role_id: 4, // CASHIER
      username: 'temp_inactive_cashier',
      email: 'temp.inactive@urbanbites.in',
      password: 'TempPassword@2026',
      full_name: 'Temp Inactive User',
      is_active: false
    })
  });
  const createInactiveData = await createInactiveRes.json();
  tempUserId = createInactiveData.data.id;

  const inactiveLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'temp_inactive_cashier',
      password: 'TempPassword@2026'
    })
  });
  const inactiveLoginData = await inactiveLoginRes.json();

  assert(inactiveLoginRes.status === 401, 'HTTP status is 401 Unauthorized');
  assert(inactiveLoginData.error.code === 'ACCOUNT_DEACTIVATED', 'Error code is ACCOUNT_DEACTIVATED');

  // --------------------------------------------------------------------------
  // TEST 5: Profile Without JWT
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Profile Without JWT');
  const noTokenRes = await fetch(`${BASE_URL}/auth/profile`);
  const noTokenData = await noTokenRes.json();

  assert(noTokenRes.status === 401, 'HTTP status is 401 Unauthorized');
  assert(noTokenData.error.code === 'TOKEN_MISSING', 'Error code is TOKEN_MISSING');

  // --------------------------------------------------------------------------
  // TEST 6: Profile With Valid JWT
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] Profile With Valid JWT');
  const profileRes = await fetch(`${BASE_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const profileData = await profileRes.json();

  assert(profileRes.status === 200, 'HTTP status is 200 OK');
  assert(profileData.data.username === 'rohit_admin', 'Username matches rohit_admin');
  assert(profileData.data.role === 'ADMIN', 'Role matches ADMIN');
  assert(profileData.data.is_active === true, 'is_active is true');
  assert(profileData.data.password_hash === undefined, 'Security: password_hash not returned');

  // --------------------------------------------------------------------------
  // TEST 7: Profile After User Deactivation
  // --------------------------------------------------------------------------
  console.log('\n[Test 7] Profile After User Deactivation (Does not trust stale JWT)');
  // 1. Create temporary active user
  const tempUserRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      role_id: 3, // CHEF
      username: 'temp_deact_chef',
      email: 'temp.deact@urbanbites.in',
      password: 'TempPassword@2026',
      full_name: 'Temp Deact Chef',
      is_active: true
    })
  });
  const tempUserData = await tempUserRes.json();
  tempDeactUserId = tempUserData.data.id;

  // 2. Log in as that user to obtain a valid JWT
  const tempLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'temp_deact_chef',
      password: 'TempPassword@2026'
    })
  });
  const tempLoginData = await tempLoginRes.json();
  const tempChefToken = tempLoginData.data.token;

  // 3. Admin deactivates the user
  await fetch(`${BASE_URL}/users/${tempDeactUserId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ is_active: false })
  });

  // 4. Deactivated user attempts to access /auth/profile with previously valid JWT
  const staleProfileRes = await fetch(`${BASE_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${tempChefToken}` }
  });
  const staleProfileData = await staleProfileRes.json();

  assert(staleProfileRes.status === 401, 'HTTP status is 401 Unauthorized');
  assert(staleProfileData.error.code === 'ACCOUNT_DEACTIVATED', 'Immediate revocation: ACCOUNT_DEACTIVATED');

  // --------------------------------------------------------------------------
  // TEST 8: Admin Accessing User Management
  // --------------------------------------------------------------------------
  console.log('\n[Test 8] Admin Accessing User Management (GET /api/v1/users)');
  const usersListRes = await fetch(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const usersListData = await usersListRes.json();

  assert(usersListRes.status === 200, 'HTTP status is 200 OK');
  assert(usersListData.data.length >= 10, 'Staff members list returned');
  assert(usersListData.meta.total >= 10, 'Pagination metadata returned');

  // --------------------------------------------------------------------------
  // TEST 9: Cashier Attempting Admin Access (RBAC Protection)
  // --------------------------------------------------------------------------
  console.log('\n[Test 9] Cashier Attempting Admin Access');
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

  const forbiddenRes = await fetch(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  const forbiddenData = await forbiddenRes.json();

  assert(forbiddenRes.status === 403, 'HTTP status is 403 Forbidden');
  assert(forbiddenData.error.code === 'FORBIDDEN_ROLE', 'Error code is FORBIDDEN_ROLE');

  // --------------------------------------------------------------------------
  // TEST 10: Duplicate Username / Email
  // --------------------------------------------------------------------------
  console.log('\n[Test 10] Duplicate Username & Email Rejection');
  const dupUserRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      role_id: 4,
      username: 'rohit_admin', // duplicate
      email: 'unique.email@urbanbites.in',
      password: 'SamplePassword@123',
      full_name: 'Duplicate Test'
    })
  });
  const dupUserData = await dupUserRes.json();

  assert(dupUserRes.status === 409, 'Duplicate username rejected with 409 Conflict');
  assert(dupUserData.error.code === 'DUPLICATE_USERNAME', 'Error code is DUPLICATE_USERNAME');

  const dupEmailRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      role_id: 4,
      username: 'new_unique_user',
      email: 'rohit.admin@urbanbites.in', // duplicate
      password: 'SamplePassword@123',
      full_name: 'Duplicate Email Test'
    })
  });
  const dupEmailData = await dupEmailRes.json();

  assert(dupEmailRes.status === 409, 'Duplicate email rejected with 409 Conflict');
  assert(dupEmailData.error.code === 'DUPLICATE_EMAIL', 'Error code is DUPLICATE_EMAIL');

  // --------------------------------------------------------------------------
  // TEST 11: Invalid Role ID
  // --------------------------------------------------------------------------
  console.log('\n[Test 11] Invalid Role ID Rejection');
  const invalidRoleRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      role_id: 9999, // non-existent role
      username: 'test_invalid_role',
      email: 'invalid.role@urbanbites.in',
      password: 'SamplePassword@123',
      full_name: 'Invalid Role Test'
    })
  });
  const invalidRoleData = await invalidRoleRes.json();

  assert(invalidRoleRes.status === 400, 'Invalid role rejected with 400 Bad Request');
  assert(invalidRoleData.error.code === 'INVALID_ROLE_ID', 'Error code is INVALID_ROLE_ID');

  // --------------------------------------------------------------------------
  // TEST 12: Password Hash Never Returned
  // --------------------------------------------------------------------------
  console.log('\n[Test 12] Password Hash Omission Across Endpoints');
  const singleUserRes = await fetch(`${BASE_URL}/users/1`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const singleUserData = await singleUserRes.json();

  assert(singleUserData.data.password_hash === undefined, 'GET /users/:id omits password_hash');
  assert(usersListData.data.every(u => u.password_hash === undefined), 'GET /users list omits password_hash across all items');

  // --------------------------------------------------------------------------
  // TEST 13: Last Active Admin Protection
  // --------------------------------------------------------------------------
  console.log('\n[Test 13] Last Active Admin Protection');
  // Rohit Sharma (id: 1) and Kavita Rao (id: 10) are the 2 active ADMINs
  // 1. Temporarily deactivate Kavita
  await fetch(`${BASE_URL}/users/10/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ is_active: false })
  });

  // Now Rohit is the only active ADMIN left in the system!
  // 2. Attempt to deactivate Rohit
  const deactLastAdminRes = await fetch(`${BASE_URL}/users/1/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ is_active: false })
  });
  const deactLastAdminData = await deactLastAdminRes.json();

  assert(deactLastAdminRes.status === 400, 'Deactivating last active admin rejected with 400 Bad Request');
  assert(deactLastAdminData.error.code === 'LAST_ADMIN_PROTECTION', 'Error code is LAST_ADMIN_PROTECTION');

  // 3. Reactivate Kavita to restore state
  await fetch(`${BASE_URL}/users/10/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ is_active: true })
  });
  console.log('  🛡️ Restored Kavita Rao active status');

  // --------------------------------------------------------------------------
  // TEST 14: MongoDB Atlas Audit Logging & Sanitization
  // --------------------------------------------------------------------------
  console.log('\n[Test 14] MongoDB Atlas Audit Logging & Sanitization');
  await connectMongoDB();

  const loginSuccessLog = await AuditLog.findOne({ action: 'LOGIN_SUCCESS', username: 'rohit_admin' }).sort({ createdAt: -1 });
  assert(Boolean(loginSuccessLog), 'LOGIN_SUCCESS audit log found in MongoDB Atlas');
  assert(loginSuccessLog.metadata?.password === undefined, 'Audit log metadata: password is not stored');
  assert(loginSuccessLog.metadata?.token === undefined, 'Audit log metadata: token is not stored');

  const loginFailedLog = await AuditLog.findOne({ action: 'LOGIN_FAILED', 'metadata.reason': 'INVALID_PASSWORD' }).sort({ createdAt: -1 });
  assert(Boolean(loginFailedLog), 'LOGIN_FAILED audit log found in MongoDB Atlas');

  const staffCreatedLog = await AuditLog.findOne({ action: 'STAFF_CREATED', 'metadata.createdUsername': 'temp_deact_chef' }).sort({ createdAt: -1 });
  assert(Boolean(staffCreatedLog), 'STAFF_CREATED audit log found in MongoDB Atlas');

  // Clean up isolated test users from MySQL and MongoDB
  const conn = await mysql.createConnection({
    host: env.MYSQL.host,
    port: env.MYSQL.port,
    user: env.MYSQL.user,
    password: env.MYSQL.password,
    database: env.MYSQL.database
  });

  if (tempUserId) {
    await conn.execute('DELETE FROM users WHERE id = ?', [tempUserId]);
  }
  if (tempDeactUserId) {
    await conn.execute('DELETE FROM users WHERE id = ?', [tempDeactUserId]);
  }
  await conn.end();

  // Clean up test audit logs
  await AuditLog.deleteMany({ action: { $in: ['STAFF_CREATED', 'STAFF_DEACTIVATED'] }, 'metadata.createdUsername': { $in: ['temp_inactive_cashier', 'temp_deact_chef'] } });
  console.log('  🧹 Cleaned up isolated test staff accounts from MySQL & MongoDB Atlas');

  await closeMongoDB();

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  Summary: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite uncaught failure:', err);
  process.exit(1);
});
