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
  let createdPayload: Record<string, unknown> | undefined;
  let linkedPayload: Record<string, unknown> | undefined;
  await page.route('**/v1/scheduled-shifts', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    createdPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '44444444-4444-4444-8444-444444444444',
        ...createdPayload,
        createdAt: '2026-09-15T12:00:00.000Z',
      }),
    });
  });
  await page.route('**/v1/shifts/33333333-3333-4333-8333-333333333333', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    linkedPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '33333333-3333-4333-8333-333333333333',
        userId: 'smoke-user',
        locationId: '22222222-2222-4222-8222-222222222222',
        clockedIn: '2026-09-14T08:02:00.000Z',
        clockedOut: '2026-09-14T13:44:00.000Z',
        scheduledShiftId: '44444444-4444-4444-8444-444444444444',
        durationMinutes: 342,
      }),
    });
  });

  await expect(page.getByRole('button', { name: 'Record hours' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan shift' })).toBeVisible();
  await page.getByRole('button', { name: /Open Sam Barista's shift/ }).click();
  await expect(page.getByRole('dialog', { name: 'Worked without a rota shift' })).toBeVisible();
  await expect(page.getByLabel('Date worked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save correction' })).toBeDisabled();
  const createMatching = page.getByRole('button', { name: 'Create matching rota shift' });
  await expect(createMatching).toBeEnabled();
  await createMatching.click();
  await expect(page.getByText('Matching rota shift created and linked.')).toBeVisible();
  expect(createdPayload).toMatchObject({
    userId: 'smoke-user',
    locationId: '22222222-2222-4222-8222-222222222222',
    startsAt: '2026-09-14T08:02:00.000Z',
    endsAt: '2026-09-14T13:44:00.000Z',
    status: 'published',
  });
  expect(linkedPayload).toEqual({ scheduledShiftId: '44444444-4444-4444-8444-444444444444' });
  const removeButton = page.getByRole('button', { name: 'Remove worked-time record' });
  const entryCard = removeButton.locator('..').locator('..').locator('..');
  const [cardBox, removeBox] = await Promise.all([entryCard.boundingBox(), removeButton.boundingBox()]);
  expect(cardBox).not.toBeNull();
  expect(removeBox).not.toBeNull();
  expect(cardBox!.x + cardBox!.width - (removeBox!.x + removeBox!.width)).toBeGreaterThanOrEqual(8);

  await removeButton.click();
  const confirmation = page.getByRole('dialog', { name: 'Remove this worked-time record?' });
  await expect(confirmation).toContainText('Any planned rota shift stays in place');
  await expect(confirmation.getByRole('button', { name: 'Remove worked time' })).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirmation).not.toBeVisible();
});

test('record hours is a distinct flow and explains that it does not create rota work', async ({ page }) => {
  await page.getByRole('button', { name: 'Record hours' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record worked time' });
  await expect(dialog).toContainText('it will not add a shift to the rota');
  await expect(dialog.getByRole('button', { name: 'Record hours' })).toBeDisabled();
  await expect(dialog.getByLabel('Staff member')).toBeVisible();
  await expect(dialog.getByLabel('Location')).toBeVisible();
});
