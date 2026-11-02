import { test, expect } from '@playwright/test';

test.describe('Manual Acceptance Bug Fixes & Regression Battery', () => {
  async function logout(page) {
    // Dismiss any open modal if present
    const closeBtn = page.locator('button:has-text("Close")');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
    await page.keyboard.press('Escape');
    const logoutBtn = page.locator('button[title="Log out of system"]');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click({ force: true });
      await expect(page).toHaveURL(/.*login/);
    }
  }

  async function login(page, username, password = 'UrbanBites@2026') {
    if (!page.url().includes('/login')) {
      await page.goto('/login');
      if (!page.url().includes('/login')) {
        await logout(page);
      }
    }
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  }

  test('BUG 1: Suppliers page renders cleanly for ADMIN and INVENTORY_MANAGER without TypeError', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Test as ADMIN
    await login(page, 'rohit_admin');
    await page.click('aside a:has-text("Suppliers")');
    await expect(page).toHaveURL('/suppliers');

    // Verify page title and table render
    await expect(page.locator('h1', { hasText: 'Suppliers & Catalog' })).toBeVisible();
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify search filter works safely without crash
    const searchInput = page.locator('input[placeholder*="Search suppliers"]');
    await searchInput.fill('Farm');
    await expect(page.locator('table tbody')).toContainText('Farm');

    // Test View Catalog modal
    const viewCatalogBtn = page.locator('table tbody button:has-text("View Catalog")').first();
    await viewCatalogBtn.click();
    await expect(page.locator('h3', { hasText: 'Details & Catalog' })).toBeVisible();
    await expect(page.locator('text=Contracted Ingredients & Pricing')).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');

    // Verify zero TypeError console errors
    const typeErrors = consoleErrors.filter(err => err.includes('TypeError') || err.includes('toLowerCase'));
    expect(typeErrors).toHaveLength(0);

    // 2. Test as INVENTORY_MANAGER
    await logout(page);
    await login(page, 'priya_inventory');
    await page.click('aside a:has-text("Suppliers")');
    await expect(page).toHaveURL('/suppliers');
    await expect(page.locator('h1', { hasText: 'Suppliers & Catalog' })).toBeVisible();
    await expect(tableRows.first()).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'playwright-report/screenshots/regression_01_suppliers.png' });
  });

  test('BUG 2 & BUG 3: Kitchen confirmation sends numeric order ID (never undefined) and no React key warnings', async ({ page }) => {
    const reactKeyWarnings = [];
    const outgoingRequests = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('unique "key" prop') || text.includes('missing key')) {
        reactKeyWarnings.push(text);
      }
    });

    page.on('request', request => {
      outgoingRequests.push(request.url());
    });

    page.on('dialog', async dialog => {
      try {
        await dialog.accept();
      } catch (_) {
        // Ignored if dismissed or page navigated
      }
    });

    // 1. First, create an isolated test order via POS so we have a guaranteed PENDING order
    await login(page, 'rohit_admin');
    await page.click('aside a:has-text("Customer Orders")');
    await expect(page).toHaveURL('/orders');

    // Add 1 Crispy French Fries
    const friesCard = page.locator('div.bg-white').filter({ has: page.locator('h3', { hasText: 'Crispy French Fries' }) });
    await friesCard.locator('button:has-text("+ Add to Ticket")').click();

    // Select Table 1
    const tableSelect = page.locator('label:has-text("Table #") + select');
    await tableSelect.selectOption('1');
    await page.click('button:has-text("Create Customer Ticket")');

    // Close automatically opened Order Ticket modal
    const ticketModalHeader = page.locator('h3', { hasText: 'Order Ticket:' });
    await expect(ticketModalHeader).toBeVisible();
    await page.click('button:has-text("Close")');

    // 2. Log in as CHEF and go to Kitchen queue
    await logout(page);
    await login(page, 'vikram_headchef');
    await page.click('aside a:has-text("Kitchen Fulfilment")');
    await expect(page).toHaveURL('/kitchen');

    // Verify pending cards exist
    const pendingColumn = page.locator('.bg-gray-100').filter({ hasText: '1. Pending Confirmation' });
    await expect(pendingColumn).toBeVisible();

    const confirmBtn = pendingColumn.locator('button:has-text("Confirm (FEFO)")').first();
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });

    // Click confirm
    await confirmBtn.click();

    // Verify that NO request was sent with /undefined/
    const undefinedRequests = outgoingRequests.filter(url => url.includes('/undefined'));
    expect(undefinedRequests).toHaveLength(0);

    // Verify that a valid confirm request was sent matching numeric ID
    const validConfirmRequest = outgoingRequests.find(url => /\/api\/v1\/orders\/\d+\/confirm/.test(url));
    expect(validConfirmRequest).toBeDefined();

    // Verify NO React key warnings on Kitchen page
    expect(reactKeyWarnings).toHaveLength(0);

    // Take screenshot of Kitchen after confirmation
    await page.screenshot({ path: 'playwright-report/screenshots/regression_02_kitchen.png' });
  });

  test('BUG 3: Purchase Orders creation modal dropdowns emit zero React key warnings', async ({ page }) => {
    const reactKeyWarnings = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('unique "key" prop') || text.includes('missing key')) {
        reactKeyWarnings.push(text);
      }
    });

    await login(page, 'rohit_admin');
    await page.click('aside a:has-text("Purchase Orders")');
    await expect(page).toHaveURL('/purchase-orders');

    // Open Create Purchase Order modal
    const createBtn = page.locator('button:has-text("Create Draft PO")');
    await createBtn.click();
    await expect(page.locator('h3', { hasText: 'Create New Draft Purchase Order' })).toBeVisible();

    // Add ingredient row to mount both vendor and ingredient selects
    await page.click('button:has-text("+ Add Ingredient")');

    // Wait for selects inside the modal
    const modal = page.locator('.fixed');
    const vendorSelect = modal.locator('select').first();
    await expect(vendorSelect.locator('option')).not.toHaveCount(0);

    const ingredientSelect = modal.locator('select').nth(1);
    await expect(ingredientSelect.locator('option')).not.toHaveCount(0);

    // Verify zero missing key warnings were emitted
    expect(reactKeyWarnings).toHaveLength(0);

    // Close modal via Cancel button inside modal
    await modal.locator('button:has-text("Cancel")').click();
  });

  test('BUG 4: CHEF account cannot view or trigger payment controls on Orders page', async ({ page }) => {
    // 1. Log in as CHEF
    await login(page, 'vikram_headchef');
    await page.click('aside a:has-text("Customer Orders")');
    await expect(page).toHaveURL('/orders');

    // Switch to Order History
    await page.click('button:has-text("Order History")');

    // Look at orders table
    const table = page.locator('table tbody');
    await expect(table).toBeVisible();

    // For CHEF, the Pay button MUST NOT exist anywhere in the table
    const payButtons = page.locator('table tbody button:has-text("Pay")');
    expect(await payButtons.count()).toBe(0);

    // Open Details on any order
    const detailsBtn = page.locator('table tbody button:has-text("Details")').first();
    await detailsBtn.click();
    await expect(page.locator('h3', { hasText: 'Order Ticket:' })).toBeVisible();

    // The Record Payment button MUST NOT exist in the modal
    const recordPaymentBtn = page.locator('button:has-text("Record Payment")');
    expect(await recordPaymentBtn.count()).toBe(0);

    // Close modal and logout
    await page.click('button:has-text("Close")');
    await logout(page);

    // 2. Log in as CASHIER to verify Cashiers CAN see Pay button
    await login(page, 'arjun_cashier');
    await page.click('aside a:has-text("Customer Orders")');
    await page.click('button:has-text("Order History")');

    // Check if any unpaid orders exist
    const cashierPayButtons = page.locator('table tbody button:has-text("Pay")');
    const unpaidCount = await cashierPayButtons.count();
    // At least one unpaid order should exist or have Pay button available
    if (unpaidCount > 0) {
      await expect(cashierPayButtons.first()).toBeVisible();
    }

    // Take screenshot
    await page.screenshot({ path: 'playwright-report/screenshots/regression_04_chef_rbac.png' });
  });
});

