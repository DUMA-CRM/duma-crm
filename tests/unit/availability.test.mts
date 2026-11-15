import assert from 'node:assert/strict';
import test from 'node:test';

import { availabilitySummary, daysToRules, rulesToDays } from '../../lib/utils/availability.ts';

const rule = (
  weekday: number,
  startMinute: number | null,
  endMinute: number | null,
  kind: 'unavailable' | 'preferred' = 'unavailable',
  note: string | null = null,
) => ({
  weekday,
  startMinute,
  endMinute,
  kind,
  note,
});

test('rules become one row per weekday and come back unchanged', () => {
  const rules = [rule(1, null, null, 'unavailable', 'College'), rule(2, 840, 1440), rule(5, null, null, 'preferred')];
  const days = rulesToDays(rules);
  assert.equal(days.length, 7);
  assert.equal(days[0].mode, 'available');
  assert.equal(days[1].mode, 'unavailable_all_day');
  assert.equal(days[1].note, 'College');
  assert.deepEqual([days[2].mode, days[2].from, days[2].to], ['unavailable_between', '14:00', '00:00']);
  assert.equal(days[5].preferred, true);
  assert.deepEqual(daysToRules(days), rules);
  assert.equal(availabilitySummary(days), 'Not Tue · Wed until 14:00 · prefers Sat');
});

test('a second window the form can’t show survives a save', () => {
  const rules = [rule(3, 0, 600), rule(3, 1200, 1440)];
  const days = rulesToDays(rules);
  assert.equal(days[3].from, '00:00');
  assert.equal(days[3].to, '10:00');
  assert.deepEqual(daysToRules(days), rules);
});

test('unavailable all day drops a preference on that day, and a bad window is refused', () => {
  const days = rulesToDays([]);
  days[0] = { ...days[0], mode: 'unavailable_all_day', preferred: true, note: 'Childcare' };
  assert.deepEqual(daysToRules(days), [rule(0, null, null, 'unavailable', 'Childcare')]);
  days[1] = { ...days[1], mode: 'unavailable_between', from: '15:00', to: '09:00' };
  assert.throws(() => daysToRules(days), /Tuesday: The end must be after the start/);
});
