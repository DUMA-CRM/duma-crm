import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const service = readFileSync(join(root, 'lib/api/inventory.service.ts'), 'utf8');
const overview = readFileSync(join(root, 'components/inventory/StockOverview.tsx'), 'utf8');

test('an unknown stock forecast stays unknown instead of becoming zero days', async () => {
  assert.match(service, /daysOfStockRemaining: number \| null/);
  // Since 2026-09-27 the overview folds the forecast into a StockLine; a missing
  // forecast must carry through as null, never as 0.
  assert.match(overview, /coverDays: forecast\?\.daysOfStockRemaining \?\? null/);
  assert.match(overview, /cover === null/);

  const { needsOrdering, stockCounts } = await import('../lib/utils/stock-list.ts');
  const unknown = {
    stockItemId: 'a', name: 'A', unit: 'kg', category: null, qty: 10, threshold: 2, isAvailable: true, unitCost: null,
    coverDays: null, earliestExpiry: null, recommendedQty: 0, reorderQty: null, needsReorder: false,
  };
  // An item with no usage history is neither "running out" nor on the order.
  assert.equal(needsOrdering(unknown), false);
  assert.equal(stockCounts([unknown], new Date()).runningOut, 0);
});
