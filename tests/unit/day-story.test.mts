import assert from 'node:assert/strict';
import test from 'node:test';

import { comparisonWait, dayMood, daySummary, dayWins } from '../../lib/utils/day-story.ts';

const money = (amount: number) => `£${Math.round(amount)}`;
// 2026-11-17 is a Tuesday.
const TODAY = '2026-11-17';

const base = {
  firstName: 'Marian',
  weekday: 'Tuesday',
  opensAt: '08:00',
  paceDelta: null,
  typicalDay: null,
  target: null,
  topItem: null,
  yesterday: null,
  money,
};

test('a finished day is told against a typical one, and only called quiet when it was', () => {
  const quiet = daySummary({
    ...base,
    state: 'after-close',
    nowMinutes: 21 * 60,
    takenToday: 28,
    orders: 3,
    typicalDay: 100,
    topItem: 'Cappuccino',
  });
  assert.equal(quiet.greeting, 'Good evening, Marian');
  assert.equal(quiet.line, 'A quiet £28 day from 3 orders. Cappuccino sold best.');
  // No history: no adjective at all, rather than a guess.
  const unknown = daySummary({ ...base, state: 'after-close', nowMinutes: 21 * 60, takenToday: 28, orders: 1 });
  assert.equal(unknown.line, 'A £28 day from 1 order.');
});

test('a day under way says how far ahead or behind, and a hit target outranks pace', () => {
  const behind = daySummary({ ...base, state: 'trading', nowMinutes: 11 * 60, takenToday: 80, orders: 9, paceDelta: -20 });
  assert.equal(behind.greeting, 'Good morning, Marian');
  assert.equal(behind.line, '£80 from 9 orders so far, £20 behind a typical Tuesday.');
  const hit = daySummary({ ...base, state: 'trading', nowMinutes: 15 * 60, takenToday: 60, orders: 9, paceDelta: 30, target: 50 });
  assert.equal(hit.line, '£60 from 9 orders so far, and the target’s already hit 🎉');
});

test('before open, the aim is the target when there is one, else a typical day', () => {
  const aim = daySummary({ ...base, state: 'before-open', nowMinutes: 7 * 60, takenToday: 0, orders: 0, target: 50, typicalDay: 90 });
  assert.equal(aim.line, 'Doors open at 08:00. Today’s aim is £50.');
  const typical = daySummary({
    ...base,
    firstName: null,
    state: 'before-open',
    nowMinutes: 7 * 60,
    takenToday: 0,
    orders: 0,
    typicalDay: 90,
  });
  assert.equal(typical.greeting, 'Good morning');
  assert.equal(typical.line, 'Doors open at 08:00. A typical Tuesday takes £90.');
});

test('a best day needs enough days to beat, and outranks a best weekday', () => {
  const history = [
    { date: '2026-11-10', revenue: 40 }, // Tue
    { date: '2026-11-03', revenue: 45 }, // Tue
    { date: '2026-10-27', revenue: 30 }, // Tue
    { date: '2026-11-15', revenue: 80 }, // Sun
  ];
  const weekdayOnly = dayWins({ today: TODAY, state: 'trading', takenToday: 50, history, target: null, weekday: 'Tuesday' });
  assert.deepEqual(
    weekdayOnly.map((win) => win.text),
    ['Best Tuesday in three weeks'],
  );
  const best = dayWins({ today: TODAY, state: 'trading', takenToday: 90, history, target: null, weekday: 'Tuesday' });
  assert.deepEqual(
    best.map((win) => win.id),
    ['best-day'],
  );
  // Two Tuesdays are not enough to call a third the best.
  const thin = dayWins({ today: TODAY, state: 'trading', takenToday: 50, history: history.slice(0, 2), target: null, weekday: 'Tuesday' });
  assert.deepEqual(thin, []);
  // Nothing taken yet is never a record.
  assert.deepEqual(dayWins({ today: TODAY, state: 'before-open', takenToday: 0, history, target: null, weekday: 'Tuesday' }), []);
});

test('a target streak skips closed days, counts today once hit, and ends when today closes short', () => {
  const history = [
    { date: '2026-11-16', revenue: 60 },
    // 15th: closed, no row.
    { date: '2026-11-14', revenue: 55 },
    { date: '2026-11-13', revenue: 20 },
    { date: TODAY, revenue: 999 }, // today's own row is ignored
  ];
  const streak = (takenToday: number, state: 'trading' | 'after-close') =>
    dayWins({ today: TODAY, state, takenToday, history, target: 50, weekday: 'Tuesday' }).find((win) => win.id === 'target-streak')?.text;
  assert.equal(streak(51, 'trading'), '3 days in a row over target');
  assert.equal(streak(10, 'trading'), '2 days in a row over target, keep it going');
  assert.equal(streak(10, 'after-close'), undefined);
});

test('the wait for a comparison counts the weekdays still to come', () => {
  assert.equal(comparisonWait(2, 3, 'Tuesday'), 'Compares after 1 more Tuesday');
  assert.equal(comparisonWait(0, 3, 'Friday'), 'Compares after 3 more Fridays');
});

test('the mascot is proud on a win, curious when slow, asleep when shut — never sad', () => {
  const quiet = { takenToday: 10, target: null, paceDelta: null, typicalByNow: null, wins: [] };
  assert.equal(dayMood({ ...quiet, state: 'closed-today' }), 'sleepy');
  assert.equal(dayMood({ ...quiet, state: 'after-close' }), 'sleepy');
  assert.equal(dayMood({ ...quiet, state: 'after-close', target: 5 }), 'proud');
  assert.equal(dayMood({ ...quiet, state: 'before-open' }), 'ready');
  assert.equal(dayMood({ ...quiet, state: 'trading', paceDelta: -30, typicalByNow: 100 }), 'curious');
  assert.equal(dayMood({ ...quiet, state: 'trading', paceDelta: 15, typicalByNow: 100 }), 'proud');
  assert.equal(dayMood({ ...quiet, state: 'trading', paceDelta: 2, typicalByNow: 100 }), 'steady');
});
