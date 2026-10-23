import assert from 'node:assert/strict';
import test from 'node:test';

const { draftChanged, draftFilters, draftFromFilters, draftSummary, pickDays, pickPreset, setCompare } = await import(
  '../lib/utils/report-range-draft.ts'
);

const NOW = new Date('2026-10-23T10:00:00Z');
const start = draftFromFilters({ preset: 'last-30', compare: 'previous' });

test('a preset clears custom days; calendar days make a custom range', () => {
  const custom = pickDays(start, new Date(2026, 9, 18), new Date(2026, 9, 17));
  assert.deepEqual([custom.preset, custom.from, custom.to], ['custom', '2026-10-17', '2026-10-18'], 'ordered whichever is clicked first');
  const single = pickDays(start, new Date(2026, 9, 17));
  assert.equal(single.to, '2026-10-17', 'one click is one day until the second');
  const back = pickPreset(custom, 'yesterday');
  assert.deepEqual([back.preset, back.from, back.to], ['yesterday', undefined, undefined]);
});

test('the summary says what Apply will show', () => {
  const summary = draftSummary(pickDays(start, new Date(2026, 9, 17), new Date(2026, 9, 18)), NOW);
  const oct = new Date(2026, 9, 1).toLocaleDateString('en-GB', { month: 'short' });
  assert.equal(summary.dates, `17–18 ${oct} 2026`);
  assert.equal(summary.comparison, `vs 15–16 ${oct}`);
  assert.equal(draftSummary(setCompare(start, 'none'), NOW).comparison, null);
});

test('Apply is only offered when something would change', () => {
  const filters = { preset: 'custom' as const, from: '2026-10-17', to: '2026-10-18', compare: 'previous' as const };
  const same = draftFromFilters(filters);
  assert.equal(draftChanged(same, filters, NOW), false);
  assert.equal(draftChanged(pickDays(same, new Date(2026, 9, 17), new Date(2026, 9, 19)), filters, NOW), true);
  assert.equal(draftChanged(setCompare(same, 'year'), filters, NOW), true);
  assert.deepEqual(draftFilters(pickPreset(same, 'today')), { preset: 'today', from: undefined, to: undefined, compare: 'previous' });
});
