import assert from 'node:assert/strict';
import test from 'node:test';

import { type PromotionsListRow, filterPromotions, promotionsOverview } from '../../lib/utils/promotions-overview.ts';

const NOW = Date.parse('2026-11-16T12:00:00Z');

const promotion = (name: string, patch: Partial<PromotionsListRow> = {}): PromotionsListRow => ({
  name,
  kind: 'percentage',
  status: 'active',
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  redemptionCount: 0,
  firstCode: null,
  discountTotal: '0.00',
  ...patch,
});

const promotions = [
  promotion('Summer 10%', { firstCode: 'SUMMER10', redemptionCount: 3, discountTotal: '0.10' }),
  promotion('Launch week', { startsAt: '2026-12-01T00:00:00Z', kind: 'fixed_amount' }),
  promotion('Flyer batch', { maxRedemptions: 50, redemptionCount: 50, discountTotal: '0.20' }),
  promotion('Halloween', { endsAt: '2026-11-01T00:00:00Z', kind: 'free_item' }),
  promotion('Staff', { status: 'paused' }),
  promotion('Old opening', { status: 'archived', redemptionCount: 7, discountTotal: '0.70' }),
];
const names = (rows: PromotionsListRow[]) => rows.map((row) => row.name);

test('used up and past its end date are both ended; current leaves only the archive out', () => {
  const view = (value: Parameters<typeof filterPromotions>[1]['view']) =>
    names(filterPromotions(promotions, { view: value, kind: 'any', search: '' }, NOW));
  assert.deepEqual(view('ended'), ['Flyer batch', 'Halloween']);
  assert.deepEqual(view('scheduled'), ['Launch week']);
  assert.deepEqual(view('live'), ['Summer 10%']);
  assert.equal(view('current').length, 5);
  assert.deepEqual(view('archived'), ['Old opening']);
});

test('search finds a name or a code; type narrows it', () => {
  assert.deepEqual(names(filterPromotions(promotions, { view: 'current', kind: 'any', search: ' summer10 ' }, NOW)), ['Summer 10%']);
  assert.deepEqual(names(filterPromotions(promotions, { view: 'current', kind: 'free_item', search: '' }, NOW)), ['Halloween']);
});

test('the figures: archived is out of live/paused/ended, but its uses and money still count, to the penny', () => {
  // 0.10 + 0.20 + 0.70 is 0.9999999999999999 in floating point.
  assert.deepEqual(promotionsOverview(promotions, NOW), { current: 5, live: 1, paused: 1, ended: 2, uses: 60, discountGiven: '1.00' });
  assert.equal(promotionsOverview([], NOW).discountGiven, '0.00');
});
