import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const service = readFileSync(join(root, 'lib/api/inventory.service.ts'), 'utf8');
const overview = readFileSync(join(root, 'components/inventory/StockOverview.tsx'), 'utf8');

test('an unknown stock forecast stays unknown instead of becoming zero days', () => {
  assert.match(service, /daysOfStockRemaining: number \| null/);
  assert.match(overview, /daysOfStockRemaining != null/);
  assert.match(overview, /days == null/);
  assert.doesNotMatch(overview, /days === undefined/);
});
