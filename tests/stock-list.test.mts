import assert from 'node:assert/strict';
import test from 'node:test';

const { filterStock, groupByCategory, needsOrdering, orderQuantity, sortStock, stockCounts, stockHealth, stockValue, suggestedOrder } = await import(
  '../lib/utils/stock-list.ts'
);

const NOW = new Date('2026-09-27T09:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();
const line = (over: Record<string, unknown> = {}) =>
  ({
    stockItemId: String(over.name ?? 'x'),
    name: 'Item',
    unit: 'kg',
    category: 'FOOD',
    qty: 10,
    threshold: 4,
    isAvailable: true,
    unitCost: 2,
    coverDays: null,
    earliestExpiry: null,
    recommendedQty: 0,
    reorderQty: null,
    needsReorder: false,
    ...over,
  }) as never;

test('health reads against par: out at zero, critical at half, low at par', () => {
  assert.equal(stockHealth(line({ qty: 0 })), 'out');
  assert.equal(stockHealth(line({ qty: 2 })), 'critical');
  assert.equal(stockHealth(line({ qty: 4 })), 'low');
  assert.equal(stockHealth(line({ qty: 5 })), 'ok');
  assert.equal(stockHealth(line({ qty: 5, threshold: 0 })), 'ok');
  assert.equal(stockHealth(line({ isAvailable: false })), 'unavailable');
});

test('stock value sums on-hand at last cost and counts what has no cost', () => {
  assert.deepEqual(stockValue([line({ qty: 3, unitCost: 1.1 }), line({ qty: 2, unitCost: null }), line({ qty: -1, unitCost: 5 })]), { value: 3.3, unpriced: 1 });
});

test('order quantity prefers the forecast, then the reorder quantity, then twice par', () => {
  assert.equal(orderQuantity(line({ recommendedQty: 6.2 })), 7);
  assert.equal(orderQuantity(line({ reorderQty: 12 })), 12);
  assert.equal(orderQuantity(line({ qty: 1, threshold: 4 })), 7);
  assert.equal(orderQuantity(line({ threshold: 0 })), 0);
});

test('the suggested order takes what is low, flagged or running out, soonest first', () => {
  const lines = [
    line({ name: 'Milk', qty: 1, coverDays: 1 }),
    line({ name: 'Beans', qty: 20, coverDays: 5 }),
    line({ name: 'Cups', qty: 50 }),
    line({ name: 'Syrup', qty: 0, isAvailable: false }),
  ];
  assert.equal(needsOrdering(lines[2]), false);
  assert.deepEqual(
    suggestedOrder(lines).map((entry: { line: { name: string } }) => entry.line.name),
    ['Milk', 'Beans'],
  );
});

test('views, sorting and grouping', () => {
  const lines = [
    line({ name: 'Oat milk', category: 'BEVERAGE', qty: 2, earliestExpiry: day(3), coverDays: 2 }),
    line({ name: 'Flour', qty: 30, unitCost: 1 }),
    line({ name: 'Napkins', category: 'SUPPLY', qty: 100, unitCost: 0.02 }),
  ];
  const now = NOW;
  assert.deepEqual(
    filterStock(lines, { view: 'expiring', category: 'all', search: '', now }).map((l: { name: string }) => l.name),
    ['Oat milk'],
  );
  assert.deepEqual(
    filterStock(lines, { view: 'all', category: 'FOOD', search: 'fl', now }).map((l: { name: string }) => l.name),
    ['Flour'],
  );
  assert.deepEqual(
    sortStock(lines, 'value').map((l: { name: string }) => l.name),
    ['Flour', 'Oat milk', 'Napkins'],
  );
  assert.deepEqual(
    groupByCategory(lines).map((g: { category: string | null }) => g.category),
    ['FOOD', 'BEVERAGE', 'SUPPLY'],
  );
  const counts = stockCounts(lines, now);
  assert.equal(counts.low, 1);
  assert.equal(counts.expiring, 1);
  assert.equal(counts.runningOut, 1);
  assert.equal(counts.reorder, 1);
});
