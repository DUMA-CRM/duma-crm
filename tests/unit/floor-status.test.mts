import assert from 'node:assert/strict';
import test from 'node:test';

import { bookingMarkers, markerLabel } from '../../lib/utils/booking-markers.ts';
import {
  type FloorBooking,
  floorTableState,
  floorUsage,
  guestHistory,
  hostGroups,
  hostPrimaryStep,
  hostSections,
  waitlistForTable,
} from '../../lib/utils/floor-status.ts';

// Fixed instants in UTC; nothing here reads the clock or the machine's zone.
const at = (time: string) => new Date(`2026-11-16T${time}:00.000Z`);
const booking = (patch: Partial<FloorBooking> & Pick<FloorBooking, 'id'>): FloorBooking => ({
  guestName: 'Guest',
  partySize: 2,
  startsAt: '2026-11-16T19:00:00.000Z',
  endsAt: '2026-11-16T20:30:00.000Z',
  status: 'confirmed',
  tables: [{ id: 't1', label: 'T1' }],
  seatedAt: null,
  ...patch,
});
const t1 = { id: 't1', maxCovers: 4 };
const t2 = { id: 't2', maxCovers: 2 };

test('a table with nothing within the hour is free, and says what comes next', () => {
  const later = booking({ id: 'b1', startsAt: '2026-11-16T21:00:00.000Z', endsAt: '2026-11-16T22:30:00.000Z' });
  const status = floorTableState(t1, [later], at('18:30'));
  assert.equal(status.state, 'free');
  assert.equal(status.booking, null);
  assert.equal(status.next?.id, 'b1');
});

test('a booking within the hour makes it upcoming; after its start it is late until seated', () => {
  const due = booking({ id: 'b1' });
  assert.equal(floorTableState(t1, [due], at('17:55')).state, 'free');
  const soon = floorTableState(t1, [due], at('18:30'));
  assert.equal(soon.state, 'upcoming');
  assert.equal(soon.minutesLate, 0);
  const late = floorTableState(t1, [due], at('19:20'));
  assert.equal(late.state, 'upcoming');
  assert.equal(late.minutesLate, 20);
  // Past its booked end, an unseated booking no longer holds the table.
  assert.equal(floorTableState(t1, [due], at('20:31')).state, 'free');
});

test('seated counts from when they sat down, with the share of the stay used', () => {
  // Booked 19:00–20:30 (90 min), seated late at 19:15: due out at 20:45.
  const seated = booking({ id: 'b1', status: 'seated', seatedAt: '2026-11-16T19:15:00.000Z' });
  const halfway = floorTableState(t1, [seated], at('20:00'));
  assert.equal(halfway.state, 'seated');
  assert.equal(halfway.progress, 0.5);
  assert.equal(halfway.minutesLeft, 45);
  const over = floorTableState(t1, [seated], at('20:55'));
  assert.equal(over.state, 'overdue');
  assert.equal(over.progress, 1);
  assert.equal(over.minutesLeft, -10);
  // Looking back to before they sat down, the table was waiting for them.
  assert.equal(floorTableState(t1, [seated], at('19:05')).state, 'upcoming');
});

test('finished, cancelled and no-show bookings leave the table free', () => {
  for (const status of ['completed', 'cancelled', 'no_show'] as const) {
    assert.equal(floorTableState(t1, [booking({ id: 'b1', status })], at('19:10')).state, 'free');
  }
});

test('attention: an unconfirmed booking, or a party bigger than its tables', () => {
  assert.equal(floorTableState(t1, [booking({ id: 'b1', status: 'booked' })], at('18:45')).attention, 'unconfirmed');
  assert.equal(floorTableState(t1, [booking({ id: 'b1', status: 'confirmed' })], at('18:45')).attention, null);
  assert.equal(floorTableState(t1, [booking({ id: 'b1', partySize: 5 })], at('18:45')).attention, 'too_big');
  // Two tables put together seat six: a party of five fits, and each table knows the other.
  const joined = booking({
    id: 'b1',
    partySize: 5,
    tables: [
      { id: 't1', label: 'T1' },
      { id: 't2', label: 'T2' },
    ],
  });
  const status = floorTableState(t2, [joined], at('18:45'), { tables: [t1, t2] });
  assert.equal(status.attention, null);
  assert.deepEqual(status.joined, ['t1']);
});

