import { test, expect } from '@playwright/test';

test('Frontend smoke test - Loads login page and title', async ({ page }) => {
  await page.goto('/');
  // Since unauthenticated, should redirect to /login
  await expect(page).toHaveURL(/.*login/);
  await expect(page.locator('text=Urban Bites')).toBeVisible();
});
