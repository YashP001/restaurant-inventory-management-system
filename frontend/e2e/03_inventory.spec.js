import { test, expect } from '@playwright/test';

test.describe('Inventory and Batch Browser Tests', () => {
  async function loginAsAdmin(page) {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'rohit_admin');
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  }

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('aside a:has-text("Inventory & Batches")');
    await expect(page).toHaveURL('/inventory');
    await expect(page.locator('h1:has-text("Inventory & Stock Tracking")')).toBeVisible();
  });

  test('1. Inventory table renders with stock balances and par levels', async ({ page }) => {
    // Current stock tab should be active by default
    await expect(page.locator('button:has-text("Current Stock")')).toBeVisible();
    await expect(page.locator('th:has-text("Ingredient")')).toBeVisible();
    await expect(page.locator('th:has-text("Current Stock")')).toBeVisible();
    await expect(page.locator('th:has-text("Safety Min")')).toBeVisible();
    await expect(page.locator('th:has-text("Optimal Par")')).toBeVisible();

    // Verify ingredients rendered
    await expect(page.locator('text=All-Purpose Flour (Maida)').first()).toBeVisible();
    await expect(page.locator('text=Fresh Malai Paneer').first()).toBeVisible();

    // Take screenshot of inventory stock table
    await page.screenshot({ path: 'playwright-report/screenshots/03_inventory_table.png' });
  });

  test('2. Search filtering filters rows dynamically', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search ingredients..."]');
    await searchInput.fill('Flour');

    // Should display Flour row
    await expect(page.locator('text=All-Purpose Flour (Maida)')).toBeVisible();

    // Should filter out non-matching rows
    await expect(page.locator('text=Fresh Malai Paneer')).not.toBeVisible();
    await expect(page.locator('text=Ground Coffee Beans')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');
    await expect(page.locator('text=Fresh Malai Paneer')).toBeVisible();
  });

  test('3. Expiring Batches tab displays FEFO priority batches and urgency badges', async ({ page }) => {
    await page.click('button:has-text("Expiring Batches")');

    await expect(page.locator('text=FEFO Priority View')).toBeVisible();
    await expect(page.locator('th:has-text("Batch Number")')).toBeVisible();
    await expect(page.locator('th:has-text("Remaining Qty")')).toBeVisible();
    await expect(page.locator('th:has-text("Expiry Date")')).toBeVisible();

    // Verify batch rows are displayed
    const rows = page.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('4. All Batches tab displays batch metadata and status badges', async ({ page }) => {
    await page.click('button:has-text("All Batches")');

    await expect(page.locator('th:has-text("Received Qty")')).toBeVisible();
    await expect(page.locator('th:has-text("Remaining Qty")')).toBeVisible();
    await expect(page.locator('th:has-text("Unit Cost")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();

    // Batch status badges (ACTIVE or EXPIRED)
    await expect(page.locator('span:has-text("EXPIRED")').or(page.locator('span:has-text("ACTIVE")')).first()).toBeVisible();
  });

  test('5. Stock adjustment validation: blocks excessive decrease with clear error', async ({ page }) => {
    await page.click('button:has-text("Adjust Stock")');
    await expect(page.locator('h3:has-text("Manual Stock Adjustment")')).toBeVisible();

    const form = page.locator('form');

    // Select the first active batch from modal dropdown
    const batchSelect = form.locator('select').nth(0);
    await batchSelect.selectOption({ index: 1 });

    // Select DECREASE
    const typeSelect = form.locator('select').nth(1);
    await typeSelect.selectOption('DECREASE');

    // Enter excessive quantity
    const qtyInput = form.locator('input[type="number"]');
    await qtyInput.fill('999999');

    // Submit
    await form.locator('button[type="submit"]:has-text("Confirm Adjustment")').click();

    // Error message must be shown
    const errorAlert = page.locator('text=exceeds current remaining');
    await expect(errorAlert).toBeVisible();
  });

  test('6. Stock adjustment success: applies valid increase and records in movements ledger', async ({ page }) => {
    await page.click('button:has-text("Adjust Stock")');
    await expect(page.locator('h3:has-text("Manual Stock Adjustment")')).toBeVisible();

    const form = page.locator('form');

    // Select the first active batch
    const batchSelect = form.locator('select').nth(0);
    await batchSelect.selectOption({ index: 1 });

    // Ensure INCREASE
    const typeSelect = form.locator('select').nth(1);
    await typeSelect.selectOption('INCREASE');

    // Fill valid quantity
    const qtyInput = form.locator('input[type="number"]');
    await qtyInput.fill('1.000');

    // Fill notes
    const notesInput = form.locator('textarea');
    await notesInput.fill('E2E Playwright cycle count adjustment verification');

    // Submit adjustment
    await form.locator('button[type="submit"]:has-text("Confirm Adjustment")').click();

    // Modal should close
    await expect(page.locator('h3:has-text("Manual Stock Adjustment")')).not.toBeVisible();

    // Check Movements Ledger tab
    await page.click('button:has-text("Movements Ledger")');
    await expect(page.locator('text=AUDIT_ADJUSTMENT').first()).toBeVisible();
  });

  test('7. Stock Receiving protocol guidance modal routes cleanly to Purchase Orders', async ({ page }) => {
    await page.click('button:has-text("Receive Stock")');

    // Verify guidance modal appears
    await expect(page.locator('h3:has-text("Stock Inward & Batch Receiving Protocol")')).toBeVisible();
    await expect(page.locator('text=Purchase Order Inward Requirement')).toBeVisible();

    // Click "Go to Purchase Orders →"
    await page.click('button:has-text("Go to Purchase Orders")');

    // Should navigate to /purchase-orders
    await expect(page).toHaveURL('/purchase-orders');
    await expect(page.locator('h1:has-text("Purchase Orders")')).toBeVisible();
  });
});
