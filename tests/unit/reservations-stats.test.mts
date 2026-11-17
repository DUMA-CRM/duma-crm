import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type StatsBooking,
  busyHourSpan,
  coversByDay,
  coversHeatGrid,
  median,
  overCapacity,
  overviewRange,
  partyBand,
  partyMix,
  percentLabel,
  repeatGuests,
  serviceQuality,
  sourceMix,
  splitBookings,
  stayLabel,
  todayGlance,
  unconfirmedToday,
} from '../../lib/utils/reservations-stats.ts';

const TZ = 'Europe/London';
const MIN = 60_000;
const at = (instant: string, minutes: number) => new Date(new Date(instant).getTime() + minutes * MIN).toISOString();

let next = 0;
const booking = (startsAt: string, patch: Partial<StatsBooking> = {}): StatsBooking => ({
  id: `b${++next}`,
  guestName: 'Guest',
  customerId: null,
  partySize: 2,
  startsAt,
  endsAt: at(startsAt, 90),
  status: 'booked',
  source: 'phone',
  seatedAt: null,
  completedAt: null,
  tables: [{ id: 't1', label: 'T1' }],
  ...patch,
});

// ─── The range ────────────────────────────────────────────────────────────────

test('overviewRange spans local midnight 30 days back to 7 days ahead, across the October clock change', () => {
  // 28 Oct 2026 is GMT; 28 Sep was BST, so its midnight is 23:00 UTC the day before.
  const range = overviewRange('2026-10-28', TZ);
  assert.equal(range.from, '2026-09-27T23:00:00.000Z');
  assert.equal(range.to, '2026-11-04T00:00:00.000Z');
  assert.equal(range.pastFirst, '2026-09-28');
  assert.equal(range.pastLast, '2026-10-27');
  assert.deepEqual(range.ahead, ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
  // Well inside the API's 62-day limit.
  assert.ok(new Date(range.to).getTime() - new Date(range.from).getTime() < 62 * 86_400_000);
});

test('splitBookings files a booking by its local day, so 00:30 BST belongs to the new day', () => {
  const lateYesterday = booking('2026-10-27T23:30:00Z'); // 23:30 GMT on the 27th
  const justAfterMidnight = booking('2026-06-15T23:30:00Z'); // 00:30 BST on the 16th
  const split = splitBookings([lateYesterday, justAfterMidnight], '2026-06-16', TZ);
  assert.deepEqual(
    split.today.map((b) => b.id),
    [justAfterMidnight.id],
  );
  assert.deepEqual(
    split.ahead.map((b) => b.id),
    [lateYesterday.id, justAfterMidnight.id],
  );
  assert.deepEqual(split.past, []);
  const october = splitBookings([lateYesterday], '2026-10-28', TZ);
  assert.deepEqual(
    october.past.map((b) => b.id),
    [lateYesterday.id],
  );
});

// ─── Today ────────────────────────────────────────────────────────────────────

test('todayGlance: covers leave out cancelled and no-shows; seated so far is seated plus finished', () => {
  const day = [
    booking('2026-11-17T12:00:00Z', { status: 'completed', partySize: 4 }),
    booking('2026-11-17T13:00:00Z', { status: 'seated', partySize: 2, source: 'walk_in' }),
    booking('2026-11-17T19:00:00Z', { status: 'confirmed', partySize: 6 }),
    booking('2026-11-17T20:00:00Z', { status: 'booked', partySize: 3 }),
    booking('2026-11-17T12:30:00Z', { status: 'no_show', partySize: 5 }),
    booking('2026-11-17T18:00:00Z', { status: 'cancelled', partySize: 8 }),
    booking('2026-11-17T18:30:00Z', { status: 'cancelled', partySize: 2, source: 'walk_in' }),
  ];
  assert.deepEqual(todayGlance(day), {
    coversBooked: 4 + 2 + 6 + 3,
    coversSeated: 4 + 2,
    toCome: 2,
    toComeCovers: 9,
    walkIns: 1,
    walkInCovers: 2,
    noShows: 1,
    noShowCovers: 5,
  });
});

test('unconfirmedToday: booked (not confirmed) bookings whose window has not ended', () => {
  const now = new Date('2026-11-17T18:00:00Z');
  const over = booking('2026-11-17T12:00:00Z'); // ended 13:30
  const tonight = booking('2026-11-17T19:30:00Z');
  const running = booking('2026-11-17T17:00:00Z'); // ends 18:30
  const confirmed = booking('2026-11-17T20:00:00Z', { status: 'confirmed' });
  assert.deepEqual(
    unconfirmedToday([over, tonight, running, confirmed], now).map((b) => b.id),
    [tonight.id, running.id],
  );
});

test('overCapacity: a live party bigger than its tables, joined tables summed; unknown tables are not judged', () => {
  const tables = [
    { id: 't1', maxCovers: 2 },
    { id: 't2', maxCovers: 4 },
  ];
  const tooBig = booking('2026-11-17T19:00:00Z', { partySize: 3, tables: [{ id: 't1', label: 'T1' }] });
  const joined = booking('2026-11-17T19:00:00Z', {
    partySize: 6,
    tables: [
      { id: 't1', label: 'T1' },
      { id: 't2', label: 'T2' },
    ],
  });
  const finished = booking('2026-11-17T12:00:00Z', { partySize: 9, status: 'completed' });
  const noTable = booking('2026-11-17T19:00:00Z', { partySize: 9, tables: [] });
  const goneTable = booking('2026-11-17T19:00:00Z', { partySize: 9, tables: [{ id: 'old', label: 'Old' }] });
  assert.deepEqual(
    overCapacity([tooBig, joined, finished, noTable, goneTable], tables).map((b) => b.id),
    [tooBig.id],
  );
});

// ─── Next seven days ──────────────────────────────────────────────────────────

test('coversByDay splits lunch and dinner at 16:00 local, through the clock change', () => {
  const days = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'];
  const rows = coversByDay(
    [
      booking('2026-10-24T14:59:00Z', { partySize: 2 }), // 15:59 BST → lunch
      booking('2026-10-24T15:00:00Z', { partySize: 3 }), // 16:00 BST → dinner
      booking('2026-10-24T23:30:00Z', { partySize: 4 }), // 00:30 BST on the 25th → lunch
      booking('2026-10-25T23:30:00Z', { partySize: 5 }), // 23:30 GMT on the 25th → dinner
      booking('2026-10-26T15:59:00Z', { partySize: 6 }), // 15:59 GMT → lunch
      booking('2026-10-26T16:00:00Z', { partySize: 1 }), // 16:00 GMT → dinner
      booking('2026-10-26T19:00:00Z', { partySize: 9, status: 'cancelled' }),
      booking('2026-10-26T19:00:00Z', { partySize: 9, status: 'no_show' }),
      booking('2026-10-30T19:00:00Z', { partySize: 9 }), // outside the days asked for
    ],
    days,
    0,
    TZ,
  );
  assert.deepEqual(
    rows.map(({ date, lunch, dinner, total, bookings }) => ({ date, lunch, dinner, total, bookings })),
    [
      { date: '2026-10-23', lunch: 0, dinner: 0, total: 0, bookings: 0 },
      { date: '2026-10-24', lunch: 2, dinner: 3, total: 5, bookings: 2 },
      { date: '2026-10-25', lunch: 4, dinner: 5, total: 9, bookings: 2 },
      { date: '2026-10-26', lunch: 6, dinner: 1, total: 7, bookings: 2 },
    ],
  );
  // No seats known: nothing is busy, but the peak day is still marked.
  assert.deepEqual(
    rows.map((row) => [row.busy, row.peak]),
    [
      [false, false],
      [false, false],
      [false, true],
      [false, false],
    ],
  );
});

test('coversByDay: busy when one service reaches 80% of the seats; the first of tied days is the peak', () => {
  const rows = coversByDay(
    [
      booking('2026-11-18T12:00:00Z', { partySize: 8 }), // lunch 8 of 10 seats → busy
      booking('2026-11-19T12:00:00Z', { partySize: 4 }),
      booking('2026-11-19T19:00:00Z', { partySize: 4 }), // 8 in all, neither service at 8
    ],
    ['2026-11-17', '2026-11-18', '2026-11-19'],
    10,
    TZ,
  );
  assert.deepEqual(
    rows.map((row) => [row.date, row.busy, row.peak]),
    [
      ['2026-11-17', false, false],
      ['2026-11-18', true, true],
      ['2026-11-19', false, false],
    ],
  );
});

// ─── Service quality ──────────────────────────────────────────────────────────

test('median handles odd, even and empty lists', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 10]), 3.5);
  assert.equal(median([]), null);
});

