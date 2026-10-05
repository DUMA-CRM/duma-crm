import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentCard } from '../lib/ai/agent-types.ts';
import { removeRepeatedCardRows } from '../lib/ai/card-prose.ts';

const recentOrders: AgentCard[] = [
  {
    kind: 'list',
    title: 'Recent orders',
    caption: 'Showing 2 of 3',
    rows: [
      { label: 'Order #c62df544', value: '£4.90', meta: 'POS · done · 29 Sep 2026, 12:44' },
      { label: 'Order #26c7fcc4', value: '£8.10', meta: 'POS · done · 28 Sep 2026, 23:48' },
    ],
  },
];

test('a narrated copy of list-card rows is removed completely', () => {
  const answer = `Here are the 3 most recent orders across channels:

- **£4.90** (POS, done) — 2026-09-29 11:44
- **£8.10** (POS, done) — 2026-09-28 22:48
- **£6.60** (POS, cancelled) — 2026-09-28 21:53`;
  assert.equal(removeRepeatedCardRows(answer, recentOrders), '');
});

test('an implication stays while repeated rows leave', () => {
  const answer = `The latest orders are all from POS; one cancellation needs attention.

- **£4.90** (POS, done) — 2026-09-29 11:44
- **£8.10** (POS, done) — 2026-09-28 22:48`;
  assert.equal(removeRepeatedCardRows(answer, recentOrders), 'The latest orders are all from POS; one cancellation needs attention.');
});

test('a distinct recommendation list is preserved', () => {
  const answer = `Recommended next steps:

- Review the cancelled order
- Compare POS totals with the cash-up`;
  assert.equal(removeRepeatedCardRows(answer, recentOrders), answer);
});
