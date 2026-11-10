import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_RULES,
  type RotaPerson,
  parseClock,
  rotaSummary,
  rotaWarnings,
  shiftSpan,
  shortShift,
  weekDays,
  weekStartOf,
} from '../../lib/utils/rota-builder.ts';

const shift = (start: string, end: string, breakMinutes = 30) => ({ start, end, breakMinutes });
const week = (...shifts: (ReturnType<typeof shift> | null)[]) => [...shifts, ...Array(7 - shifts.length).fill(null)];

test('clock times are read the way people type them, and nonsense is refused', () => {
  assert.equal(parseClock('07:30'), 450);
  assert.equal(parseClock('7:30'), 450);
  assert.equal(parseClock('0730'), 450);
  assert.equal(parseClock('7'), 420);
  assert.equal(parseClock('24:00'), 1440);
  for (const bad of ['', '7.30', '25:00', '24:30', '12:60', 'noon']) assert.equal(parseClock(bad), null, bad);
});

test('paid time is the shift less its unpaid break, and a shift can run past midnight', () => {
  assert.deepEqual(shiftSpan(shift('07:00', '15:00')), { start: 420, end: 900, lengthMinutes: 480, paidMinutes: 450 });
  // A late close: 18:00 to 02:00 is eight hours, not minus sixteen.
  assert.equal(shiftSpan(shift('18:00', '02:00', 0))?.lengthMinutes, 480);
  // A break longer than the shift pays nothing, never a negative amount.
  assert.equal(shiftSpan(shift('11:00', '12:00', 90))?.paidMinutes, 0);
  assert.equal(shiftSpan(shift('09:00', '09:00')), null);
  assert.equal(shortShift(shift('07:00', '15:30')), '07–15:30');
});

test('the week’s staff cost is paid hours × rate, to the penny, and labour % is against expected sales', () => {
  const people: RotaPerson[] = [
    // 7.5 paid hours at £12.21 is £91.575, rounded to £91.58 per shift: £457.90 for five.
    {
      id: 1,
      name: 'Amira',
      role: 'Barista',
      rate: '12.21',
      shifts: week(
        shift('07:00', '15:00'),
        shift('07:00', '15:00'),
        null,
        shift('07:00', '15:00'),
        shift('07:00', '15:00'),
        shift('07:00', '15:00'),
      ),
    },
    // No rate: hours count, cost does not.
    { id: 2, name: 'Josh', role: 'Kitchen', rate: '', shifts: week(null, shift('12:00', '20:00')) },
  ];
  const summary = rotaSummary(people, '2,000');
  assert.equal(summary.people[0].costPence, 5 * 9158);
  assert.equal(summary.people[1].costPence, null);
  assert.equal(summary.paidMinutes, 6 * 450);
  assert.equal(summary.unpricedMinutes, 450);
  assert.equal(summary.costPence, 45790);
  assert.equal(summary.days[1].people, 2);
  assert.ok(summary.labourPct !== null && Math.abs(summary.labourPct - 22.895) < 1e-9);
  assert.equal(rotaSummary(people, '').labourPct, null);
});

test('working-time rules: a break over six hours, 11 hours’ rest, and 48 hours a week', () => {
  const people: RotaPerson[] = [
    // A close then an open: 22:00 to 07:00 is nine hours' rest. A 7-hour shift with a 15-minute break.
    { id: 1, name: 'Lena', role: '', rate: '', shifts: week(shift('14:00', '22:00'), shift('07:00', '14:00', 15)) },
    // Six 9-hour days, 8.5 paid each: 51 hours.
    { id: 2, name: 'Sam', role: '', rate: '', shifts: week(...Array(6).fill(shift('08:00', '17:00'))) },
    // Exactly six hours needs no break; a day off resets the rest.
    { id: 3, name: 'Ola', role: '', rate: '', shifts: week(shift('16:00', '22:00', 0), null, shift('06:00', '12:00', 0)) },
  ];
  assert.deepEqual(rotaWarnings(people), [
    { kind: 'break', personId: 1, day: 1, lengthMinutes: 420 },
    { kind: 'rest', personId: 1, day: 1, restMinutes: 540 },
    { kind: 'weekly', personId: 2, paidMinutes: 6 * 510 },
  ]);
});

test('an overnight shift that runs into the next one leaves no rest at all', () => {
  const people: RotaPerson[] = [{ id: 1, name: 'Kai', role: '', rate: '', shifts: week(shift('20:00', '04:00'), shift('09:00', '17:00')) }];
  assert.deepEqual(rotaWarnings(people), [{ kind: 'rest', personId: 1, day: 1, restMinutes: 300 }]);
});

test('the week starts on the chosen first day, on or before the date', () => {
  assert.equal(weekStartOf('2026-11-10'), '2026-11-09');
  assert.equal(weekStartOf('2026-11-09'), '2026-11-09');
  assert.equal(weekStartOf('2026-11-15'), '2026-11-09');
  // A Sunday-first week, as in the US.
  assert.equal(weekStartOf('2026-11-10', 0), '2026-11-08');
  assert.equal(weekStartOf('2026-11-08', 0), '2026-11-08');
  assert.deepEqual(
    weekDays('2026-11-08').map((d) => d.weekend),
    [true, false, false, false, false, false, true],
  );
  assert.equal(weekStartOf('nope'), null);
});

test('rules follow the visitor’s country: each can be changed or switched off', () => {
  const sam: RotaPerson[] = [{ id: 2, name: 'Sam', role: '', rate: '', shifts: week(...Array(6).fill(shift('08:00', '17:00', 0))) }];
  // Six 9-hour days with no break: no break, and 54 hours.
  assert.deepEqual(
    rotaWarnings(sam).map((w) => w.kind),
    ['break', 'break', 'break', 'break', 'break', 'break', 'weekly'],
  );
  // No federal break or weekly limit, as in the US.
  assert.deepEqual(rotaWarnings(sam, { ...DEFAULT_RULES, breakAfterMinutes: null, weeklyMinutes: null }), []);
  // A 60-hour cap passes the same week.
  assert.equal(rotaWarnings(sam, { ...DEFAULT_RULES, breakAfterMinutes: null, weeklyMinutes: 60 * 60 }).length, 0);
});