test('serviceQuality: each metric counts only the bookings its rule names', () => {
  const start = '2026-11-10T19:00:00Z';
  const bookings = [
    // Finished, seated 10 min late, 100 min at the table, on two tables.
    booking(start, {
      status: 'completed',
      seatedAt: at(start, 10),
      completedAt: at(start, 110),
      tables: [
        { id: 't1', label: 'T1' },
        { id: 't2', label: 'T2' },
      ],
    }),
    // Finished, seated early (not late), 60 min at the table.
    booking(start, { status: 'completed', seatedAt: at(start, -5), completedAt: at(start, 55) }),
    // Finished, seated 30 min late, but no completedAt on record: lateness yes, stay no.
    booking(start, { status: 'completed', seatedAt: at(start, 30), completedAt: null }),
    // Seated now, 2 min late.
    booking(start, { status: 'seated', seatedAt: at(start, 2) }),
    // A walk-in: never late, never a no-show, never a cancellation — but it turns a table.
    booking(start, { status: 'completed', source: 'walk_in', seatedAt: at(start, 45), completedAt: at(start, 105) }),
    booking(start, { status: 'no_show' }),
    booking(start, { status: 'cancelled' }),
    booking(start, { status: 'cancelled', source: 'walk_in' }),
    booking(start, { status: 'booked' }),
  ];
  const quality = serviceQuality(bookings, 4, 30);

  // Stays: 100, 60 and the walk-in's 60.
  assert.equal(quality.staysMeasured, 3);
  assert.ok(Math.abs(quality.averageStayMinutes! - (100 + 60 + 60) / 3) < 1e-9);

  // Table uses by finished parties: 2 + 1 + 1 + 1 = 5, over 4 tables and 30 days.
  assert.ok(Math.abs(quality.turnsPerTableDay! - 5 / 4 / 30) < 1e-9);

  // Lateness over the four seated-with-a-booking parties: 10, 30, 2 late; one early.
  assert.deepEqual(quality.lateness, { late: 3, measured: 4, medianMinutes: 10, averageMinutes: 14 });

  // Booked (not walk-in): 7. Of them cancelled: 1. Expected: 6, of which 1 no-show.
  assert.equal(quality.booked, 7);
  assert.equal(quality.cancelled, 1);
  assert.equal(quality.expected, 6);
  assert.equal(quality.noShows, 1);
  assert.ok(Math.abs(quality.noShowRate! - 1 / 6) < 1e-9);
  assert.ok(Math.abs(quality.cancellationRate! - 1 / 7) < 1e-9);
});

