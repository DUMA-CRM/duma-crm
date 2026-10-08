import assert from 'node:assert/strict';
import test from 'node:test';

const { REPORTS } = await import('../lib/reports/catalogue.ts');
const { channelCount, reportRelevance, splitReports } = await import('../lib/reports/relevance.ts');

const everything = new Set(['ordering', 'pos', 'qr-ordering', 'payments', 'inventory', 'purchasing', 'workforce', 'customers']);
const full = { modules: everything, locationCount: 3, kitchen: true, vatRegistered: true, channels: 2 };

test('a full café chain sees every report', () => {
  assert.equal(splitReports(REPORTS, full).hidden.length, 0);
});

test('one location hides Sales by location; one channel hides Sales by channel', () => {
  assert.equal(reportRelevance('sales-by-location', { ...full, locationCount: 1 }).relevant, false);
  assert.equal(reportRelevance('sales-by-channel', { ...full, channels: 1 }).relevant, false);
});

test('a single-site shop with only the till and stock sees what applies to it', () => {
  const shop = {
    modules: new Set(['ordering', 'pos', 'payments', 'inventory']),
    locationCount: 1,
    kitchen: false,
    vatRegistered: false,
    channels: 1,
  };
  const { shown, hidden } = splitReports(REPORTS, shop);
  assert.deepEqual(hidden.map((entry) => entry.report.id).sort(), [
    'customer-retention',
    'labour-vs-sales',
    'menu-engineering',
    'prime-cost',
    'purchasing',
    'sales-by-channel',
    'sales-by-location',
    'staff-hours',
    'vat',
  ]);
  assert.ok(shown.some((report) => report.id === 'end-of-day'));
  assert.ok(hidden.every((entry) => entry.reason.length > 0));
});

test('unknown is shown: modules loading, VAT not readable', () => {
  const loading = { modules: null, locationCount: 2, kitchen: true, channels: 2 };
  assert.equal(splitReports(REPORTS, loading).hidden.length, 0);
});

test('channels: the modules that take orders, joined with what actually sold', () => {
  assert.equal(channelCount(new Set(['pos']), []), 1);
  assert.equal(channelCount(new Set(['pos', 'qr-ordering']), []), 2);
  // An online shop with no till: web orders and manual ones.
  assert.equal(channelCount(new Set(['ordering']), ['web', 'manual', 'web', null]), 2);
  assert.equal(channelCount(new Set(['pos']), ['pos']), 1);
});
