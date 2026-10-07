import assert from 'node:assert/strict';
import test from 'node:test';

import { searchSupportArticles } from '../lib/ai/support-search.ts';

test('support search ranks the relevant product guide first', () => {
  const [result] = searchSupportArticles('Why does receiving a purchase order not update stock?');
  assert.equal(result?.slug, 'receive-a-delivery');
  assert.match(result?.excerpt ?? '', /stock|purchase order/i);
});

test('support search stays bounded and returns no match for unrelated text', () => {
  assert.ok(searchSupportArticles('reports stock shifts email onboarding', 20).length <= 3);
  assert.deepEqual(searchSupportArticles('quasar nebula'), []);
});

test('QR ordering setup and availability questions find the dedicated guide', () => {
  const [result] = searchSupportArticles('Why can’t I make a QR order now? The store says closed.');
  assert.equal(result?.slug, 'set-up-qr-ordering');
});

test('current workflows find their dedicated guides', () => {
  const cases: Array<[string, string]> = [
    ['How do I cash up and close the day?', 'cash-up-and-reconcile'],
    ['How do I clock in for my shift?', 'use-my-rota-and-clock-in'],
    ['Where are held tickets on the till?', 'take-orders-on-the-till'],
    ['How do I set up the kitchen screen chime?', 'run-the-kitchen-screen'],
    ['How do loyalty stamps and rewards work?', 'customer-loyalty-and-records'],
    ['How do I erase a customer for a privacy request?', 'handle-privacy-requests'],
    ['Can I change my dashboard layout?', 'set-up-your-dashboard'],
  ];
  for (const [question, slug] of cases) {
    assert.equal(searchSupportArticles(question)[0]?.slug, slug, question);
  }
});

test('every support article has a unique slug', async () => {
  const { SUPPORT_ARTICLES } = await import('../lib/content/support-articles.ts');
  const slugs = SUPPORT_ARTICLES.map((article) => article.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});
