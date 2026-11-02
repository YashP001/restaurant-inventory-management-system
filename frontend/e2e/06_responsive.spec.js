import { test, expect } from '@playwright/test';

test.describe('Responsive Layout & Mobile Viewport Browser Tests', () => {
  async function login(page, username = 'rohit_admin') {
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  }

  test('1. Desktop viewport (1440x900) layout, static sidebar, and zero horizontal scroll overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    // Sidebar should be permanently visible on desktop
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveClass(/lg:translate-x-0/);

    // Hamburger button should NOT be visible on desktop (lg:hidden)
    const hamburgerBtn = page.locator('button[aria-label="Open navigation menu"]');
    await expect(hamburgerBtn).toBeHidden();

    // Verify 4 KPI cards render in multi-column layout
    const kpiCards = page.locator('main').locator('div.bg-white').filter({ has: page.locator('p.text-2xl') });
    await expect(kpiCards).toHaveCount(4);

    // Verify no horizontal document overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Capture screenshot
    await page.screenshot({ path: 'playwright-report/screenshots/06_desktop_1440x900.png' });
  });

  test('2. Tablet viewport (768x1024) hamburger menu toggle and navigation', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);

    // Hamburger button should be visible
    const hamburgerBtn = page.locator('button[aria-label="Open navigation menu"]');
    await expect(hamburgerBtn).toBeVisible();

    // Mobile backdrop should not exist initially
    const backdrop = page.locator('.fixed.inset-0.bg-slate-900\\/40');
    await expect(backdrop).toHaveCount(0);

    // Click hamburger to open mobile sidebar drawer
    await hamburgerBtn.click();
    await expect(backdrop).toBeVisible();

    // Verify sidebar is now open
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveClass(/translate-x-0/);

    // Click a navigation item from the open drawer
    await sidebar.locator('a:has-text("Inventory & Batches")').click();

    // URL changes and drawer closes automatically
    await expect(page).toHaveURL('/inventory');
    await expect(backdrop).toHaveCount(0);

    // Verify no horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Capture screenshot
    await page.screenshot({ path: 'playwright-report/screenshots/06_tablet_768x1024.png' });
  });

  test('3. Mobile viewport (390x844) responsive drawer, backdrop close, and table containers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);

    const hamburgerBtn = page.locator('button[aria-label="Open navigation menu"]');
    await expect(hamburgerBtn).toBeVisible();

    // Open mobile sidebar
    await hamburgerBtn.click();
    const backdrop = page.locator('.fixed.inset-0.bg-slate-900\\/40');
    await expect(backdrop).toBeVisible();

    // Close by clicking backdrop
    await backdrop.click({ position: { x: 350, y: 100 } });
    await expect(backdrop).toHaveCount(0);

    // Navigate to Inventory page
    await hamburgerBtn.click();
    await page.locator('aside a:has-text("Inventory & Batches")').click();
    await expect(page).toHaveURL('/inventory');

    // Verify tables have scrollable horizontal overflow wrappers
    const tableWrappers = page.locator('.overflow-x-auto');
    await expect(tableWrappers.first()).toBeVisible();

    // Navigate to Orders POS
    await hamburgerBtn.click();
    await page.locator('aside a:has-text("Customer Orders")').click();
    await expect(page).toHaveURL('/orders');

    // Verify menu items adapt to mobile column
    await expect(page.locator('h1', { hasText: 'Customer Orders & POS' })).toBeVisible();

    // Verify root document has no horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Capture mobile screenshot
    await page.screenshot({ path: 'playwright-report/screenshots/06_mobile_390x844.png' });
  });
});
