import { test, expect } from '@playwright/test';

test.describe('Authentication and RBAC Browser Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear browser storage before each test
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('1. Login as ADMIN: loads dashboard and displays full navigation including Staff Management', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'rohit_admin');
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Urban Bites Management Platform')).toBeVisible();

    // Verify user role badge in header or sidebar
    await expect(page.locator('text=rohit_admin').first()).toBeVisible();
    await expect(page.locator('text=ADMIN').first()).toBeVisible();

    // Admin should see Staff Management in sidebar
    await expect(page.locator('a:has-text("Staff Management")')).toBeVisible();
    await expect(page.locator('a:has-text("Suppliers")')).toBeVisible();
    await expect(page.locator('a:has-text("Purchase Orders")')).toBeVisible();

    // Take screenshot of successful Admin login
    await page.screenshot({ path: 'playwright-report/screenshots/01_admin_dashboard.png' });
  });

  test('2. Logout clears session and redirects to /login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'rohit_admin');
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // Click logout button in sidebar
    const logoutBtn = page.locator('button[title="Log out of system"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Should redirect to /login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('text=Sign In to Dashboard')).toBeVisible();

    // Verify localStorage cleared
    const token = await page.evaluate(() => localStorage.getItem('ub_token'));
    expect(token).toBeNull();
  });

  test('3. Login as INVENTORY_MANAGER: has Inventory & POs, but lacks Staff Management', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'priya_inventory');
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');
    await expect(page.locator('text=priya_inventory').first()).toBeVisible();
    await expect(page.locator('text=INVENTORY_MANAGER').first()).toBeVisible();

    // Authorized links
    await expect(page.locator('a:has-text("Inventory & Batches")')).toBeVisible();
    await expect(page.locator('a:has-text("Suppliers")')).toBeVisible();
    await expect(page.locator('a:has-text("Purchase Orders")')).toBeVisible();

    // Unauthorized link for Inventory Manager
    await expect(page.locator('a:has-text("Staff Management")')).not.toBeVisible();
  });

  test('4. Login as CHEF: has Kitchen Fulfilment, lacks Suppliers and Staff Management', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'vikram_headchef');
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');
    await expect(page.locator('text=vikram_headchef').first()).toBeVisible();
    await expect(page.locator('text=CHEF').first()).toBeVisible();

    await expect(page.locator('a:has-text("Kitchen Fulfilment")')).toBeVisible();
    await expect(page.locator('a:has-text("Menu Catalog")')).toBeVisible();

    // Unauthorized links for Chef
    await expect(page.locator('a:has-text("Suppliers")')).not.toBeVisible();
    await expect(page.locator('a:has-text("Purchase Orders")')).not.toBeVisible();
    await expect(page.locator('a:has-text("Staff Management")')).not.toBeVisible();
  });

  test('5. Login as CASHIER: has Customer Orders, lacks Purchase Orders and Staff', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'arjun_cashier');
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');
    await expect(page.locator('text=arjun_cashier').first()).toBeVisible();
    await expect(page.locator('text=CASHIER').first()).toBeVisible();

    await expect(page.locator('a:has-text("Customer Orders")')).toBeVisible();

    // Unauthorized links for Cashier
    await expect(page.locator('a:has-text("Suppliers")')).not.toBeVisible();
    await expect(page.locator('a:has-text("Purchase Orders")')).not.toBeVisible();
    await expect(page.locator('a:has-text("Procurement Engine")')).not.toBeVisible();
    await expect(page.locator('a:has-text("Staff Management")')).not.toBeVisible();
  });

  test('6. Invalid credentials show clear error alert', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'rohit_admin');
    await page.fill('input[type="password"]', 'WrongPassword123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*login/);
    const alert = page.locator('.bg-rose-50');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Invalid/i);
  });

  test('7. Protected route redirect: unauthenticated user cannot access /inventory', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('text=Sign In to Dashboard')).toBeVisible();
  });

  test('8. Unauthorized direct navigation displays Access Restricted screen', async ({ page }) => {
    // Login as Cashier
    await page.goto('/login');
    await page.fill('input[type="text"]', 'arjun_cashier');
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // Directly navigate to /staff (ADMIN only)
    await page.goto('/staff');

    // Should display Access Restricted screen
    await expect(page.locator('text=Access Restricted')).toBeVisible();
    await expect(page.locator('text=CASHIER').first()).toBeVisible();
    await expect(page.locator('a:has-text("Return to Dashboard")')).toBeVisible();
  });

  test('9. Session expiration clears token and forces redirect to /login', async ({ page }) => {
    // Login as Admin
    await page.goto('/login');
    await page.fill('input[type="text"]', 'rohit_admin');
    await page.fill('input[type="password"]', 'UrbanBites@2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // Simulate session expiration event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('ub_auth_expired'));
    });

    // Should redirect to /login
    await page.goto('/inventory');
    await expect(page).toHaveURL(/.*login/);
  });
});