test('serviceQuality: nothing to measure gives nulls, not zeros', () => {
  const quality = serviceQuality([], 0, 30);
  assert.equal(quality.averageStayMinutes, null);
  assert.equal(quality.turnsPerTableDay, null);
  assert.equal(quality.lateness.medianMinutes, null);
  assert.equal(quality.lateness.averageMinutes, null);
  assert.equal(quality.noShowRate, null);
  assert.equal(quality.cancellationRate, null);
});

// ─── Busiest hours ────────────────────────────────────────────────────────────

test('coversHeatGrid: Monday first, by local hour, the same 19:00 either side of the clock change', () => {
  const grid = coversHeatGrid(
    [
      booking('2026-10-24T18:00:00Z', { partySize: 2 }), // Sat 19:00 BST
      booking('2026-10-26T19:00:00Z', { partySize: 3 }), // Mon 19:00 GMT
      booking('2026-10-26T19:30:00Z', { partySize: 4 }), // Mon 19:30 GMT
      booking('2026-10-26T19:00:00Z', { partySize: 9, status: 'cancelled' }),
      booking('2026-10-26T19:00:00Z', { partySize: 9, status: 'no_show' }),
      booking('2026-10-25T11:00:00Z', { partySize: 1, status: 'completed' }), // Sun 11:00 GMT
    ],
    TZ,
  );
  assert.equal(grid.length, 7);
  assert.equal(grid[0]![19], 7);
  assert.equal(grid[5]![19], 2);
  assert.equal(grid[6]![11], 1);
  assert.equal(
    grid.flat().reduce((sum, value) => sum + value, 0),
    10,
  );
});

