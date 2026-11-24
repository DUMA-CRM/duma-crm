import assert from 'node:assert/strict';
import test from 'node:test';

import { reportShortcuts } from '../../lib/dashboard/report-shortcuts.ts';

const ids = (reports: { id: string }[]) => reports.map((report) => report.id);

test('a shortcut shows only when the viewer holds one of its report’s capabilities', () => {
  // analytics:read alone opens neither end of day (cashups:read) nor refunds (orders:refund).
  assert.deepEqual(ids(reportShortcuts(['analytics:read'])), [
    'sales-summary',
    'labour-vs-sales',
    'item-sales',
    'payment-methods',
    'staff-hours',
  ]);
  assert.deepEqual(ids(reportShortcuts(['cashups:read', 'loss:read'])), ['end-of-day', 'waste']);
  assert.deepEqual(reportShortcuts([]), []);
  assert.deepEqual(reportShortcuts(null), []);
});

test('starred reports come first, still only those the viewer can open', () => {
  assert.deepEqual(ids(reportShortcuts(['analytics:read'], ['vat', 'refunds', 'sales-summary'], 3)), [
    'vat',
    'sales-summary',
    'labour-vs-sales',
  ]);
});
