import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bucketAxisLabel,
  comparisonRange,
  delta,
  exportFileName,
  formatDelta,
  ordersHref,
  rangeDays,
  rangeLabel,
  readFilters,
  resolveRange,
  toCsv,
  toDateKey,
  writeFilters,
} from '../lib/utils/report-filters.ts';

// Saturday 4 October 2026, mid-afternoon, local time.
const NOW = new Date(2026, 9, 4, 15, 30);
const keys = (range: { from: Date; to: Date }) => [toDateKey(range.from), toDateKey(range.to)];

test('presets resolve to local-day ranges with an exclusive end', () => {
  assert.deepEqual(keys(resolveRange({ preset: 'today' }, NOW)), ['2026-10-04', '2026-10-05']);
  assert.deepEqual(keys(resolveRange({ preset: 'yesterday' }, NOW)), ['2026-10-03', '2026-10-04']);
  assert.deepEqual(keys(resolveRange({ preset: 'this-week' }, NOW)), ['2026-09-28', '2026-10-05']);
  assert.deepEqual(keys(resolveRange({ preset: 'last-week' }, NOW)), ['2026-09-21', '2026-09-28']);
  assert.deepEqual(keys(resolveRange({ preset: 'last-7' }, NOW)), ['2026-09-28', '2026-10-05']);
  assert.deepEqual(keys(resolveRange({ preset: 'last-month' }, NOW)), ['2026-09-01', '2026-10-01']);
  assert.deepEqual(keys(resolveRange({ preset: 'this-quarter' }, NOW)), ['2026-10-01', '2026-10-05']);
  assert.equal(rangeDays(resolveRange({ preset: 'last-30' }, NOW)), 30);
});

test('a custom range is inclusive of its last day, and tolerates reversed days', () => {
  assert.deepEqual(keys(resolveRange({ preset: 'custom', from: '2026-09-01', to: '2026-09-30' }, NOW)), ['2026-09-01', '2026-10-01']);
  assert.deepEqual(keys(resolveRange({ preset: 'custom', from: '2026-09-30', to: '2026-09-01' }, NOW)), ['2026-09-01', '2026-10-01']);
});

test('the comparison is the period before, or the same days last year', () => {
  const september = resolveRange({ preset: 'last-month' }, NOW);
  assert.deepEqual(keys(comparisonRange(september, 'previous')!), ['2026-08-02', '2026-09-01']);
  // A whole month compares by calendar.
  assert.deepEqual(keys(comparisonRange(september, 'year')!), ['2025-09-01', '2025-10-01']);
  assert.equal(comparisonRange(september, 'none'), null);
});

test('filters round-trip through the URL, writing only what differs from the default', () => {
  assert.equal(writeFilters({ preset: 'last-30', compare: 'previous', locationId: '' }).toString(), '');
  const custom = { preset: 'custom' as const, from: '2026-09-01', to: '2026-09-30', compare: 'year' as const, locationId: 'loc-1' };
  assert.deepEqual(readFilters(writeFilters(custom)), custom);
  // A custom range with a broken day falls back rather than throwing.
  assert.equal(readFilters(new URLSearchParams('range=custom&from=2026-02-30&to=2026-03-01')).preset, 'last-30');
  // Unrelated parameters survive.
  assert.equal(writeFilters({ preset: 'today', compare: 'none', locationId: '' }, new URLSearchParams('tab=x')).get('tab'), 'x');
});

test('a range names itself by preset, or by its days', () => {
  assert.equal(rangeLabel({ preset: 'last-7' }, resolveRange({ preset: 'last-7' }, NOW)), 'Last 7 days');
  const range = resolveRange({ preset: 'custom', from: '2026-09-01', to: '2026-09-30' }, NOW);
  assert.equal(
    rangeLabel({ preset: 'custom' }, range),
    '1 Sept – 30 Sept 2026'.replaceAll('Sept', range.from.toLocaleDateString('en-GB', { month: 'short' })),
  );
});

test('change reads as a percentage, "New" from zero, and nothing without a comparison', () => {
  assert.equal(formatDelta(delta(112, 100)), '+12%');
  assert.equal(formatDelta(delta(96, 100)), '−4%');
  assert.equal(formatDelta(delta(5, 0)), 'New');
  assert.equal(formatDelta(delta(0, 0)), 'No change');
  assert.equal(formatDelta(delta(5, null)), null);
});

test('CSV quotes what needs quoting and defuses formulas', () => {
  const csv = toCsv(
    [
      { name: 'Flat white, large', note: 'said "hi"', amount: 3.5 },
      { name: '=SUM(A1)', note: null, amount: -1 },
    ],
    [
      { header: 'Item', value: (row) => row.name },
      { header: 'Note', value: (row) => row.note },
      { header: 'Amount', value: (row) => row.amount },
    ],
  );
  assert.equal(csv, 'Item,Note,Amount\r\n"Flat white, large","said ""hi""",3.5\r\n\'=SUM(A1),,-1\r\n');
});