test('usage counts tables held now and each party’s covers once', () => {
  const bookings = [
    booking({
      id: 'b1',
      status: 'seated',
      partySize: 5,
      seatedAt: '2026-11-16T19:00:00.000Z',
      tables: [
        { id: 't1', label: 'T1' },
        { id: 't2', label: 'T2' },
      ],
    }),
    booking({
      id: 'b2',
      partySize: 2,
      startsAt: '2026-11-16T19:45:00.000Z',
      endsAt: '2026-11-16T21:00:00.000Z',
      tables: [{ id: 't3', label: 'T3' }],
    }),
  ];
  const tables = [t1, t2, { id: 't3', maxCovers: 2 }];
  // At 19:30 the 19:45 booking is only due: one party, two tables, five covers.
  assert.deepEqual(floorUsage(tables, bookings, at('19:30')), { tables: 2, tablesTotal: 3, covers: 5, coversTotal: 8 });
  // At 19:50 its time has come: the table is held for them.
  assert.deepEqual(floorUsage(tables, bookings, at('19:50')), { tables: 3, tablesTotal: 3, covers: 7, coversTotal: 8 });
});

test('the host panel lists arriving soonest first, seated longest first, and counts guests', () => {
  const sections = hostSections([
    booking({ id: 'late', startsAt: '2026-11-16T20:00:00.000Z' }),
    booking({ id: 'early', startsAt: '2026-11-16T18:30:00.000Z', status: 'booked', partySize: 4 }),
    booking({ id: 's2', status: 'seated', seatedAt: '2026-11-16T19:10:00.000Z' }),
    booking({ id: 's1', status: 'seated', seatedAt: '2026-11-16T18:40:00.000Z' }),
    booking({ id: 'gone', status: 'completed' }),
    booking({ id: 'off', status: 'cancelled' }),
    booking({ id: 'ns', status: 'no_show' }),
  ]);
  assert.deepEqual(
    sections.map((section) => section.id),
    ['arriving', 'seated', 'departed', 'cancelled', 'no_show'],
  );
  assert.deepEqual(
    sections[0]!.bookings.map((item) => item.id),
    ['early', 'late'],
  );
  assert.equal(sections[0]!.guests, 6);
  assert.deepEqual(
    sections[1]!.bookings.map((item) => item.id),
    ['s1', 's2'],
  );
  assert.equal(sections[4]!.parties, 1);
});

test('a returning guest: finished visits before now, no-shows, the last visit', () => {
  const history = guestHistory(
    [
      { id: 'a', status: 'completed', startsAt: '2026-10-01T19:00:00.000Z' },
      { id: 'b', status: 'completed', startsAt: '2026-11-02T19:00:00.000Z' },
      { id: 'c', status: 'no_show', startsAt: '2026-09-01T19:00:00.000Z' },
      { id: 'now', status: 'confirmed', startsAt: '2026-11-16T19:00:00.000Z' },
      { id: 'future', status: 'completed', startsAt: '2026-12-01T19:00:00.000Z' },
    ],
    at('12:00'),
    'now',
  );
  assert.deepEqual(history, { visits: 2, noShows: 1, lastVisit: '2026-11-02T19:00:00.000Z' });
});

test('allergen markers name the UK 14 exactly, and only when the notes mention them', () => {
  assert.equal(bookingMarkers(null), null);
  assert.equal(bookingMarkers('Window table please'), null);
  assert.deepEqual(bookingMarkers('Severe peanut allergy, also no milk'), {
    allergens: ['Milk', 'Peanuts'],
    allergy: true,
    occasions: [],
  });
  // "Peanut" is not tree nuts, and words inside other words don't count.
  assert.deepEqual(bookingMarkers('peanuts')?.allergens, ['Peanuts']);
  assert.equal(bookingMarkers('Nutmeg on the dessert, eggplant starter, fishing trip'), null);
  assert.deepEqual(bookingMarkers('Tree nuts and sesame')?.allergens, ['Tree nuts', 'Sesame']);
  assert.deepEqual(bookingMarkers('Sulphur dioxide')?.allergens, ['Sulphites']);
  // An allergy without a named allergen still flags.
  assert.deepEqual(bookingMarkers('Guest is allergic, will explain'), { allergens: [], allergy: true, occasions: [] });
  // "No allergies" flags nothing.
  assert.equal(bookingMarkers('No known allergies'), null);
  assert.equal(bookingMarkers('no allergies'), null);
});

