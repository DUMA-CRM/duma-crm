import { expect, test } from '@playwright/test';

test('Telegram setup, explicit test, pause and mobile layout', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('sam@example.test');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('correct-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  let connection: Record<string, unknown> | null = null;
  let sends = 0;
  await page.route('**/v1/telegram-connections**', async (route) => {
    if (route.request().url().includes('/chats')) return route.fulfill({ json: [{ id: '-1001234567890', title: 'High Street staff' }] });
    if (route.request().method() === 'PUT') {
      const data = route.request().postDataJSON();
      connection = {
        id: 'telegram-test',
        botUsername: 'duma_staff_bot',
        chatId: data.chatId,
        chatTitle: 'High Street staff',
        isEnabled: data.isEnabled,
        lastTestedAt: connection?.lastTestedAt ?? null,
        lastError: null,
      };
    }
    if (route.request().method() === 'POST') {
      sends++;
      connection = { ...connection, lastTestedAt: new Date().toISOString() };
    }
    return route.fulfill({ json: connection });
  });
  await page.goto('/settings/connectors?connector=telegram');
  await expect(page.getByText('Telegram isn’t set up')).toBeVisible();
  await page.getByRole('button', { name: 'Connect Telegram' }).click();
  await expect(page.getByRole('heading', { name: 'Create your Telegram bot' })).toBeVisible();
  await page.getByLabel('Bot token', { exact: true }).fill('123456:fake_token_only_for_browser_testing');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByRole('heading', { name: 'Where should messages go?' })).toBeVisible();
  await page.getByRole('button', { name: 'Find chats', exact: true }).click();
  await page.getByRole('combobox', { name: 'Choose a chat' }).click();
  await page.getByRole('option', { name: /High Street staff/ }).click();
  await expect(page.getByLabel('Destination chat ID')).toHaveValue('-1001234567890');
  await page.getByRole('button', { name: /Verify and save/ }).click();
  await expect(page.getByRole('heading', { name: 'Prove it works' })).toBeVisible();
  expect(sends).toBe(0);
  await page.getByRole('button', { name: 'Send test message' }).click();
  await expect(page.getByText(/Last successful test/)).toBeVisible();
  expect(sends).toBe(1);
  await page.getByRole('button', { name: /Finish setup/ }).click();
  await expect(page.getByText('Posting to High Street staff')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: '/tmp/duma-telegram-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/duma-telegram-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('switch', { name: 'Allow automation notifications' }).click();
  await expect(page.getByRole('button', { name: 'Send test message' })).toBeDisabled();
  await page.getByRole('button', { name: 'Verify and save' }).click();
  await expect(page.getByText(/Paused — automation messages are skipped/)).toBeVisible();
  await page.getByRole('button', { name: 'Send test message' }).click();
  await expect.poll(() => sends).toBe(2);
});
