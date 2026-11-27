import { test, expect } from '@playwright/test';

test.describe('Authentication and Route Guard Flows', () => {
  test('login page loads and renders authentication form correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('System Authentication')).toBeVisible();
    await expect(page.getByLabel(/Operator Email/i)).toBeVisible();
    await expect(page.getByLabel(/Passcode/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Authenticate/i })).toBeVisible();
  });

  test('register page loads and displays registration fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Request Clearance')).toBeVisible();
    await expect(page.getByLabel(/Operator Identity/i)).toBeVisible();
    await expect(page.getByLabel(/Primary Dispatch Email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Submit Credentials/i })).toBeVisible();
  });

  test('unauthenticated visit to protected dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login?returnTo=%2Fdashboard');
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('returnTo=%2Fdashboard');
  });
});
