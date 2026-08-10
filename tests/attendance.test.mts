import assert from 'node:assert/strict';
import test from 'node:test';

const { ROTA_GRACE_MINS, findAttendanceIssues } = await import('../lib/utils/attendance.ts');
const { resolveTradingDay } = await import('../lib/utils/trading-day.ts');

type Args = Parameters<typeof findAttendanceIssues>[0];
type Shift = Args['activeShifts'][number];
type Rota = Args['rota'][number];

const hours = (open: string, close: string) => ({ open, close });
const week = (day: { open: string; close: string } | null) => ({
  mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day,
});
const site = (open = '09:00', close = '17:00') => ({ timezone: 'Europe/London', openingHours: week(hours(open, close)) });

const shift = (userId: string, clockedInIso: string): Shift =>
  ({ id: `shift-${userId}`, userId, locationId: 'loc-1', clockedIn: clockedInIso, staff: { userId, user: { id: userId, name: 'Sam Patel', email: 's@x.com' } } }) as Shift;

const slot = (userId: string | null, startsAt: string, endsAt: string, status = 'published'): Rota =>
  ({ id: `slot-${userId}-${startsAt}`, locationId: 'loc-1', userId, startsAt, endsAt, status, createdAt: startsAt }) as Rota;

// 13:00 London on a Thursday, mid-service.
const MIDDAY = new Date('2026-08-06T12:00:00Z');
// 22:00 London — the site shut at 17:00.
const AFTER_CLOSE = new Date('2026-08-06T21:00:00Z');

test('somebody still clocked in after close is flagged', () => {
  const day = resolveTradingDay(site(), AFTER_CLOSE);
  assert.equal(day.state, 'after-close');
  const issues = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T08:00:00Z')],
    rota: [slot('u1', '2026-08-06T08:00:00Z', '2026-08-06T16:00:00Z')],
    day,
    now: AFTER_CLOSE,
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].reason, 'after-close');
  assert.equal(issues[0].name, 'Sam Patel');
  assert.equal(Math.round(issues[0].minutes), 13 * 60);
});

test('clocked in during service with no rostered shift is flagged as off-rota', () => {
  const issues = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T11:00:00Z')],
    rota: [],
    day: resolveTradingDay(site(), MIDDAY),
    now: MIDDAY,
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].reason, 'off-rota');
});

test('somebody working their rostered shift is not flagged', () => {
  const issues = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T08:00:00Z')],
    rota: [slot('u1', '2026-08-06T08:00:00Z', '2026-08-06T16:00:00Z')],
    day: resolveTradingDay(site(), MIDDAY),
    now: MIDDAY,
  });
  assert.deepEqual(issues, []);
});

test('a draft rota slot does not count as cover', () => {
  const issues = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T08:00:00Z')],
    rota: [slot('u1', '2026-08-06T08:00:00Z', '2026-08-06T16:00:00Z', 'draft')],
    day: resolveTradingDay(site(), MIDDAY),
    now: MIDDAY,
  });
  assert.equal(issues[0]?.reason, 'off-rota');
});

test('someone else’s rota slot does not cover this person', () => {
  const issues = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T08:00:00Z')],
    rota: [slot('u2', '2026-08-06T08:00:00Z', '2026-08-06T16:00:00Z')],
    day: resolveTradingDay(site(), MIDDAY),
    now: MIDDAY,
  });
  assert.equal(issues[0]?.reason, 'off-rota');
});

test('clocking in a few minutes either side of the slot is within grace', () => {
  // Slot ended 10 minutes ago; grace is 15.
  const endedRecently = new Date(MIDDAY.getTime() - 10 * 60_000).toISOString();
  const issues = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T08:00:00Z')],
    rota: [slot('u1', '2026-08-06T08:00:00Z', endedRecently)],
    day: resolveTradingDay(site(), MIDDAY),
    now: MIDDAY,
  });
  assert.deepEqual(issues, [], `within ${ROTA_GRACE_MINS} minutes of the slot end is normal`);
});

test('well past the end of the slot is flagged', () => {
  const endedLongAgo = new Date(MIDDAY.getTime() - 90 * 60_000).toISOString();
  const issues = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T08:00:00Z')],
    rota: [slot('u1', '2026-08-06T06:00:00Z', endedLongAgo)],
    day: resolveTradingDay(site(), MIDDAY),
    now: MIDDAY,
  });
  assert.equal(issues[0]?.reason, 'off-rota');
});

test('arriving before opening is normal and is never flagged', () => {
  // 07:00 local, site opens at 09:00 — prep and deliveries.
  const beforeOpen = new Date('2026-08-06T06:00:00Z');
  const day = resolveTradingDay(site(), beforeOpen);
  assert.equal(day.state, 'before-open');
  const issues = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T05:30:00Z')],
    rota: [slot('u1', '2026-08-06T05:30:00Z', '2026-08-06T14:00:00Z')],
    day,
    now: beforeOpen,
  });
  assert.deepEqual(issues, [], 'a dashboard that complains every morning gets ignored');
});

