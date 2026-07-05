/**
 * Playwright E2E test configuration for s-clinic-web
 *
 * Tests cover:
 * - Responsive layouts at 320/768/1024px (R3.1–R3.4)
 * - Layout transition < 300ms without reload (R3.6)
 * - Back/forward navigation (R2.4, R2.5)
 * - Service Worker registration ≤ 5s (R1.2)
 * - Standalone display mode (R1.6)
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30_000,

  use: {
    /* Base URL for the dev server */
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
      },
    },
  ],

  /* Run the preview server before starting tests */
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
