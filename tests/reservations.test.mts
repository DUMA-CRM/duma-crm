import assert from 'node:assert/strict';
import test from 'node:test';

import type { BookingLike } from '../lib/utils/reservations.ts';

const {
  addDays,
  bookingActions,
  bookingDraftProblems,
  bookingWindow,
  CANVAS,
  dayRange,
  defaultDurationMinutes,
  freeSpot,
  groupBySlot,
  isRunningLate,
  movedTables,
  nextTableLabel,
  placeOnCanvas,
  seatsAtMost,
  seatsParty,
  summariseDay,
  tableStatus,
  waitTone,
} = await import('../lib/utils/reservations.ts');

const booking = (patch: Partial<BookingLike> = {}): BookingLike => ({
  id: 'b1',
  guestName: 'Sam',
  partySize: 2,
  startsAt: '2026-10-11T18:00:00.000Z',
  endsAt: '2026-10-11T19:30:00.000Z',
  status: 'booked',
  tables: [{ id: 't1', label: 'T1' }],
  ...patch,
});

test('a day runs midnight to midnight in the zone, across a clock change too', () => {
  assert.deepEqual(dayRange('2026-07-01', 'Europe/London'), { from: '2026-06-30T23:00:00.000Z', to: '2026-07-01T23:00:00.000Z' });
  // 25 October 2026: the clocks go back, so the day is 25 hours long.
  const { from, to } = dayRange('2026-10-25', 'Europe/London');
  assert.equal((new Date(to).getTime() - new Date(from).getTime()) / 3_600_000, 25);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('a booking window starts at the wall-clock time and runs for the stay', () => {
  assert.deepEqual(bookingWindow('2026-07-01', '19:30', 90, 'Europe/London'), {
    startsAt: '2026-07-01T18:30:00.000Z',
    endsAt: '2026-07-01T20:00:00.000Z',
  });
  assert.equal(bookingWindow('2026-07-01', 'later', 90, 'Europe/London'), null);
  assert.equal(defaultDurationMinutes(2), 90);
  assert.equal(defaultDurationMinutes(5), 120);
  assert.equal(defaultDurationMinutes(10), 150);
});

test('the next step is offered first; finished bookings offer only a restore', () => {
  assert.deepEqual(
    bookingActions('booked').map((action) => action.status),
    ['seated', 'confirmed', 'cancelled', 'no_show'],
  );
  assert.equal(bookingActions('seated')[0]?.label, 'Finish');
  assert.equal(bookingActions('seated')[1]?.label, 'Unseat');
  assert.deepEqual(bookingActions('completed'), []);
  assert.deepEqual(
    bookingActions('cancelled').map((action) => action.label),
    ['Restore booking'],
  );
  assert.ok(bookingActions('confirmed').find((action) => action.status === 'no_show')?.destructive);
});

test('bookings group under their start time, in order', () => {
  const groups = groupBySlot(
    [
      booking({ id: 'b2', startsAt: '2026-07-01T19:00:00.000Z' }),
      booking({ id: 'b1', startsAt: '2026-07-01T18:30:00.000Z' }),
      booking({ id: 'b3', startsAt: '2026-07-01T19:00:00.000Z' }),
    ],
    'Europe/London',
  );
  assert.deepEqual(
    groups.map((group) => [group.slot, group.bookings.map((item) => item.id)]),
    [
      ['19:30', ['b1']],
      ['20:00', ['b2', 'b3']],
    ],
  );
});

test('the day’s counts leave cancellations out, and no-shows out of covers', () => {
  assert.deepEqual(
    summariseDay([
      booking({ partySize: 2, status: 'seated' }),
      booking({ partySize: 4, status: 'booked' }),
      booking({ partySize: 6, status: 'cancelled' }),
      booking({ partySize: 3, status: 'no_show' }),
      booking({ partySize: 2, status: 'completed' }),
    ]),
    { bookings: 4, covers: 8, seated: 1, toCome: 1, noShows: 1 },
  );
});

test('a table is seated, held, booked soon or free', () => {
  const at = new Date('2026-10-11T18:15:00.000Z');
  assert.equal(tableStatus('t1', [booking({ status: 'seated' })], at).state, 'seated');
  assert.equal(tableStatus('t1', [booking()], at).state, 'held', 'within the window, not yet seated');
  assert.equal(
    tableStatus('t1', [booking({ startsAt: '2026-10-11T19:00:00.000Z', endsAt: '2026-10-11T20:00:00.000Z' })], at).state,
    'soon',
  );
  assert.equal(
    tableStatus('t1', [booking({ startsAt: '2026-10-11T21:00:00.000Z', endsAt: '2026-10-11T22:00:00.000Z' })], at).state,
    'free',
  );
  assert.equal(tableStatus('t1', [booking({ status: 'cancelled' })], at).state, 'free', 'a cancelled booking holds nothing');
  assert.equal(tableStatus('t2', [booking()], at).state, 'free', 'another table');
  const overstayed = tableStatus('t1', [booking({ status: 'seated', endsAt: '2026-10-11T18:10:00.000Z' })], at);
  assert.equal(overstayed.state, 'seated', 'still eating past the booked end');
  const next = tableStatus(
    't1',
    [booking({ status: 'seated' }), booking({ id: 'b2', startsAt: '2026-10-11T20:00:00.000Z', endsAt: '2026-10-11T21:00:00.000Z' })],
    at,
  );
  assert.equal(next.next?.id, 'b2');
});

test('running late: unseated past a grace period', () => {
  const now = new Date('2026-10-11T18:20:00.000Z');
  assert.ok(isRunningLate(booking(), now));
  assert.ok(!isRunningLate(booking(), new Date('2026-10-11T18:10:00.000Z')));
  assert.ok(!isRunningLate(booking({ status: 'seated' }), now));
});

test('tables seat a party alone or pushed together', () => {
  assert.ok(seatsParty({ minCovers: 2, maxCovers: 4 }, 3));
  assert.ok(!seatsParty({ minCovers: 2, maxCovers: 4 }, 1));
  assert.equal(seatsAtMost([{ maxCovers: 4 }, { maxCovers: 2 }]), 6);
});

test('waits against the quote', () => {
  assert.equal(waitTone(10, 20), 'ok');
  assert.equal(waitTone(17, 20), 'near');
  assert.equal(waitTone(25, 20), 'over');
  assert.equal(waitTone(35, null), 'near');
});

test('a booking draft says what is missing', () => {
  const draft = {
    guestName: 'Sam',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    date: '2026-10-11',
    time: '19:00',
    durationMinutes: 90,
    notes: '',
  };
  assert.deepEqual(bookingDraftProblems(draft), {});
  assert.deepEqual(
    Object.keys(bookingDraftProblems({ ...draft, guestName: ' ', partySize: 0, guestEmail: 'nope', durationMinutes: 5 })).sort(),
    ['durationMinutes', 'guestEmail', 'guestName', 'partySize'],
  );
});

test('the floor plan: tables snap to the grid and stay on the canvas', () => {
  const table = { x: 0, y: 0, width: 80, height: 80 };
  assert.deepEqual(placeOnCanvas(table, 123, 47), { ...table, x: 120, y: 50 });
  assert.deepEqual(placeOnCanvas(table, -40, 5000), { ...table, x: 0, y: CANVAS.height - 80 });
  assert.equal(nextTableLabel(['T1', 'T9', 'Bar', '4']), 'T10');
  assert.equal(nextTableLabel([]), 'T1');
  const spot = freeSpot([{ x: 40, y: 40, width: 80, height: 80 }], { width: 80, height: 80 });
  assert.ok(spot.x >= 140 || spot.y >= 140, 'clear of the first table');
  const saved = [{ id: 'a', x: 0, y: 0, width: 80, height: 80, rotation: 0 }];
  assert.deepEqual(movedTables(saved, saved), []);
  assert.deepEqual(
    movedTables(saved, [{ ...saved[0]!, rotation: 90 }]).map((row) => row.id),
    ['a'],
  );
});

const { guestDetailsProblems, noTimesMessage, upcomingDays } = await import('../lib/utils/reservations.ts');

test('the guest page: day picks stop at the horizon, and an empty day says why', () => {
  assert.deepEqual(upcomingDays('2026-12-30', 3), ['2026-12-30', '2026-12-31', '2027-01-01']);
  assert.equal(upcomingDays('2026-12-30', 60).length, 14);
  assert.equal(noTimesMessage('closed', null), 'We’re closed that day — try another.');
  assert.match(noTimesMessage('full', '020 7946 0000'), /fully booked.*Call us on 020 7946 0000\./);
  assert.match(noTimesMessage('no_table', null), /for that many online\.$/);
});

test('the guest gives a name, an email and a phone number', () => {
  assert.deepEqual(guestDetailsProblems({ name: 'Sam', email: 'sam@example.com', phone: '07700 900123' }), {});
  assert.deepEqual(Object.keys(guestDetailsProblems({ name: ' ', email: 'sam@', phone: '12' })).sort(), ['email', 'name', 'phone']);
});

test('chairs sit one a side on a square table, long sides first on a long one', async () => {
  const { chairSpots } = await import('../lib/utils/reservations.ts');
  const square = { x: 100, y: 100, width: 80, height: 80, shape: 'square' as const };
  const sides = (spots: { angle: number }[]) => spots.map((spot) => spot.angle).sort((a, b) => a - b);
  assert.deepEqual(sides(chairSpots(square, 4)), [0, 90, 180, 270]);
  assert.deepEqual(chairSpots(square, 0), []);

  const long = { x: 100, y: 100, width: 140, height: 80, shape: 'rectangle' as const };
  assert.deepEqual(sides(chairSpots(long, 6)), [0, 0, 0, 180, 180, 180]);
  // The seventh goes on an end once the long sides are full.
  assert.equal(chairSpots(long, 7).filter((spot) => spot.angle === 90 || spot.angle === 270).length, 1);
  // Turned on its end, the long sides are left and right.
  assert.deepEqual(sides(chairSpots({ ...long, width: 80, height: 140 }, 2)), [90, 270]);

  // Top chairs are centred along the side, just clear of the edge.
  const top = chairSpots(long, 6).filter((spot) => spot.angle === 0).map((spot) => Math.round(spot.x));
  assert.deepEqual(top, [123, 170, 217]);
  assert.ok(chairSpots(long, 6).every((spot) => spot.angle !== 0 || spot.y < 100));
});

test('chairs round a round table are spaced evenly from twelve o’clock', async () => {
  const { chairSpots } = await import('../lib/utils/reservations.ts');
  const spots = chairSpots({ x: 0, y: 0, width: 80, height: 80, shape: 'round' }, 4);
  assert.equal(spots.length, 4);
  assert.equal(Math.round(spots[0]!.x), 40);
  assert.ok(spots[0]!.y < 0);
  assert.deepEqual(spots.map((spot) => Math.round(spot.angle)), [0, 90, 180, 270]);
});

test('the best fit is the smallest free table that seats the party', async () => {
  const { bestFitTable } = await import('../lib/utils/reservations.ts');
  const table = (id: string, maxCovers: number, free = true, seatsParty = true) => ({ id, label: id, maxCovers, free, seatsParty });
  assert.equal(bestFitTable([table('T6', 6), table('T2', 2, false), table('T10', 4), table('T4', 4)])?.id, 'T4');
  assert.equal(bestFitTable([table('T1', 2, true, false), table('T2', 4, false)]), null);
});

test('minutes read as a person says them', async () => {
  const { minutesLabel } = await import('../lib/utils/reservations.ts');
  assert.equal(minutesLabel(0), 'None');
  assert.equal(minutesLabel(0, 'Back to back'), 'Back to back');
  assert.equal(minutesLabel(45), '45 min');
  assert.equal(minutesLabel(120), '2 h');
  assert.equal(minutesLabel(90), '1 h 30');
  assert.equal(minutesLabel(1440), '1 day');
  assert.equal(minutesLabel(3060), '2 days 3 h');
});
