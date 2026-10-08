import assert from 'node:assert/strict';
import test from 'node:test';

const { stockHealthSummary, teamTodaySummary, tenderLabel, tenderShares } = await import('../lib/utils/dashboard-cards.ts');

const now = new Date('2026-10-08T12:00:00Z');
const row = (over: Record<string, unknown> = {}) => ({
  totalOnHand: '10',
  needsReorder: false,
  reorderLevel: '5',
  earliestExpiryDate: null,
  stockValue: '20',
  unvaluedQuantity: '0',
  ...over,
});

test('stock health counts out, low and expiring, and values the shelf', () => {
  const summary = stockHealthSummary(
    [
      row(),
      row({ totalOnHand: '0', stockValue: '0' }),
      row({ totalOnHand: '3', needsReorder: true }),
      row({ totalOnHand: '3', needsReorder: true, reorderLevel: '0' }),
      row({ earliestExpiryDate: '2026-10-12' }),
      row({ earliestExpiryDate: '2026-11-30' }),
      row({ stockValue: '5.5', unvaluedQuantity: '2' }),
    ],
    now,
  );
  assert.deepEqual(summary, { items: 7, out: 1, low: 1, expiring: 1, value: 105.5, unvalued: 1 });
});

test('a par of 0 is "none set", never low', () => {
  assert.equal(stockHealthSummary([row({ needsReorder: true, reorderLevel: '0' })], now).low, 0);
});

test('team today: who is on, who is rostered, and who has not turned up', () => {
  const rota = [
    { id: 's1', userId: 'ana', startsAt: '2026-10-08T08:00:00Z', endsAt: '2026-10-08T16:00:00Z' },
    { id: 's2', userId: 'ben', startsAt: '2026-10-08T11:00:00Z', endsAt: '2026-10-08T19:00:00Z' },
    { id: 's3', userId: 'cat', startsAt: '2026-10-08T11:55:00Z', endsAt: '2026-10-08T20:00:00Z' },
    { id: 's4', userId: 'dan', startsAt: '2026-10-08T17:00:00Z', endsAt: '2026-10-08T22:00:00Z' },
    { id: 's5', userId: null, startsAt: '2026-10-08T09:00:00Z', endsAt: '2026-10-08T17:00:00Z' },
  ];
  const active = [{ userId: 'ana', clockedIn: '2026-10-08T08:00:00Z', scheduledShiftId: 's1' }];
  // ben is an hour late; cat is inside the grace window; dan hasn't started yet.
  assert.deepEqual(teamTodaySummary({ rota, active, now }), { onShift: 1, rostered: 4, missing: 1, hoursSoFar: 4 });
});

test('tenders rank by takings with their share; zero rows drop out', () => {
  const shares = tenderShares([
    { method: 'cash', revenue: 25 },
    { method: 'card', revenue: 75 },
    { method: 'voucher', revenue: 0 },
  ]);
  assert.deepEqual(
    shares.map((s) => [s.method, s.share]),
    [
      ['card', 0.75],
      ['cash', 0.25],
    ],
  );
  assert.equal(tenderLabel('bank_transfer'), 'Bank transfer');
  assert.equal(tenderLabel(''), 'Other');
});
