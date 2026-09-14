import { expect, test } from '@playwright/test';

test('a team member can sign in and reach their dashboard', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('sam@example.test');
  await page.getByLabel('Password').fill('correct-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Sam/ })).toBeVisible();
});
