import assert from 'node:assert/strict';
import test from 'node:test';

const { periodFrom, readLoss, summariseLosses } = await import('../lib/utils/losses.ts');

const l = (quantity: number, reason: string | null, notes: string | null = null) => ({ quantity, reason, notes, createdAt: '2026-09-27T10:00:00Z' });

test('reads all three shapes of reason', () => {
  assert.deepEqual(readLoss(l(-1, 'EXPIRY', 'Back of fridge')), { kind: 'expired', note: 'Back of fridge' });
  assert.deepEqual(readLoss(l(-1, 'SPILL')), { kind: 'spilt', note: null });
  assert.deepEqual(readLoss(l(-1, 'DAMAGED')), { kind: 'damaged', note: null });
  assert.deepEqual(readLoss(l(-1, null, 'theft: till area')), { kind: 'theft', note: 'till area' });
  assert.deepEqual(readLoss(l(-1, null, 'Dropped: tray')), { kind: 'other', note: 'Dropped: tray' });
  assert.deepEqual(readLoss(l(-1, null, null)), { kind: 'other', note: null });
});

test('summary totals quantity and value, and finds the main reason', () => {
  const s = summariseLosses([l(-1.5, 'EXPIRY'), l(-0.2, 'SPILL'), l(-0.3, 'EXPIRED')], 1.05);
  assert.deepEqual(s, { quantity: 2, count: 3, valuePence: 210, topKind: 'expired' });
  assert.equal(summariseLosses([], null).topKind, null);
  assert.equal(summariseLosses([l(-1, 'OTHER')], null).valuePence, null);
});

test('periods start at local midnight', () => {
  const now = new Date(2026, 8, 27, 15);
  assert.equal(periodFrom('all', now), undefined);
  assert.equal(new Date(periodFrom('30d', now)!).getDate(), 28);
});

test('each write-off is valued at what it cost then; older ones at the item cost', () => {
  const at = (quantity: number, unitCost?: string | null) => ({ quantity, unitCost, reason: 'EXPIRED', createdAt: '2026-01-01' });
  assert.equal(summariseLosses([at(-2, '0.5000'), at(-1)], 3).valuePence, 400);
  assert.equal(summariseLosses([at(-2, '0.5000'), at(-1)], null).valuePence, null);
  assert.equal(summariseLosses([at(-2, '0.5000')], null).valuePence, 100);
});