test('with no trading hours set, closure cannot be judged — only the rota is', () => {
  const day = resolveTradingDay({ timezone: 'Europe/London', openingHours: null }, MIDDAY);
  assert.equal(day.state, 'no-hours');
  const covered = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T08:00:00Z')],
    rota: [slot('u1', '2026-08-06T08:00:00Z', '2026-08-06T16:00:00Z')],
    day,
    now: MIDDAY,
  });
  assert.deepEqual(covered, []);
});

test('the longest-running problem is listed first', () => {
  const issues = findAttendanceIssues({
    activeShifts: [shift('u1', '2026-08-06T11:30:00Z'), shift('u2', '2026-08-06T06:00:00Z')],
    rota: [],
    day: resolveTradingDay(site(), MIDDAY),
    now: MIDDAY,
  });
  assert.equal(issues[0].shift.userId, 'u2');
});

// ── Cover gaps: rostered but nobody there ────────────────────────────────────

const { NO_SHOW_GRACE_MINS, findCoverGaps } = await import('../lib/utils/attendance.ts');

const named = (userId: string | null, startsAt: string, endsAt: string, name = 'Alex Rowe'): Rota =>
  ({ ...slot(userId, startsAt, endsAt), staff: userId ? { userId, user: { id: userId, name, email: 'a@x.com' } } : undefined }) as Rota;

test('a shift nobody clocked in for is flagged once the grace has passed', () => {
  const startedAt = new Date(MIDDAY.getTime() - 40 * 60_000).toISOString();
  const gaps = findCoverGaps({
    rota: [named('u1', startedAt, '2026-08-06T16:00:00Z')],
    activeShifts: [],
    now: MIDDAY,
  });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, 'not-clocked-in');
  assert.equal(gaps[0].name, 'Alex Rowe');
  assert.equal(Math.round(gaps[0].minutesLate), 40);
});

test('a shift that has only just started is inside the grace and stays quiet', () => {
  // The old behaviour fired at the exact second a shift began.
  const justStarted = new Date(MIDDAY.getTime() - 1 * 60_000).toISOString();
  const gaps = findCoverGaps({
    rota: [named('u1', justStarted, '2026-08-06T16:00:00Z')],
    activeShifts: [],
    now: MIDDAY,
  });
  assert.deepEqual(gaps, [], `a shift ${NO_SHOW_GRACE_MINS} minutes old or less is not a no-show yet`);
});

test('somebody who did clock in is not flagged', () => {
  const startedAt = new Date(MIDDAY.getTime() - 40 * 60_000).toISOString();
  const gaps = findCoverGaps({
    rota: [named('u1', startedAt, '2026-08-06T16:00:00Z')],
    activeShifts: [shift('u1', startedAt)],
    now: MIDDAY,
  });
  assert.deepEqual(gaps, []);
});

test('a published slot with nobody assigned is its own warning', () => {
  const startedAt = new Date(MIDDAY.getTime() - 30 * 60_000).toISOString();
  const gaps = findCoverGaps({ rota: [named(null, startedAt, '2026-08-06T16:00:00Z')], activeShifts: [], now: MIDDAY });
  assert.equal(gaps[0]?.reason, 'unassigned');
});

test('a draft shift is not a commitment and is never flagged', () => {
  const startedAt = new Date(MIDDAY.getTime() - 40 * 60_000).toISOString();
  const gaps = findCoverGaps({
    rota: [slot('u1', startedAt, '2026-08-06T16:00:00Z', 'draft')],
    activeShifts: [],
    now: MIDDAY,
  });
  assert.deepEqual(gaps, []);
});

test('a shift that has already ended is history, not a live gap', () => {
  const gaps = findCoverGaps({
    rota: [named('u1', '2026-08-06T06:00:00Z', '2026-08-06T09:00:00Z')],
    activeShifts: [],
    now: MIDDAY,
  });
  assert.deepEqual(gaps, []);
});

test('a shift later today is not yet a problem', () => {
  const gaps = findCoverGaps({
    rota: [named('u1', '2026-08-06T14:00:00Z', '2026-08-06T20:00:00Z')],
    activeShifts: [],
    now: MIDDAY,
  });
  assert.deepEqual(gaps, []);
});

test('the person who is latest is listed first', () => {
  const gaps = findCoverGaps({
    rota: [
      named('u1', new Date(MIDDAY.getTime() - 20 * 60_000).toISOString(), '2026-08-06T16:00:00Z', 'Twenty Late'),
      named('u2', new Date(MIDDAY.getTime() - 90 * 60_000).toISOString(), '2026-08-06T16:00:00Z', 'Ninety Late'),
    ],
    activeShifts: [],
    now: MIDDAY,
  });
  assert.equal(gaps[0].name, 'Ninety Late');
});

test('somebody else being on the floor does not cover a named shift', () => {
  const startedAt = new Date(MIDDAY.getTime() - 40 * 60_000).toISOString();
  const gaps = findCoverGaps({
    rota: [named('u1', startedAt, '2026-08-06T16:00:00Z')],
    activeShifts: [shift('u2', startedAt)],
    now: MIDDAY,
  });
  assert.equal(gaps[0]?.reason, 'not-clocked-in');
});