test('busyHourSpan trims to the hours used, widened to a minimum and kept within the day', () => {
  const empty = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  assert.equal(busyHourSpan(empty), null);
  const grid = empty.map((row) => [...row]);
  grid[2]![12] = 4;
  grid[4]![22] = 2;
  assert.deepEqual(busyHourSpan(grid), { from: 12, to: 22 });
  const late = empty.map((row) => [...row]);
  late[0]![22] = 1;
  assert.deepEqual(busyHourSpan(late), { from: 16, to: 23 });
});

// ─── Guests ───────────────────────────────────────────────────────────────────

test('sourceMix and partyMix leave cancelled bookings out and keep a fixed order', () => {
  const bookings = [
    booking('2026-11-10T19:00:00Z', { source: 'online', partySize: 2 }),
    booking('2026-11-10T19:00:00Z', { source: 'online', partySize: 4 }),
    booking('2026-11-10T19:00:00Z', { source: 'walk_in', partySize: 7, status: 'no_show' }),
    booking('2026-11-10T19:00:00Z', { source: 'phone', partySize: 5 }),
    booking('2026-11-10T19:00:00Z', { source: 'other', partySize: 12, status: 'cancelled' }),
  ];
  assert.deepEqual(sourceMix(bookings), [
    { key: 'online', bookings: 2, share: 0.5 },
    { key: 'phone', bookings: 1, share: 0.25 },
    { key: 'walk_in', bookings: 1, share: 0.25 },
    { key: 'other', bookings: 0, share: 0 },
  ]);
  assert.deepEqual(partyMix(bookings), [
    { key: '1-2', bookings: 1, share: 0.25 },
    { key: '3-4', bookings: 1, share: 0.25 },
    { key: '5-6', bookings: 1, share: 0.25 },
    { key: '7+', bookings: 1, share: 0.25 },
  ]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map(partyBand), ['1-2', '1-2', '3-4', '3-4', '5-6', '5-6', '7+', '7+']);
});

test('repeatGuests: bookings by a customer seen more than once, over every non-cancelled booking', () => {
  const bookings = [
    booking('2026-11-01T19:00:00Z', { customerId: 'ana' }),
    booking('2026-11-08T19:00:00Z', { customerId: 'ana' }),
    booking('2026-11-09T19:00:00Z', { customerId: 'ana' }),
    booking('2026-11-02T19:00:00Z', { customerId: 'ben' }),
    booking('2026-11-03T19:00:00Z', { customerId: 'ben', status: 'cancelled' }), // doesn't make Ben a repeat
    booking('2026-11-04T19:00:00Z', { customerId: 'cat', status: 'no_show' }),
    booking('2026-11-05T19:00:00Z', { customerId: 'cat' }),
    booking('2026-11-06T19:00:00Z'),
  ];
  assert.deepEqual(repeatGuests(bookings), { repeatBookings: 5, returningGuests: 2, linked: 6, total: 7, share: 5 / 7 });
  assert.equal(repeatGuests([]).share, null);
});

// ─── Words ────────────────────────────────────────────────────────────────────

test('percentLabel and stayLabel', () => {
  assert.equal(percentLabel(null), '—');
  assert.equal(percentLabel(0), '0%');
  assert.equal(percentLabel(0.004), '0.4%');
  assert.equal(percentLabel(0.1249), '12%');
  assert.equal(stayLabel(null), '—');
  assert.equal(stayLabel(44.6), '45 min');
  assert.equal(stayLabel(110), '1 h 50 min');
  assert.equal(stayLabel(120), '2 h');
});
