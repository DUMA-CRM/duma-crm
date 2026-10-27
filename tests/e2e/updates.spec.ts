import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const id = '11111111-1111-4111-8111-111111111119';
const content = {
  title: 'Menu management just got easier',
  summary: 'Update prices directly from your menu list and keep service moving.',
  body: '## What changed\n\n- Edit prices directly from the menu.\n- See unavailable products immediately.\n\n## What you need to do\n\nNothing — the update is already active.',
  category: 'improved',
  targetRoles: [],
  targetModules: [],
  actionLabel: 'Open menu',
  actionUrl: '/menu',
};
const post = { ...content, id, announcement: 1, publishedAt: '2026-10-25T12:00:00Z', unread: true };
const output = '/tmp/duma-updates-review';

test('announcement is shown once, opens its article, and remains accessible on mobile', async ({ page, context }) => {
  test.setTimeout(60_000);
  await mkdir(output, { recursive: true });
  await context.addCookies([{ name: 'better-auth.session_token', value: 'smoke-token', domain: '127.0.0.1', path: '/' }]);
  let shown = false;
  let read = false;
  await page.route('**/be/v1/updates**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/shown')) {
      const claimed = !shown;
      shown = true;
      return route.fulfill({ json: { claimed } });
    }
    if (path.endsWith('/read')) {
      read = true;
      return route.fulfill({ json: { claimed: true } });
    }
    if (path.endsWith('/dismiss')) return route.fulfill({ json: { claimed: true } });
    if (path.endsWith('/unread')) return route.fulfill({ json: { count: read ? 0 : 1, popup: shown ? null : post } });
    if (path.endsWith(id)) return route.fulfill({ json: post });
    return route.fulfill({ json: { data: [{ ...post, unread: !read }], hasMore: false } });
  });
  await page.goto('/dashboard');
  const dialog = page.getByRole('dialog', { name: 'What’s new in DUMA' });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${output}/popup-desktop.png`, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: `${output}/popup-mobile-actual.png`, animations: 'disabled' });
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await dialog.getByRole('button', { name: 'Read update' }).click();
  await expect(page).toHaveURL(new RegExp(`/updates/${id}$`), { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: content.title })).toBeVisible();
  await expect.poll(() => read).toBe(true);
  await page.screenshot({ path: `${output}/article-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/article-mobile.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: "What's new", exact: true })).toBeVisible();
  await expect(dialog).not.toBeVisible();
});

test('superadmin publishes from Content with CMS disabled and can preview on mobile', async ({ page, context }) => {
  test.setTimeout(60_000);
  await mkdir(output, { recursive: true });
  await context.addCookies([
    { name: 'better-auth.session_token', value: 'smoke-token', domain: '127.0.0.1', path: '/' },
    { name: 'updates-test-admin', value: '1', domain: '127.0.0.1', path: '/' },
    { name: 'updates-test-cms-disabled', value: '1', domain: '127.0.0.1', path: '/' },
  ]);
  let draft = {
    id,
    draft: content,
    published: null as typeof content | null,
    publishedAt: null as string | null,
    announcement: 0,
    revision: 1,
    popupExpiresAt: null,
    updatedAt: post.publishedAt,
  };
  let published = false;
  await page.route('**/be/v1/updates**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/unread')) return route.fulfill({ json: { count: 0, popup: null } });
    if (path.endsWith('/publish')) {
      expect(route.request().postDataJSON().announce).toBe(true);
      published = true;
      draft = { ...draft, published: draft.draft, publishedAt: new Date().toISOString(), announcement: 1, revision: draft.revision + 1 };
      return route.fulfill({ json: draft });
    }
    if (route.request().method() === 'PUT') {
      draft = { ...draft, draft: route.request().postDataJSON().draft, revision: draft.revision + 1 };
      return route.fulfill({ json: draft });
    }
    if (path.endsWith(id)) return route.fulfill({ json: draft });
    return route.fulfill({ json: { data: [draft], hasMore: false } });
  });
  await page.goto('/content?tab=updates');
  await expect(page.getByRole('heading', { name: 'DUMA Updates' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: new RegExp(content.title) }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(content.title);
  await page.getByLabel('Title', { exact: true }).fill('A faster way to manage your menu');
  await page.screenshot({ path: `${output}/editor-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/editor-mobile.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Preview message' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'A faster way to manage your menu' })).toBeVisible();
  await page.screenshot({ path: `${output}/popup-mobile.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Publish…', exact: true }).click();
  await expect(page.getByText('Audience: all DUMA staff users across all workspaces.')).toBeVisible();
  await page.getByRole('button', { name: 'Publish & announce' }).click();
  await expect.poll(() => published).toBe(true);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
