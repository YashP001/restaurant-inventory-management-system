import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import os from 'os';

const chromeExecutable = path.join(
  os.homedir(),
  'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
);

/**
 * Playwright E2E Configuration for Urban Bites
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1, // Deterministic sequential runs to prevent DB race conditions
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
    launchOptions: {
      executablePath: chromeExecutable,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 }
      }
    }
  ]
});
