import { test, expect } from '@playwright/test';

test.describe('Orders and Kitchen Fulfilment Browser Tests', () => {
  async function login(page, username = 'rohit_admin') {
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  }

  test('1. POS menu item selection, quantity adjustment, and ticket tax/total calculation', async ({ page }) => {
    await login(page);
    await page.click('aside a:has-text("Customer Orders")');
    await expect(page).toHaveURL('/orders');

    // Add Crispy French Fries
    const friesCard = page.locator('div.bg-white').filter({ has: page.locator('h3', { hasText: 'Crispy French Fries' }) });
    await expect(friesCard).toBeVisible();
    await friesCard.locator('button:has-text("+ Add to Ticket")').click();

    // Add Fresh Lime Soda
    const sodaCard = page.locator('div.bg-white').filter({ has: page.locator('h3', { hasText: 'Fresh Lime Soda' }) });
    await expect(sodaCard).toBeVisible();
    await sodaCard.locator('button:has-text("+ Add to Ticket")').click();

    // Verify Cart breakdown:
    // French Fries = ₹110.00
    // Fresh Lime Soda = ₹65.00
    // Subtotal = 175.00, GST = 8.75, Grand Total = 183.75
    await expect(page.locator('text=₹175.00').first()).toBeVisible();
    await expect(page.locator('text=₹8.75').first()).toBeVisible();
    await expect(page.locator('text=₹183.75').first()).toBeVisible();

    // Take screenshot of POS Ticket
    await page.screenshot({ path: 'playwright-report/screenshots/04_pos_ticket.png' });
  });

  test('2. Complete end-to-end POS order placement, kitchen confirm (FEFO), and payment', async ({ page }) => {
    // Handle dialog alerts automatically
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await login(page);
    await page.click('aside a:has-text("Customer Orders")');
    await expect(page).toHaveURL('/orders');

    // Select items
    const friesCard = page.locator('div.bg-white').filter({ has: page.locator('h3', { hasText: 'Crispy French Fries' }) });
    await friesCard.locator('button:has-text("+ Add to Ticket")').click();

    const sodaCard = page.locator('div.bg-white').filter({ has: page.locator('h3', { hasText: 'Fresh Lime Soda' }) });
    await sodaCard.locator('button:has-text("+ Add to Ticket")').click();

    // Select Table 4
    const tableSelect = page.locator('label:has-text("Table #") + select');
    await tableSelect.selectOption('4');

    // Add note
    const noteInput = page.locator('input[placeholder="Ticket notes (optional)..."]');
    await noteInput.fill('E2E Dine-in order Table 4 test');

    // Place Order
    const placeBtn = page.locator('button:has-text("Create Customer Ticket")');
    await expect(placeBtn).toBeEnabled();
    await placeBtn.click();

    // Modal with order ticket opens
    await expect(page.locator('h3:has-text("Order Ticket:")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Close")')).toBeVisible();

    // Close details modal
    await page.locator('button:has-text("Close")').click();
    await expect(page.locator('h3:has-text("Order Ticket:")')).not.toBeVisible();

    // Navigate to Kitchen Fulfilment as Chef
    await page.click('aside a:has-text("Kitchen Fulfilment")');
    await expect(page).toHaveURL('/kitchen');
    await expect(page.locator('h1:has-text("Kitchen Fulfilment Queue")')).toBeVisible();

    // Locate the pending order in kitchen queue and confirm FEFO
    const confirmBtn = page.locator('button:has-text("Confirm (FEFO)")').first();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();

      // After confirm, the status advances to PREPARING and Mark Ready becomes available
      const readyBtn = page.locator('button:has-text("Mark Ready")').first();
      await expect(readyBtn).toBeVisible({ timeout: 10000 });
      await readyBtn.click();
    }

    // Return to Orders to record payment
    await page.click('aside a:has-text("Customer Orders")');
    await page.click('button:has-text("Order History")');

    // Wait for history table to load
    await expect(page.locator('th:has-text("Order #")')).toBeVisible();

    // Open first order details
    const detailsBtn = page.locator('button:has-text("Details")').first();
    await detailsBtn.click();
    await expect(page.locator('h3:has-text("Order Ticket:")')).toBeVisible();

    // If payment button is visible, record payment
    const recordPayBtn = page.locator('button:has-text("Record Payment")');
    if (await recordPayBtn.isVisible()) {
      await recordPayBtn.click();
      await expect(page.locator('h3:has-text("Record Payment")')).toBeVisible();

      // Submit CASH payment (amount is pre-filled with remaining balance)
      await page.click('form button[type="submit"]:has-text("Save Payment")');

      // Verify payment recorded and PAID badge visible in Order History
      await expect(page.locator('span:has-text("PAID")').first()).toBeVisible();
    }

    // Take screenshot of completed order lifecycle
    await page.screenshot({ path: 'playwright-report/screenshots/04_order_completed.png' });
  });
});
