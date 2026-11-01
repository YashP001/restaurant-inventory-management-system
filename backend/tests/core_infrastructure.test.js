import { z } from 'zod';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectMongoDB, closeMongoDB } from '../src/config/mongodb.js';
import { ApiResponse } from '../src/utils/apiResponse.js';
import { ApiError } from '../src/utils/apiError.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { authenticateJWT, generateToken } from '../src/middleware/auth.js';
import { requireRole } from '../src/middleware/rbac.js';
import { validateBody } from '../src/middleware/validate.js';
import { AuditLog } from '../src/models/mongo/AuditLog.js';
import { closeMySQLPool } from '../src/config/mysql.js';

// Test Runner Engine
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

async function runTests() {
  console.log('===============================================================');
  console.log('  Urban Bites Backend Core Infrastructure & Utilities Suite    ');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: API Response Utility Contract
  // --------------------------------------------------------------------------
  console.log('[Test 1] ApiResponse Utility');
  const mockRes = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };

  const resp = new ApiResponse(200, { menuId: 1 }, 'Menu loaded', { page: 1 });
  resp.send(mockRes);

  assert(mockRes.body.success === true, 'Success flag is true for 200 OK');
  assert(mockRes.body.statusCode === 200, 'Status code matches 200');
  assert(mockRes.body.message === 'Menu loaded', 'Message matches payload');
  assert(mockRes.body.data.menuId === 1, 'Data payload is preserved');
  assert(mockRes.body.meta.page === 1, 'Meta payload is preserved');

  // --------------------------------------------------------------------------
  // TEST 2: Custom ApiError Class
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] ApiError Utility');
  const customErr = ApiError.badRequest('Invalid order item', 'ITEM_INVALID', [{ item: 'Fries' }]);
  assert(customErr.statusCode === 400, 'Status code is 400');
  assert(customErr.errorCode === 'ITEM_INVALID', 'Error code matches ITEM_INVALID');
  assert(customErr.details[0].item === 'Fries', 'Error details preserved');
  assert(customErr.isOperational === true, 'Operational error flag is true');

  // --------------------------------------------------------------------------
  // TEST 3: Centralized Error Handler Normalization
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Centralized Error Handler Normalization');
  const mockErrRes = {
    statusCode: 500,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  const mockReq = { method: 'POST', originalUrl: '/api/v1/orders' };

  errorHandler(customErr, mockReq, mockErrRes, () => {});
  assert(mockErrRes.statusCode === 400, 'Error handler outputs correct status code 400');
  assert(mockErrRes.body.success === false, 'Error response has success: false');
  assert(mockErrRes.body.error.code === 'ITEM_INVALID', 'Error response has code ITEM_INVALID');
  assert(mockErrRes.body.error.details.length === 1, 'Details array present');

  // --------------------------------------------------------------------------
  // TEST 4: JWT Authentication - Valid Token
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] JWT Authentication: Valid Token');
  const validToken = generateToken({
    id: 1,
    username: 'rohit_admin',
    role: 'ADMIN',
    email: 'rohit@urbanbites.in'
  });

  const validReq = { headers: { authorization: `Bearer ${validToken}` } };
  let validNextCalled = false;
  let validNextError = null;

  await authenticateJWT(validReq, {}, (err) => {
    validNextCalled = true;
    validNextError = err;
  });

  assert(validNextCalled === true && !validNextError, 'Valid token passes to next()');
  assert(validReq.user.username === 'rohit_admin', 'req.user.username decoded correctly');
  assert(validReq.user.role === 'ADMIN', 'req.user.role decoded correctly');

  // --------------------------------------------------------------------------
  // TEST 5: JWT Authentication - Missing Token
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] JWT Authentication: Missing Token');
  const missingReq = { headers: {} };
  let missingErr = null;

  await authenticateJWT(missingReq, {}, (err) => { missingErr = err; });
  assert(missingErr instanceof ApiError, 'Missing token produces ApiError');
  assert(missingErr.statusCode === 401, 'Status code is 401');
  assert(missingErr.errorCode === 'TOKEN_MISSING', 'Error code is TOKEN_MISSING');

  // --------------------------------------------------------------------------
  // TEST 6: JWT Authentication - Invalid Token
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] JWT Authentication: Invalid Token');
  const invalidReq = { headers: { authorization: 'Bearer this_is_a_tampered_invalid_token' } };
  let invalidErr = null;

  await authenticateJWT(invalidReq, {}, (err) => { invalidErr = err; });
  assert(invalidErr.statusCode === 401, 'Invalid token returns 401');
  assert(invalidErr.errorCode === 'INVALID_TOKEN', 'Error code is INVALID_TOKEN');

  // --------------------------------------------------------------------------
  // TEST 7: JWT Authentication - Expired Token
  // --------------------------------------------------------------------------
  console.log('\n[Test 7] JWT Authentication: Expired Token');
  const expiredToken = generateToken({ id: 2, username: 'test_exp' }, '-1s');
  const expiredReq = { headers: { authorization: `Bearer ${expiredToken}` } };
  let expiredErr = null;

  await authenticateJWT(expiredReq, {}, (err) => { expiredErr = err; });
  assert(expiredErr.statusCode === 401, 'Expired token returns 401');
  assert(expiredErr.errorCode === 'TOKEN_EXPIRED', 'Error code is TOKEN_EXPIRED');

  // --------------------------------------------------------------------------
  // TEST 8: Role-Based Access Control (RBAC) - Authorized
  // --------------------------------------------------------------------------
  console.log('\n[Test 8] RBAC: Authorized Role (Admin)');
  const adminReq = { user: { id: 1, role: 'ADMIN', is_active: true } };
  let adminNextCalled = false;
  let adminNextErr = null;

  requireRole('ADMIN', 'INVENTORY_MANAGER')(adminReq, {}, (err) => {
    adminNextCalled = true;
    adminNextErr = err;
  });

  assert(adminNextCalled === true && !adminNextErr, 'Admin user authorized successfully');

  // --------------------------------------------------------------------------
  // TEST 9: Role-Based Access Control (RBAC) - Unauthorized
  // --------------------------------------------------------------------------
  console.log('\n[Test 9] RBAC: Unauthorized Role (Cashier accessing Admin route)');
  const cashierReq = { user: { id: 5, role: 'CASHIER', is_active: true } };
  let cashierErr = null;

  requireRole('ADMIN', 'INVENTORY_MANAGER')(cashierReq, {}, (err) => {
    cashierErr = err;
  });

  assert(cashierErr instanceof ApiError, 'Unauthorized role produces ApiError');
  assert(cashierErr.statusCode === 403, 'Unauthorized role returns 403 Forbidden');
  assert(cashierErr.errorCode === 'FORBIDDEN_ROLE', 'Error code is FORBIDDEN_ROLE');

  // Inactive user in RBAC produces 401 ACCOUNT_DEACTIVATED
  const inactiveReq = { user: { id: 5, role: 'ADMIN', is_active: false } };
  let inactiveErr = null;
  requireRole('ADMIN')(inactiveReq, {}, (err) => {
    inactiveErr = err;
  });
  assert(inactiveErr?.statusCode === 401, 'Deactivated account returns 401 Unauthorized in RBAC');
  assert(inactiveErr?.errorCode === 'ACCOUNT_DEACTIVATED', 'Deactivated account error code is ACCOUNT_DEACTIVATED');

  // --------------------------------------------------------------------------
  // TEST 10: Request Validation Middleware with Zod
  // --------------------------------------------------------------------------
  console.log('\n[Test 10] Zod Request Body Validation');
  const sampleSchema = z.object({
    order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'ONLINE']),
    items: z.array(z.object({
      menu_item_id: z.number().int().positive(),
      quantity: z.number().int().min(1)
    })).min(1, 'At least 1 item is required')
  });

  // Invalid body: negative quantity and invalid order_type
  const badReq = {
    body: {
      order_type: 'DRIVE_THRU', // invalid enum
      items: [{ menu_item_id: 1, quantity: -2 }] // invalid min(1)
    }
  };

  let validationErr = null;
  await validateBody(sampleSchema)(badReq, {}, (err) => {
    validationErr = err;
  });

  assert(validationErr instanceof z.ZodError, 'Invalid body triggers ZodError');
  assert(validationErr.issues.length >= 2, 'Zod captured multiple validation issues');

  // Test error handler formatting for ZodError
  const zodErrRes = {
    statusCode: 500,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  errorHandler(validationErr, { method: 'POST', originalUrl: '/api/v1/orders' }, zodErrRes, () => {});
  assert(zodErrRes.statusCode === 400, 'ZodError mapped to 400 Bad Request');
  assert(zodErrRes.body.error.code === 'VALIDATION_ERROR', 'Error code mapped to VALIDATION_ERROR');
  assert(zodErrRes.body.error.details.length >= 2, 'Field-level error details included in response');

  // --------------------------------------------------------------------------
  // TEST 11: MongoDB Atlas AuditLog Insertion & Sensitive Field Sanitization
  // --------------------------------------------------------------------------
  console.log('\n[Test 11] MongoDB Atlas AuditLog Persistence & Security Sanitization');
  await connectMongoDB();

  const testAudit = await AuditLog.record({
    userId: 1,
    username: 'rohit_admin',
    action: 'TEST_INFRASTRUCTURE_VERIFICATION',
    resourceType: 'SYSTEM_DIAGNOSTICS',
    resourceId: 'DIAG-001',
    requestId: 'REQ-TEST-12345',
    metadata: {
      diagnosticStatus: 'SUCCESS',
      // Sensitive fields that MUST be stripped:
      password: 'sensitive_raw_password_123',
      token: 'jwt_bearer_token_abc'
    }
  });

  assert(testAudit !== null && testAudit._id, 'Audit log saved to MongoDB Atlas with ObjectId');
  assert(testAudit.action === 'TEST_INFRASTRUCTURE_VERIFICATION', 'Action stored correctly');
  assert(testAudit.metadata.diagnosticStatus === 'SUCCESS', 'Non-sensitive metadata preserved');
  assert(testAudit.metadata.password === undefined, 'Security: password field was automatically stripped');
  assert(testAudit.metadata.token === undefined, 'Security: token field was automatically stripped');

  // Clean up the test document
  await AuditLog.deleteOne({ _id: testAudit._id });
  console.log('  🧹 Cleaned up verification test document from MongoDB Atlas');

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

runTests().catch(err => {
  console.error('Test suite uncaught failure:', err);
  process.exit(1);
});
