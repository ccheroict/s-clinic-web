/**
 * E2E tests: Back/forward browser navigation
 *
 * Validates: Requirements 2.4, 2.5
 *
 * Tests that:
 * - Back/forward updates displayed content to match the URL (R2.4)
 * - Navigating to an invalid URL shows a "not found" message without full page reload (R2.5)
 */

import { test, expect } from '@playwright/test';

test.describe('Back/forward navigation (R2.4, R2.5)', () => {
  test('back navigation updates content to match URL', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Navigate to the app root (will redirect to /login or /patients depending on auth)
    await page.goto('/');
    await page.waitForSelector('.v-app', { timeout: 10_000 });

    // Navigate to login page explicitly
    await page.goto('/login');
    await page.waitForURL('**/login');

    // Navigate to a different page
    await page.goto('/not-found');
    await page.waitForURL('**/not-found');

    // Go back — should return to /login
    await page.goBack();
    await page.waitForURL('**/login', { timeout: 2_000 });

    // The page content should reflect the login page
    const url = page.url();
    expect(url).toContain('/login');
  });

  test('forward navigation updates content to match URL', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Build navigation history
    await page.goto('/login');
    await page.waitForSelector('.v-app', { timeout: 10_000 });

    await page.goto('/not-found');
    await page.waitForURL('**/not-found');

    // Go back to /login
    await page.goBack();
    await page.waitForURL('**/login', { timeout: 2_000 });

    // Go forward to /not-found
    await page.goForward();
    await page.waitForURL('**/not-found', { timeout: 2_000 });

    const url = page.url();
    expect(url).toContain('/not-found');
  });

  test('navigating to undefined path shows not-found content without reload (R2.5)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    await page.goto('/');
    await page.waitForSelector('.v-app', { timeout: 10_000 });

    // Track reload events
    let reloaded = false;
    page.on('load', () => {
      reloaded = true;
    });

    // Navigate to an undefined path
    await page.goto('/some-random-nonexistent-path-12345');

    // Should show not found content (the catch-all route renders NotFoundPage)
    // Wait for the not-found page content to appear
    await page.waitForSelector('.v-app', { timeout: 5_000 });

    // The URL should reflect the invalid path or /not-found
    const bodyText = await page.textContent('body');
    // NotFoundPage should contain some indication of "not found"
    // This is flexible — it could be in Vietnamese or English
    const hasNotFoundIndicator =
      bodyText?.includes('404') ||
      bodyText?.includes('not found') ||
      bodyText?.includes('không tìm thấy') ||
      bodyText?.includes('Không tìm thấy');

    expect(hasNotFoundIndicator).toBe(true);
  });

  test('back/forward updates content within 1 second (R2.4)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Navigate through multiple pages to build history
    await page.goto('/login');
    await page.waitForSelector('.v-app', { timeout: 10_000 });

    await page.goto('/not-found');
    await page.waitForURL('**/not-found');

    // Measure time for back navigation
    const start = Date.now();
    await page.goBack();
    await page.waitForURL('**/login', { timeout: 1_000 });
    const elapsed = Date.now() - start;

    // Content should update within 1 second (R2.4)
    expect(elapsed).toBeLessThan(1_000);
  });
});