test('occasion markers, and the marker’s words', () => {
  const markers = bookingMarkers('Her 40th BIRTHDAY — gluten free cake')!;
  assert.deepEqual(markers, { allergens: ['Gluten'], allergy: true, occasions: ['Birthday'] });
  assert.equal(markerLabel(markers), 'Allergy: Gluten · Birthday');
  assert.equal(markerLabel(bookingMarkers('Anniversary dinner')!), 'Anniversary');
});

test('the host’s one step: seat today (naming the tables), confirm on another day, mark left, restore', () => {
  const held = booking({
    id: 'b1',
    status: 'booked',
    tables: [
      { id: 't1', label: 'T7' },
      { id: 't2', label: 'T8' },
    ],
  });
  assert.deepEqual(hostPrimaryStep(held, true), { status: 'seated', label: 'Seat at T7+T8' });
  assert.deepEqual(hostPrimaryStep({ ...held, tables: [] }, true), { status: 'seated', label: 'Seat' });
  assert.deepEqual(hostPrimaryStep(held, false), { status: 'confirmed', label: 'Confirm' });
  assert.equal(hostPrimaryStep({ ...held, status: 'confirmed' }, false), null);
  assert.deepEqual(hostPrimaryStep({ ...held, status: 'seated' }, true), { status: 'completed', label: 'Mark left' });
  assert.deepEqual(hostPrimaryStep({ ...held, status: 'no_show' }, true), { status: 'booked', label: 'Restore' });
  assert.deepEqual(hostPrimaryStep({ ...held, status: 'cancelled' }, false), { status: 'booked', label: 'Restore' });
  assert.equal(hostPrimaryStep({ ...held, status: 'completed' }, true), null);
});

test('seating a free table from the waitlist: parties it seats first, each group longest wait first', () => {
  const entry = (id: string, partySize: number, createdAt: string, status = 'waiting') => ({ id, partySize, createdAt, status });
  const list = [
    entry('big', 6, '2026-11-16T18:00:00.000Z'),
    entry('late-two', 2, '2026-11-16T18:20:00.000Z'),
    entry('early-four', 4, '2026-11-16T18:10:00.000Z', 'notified'),
    entry('gone', 2, '2026-11-16T17:00:00.000Z', 'left'),
  ];
  const ranked = waitlistForTable(list, { minCovers: 2, maxCovers: 4 });
  assert.deepEqual(
    ranked.map((row) => [row.entry.id, row.fits]),
    [
      ['early-four', true],
      ['late-two', true],
      ['big', false],
    ],
  );
});

test('the host works late first (today only), then next, seated, and done together', () => {
  const day = [
    booking({ id: 'next', startsAt: '2026-11-16T20:00:00.000Z', partySize: 4 }),
    booking({ id: 'late', startsAt: '2026-11-16T19:00:00.000Z', status: 'booked' }),
    booking({ id: 'grace', startsAt: '2026-11-16T19:20:00.000Z' }),
    booking({ id: 's2', status: 'seated', seatedAt: '2026-11-16T19:10:00.000Z' }),
    booking({ id: 's1', status: 'seated', seatedAt: '2026-11-16T18:40:00.000Z' }),
    booking({ id: 'off', status: 'cancelled', startsAt: '2026-11-16T18:00:00.000Z' }),
    booking({ id: 'gone', status: 'completed', startsAt: '2026-11-16T12:00:00.000Z' }),
    booking({ id: 'ns', status: 'no_show', startsAt: '2026-11-16T13:00:00.000Z' }),
  ];
  const ids = (groups: ReturnType<typeof hostGroups>) => groups.map((group) => [group.id, group.bookings.map((item) => item.id)]);
  // 19:30: the 19:00 party is 30 minutes late; the 19:20 one is still inside the 15-minute grace.
  assert.deepEqual(ids(hostGroups(day, { now: at('19:30'), isToday: true })), [
    ['late', ['late']],
    ['next', ['grace', 'next']],
    ['seated', ['s1', 's2']],
    ['done', ['gone', 'ns', 'off']],
  ]);
  // Looking at another time, nobody is late: they're all still to come.
  const elsewhere = hostGroups(day, { now: at('19:30'), isToday: false });
  assert.deepEqual(elsewhere[0]!.bookings, []);
  assert.deepEqual(
    elsewhere[1]!.bookings.map((item) => item.id),
    ['late', 'grace', 'next'],
  );
  assert.equal(elsewhere[1]!.guests, 8);
});
