import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type ListedBooking,
  type ListedWaitlistEntry,
  bookingsOverview,
  dayPartOf,
  filterBookings,
  groupBookings,
  inHostFilter,
  lateBookings,
  matchesWaitlistSearch,
  resolveReservationsTab,
  waitlistGroups,
  waitlistOverview,
} from '../../lib/utils/reservations-lists.ts';

const TZ = 'Europe/London';
const NOW = new Date('2026-11-16T19:30:00Z');
const TODAY = { now: NOW, isToday: true };

const booking = (id: string, startsAt: string, patch: Partial<ListedBooking> = {}): ListedBooking => ({
  id,
  guestName: `Guest ${id}`,
  partySize: 2,
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 90 * 60_000).toISOString(),
  status: 'booked',
  tables: [{ id: 't1', label: 'T1' }],
  ...patch,
});

const DAY: ListedBooking[] = [
  booking('a', '2026-11-16T09:00:00Z', { status: 'completed', partySize: 3 }),
  booking('b', '2026-11-16T13:00:00Z', { status: 'no_show', partySize: 4 }),
  booking('c', '2026-11-16T19:00:00Z', { status: 'booked', partySize: 2, guestPhone: '07700 900123' }),
  booking('d', '2026-11-16T19:00:00Z', { status: 'confirmed', partySize: 5, tables: [] }),
  booking('e', '2026-11-16T19:15:00Z', { status: 'seated', partySize: 2 }),
  booking('f', '2026-11-16T20:00:00Z', { status: 'cancelled', partySize: 6 }),
];

test('the figures leave cancellations out, and no-shows out of covers', () => {
  assert.deepEqual(bookingsOverview(DAY, TODAY), {
    bookings: 5,
    covers: 3 + 2 + 5 + 2,
    toCome: 2,
    seated: 1,
    noTable: 1,
    late: 2,
    unconfirmed: 1,
  });
});

test('lateness only counts on today, after the 15-minute grace', () => {
  assert.deepEqual(
    lateBookings(DAY, TODAY).map((row) => row.id),
    ['c', 'd'],
  );
  assert.deepEqual(lateBookings(DAY, { now: NOW, isToday: false }), []);
  assert.deepEqual(lateBookings(DAY, { now: new Date('2026-11-16T19:10:00Z'), isToday: true }), []);
});

test('a view and a search narrow together; a phone matches on its digits', () => {
  assert.deepEqual(
    filterBookings(DAY, { view: 'to_come', search: '' }, TODAY).map((row) => row.id),
    ['c', 'd'],
  );
  assert.deepEqual(
    filterBookings(DAY, { view: 'all', search: '900 123' }, TODAY).map((row) => row.id),
    ['c'],
  );
  assert.deepEqual(
    filterBookings(DAY, { view: 'all', search: 't1' }, TODAY).map((row) => row.id),
    ['a', 'b', 'c', 'e', 'f'],
  );
  assert.deepEqual(
    filterBookings(DAY, { view: 'no_table', search: '' }, TODAY).map((row) => row.id),
    ['d'],
  );
});

test('groups by time of day in the workspace zone, cancelled at the foot', () => {
  const groups = groupBookings(DAY, TZ);
  assert.deepEqual(
    groups.map((group) => [group.title, group.bookings.map((row) => row.id), group.covers]),
    [
      ['Morning', ['a'], 3],
      ['Afternoon', ['b'], 0],
      ['Evening', ['c', 'd', 'e'], 9],
      ['Cancelled', ['f'], 0],
    ],
  );
  // 11:30 UTC is 12:30 in Paris — afternoon there, morning in London.
  assert.equal(dayPartOf('2026-07-01T11:30:00Z', 'Europe/Paris'), 'afternoon');
  assert.equal(dayPartOf('2026-11-16T11:30:00Z', TZ), 'morning');
});

const entry = (createdAt: string, patch: Partial<ListedWaitlistEntry> = {}): ListedWaitlistEntry => ({
  guestName: 'Sam',
  guestPhone: null,
  partySize: 2,
  quotedWaitMinutes: 15,
  status: 'waiting',
  notes: null,
  createdAt,
  ...patch,
});

