import { test, expect } from '@playwright/test';

test.describe('Demand Forecasting & Intelligent Procurement Browser Tests', () => {
  async function login(page, username = 'rohit_admin') {
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  }

  test('1. Forecasting page displays model metadata, interpretive notes, and 7-day projections', async ({ page }) => {
    await login(page);

    // Navigate to Forecasting page
    await page.click('aside a:has-text("Demand Forecasting")');
    await expect(page).toHaveURL('/forecasting');

    // Page Header
    await expect(page.locator('h1', { hasText: 'AI Demand Forecasting' })).toBeVisible();

    // Verify Model Metadata Banner
    await expect(page.locator('text=RandomForestRegressor').first()).toBeVisible();
    await expect(page.locator('text=2026-10-30').first()).toBeVisible();
    await expect(page.locator('text=7 Days').first()).toBeVisible();
    await expect(page.locator('text=Empirical Residuals').first()).toBeVisible();

    // Verify Methodological Guidance & Warnings
    await expect(page.locator('text=Important Interpretive Notes:')).toBeVisible();
    await expect(page.locator('text=Data Freshness Warning:')).toBeVisible();
    await expect(page.locator('text=Empirical Residual Bounds:')).toBeVisible();
    await expect(page.locator('text=Kitchen Prep Guidance:')).toBeVisible();

    // Verify Menu Item Forecasts Table renders
    await expect(page.locator('table thead')).toContainText('Menu Dish');
    await expect(page.locator('table thead')).toContainText('7-Day Total Expected');
    await expect(page.locator('table thead')).toContainText('Recommended Prep');

    // Switch to BOM Ingredient Demand Breakdown tab
    await page.click('button:has-text("BOM Ingredient Demand Breakdown")');
    await expect(page.locator('button:has-text("BOM Ingredient Demand Breakdown")')).toHaveClass(/border-primary-600/);

    // Switch to Model Evaluation & Accuracy tab
    await page.click('button:has-text("Model Evaluation & Accuracy")');
    await expect(page.locator('button:has-text("Model Evaluation & Accuracy")')).toHaveClass(/border-primary-600/);

    // Capture screenshot
    await page.screenshot({ path: 'playwright-report/screenshots/05_forecasting_dashboard.png' });
  });

  test('2. Procurement recommendations table, ROP metrics, and shortage filtering', async ({ page }) => {
    await login(page);

    // Navigate to Procurement Engine
    await page.click('aside a:has-text("Procurement Engine")');
    await expect(page).toHaveURL('/procurement');

    // Header & KPIs
    await expect(page.locator('h1', { hasText: 'Intelligent Procurement Engine' })).toBeVisible();
    await expect(page.locator('text=Evaluated Ingredients')).toBeVisible();
    await expect(page.locator('text=Reorder Required')).toBeVisible();
    await expect(page.locator('text=Forecast Horizon')).toBeVisible();

    // Verify Procurement Table Columns
    const tableHeader = page.locator('table thead');
    await expect(tableHeader).toContainText('Ingredient');
    await expect(tableHeader).toContainText('Usable Stock');
    await expect(tableHeader).toContainText('Safety Stock');
    await expect(tableHeader).toContainText('ROP');
    await expect(tableHeader).toContainText('Lead-Time Dem.');
    await expect(tableHeader).toContainText('7D Forecast');
    await expect(tableHeader).toContainText('Supplier & MOQ');
    await expect(tableHeader).toContainText('Suggested Order');
    await expect(tableHeader).toContainText('Est. Cost');

    // Test Shortages filter and selection buttons
    await page.click('button:has-text("Deselect All")');
    await expect(page.locator('button:has-text("Convert Selected to Draft PO (0)")')).toBeDisabled();

    await page.click('button:has-text("Select All Shortages")');
    // Button should be re-enabled
    await expect(page.locator('button:has-text("Convert Selected to Draft PO")')).toBeEnabled();

    // Capture screenshot
    await page.screenshot({ path: 'playwright-report/screenshots/05_procurement_recommendations.png' });
  });

  test('3. Convert recommendations to DRAFT Purchase Order and submit to vendor', async ({ page }) => {
    // Automatically accept all browser confirm/alert dialogs
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await login(page);

    // Navigate to Procurement
    await page.click('aside a:has-text("Procurement Engine")');
    await expect(page).toHaveURL('/procurement');

    // Select all shortages
    await page.click('button:has-text("Select All Shortages")');
    const convertBtn = page.locator('button:has-text("Convert Selected to Draft PO")');
    await expect(convertBtn).toBeEnabled();

    // Open Draft PO confirmation modal
    await convertBtn.click();
    await expect(page.locator('h3', { hasText: 'Confirm Purchase Order Generation' })).toBeVisible();

    // Verify warning that PO will be created in DRAFT status
    await expect(page.locator('text=Generated purchase orders will be created in DRAFT status')).toBeVisible();
    await expect(page.locator('text=Vendor Grouping & Cost Summary')).toBeVisible();

    // Take screenshot of confirmation modal
    await page.screenshot({ path: 'playwright-report/screenshots/05_draft_po_modal.png' });

    // Execute conversion
    await page.click('button:has-text("Create Draft Purchase Orders")');

    // Navigate to Purchase Orders to verify DRAFT PO creation
    await page.click('aside a:has-text("Purchase Orders")');
    await expect(page).toHaveURL('/purchase-orders');

    // Verify at least one Draft PO exists
    const draftBadge = page.locator('span:has-text("DRAFT")').first();
    await expect(draftBadge).toBeVisible();

    // Identify the row containing DRAFT and extract its PO number
    const draftRow = page.locator('table tbody tr').filter({ has: page.locator('span:has-text("DRAFT")') }).first();
    await expect(draftRow).toBeVisible();
    const poNumber = (await draftRow.locator('td').first().innerText()).trim();

    // Verify Submit button is present on the DRAFT row
    const submitBtn = draftRow.locator('button:has-text("Submit")');
    await expect(submitBtn).toBeVisible();

    // Submit the DRAFT purchase order
    await submitBtn.click();

    // Verify status transitions to SUBMITTED for this specific PO
    const submittedRow = page.locator('table tbody tr').filter({ hasText: poNumber });
    await expect(submittedRow.locator('span:has-text("SUBMITTED")')).toBeVisible({ timeout: 10000 });

    // Take screenshot of submitted PO
    await page.screenshot({ path: 'playwright-report/screenshots/05_submitted_po.png' });
  });
});
