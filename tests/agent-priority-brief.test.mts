import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePriorityBrief } from '../lib/ai/priority-brief.ts';

test('three operational priorities become a ranked brief with next actions', () => {
  const brief = parsePriorityBrief(`1. **Restock milk now** — Oat milk is at zero. **Next:** Raise a restock request.
2. **Check attendance** — One person is clocked in off rota. **Next:** Confirm the shift.
3. **Review cash-up** — The latest close has a variance. **Next:** Reconcile the tender totals.`);

  assert.deepEqual(brief?.items, [
    { rank: 1, title: 'Restock milk now', evidence: 'Oat milk is at zero.', next: 'Raise a restock request.' },
    { rank: 2, title: 'Check attendance', evidence: 'One person is clocked in off rota.', next: 'Confirm the shift.' },
    { rank: 3, title: 'Review cash-up', evidence: 'The latest close has a variance.', next: 'Reconcile the tender totals.' },
  ]);
});

test('ordinary numbered instructions stay ordinary markdown', () => {
  assert.equal(parsePriorityBrief('1. Open Settings\n2. Choose Trading\n3. Save'), undefined);
});

test('the current evidence-only answer is still recognised', () => {
  const brief = parsePriorityBrief(`1. **Stock outages**: Oat milk and soy milk are at zero stock.
2. **Unrostered attendance**: No shifts are scheduled, but one person is clocked in.
3. **Cash-up discrepancies**: The latest cash-up has a cash variance.`);

  assert.equal(brief?.items.length, 3);
  assert.equal(brief?.items[0].title, 'Stock outages');
  assert.equal(brief?.items[0].next, undefined);
});
