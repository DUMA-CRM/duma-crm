import assert from 'node:assert/strict';
import test from 'node:test';

import { searchSupportArticles } from '../lib/ai/support-search.ts';

test('support search covers the previously missing administrative workflows', () => {
  for (const query of [
    'cash up variance',
    'privacy request due date',
    'customer duplicates merge',
    'payment connectors',
    'audit log',
    'update my personal details',
  ]) {
    assert.ok(searchSupportArticles(query).length > 0, `Expected a support result for “${query}”`);
  }
});
