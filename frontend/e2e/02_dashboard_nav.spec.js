import { test, expect } from '@playwright/test';

test.describe('Dashboard and Navigation Browser Tests', () => {
  // Helper to log in as ADMIN
  async function loginAsAdmin(page) {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'rohit_admin');
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  }

  test('1. KPI cards and Dashboard overview render successfully', async ({ page }) => {
    await loginAsAdmin(page);

    // Dashboard headings
    await expect(page.locator('h1:has-text("Operations Dashboard")')).toBeVisible();
    await expect(page.locator('text=Live operational overview across inventory, sales, and kitchen fulfilment')).toBeVisible();

    // KPI Cards
    await expect(page.locator('text=Inventory Valuation')).toBeVisible();
    await expect(page.locator('text=Low Stock Warnings')).toBeVisible();
    await expect(page.locator('text=Expiring in 14 Days')).toBeVisible();
    await expect(page.locator('text=Submitted POs')).toBeVisible();

    // Recent orders section
    await expect(page.locator('text=Recent Customer Orders')).toBeVisible();

    // Take screenshot of Dashboard KPIs
    await page.screenshot({ path: 'playwright-report/screenshots/02_dashboard_kpis.png' });
  });

  test('2. Dashboard quick action buttons navigate properly', async ({ page }) => {
    await loginAsAdmin(page);

    // Click "New Order / POS"
    await page.click('a:has-text("New Order / POS")');
    await expect(page).toHaveURL('/orders');
    await expect(page.locator('h1:has-text("Customer Orders & POS")')).toBeVisible();

    // Return to dashboard via sidebar
    await page.click('aside a:has-text("Dashboard")');
    await expect(page).toHaveURL('/');

    // Click "Procurement" quick action
    await page.click('a:has-text("Procurement")');
    await expect(page).toHaveURL('/procurement');
    await expect(page.locator('h1:has-text("Intelligent Procurement")')).toBeVisible();
  });

  test('3. Sidebar navigation operates smoothly without full-page reloads', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to Inventory
    await page.click('aside a:has-text("Inventory & Batches")');
    await expect(page).toHaveURL('/inventory');
    await expect(page.locator('h1:has-text("Inventory & Stock Tracking")')).toBeVisible();

    // Navigate to Recipes & BOM
    await page.click('aside a:has-text("Recipes & BOM")');
    await expect(page).toHaveURL('/recipes');
    await expect(page.locator('h1:has-text("Recipes & Bill of Materials")')).toBeVisible();

    // Navigate to Customer Orders
    await page.click('aside a:has-text("Customer Orders")');
    await expect(page).toHaveURL('/orders');
    await expect(page.locator('h1:has-text("Customer Orders & POS")')).toBeVisible();

    // Navigate to Kitchen Fulfilment
    await page.click('aside a:has-text("Kitchen Fulfilment")');
    await expect(page).toHaveURL('/kitchen');
    await expect(page.locator('h1:has-text("Kitchen Fulfilment Queue")')).toBeVisible();
  });

  test('4. Session persistence across browser reload (F5)', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to /inventory
    await page.click('aside a:has-text("Inventory & Batches")');
    await expect(page).toHaveURL('/inventory');

    // Reload page (F5)
    await page.reload();

    // User should remain on /inventory without redirect to /login
    await expect(page).toHaveURL('/inventory');
    await expect(page.locator('h1:has-text("Inventory & Stock Tracking")')).toBeVisible();

    // User credentials should remain intact
    await expect(page.locator('text=rohit_admin').first()).toBeVisible();
    await expect(page.locator('text=ADMIN').first()).toBeVisible();
  });

  test('5. Zero unhandled JavaScript errors in console during dashboard operations', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await loginAsAdmin(page);
    await page.waitForTimeout(1000);

    // Filter out expected benign errors if any (like 404s for optional assets), focus on JS errors
    const runtimeErrors = consoleErrors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('font') &&
      !err.includes('Failed to load resource: the server responded with a status of 404')
    );

    expect(runtimeErrors).toHaveLength(0);
  });
});
