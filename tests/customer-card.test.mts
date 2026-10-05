import assert from 'node:assert/strict';
import test from 'node:test';

import { allergySummary, birthdayHint, birthdayThisMonth, daysUntilBirthday, visitStatus } from '../lib/utils/customer-card.ts';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

test('visitStatus reads the gap since the last visit', () => {
  assert.deepEqual(visitStatus(undefined, NOW), { tone: 'never', label: 'Never visited' });
  assert.deepEqual(visitStatus(ago(0), NOW), { tone: 'active', label: 'In today' });
  assert.deepEqual(visitStatus(ago(1), NOW), { tone: 'active', label: 'Visited yesterday' });
  assert.deepEqual(visitStatus(ago(45), NOW), { tone: 'idle', label: 'Visited 45 days ago' });
  assert.deepEqual(visitStatus(ago(90), NOW), { tone: 'lapsed', label: 'Lapsed · last in 90 days ago' });
});

test('birthdayThisMonth compares the month only', () => {
  assert.equal(birthdayThisMonth('1990-09-02', NOW), true);
  assert.equal(birthdayThisMonth('1990-10-02', NOW), false);
  assert.equal(birthdayThisMonth(undefined, NOW), false);
});

test('allergySummary names the allergens and folds the rest', () => {
  assert.equal(allergySummary(['tree_nuts']), 'Tree nuts');
  assert.equal(allergySummary(['tree_nuts', 'milk', 'eggs', 'soya']), 'Tree nuts, Milk +2');
  assert.equal(allergySummary([]), null);
});

test('days until the next birthday count by the local calendar', () => {
  const at = (year: number, month: number, day: number) => new Date(year, month - 1, day, 15).getTime();
  assert.equal(daysUntilBirthday('1990-10-03', at(2026, 10, 3)), 0);
  assert.equal(daysUntilBirthday('1990-10-04', at(2026, 10, 3)), 1);
  assert.equal(daysUntilBirthday('1990-10-02', at(2026, 10, 3)), 364);
  assert.equal(daysUntilBirthday('1992-02-29', at(2027, 2, 27)), 1);
  assert.equal(daysUntilBirthday(undefined, at(2026, 10, 3)), null);
});

test('a birthday hint only when it is close', () => {
  assert.equal(birthdayHint(0), 'Birthday today');
  assert.equal(birthdayHint(1), 'Birthday tomorrow');
  assert.equal(birthdayHint(12), 'Birthday in 12 days');
  assert.equal(birthdayHint(90), null);
});