test('an export is named for its report and its days', () => {
  assert.equal(exportFileName('sales-summary', resolveRange({ preset: 'last-month' }, NOW)), 'sales-summary_2026-09-01_2026-09-30.csv');
});

test('a daily series covers every day, with quiet days as zero', async () => {
  const { fillDays, daysIn } = await import('../lib/utils/report-filters.ts');
  const range = resolveRange({ preset: 'custom', from: '2026-09-01', to: '2026-09-03' }, NOW);
  assert.deepEqual(daysIn(range), ['2026-09-01', '2026-09-02', '2026-09-03']);
  assert.deepEqual(
    fillDays([{ date: '2026-09-02', revenue: '12.50' }], range, (row) => Number(row.revenue)),
    [
      { date: '2026-09-01', value: 0 },
      { date: '2026-09-02', value: 12.5 },
      { date: '2026-09-03', value: 0 },
    ],
  );
});

test('days group into weeks (from Monday) and months, counting their days', async () => {
  const { groupDays, bucketKey, suggestedGranularity } = await import('../lib/utils/report-filters.ts');
  assert.equal(bucketKey('2026-10-04', 'week'), '2026-09-28');
  assert.equal(bucketKey('2026-10-04', 'month'), '2026-10');
  const rows = [
    { date: '2026-09-27', net: 10, orders: 1 }, // Sunday
    { date: '2026-09-28', net: 20, orders: 2 }, // Monday
    { date: '2026-10-04', net: 5, orders: 1 }, // Sunday
  ];
  assert.deepEqual(
    groupDays(rows, 'week', ['net', 'orders']).map((bucket) => [bucket.key, bucket.days, bucket.net, bucket.orders]),
    [
      ['2026-09-21', 1, 10, 1],
      ['2026-09-28', 2, 25, 3],
    ],
  );
  assert.deepEqual(
    groupDays(rows, 'month', ['net']).map((bucket) => [bucket.key, bucket.net]),
    [
      ['2026-09', 30],
      ['2026-10', 5],
    ],
  );
  assert.equal(suggestedGranularity(resolveRange({ preset: 'last-30' }, NOW)), 'day');
  assert.equal(suggestedGranularity(resolveRange({ preset: 'last-90' }, NOW)), 'week');
  assert.equal(suggestedGranularity(resolveRange({ preset: 'this-year' }, NOW)), 'month');
});

test('the weekday pattern averages per day, Monday first', async () => {
  const { weekdayPattern } = await import('../lib/utils/report-filters.ts');
  const pattern = weekdayPattern([
    { date: '2026-09-28', value: 100 }, // Mon
    { date: '2026-10-05', value: 50 }, // Mon
    { date: '2026-10-04', value: 300 }, // Sun
  ]);
  assert.deepEqual(pattern[0], { weekday: 'Monday', short: 'Mon', total: 150, days: 2, average: 75 });
  assert.equal(pattern[6].average, 300);
  assert.equal(pattern[2].days, 0);
});

test('bucket axis labels are short: a day or week reads "6 Oct", a month "Oct"', () => {
  assert.equal(bucketAxisLabel('2026-10-06', 'day'), '6 Oct');
  assert.equal(bucketAxisLabel('2026-10-06', 'week'), '6 Oct');
  assert.equal(bucketAxisLabel('2026-10', 'month'), 'Oct');
});

test('last year lines up weekday on weekday, except for whole calendar months', () => {
  // Sat 4 Oct 2026 → Sat 5 Oct 2025, not Fri 4 Oct 2025.
  const week = { from: new Date(2026, 9, 4), to: new Date(2026, 9, 11) };
  const shifted = comparisonRange(week, 'year')!;
  assert.equal(toDateKey(shifted.from), '2025-10-05');
  assert.equal(shifted.from.getDay(), week.from.getDay());
  assert.equal(rangeDays(shifted), 7);
  // A quarter, also whole months, stays on the calendar.
  const quarter = { from: new Date(2026, 6, 1), to: new Date(2026, 9, 1) };
  assert.equal(toDateKey(comparisonRange(quarter, 'year')!.from), '2025-07-01');
});

test('a drill-down to orders always names its location', () => {
  assert.equal(ordersHref('2026-10-01', '2026-10-04', ''), '/orders?range=custom&from=2026-10-01&to=2026-10-04&location=all');
  assert.equal(
    ordersHref('2026-10-01', '2026-10-01', 'loc-1', { source: 'pos' }),
    '/orders?range=custom&from=2026-10-01&to=2026-10-01&location=loc-1&source=pos',
  );
});
