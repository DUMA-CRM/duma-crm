import assert from 'node:assert/strict';
import test from 'node:test';

const { buildRoster } = await import('../lib/utils/today-roster.ts');

const at = (hour: number, minute = 0) => new Date(2026, 8, 25, hour, minute).toISOString();
const now = new Date(2026, 8, 25, 13, 30);

const shifts = [
  { id: 's1', userId: 'sam', name: 'Sam', startsAt: at(9), endsAt: at(17) },
  { id: 's2', userId: 'kai', name: 'Kai', startsAt: at(13), endsAt: at(20) },
  { id: 's3', userId: 'mia', name: 'Mia', startsAt: at(16), endsAt: at(22) },
  { id: 's4', userId: 'ana', name: 'Ana', startsAt: at(7), endsAt: at(12) },
];

test('each shift says where its person is up to', () => {
  const { rows, counts } = buildRoster({ shifts, clockedIn: [{ id: 'c1', userId: 'sam', name: 'Sam', clockedIn: at(8, 55) }], now });
  const byName = Object.fromEntries(rows.map((row) => [row.name, [row.status, row.label]]));
  assert.deepEqual(byName.Sam, ['on', 'Since 08:55']);
  assert.deepEqual(byName.Kai, ['late', '30 min late']);
  assert.deepEqual(byName.Mia, ['later', 'Starts 16:00']);
  assert.deepEqual(byName.Ana, ['done', 'Finished 12:00']);
  assert.deepEqual(counts, { on: 1, late: 1, later: 1, done: 1, unplanned: 0 });
});

test('working now comes first, and the gone-home last', () => {
  const { rows } = buildRoster({ shifts, clockedIn: [{ id: 'c1', userId: 'sam', name: 'Sam', clockedIn: at(8, 55) }], now });
  assert.deepEqual(
    rows.map((row) => row.name),
    ['Sam', 'Kai', 'Mia', 'Ana'],
  );
});

test('a few minutes past the start is not yet late', () => {
  const { rows } = buildRoster({ shifts: [shifts[1]], clockedIn: [], now: new Date(2026, 8, 25, 13, 4) });
  assert.equal(rows[0].status, 'later');
});

test('the window fits the day and places bars and now on it', () => {
  const { rows, window } = buildRoster({ shifts, clockedIn: [], now });
  assert.equal(window.startHour, 7);
  assert.equal(window.endHour, 22);
  const sam = rows.find((row) => row.name === 'Sam')!;
  assert.ok(Math.abs(sam.left - (2 / 15) * 100) < 0.01);
  assert.ok(Math.abs(sam.width - (8 / 15) * 100) < 0.01);
  assert.ok(Math.abs(window.now! - (6.5 / 15) * 100) < 0.01);
});

test('someone clocked in without a shift still shows, flagged', () => {
  const { rows } = buildRoster({ shifts: [], clockedIn: [{ id: 'c9', userId: 'eve', name: 'Eve', clockedIn: at(12) }], now });
  assert.equal(rows[0].status, 'unplanned');
  assert.match(rows[0].label, /not on the rota/);
});

test('a short rota is widened to a working day', () => {
  const { window } = buildRoster({ shifts: [{ id: 'x', userId: 'a', name: 'A', startsAt: at(10), endsAt: at(12) }], clockedIn: [], now });
  assert.ok(window.endHour - window.startHour >= 8);
});

test('a shift that runs past midnight ends at the edge of the day, not the start', () => {
  const { rows, window } = buildRoster({
    shifts: [
      { id: 'late', userId: 'mia', name: 'Mia', startsAt: at(19, 30), endsAt: new Date(2026, 8, 26, 1, 30).toISOString() },
      { id: 'day', userId: 'sam', name: 'Sam', startsAt: at(9), endsAt: at(17) },
    ],
    clockedIn: [],
    now,
  });
  assert.equal(window.startHour, 9);
  assert.equal(window.endHour, 24);
  const mia = rows.find((row) => row.name === 'Mia')!;
  assert.ok(Math.abs(mia.left + mia.width - 100) < 0.01);
});
