import assert from 'node:assert/strict';
import test from 'node:test';

const { tenderSegments } = await import('../lib/utils/dashboard-cards.ts');

test('tenders: the biggest three by name, the rest folded into Other', () => {
  const rows = [
    { method: 'cash', revenue: 20, orders: 4 },
    { method: 'card', revenue: 60, orders: 10 },
    { method: 'gift_card', revenue: 5, orders: 1 },
    { method: 'bank_transfer', revenue: 10, orders: 1 },
    { method: 'voucher', revenue: 5, orders: 2 },
    { method: 'refunded', revenue: -3, orders: 1 },
  ];
  const segments = tenderSegments(rows);
  assert.deepEqual(
    segments.map((segment) => [segment.label, segment.revenue, segment.orders]),
    [
      ['Card', 60, 10],
      ['Cash', 20, 4],
      ['Bank transfer', 10, 1],
      ['Other', 10, 3],
    ],
  );
  assert.equal(Math.round(segments.reduce((sum, segment) => sum + segment.share, 0) * 100), 100);
});

test('four tenders stay four — no "Other" holding just one', () => {
  const rows = ['card', 'cash', 'voucher', 'cheque'].map((method, index) => ({ method, revenue: 10 - index }));
  assert.deepEqual(
    tenderSegments(rows).map((segment) => segment.label),
    ['Card', 'Cash', 'Voucher', 'Cheque'],
  );
  assert.deepEqual(tenderSegments([]), []);
});
