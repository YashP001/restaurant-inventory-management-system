import assert from 'assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createReceiptSchema } from '../src/validations/receipt.validation.js';
import { createAdjustmentSchema } from '../src/validations/adjustment.validation.js';
import { getMySQLPool } from '../src/config/mysql.js';
import { AuthService } from '../src/services/auth.service.js';
import { ReceiptService } from '../src/services/receipt.service.js';
import { AdjustmentService } from '../src/services/adjustment.service.js';
import { PurchaseOrderModel } from '../src/models/sql/purchaseOrder.model.js';
import { ForecastingService } from '../src/services/forecasting.service.js';

let passed = 0;
let failed = 0;

function pass(name) {
  passed++;
  console.log(`  ✅ PASS: ${name}`);
}

function fail(name, err) {
  failed++;
  console.error(`  ❌ FAIL: ${name}:`, err.message || err);
}

async function runCriticalFixesSuite() {
  console.log('\n===============================================================');
  console.log('  Urban Bites Task 3.2: Critical Integration Fixes Test Suite ');
  console.log('===============================================================\n');

  // Test 1: PO Receipt Payload Validation - supplier_id & ingredient_id
  console.log('[Test 1] PO Receipt Payload Validation (createReceiptSchema)');
  try {
    // Missing supplier_id should fail
    const missingSupplierPayload = {
      purchase_order_id: 1,
      received_date: '2026-11-02',
      items: [
        {
          purchase_order_item_id: 1,
          ingredient_id: 2,
          batch_number: 'TEST-BATCH-001',
          quantity_received: 10,
          unit_cost: 50.0,
          expiry_date: '2026-12-01'
        }
      ]
    };
    const res1 = createReceiptSchema.body.safeParse(missingSupplierPayload);
    assert.equal(res1.success, false, 'Payload without supplier_id must be rejected');
    pass('Receipt schema strictly rejects missing supplier_id');

    // Missing ingredient_id inside items should fail
    const missingIngredientPayload = {
      purchase_order_id: 1,
      supplier_id: 1,
      received_date: '2026-11-02',
      items: [
        {
          purchase_order_item_id: 1,
          batch_number: 'TEST-BATCH-002',
          quantity_received: 10,
          unit_cost: 50.0,
          expiry_date: '2026-12-01'
        }
      ]
    };
    const res2 = createReceiptSchema.body.safeParse(missingIngredientPayload);
    assert.equal(res2.success, false, 'Payload without ingredient_id in items must be rejected');
    pass('Receipt schema strictly rejects items missing ingredient_id');

    // Valid complete payload matching frontend fix
    const validReceiptPayload = {
      purchase_order_id: 1,
      supplier_id: 1,
      received_date: '2026-11-02',
      notes: 'Task 3.2 verified payload',
      items: [
        {
          purchase_order_item_id: 1,
          ingredient_id: 2,
          batch_number: 'BATCH-32-VALID-01',
          quantity_received: 5.5,
          unit_cost: 45.0,
          expiry_date: '2026-12-15'
        }
      ]
    };
    const res3 = createReceiptSchema.body.safeParse(validReceiptPayload);
    assert.equal(res3.success, true, 'Complete payload with supplier_id and ingredient_id must be accepted');
    pass('Receipt schema successfully accepts corrected payload with supplier_id and ingredient_id');
  } catch (err) {
    fail('Test 1 PO Receipt Schema', err);
  }

  // Test 2: Standalone Manual Inward Rejection without purchase_order_id
  console.log('\n[Test 2] Standalone Inward Rejection (Enforcing PO Inward Protocol)');
  try {
    const standaloneInwardPayload = {
      supplier_id: 1,
      received_date: '2026-11-02',
      items: [
        {
          ingredient_id: 2,
          batch_number: 'STANDALONE-BATCH-01',
          quantity_received: 10,
          unit_cost: 40.0,
          expiry_date: '2026-12-20'
        }
      ]
    };
    const res = createReceiptSchema.body.safeParse(standaloneInwardPayload);
    assert.equal(res.success, false, 'Manual inward without purchase_order_id must be rejected');
    pass('Backend correctly rejects standalone inward missing purchase_order_id');
  } catch (err) {
    fail('Test 2 Standalone Inward Rejection', err);
  }

  // Test 3: Stock Adjustment Payload Validation - ingredient_id
  console.log('\n[Test 3] Stock Adjustment Schema Validation (createAdjustmentSchema)');
  try {
    // Missing ingredient_id should fail
    const missingIngPayload = {
      batch_id: 1,
      adjustment_type: 'INCREASE',
      quantity: 5,
      reason: 'CYCLE_COUNT_CORRECTION',
      notes: 'Inventory count adjustment'
    };
    const res1 = createAdjustmentSchema.body.safeParse(missingIngPayload);
    assert.equal(res1.success, false, 'Adjustment without ingredient_id must be rejected');
    pass('Adjustment schema strictly rejects missing ingredient_id');

    // Valid complete payload matching frontend fix
    const validAdjustPayload = {
      ingredient_id: 2,
      batch_id: 1,
      adjustment_type: 'DECREASE',
      quantity: 2.5,
      reason: 'CYCLE_COUNT_CORRECTION',
      notes: 'Reconciled physical audit count'
    };
    const res2 = createAdjustmentSchema.body.safeParse(validAdjustPayload);
    assert.equal(res2.success, true, 'Complete adjustment payload must be accepted');
    pass('Adjustment schema accepts corrected payload containing ingredient_id');
  } catch (err) {
    fail('Test 3 Stock Adjustment Schema', err);
  }

  // Test 4: End-to-End Stock Adjustment Execution (Increase & Decrease)
  console.log('\n[Test 4] Live Stock Adjustment Execution & Sufficiency Check');
  const pool = getMySQLPool();
  try {
    const authResult = await AuthService.login({ identifier: 'rohit_admin', password: 'UrbanBites@2026' });
    const adminUser = authResult.user;

    // Get an active non-expired batch for testing
    const [batches] = await pool.query(`
      SELECT b.id, b.ingredient_id, b.quantity_remaining, b.quantity_received
      FROM inventory_batches b
      WHERE b.status = 'ACTIVE' AND b.expiry_date > CURRENT_DATE() AND b.quantity_remaining > 5
      LIMIT 1;
    `);

    assert.ok(batches.length > 0, 'Must have at least one active test batch');
    const testBatch = batches[0];
    const initialRemaining = Number(testBatch.quantity_remaining);

    // 4.1 Perform Increase Adjustment (+1.0)
    const incResult = await AdjustmentService.adjustStock({
      ingredientId: testBatch.ingredient_id,
      batchId: testBatch.id,
      adjustmentType: 'INCREASE',
      quantity: 1.0,
      reason: 'CYCLE_COUNT_CORRECTION',
      notes: 'Task 3.2 automated increase verification',
      user: adminUser
    });
    assert.equal(Number(incResult.new_quantity_remaining), initialRemaining + 1.0);
    pass('Live stock INCREASE (+1.0) executed atomically');

    // 4.2 Perform Decrease Adjustment (-1.0) to revert to initial
    const decResult = await AdjustmentService.adjustStock({
      ingredientId: testBatch.ingredient_id,
      batchId: testBatch.id,
      adjustmentType: 'DECREASE',
      quantity: 1.0,
      reason: 'CYCLE_COUNT_CORRECTION',
      notes: 'Task 3.2 automated decrease cleanup',
      user: adminUser
    });
    assert.equal(Number(decResult.new_quantity_remaining), initialRemaining);
    pass('Live stock DECREASE (-1.0) restored initial batch balance');

    // 4.3 Attempt Decrease Exceeding Available Stock (Must be rejected)
    let overDecreaseRejected = false;
    try {
      await AdjustmentService.adjustStock({
        ingredientId: testBatch.ingredient_id,
        batchId: testBatch.id,
        adjustmentType: 'DECREASE',
        quantity: initialRemaining + 9999.0,
        reason: 'CYCLE_COUNT_CORRECTION',
        notes: 'Excessive decrease test',
        user: adminUser
      });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_BATCH_STOCK' || (err.message && err.message.includes('Cannot decrease stock'))) {
        overDecreaseRejected = true;
      }
    }
    assert.equal(overDecreaseRejected, true, 'Excessive decrease must be rejected with INSUFFICIENT_BATCH_STOCK error');
    pass('Decreasing stock beyond remaining balance rejected with INSUFFICIENT_BATCH_STOCK');
  } catch (err) {
    fail('Test 4 Live Stock Adjustment', err);
  }

  // Test 5: Forecasting Microservice Timeout Configuration
  console.log('\n[Test 5] Forecasting Service 10-Second Timeout Verification');
  try {
    // Read the source of forecasting.service.js to verify 10000ms timeout
    const fs = await import('fs');
    const serviceSource = fs.readFileSync(
      path.resolve(__dirname, '../src/services/forecasting.service.js'),
      'utf8'
    );
    assert.ok(serviceSource.includes('AbortSignal.timeout(10000)'), 'Timeout must be set to 10000ms (10 seconds)');
    assert.ok(serviceSource.includes('timed out after 10s'), 'Error message must reflect 10s timeout');
    pass('Forecasting service timeout configured to 10000ms (10s) with clear diagnostic error message');
  } catch (err) {
    fail('Test 5 Forecasting Timeout', err);
  }

  // Test 6: Environment Example Configuration
  console.log('\n[Test 6] Environment Documentation Verification');
  try {
    const fs = await import('fs');
    const envExample = fs.readFileSync(path.resolve(__dirname, '../.env.example'), 'utf8');
    assert.ok(envExample.includes('FORECASTING_SERVICE_URL=http://localhost:8000'), 'backend/.env.example must document FORECASTING_SERVICE_URL');
    pass('backend/.env.example accurately documents FORECASTING_SERVICE_URL default');
  } catch (err) {
    fail('Test 6 Environment Documentation', err);
  }

  // Close MySQL pool
  await pool.end();

  console.log('\n===============================================================');
  console.log(`  Critical Fixes Suite Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCriticalFixesSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
