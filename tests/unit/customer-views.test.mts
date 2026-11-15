import assert from 'node:assert/strict';
import test from 'node:test';

import { activeQuickView, quickViewFilters } from '../../lib/utils/customer-views.ts';

test('a quick view stays lit through search and sort, and goes out once anything else narrows it', () => {
  const november = 11;
  assert.equal(activeQuickView({}, november), 'all');
  assert.equal(activeQuickView({ search: 'sam', sort: 'spend', direction: 'desc' }, november), 'all');
  assert.equal(activeQuickView(quickViewFilters('birthdays', november), november), 'birthdays');
  assert.equal(activeQuickView({ birthdayMonth: 3 }, november), null);
  assert.equal(activeQuickView({ lapsedDays: 60, search: 'sam' }, november), 'lapsed');
  assert.equal(activeQuickView({ lapsedDays: 60, tier: 'gold' }, november), null);
  // Cleared multi-selects and switched-off flags don't count as narrowing.
  assert.equal(activeQuickView({ marketing: 'opted_in', allergies: [], neverVisited: false }, november), 'emailable');
});
