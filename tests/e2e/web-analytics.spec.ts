import { expect, test } from '@playwright/test';

test('website analytics: listed under Website, opens as a dashboard whose funnel steps can be edited', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('sam@example.test');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('correct-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'All reports' })).toBeVisible();
  await page.getByRole('link', { name: /Website analytics/ }).click();
  await expect(page).toHaveURL(/\/reports\/web-analytics/);

  await expect(page.getByText('Visitors', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Traffic sources' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Visits by day and hour' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Funnel' })).toBeVisible();
  await page.screenshot({ path: 'test-results/web-analytics.png', fullPage: true });

  // The report scrolls inside the shell; nothing in it may push the document taller than the window.
  const sizes = await page.evaluate(() => ({ document: document.scrollingElement!.scrollHeight, window: window.innerHeight }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.window);

  // Funnel steps are edited in a drawer: a suggestion from the period adds a step, Save applies it.
  await page.getByRole('button', { name: 'Edit steps' }).click();
  await expect(page.getByRole('heading', { name: 'Funnel steps' })).toBeVisible();
  await page.getByRole('button', { name: 'order_placed' }).click();
  await page.screenshot({ path: 'test-results/web-analytics-funnel-steps.png' });
  await page.getByRole('button', { name: 'Save steps' }).click();
  await expect(page.getByText('3 steps · within an hour')).toBeVisible();
});
