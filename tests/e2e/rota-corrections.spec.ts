import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('sam@example.test');
  await page.getByLabel('Password').fill('correct-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/staff/rota');
});

test('a manager can open unplanned work from all locations and correct its date or time', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Record hours' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan shift' })).toBeVisible();
  await page.getByRole('button', { name: /Open Sam Barista's shift/ }).click();
  await expect(page.getByRole('dialog', { name: 'Worked without a rota shift' })).toBeVisible();
  await expect(page.getByLabel('Date worked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save correction' })).toBeDisabled();
});

test('record hours is a distinct flow and explains that it does not create rota work', async ({ page }) => {
  await page.getByRole('button', { name: 'Record hours' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record worked time' });
  await expect(dialog).toContainText('it will not add a shift to the rota');
  await expect(dialog.getByRole('button', { name: 'Record hours' })).toBeDisabled();
  await expect(dialog.getByLabel('Staff member')).toBeVisible();
  await expect(dialog.getByLabel('Location')).toBeVisible();
});
