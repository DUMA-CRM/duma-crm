import assert from 'node:assert/strict';
import test from 'node:test';

import { LEGACY_REPORT_PATHS, REPORTS, REPORT_CATEGORIES, REPORT_IDS, searchReports } from '../lib/reports/catalogue.ts';
import { classifyMenu, median } from '../lib/utils/menu-engineering.ts';

test('every report has a unique id, a known category and a capability', () => {
  assert.equal(REPORT_IDS.size, REPORTS.length);
  const categories = new Set(REPORT_CATEGORIES.map((category) => category.id));
  for (const report of REPORTS) {
    assert.ok(categories.has(report.category), `${report.id} has an unknown category`);
    assert.ok(report.anyOf.length > 0, `${report.id} names no capability`);
  }
});

test('every category has at least one report', () => {
  for (const category of REPORT_CATEGORIES)
    assert.ok(
      REPORTS.some((report) => report.category === category.id),
      category.id,
    );
});

test('old report paths point at reports that exist', () => {
  for (const [path, target] of Object.entries(LEGACY_REPORT_PATHS)) {
    if (target !== null) assert.ok(REPORT_IDS.has(target), `${path} → ${target}`);
  }
});

test('search matches title, keywords and category, every word', () => {
  assert.deepEqual(
    searchReports(REPORTS, 'z report').map((report) => report.id),
    ['end-of-day'],
  );
  assert.ok(searchReports(REPORTS, 'vat').some((report) => report.id === 'vat'));
  // Every labour report, plus Prime cost — labour is half of what it measures.
  assert.deepEqual(
    searchReports(REPORTS, 'labour')
      .map((report) => report.id)
      .sort(),
    ['labour-vs-sales', 'prime-cost', 'staff-hours'],
  );
  assert.ok(searchReports(REPORTS, 'food cost').some((report) => report.id === 'prime-cost'));
  assert.equal(searchReports(REPORTS, '').length, REPORTS.length);
});

test('menu engineering splits costed items at the medians and leaves uncosted ones out', () => {
  const { quadrants, medianUnits, medianMargin } = classifyMenu([
    { units: 100, margin: 70 },
    { units: 90, margin: 40 },
    { units: 10, margin: 75 },
    { units: 5, margin: 30 },
    { units: 500, margin: null },
  ]);
  assert.equal(medianUnits, 50);
  assert.equal(medianMargin, 55);
  assert.deepEqual(quadrants, ['star', 'workhorse', 'opportunity', 'low', null]);
  assert.equal(median([]), 0);
});
