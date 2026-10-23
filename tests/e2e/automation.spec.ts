import { expect, test } from '@playwright/test';

test('a single booking rule saves and reloads, and new triggers are selectable', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('sam@example.test');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('correct-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  const id = '55555555-5555-4555-8555-555555555555';
  let saved = {
    id, name: 'Prepare large bookings', trigger: 'reservation_confirmed', audience: 'customer', timezone: 'Europe/London', offsetDays: 0,
    publishedVersion: 0, isEnabled: false, templateId: null,
    definition: { schemaVersion: 1, nodes: [
      { id: 'trigger', type: 'trigger', name: 'Workflow trigger', config: { event: 'reservation_confirmed' } },
      { id: 'if', type: 'condition', name: 'Check booking', config: { field: 'booking.partySize', operator: 'equals', value: 8 } },
      { id: 'task', type: 'create_task', name: 'Prepare table', config: { subject: 'Prepare table', body: 'Review booking' } },
      { id: 'end', type: 'end', name: 'End', config: {} },
    ], edges: [
      { id: '1', source: 'trigger', target: 'if', branch: 'next' }, { id: '2', source: 'if', target: 'task', branch: 'yes' },
      { id: '3', source: 'if', target: 'end', branch: 'no' }, { id: '4', source: 'task', target: 'end', branch: 'next' },
    ] },
  };
  await page.route('**/v1/email/automations**', async route => {
    if (route.request().method() === 'PATCH') {
      saved = { ...saved, ...route.request().postDataJSON() };
      return route.fulfill({ json: saved });
    }
    return route.fulfill({ json: [saved] });
  });
  await page.goto('/communications?tab=automations');
  await expect(page).toHaveURL(/\/automation$/);
  await page.goto(`/automation?automation=${id}`);
  await page.getByRole('button', { name: /Check booking.*party size/i }).click();
  // A condition with a value opens folded to its sentence; open the If row to reach its controls.
  await page.getByRole('button', { name: /^If\b/ }).click();
  await expect(page.getByLabel('What to check')).toContainText('Party size');
  await expect(page.getByRole('button', { name: 'Add rule', exact: true })).toHaveCount(0);
  await page.getByLabel('Value', { exact: true }).fill('12');
  await page.screenshot({ path: '/tmp/duma-rules-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/duma-rules-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Unsaved changes' })).toHaveCount(0);
  expect(saved.definition.nodes.find(node => node.type === 'condition')!.config).toMatchObject({ field: 'booking.partySize', value: 12 });
  await page.reload();
  await page.getByRole('button', { name: /Check booking.*party size/i }).click();
  // A condition with a value opens folded to its sentence; open the If row to reach its controls.
  await page.getByRole('button', { name: /^If\b/ }).click();
  await expect(page.getByLabel('Value', { exact: true })).toHaveValue('12');
  await expect(page.getByLabel('What to check')).toHaveCount(1);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: /Workflow trigger.*Booking confirmed/i }).click();
  await page.getByRole('button', { name: /Event A table is booked/ }).click();
  await expect(page.getByRole('radio', { name: /An order is refunded/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /A booking is changed/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Stock falls below its threshold/ })).toBeVisible();
  await page.getByRole('radio', { name: /A booking is changed/ }).click();
});
