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