test('the waitlist figures: longest wait, told it’s ready, and over their quote', () => {
  const list = [
    entry('2026-11-16T19:00:00Z', { partySize: 4 }), // 30 min on a 15 min quote
    entry('2026-11-16T19:20:00Z', { status: 'notified' }), // 10 min
    entry('2026-11-16T19:25:00Z', { quotedWaitMinutes: null, partySize: 3 }),
  ];
  assert.deepEqual(waitlistOverview(list, NOW), { parties: 3, guests: 9, longest: 30, notified: 1, over: 1 });
  assert.deepEqual(waitlistOverview([], NOW), { parties: 0, guests: 0, longest: 0, notified: 0, over: 0 });
});

test('a waitlist search finds a name, a note or a phone’s digits', () => {
  const row = entry('2026-11-16T19:00:00Z', { guestName: 'Priya', guestPhone: '+44 7700 900456', notes: 'Pram' });
  assert.ok(matchesWaitlistSearch(row, 'pri'));
  assert.ok(matchesWaitlistSearch(row, 'pram'));
  assert.ok(matchesWaitlistSearch(row, '900456'));
  assert.ok(!matchesWaitlistSearch(row, '44'));
});

test('the page opens on the overview; old Bookings, Floor and Waitlist links land on the host stand', () => {
  const all = { canDrawFloor: true, canSetRules: true };
  assert.deepEqual(resolveReservationsTab(null, all), { tab: 'overview', panel: 'bookings' });
  assert.deepEqual(resolveReservationsTab('nonsense', all), { tab: 'overview', panel: 'bookings' });
  assert.deepEqual(resolveReservationsTab('bookings', all), { tab: 'host', panel: 'bookings' });
  assert.deepEqual(resolveReservationsTab('floor', all), { tab: 'host', panel: 'bookings' });
  assert.deepEqual(resolveReservationsTab('waitlist', all), { tab: 'host', panel: 'waitlist' });
  assert.equal(resolveReservationsTab('plan', all).tab, 'plan');
  assert.equal(resolveReservationsTab('rules', all).tab, 'rules');
});

test('the floor plan and the rules need their capability, or the link falls back to the overview', () => {
  const none = { canDrawFloor: false, canSetRules: false };
  assert.equal(resolveReservationsTab('plan', none).tab, 'overview');
  assert.equal(resolveReservationsTab('rules', none).tab, 'overview');
  assert.equal(resolveReservationsTab('rules', { canDrawFloor: false, canSetRules: true }).tab, 'rules');
});

test('the host’s quick filters: not confirmed, and notes naming an allergy (not “no allergies”)', () => {
  const unconfirmed = DAY.filter((item) => inHostFilter(item, 'unconfirmed')).map((item) => item.id);
  assert.deepEqual(unconfirmed, ['c']);
  const notes = [
    booking('nut', '2026-11-16T19:00:00Z', { notes: 'Severe peanut allergy' }),
    booking('none', '2026-11-16T19:00:00Z', { notes: 'No allergies, window please' }),
    booking('bday', '2026-11-16T19:00:00Z', { notes: 'Birthday' }),
    booking('blank', '2026-11-16T19:00:00Z', { notes: null }),
  ];
  assert.deepEqual(
    notes.filter((item) => inHostFilter(item, 'allergy')).map((item) => item.id),
    ['nut'],
  );
  assert.equal(
    notes.every((item) => inHostFilter(item, null)),
    true,
  );
});

test('the waitlist groups: told it’s ready first, then waiting, each longest first; gone left out', () => {
  const entry = (guestName: string, createdAt: string, status: ListedWaitlistEntry['status']): ListedWaitlistEntry => ({
    guestName,
    guestPhone: null,
    partySize: 2,
    quotedWaitMinutes: 15,
    status,
    notes: null,
    createdAt,
  });
  const groups = waitlistGroups([
    entry('w2', '2026-11-16T19:20:00Z', 'waiting'),
    entry('r1', '2026-11-16T19:10:00Z', 'notified'),
    entry('w1', '2026-11-16T19:05:00Z', 'waiting'),
    entry('gone', '2026-11-16T18:00:00Z', 'left'),
  ]);
  assert.deepEqual(
    groups.ready.map((item) => item.guestName),
    ['r1'],
  );
  assert.deepEqual(
    groups.waiting.map((item) => item.guestName),
    ['w1', 'w2'],
  );
});
