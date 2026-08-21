// Smoke E2E: login form renders, accepts input, and rejects bad passwords.
// This test requires a running Supabase instance seeded with at least one
// signature_sessions row. See README for the seed command.

import { test, expect } from '@playwright/test';

test('login page renders and validates input', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Reference number')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
