// my-rota reads the runtime's local calendar; pin it to the UK's.
process.env.TZ = 'Europe/London';

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ageState,
  durationLabel,
  isLate,
  joinDuration,
  latenessFor,
  latenessProblems,
  splitDuration,
  stageSince,
} from '../../lib/utils/kitchen-age.ts';
import {
  acknowledgeMarker,
  assignWorked,
  diffRota,
  formatDuration,
  leaveOnDay,
  paidMinutes,
  rotaSnapshot,
  shiftProgress,
  shiftState,
  unpaidBreak,
  weekOffsetFor,
  workedMinutes,
} from '../../lib/utils/my-rota.ts';
import {
  ALWAYS_OPEN_HOURS,
  axisNowMinutes,
  isAlwaysOpen,
  isOvernight,
  resolveTradingDay,
  tradingDayLabel,
} from '../../lib/utils/trading-day.ts';
import {
  formatCalendarDate,
  timeZoneOffsetLabel,
  workspaceDateKey,
  zonedParts,
  zonedToInstant,
} from '../../lib/utils/workspace-time.ts';

const at = (iso: string) => Date.parse(iso);

// ── zonedToInstant and friends ───────────────────────────────────────────────

test('a wall-clock time in London maps to the right instant in winter and summer', () => {
  assert.equal(zonedToInstant('2026-01-15', '09:00', 'Europe/London')?.toISOString(), '2026-01-15T09:00:00.000Z');
  assert.equal(zonedToInstant('2026-07-15', '09:00', 'Europe/London')?.toISOString(), '2026-07-15T08:00:00.000Z');
  assert.equal(zonedToInstant('2026-07-15', '09:00', 'Europe/Warsaw')?.toISOString(), '2026-07-15T07:00:00.000Z');
});

test('zonedToInstant across the London clock changes', () => {
  // The day the clocks go forward (29 March 2026): either side of the jump.
  assert.equal(zonedToInstant('2026-03-29', '00:30', 'Europe/London')?.toISOString(), '2026-03-29T00:30:00.000Z');
  assert.equal(zonedToInstant('2026-03-29', '03:00', 'Europe/London')?.toISOString(), '2026-03-29T02:00:00.000Z');
  // 01:30 never happens that night; it resolves forward to 02:30 BST, as clocks do.
  const skipped = zonedToInstant('2026-03-29', '01:30', 'Europe/London')!;
  assert.equal(skipped.toISOString(), '2026-03-29T01:30:00.000Z');
  assert.equal(zonedParts(skipped, 'Europe/London').time, '02:30');
  // The day they go back (25 October 2026): 01:30 happens twice; it is read in GMT, the later one.
  const repeated = zonedToInstant('2026-10-25', '01:30', 'Europe/London')!;
  assert.equal(repeated.toISOString(), '2026-10-25T01:30:00.000Z');
  assert.equal(zonedParts(repeated, 'Europe/London').time, '01:30');
  assert.equal(zonedToInstant('2026-10-25', '09:00', 'Europe/London')?.toISOString(), '2026-10-25T09:00:00.000Z');
  // Every wall time that does exist round-trips.
  for (const time of ['00:00', '00:59', '02:00', '23:59']) {
    for (const date of ['2026-03-29', '2026-10-25']) {
      assert.equal(zonedParts(zonedToInstant(date, time, 'Europe/London')!, 'Europe/London').time, time, `${date} ${time}`);
    }
  }
});

test('zonedToInstant refuses what is not a date and a time', () => {
  assert.equal(zonedToInstant('24/11/2026', '09:00', 'Europe/London'), null);
  assert.equal(zonedToInstant('2026-11-24', '9am', 'Europe/London'), null);
});

test('the workspace day and offset follow the zone, not UTC', () => {
  assert.equal(workspaceDateKey('2026-06-30T23:30:00Z', 'Europe/London'), '2026-07-01');
  assert.equal(workspaceDateKey('2026-12-31T23:30:00Z', 'Europe/London'), '2026-12-31');
  assert.equal(workspaceDateKey('2026-11-24T04:00:00Z', 'America/New_York'), '2026-11-23');
  assert.equal(timeZoneOffsetLabel('Europe/London', new Date('2026-01-15T12:00:00Z')), 'GMT');
  assert.equal(timeZoneOffsetLabel('Europe/London', new Date('2026-07-15T12:00:00Z')), 'GMT+1');
  assert.equal(timeZoneOffsetLabel('Asia/Kolkata', new Date('2026-07-15T12:00:00Z')), 'GMT+5:30');
  // A calendar date is shown as written, never moved by a zone.
  assert.equal(formatCalendarDate('2026-03-29', { day: 'numeric', month: 'short' }), '29 Mar');
  assert.equal(formatCalendarDate('not a date', { day: 'numeric' }), '—');
});

// ── Kitchen age ──────────────────────────────────────────────────────────────

test('a ticket ages from its stage, or from its release when that is later', () => {
  assert.equal(stageSince({ createdAt: '2026-11-24T09:00:00Z' }), '2026-11-24T09:00:00Z');
  assert.equal(stageSince({ createdAt: '2026-11-24T09:00:00Z', updatedAt: '2026-11-24T09:10:00Z' }), '2026-11-24T09:10:00Z');
  assert.equal(
    stageSince({ createdAt: '2026-11-24T08:00:00Z', updatedAt: '2026-11-24T08:00:00Z', kitchenReleaseAt: '2026-11-24T09:00:00Z' }),
    '2026-11-24T09:00:00Z',
  );
  const ticket = { createdAt: '2026-11-24T09:00:00Z' };
  assert.equal(ageState(ticket, at('2026-11-24T09:01:00Z')).tone, 'ok');
  assert.equal(ageState(ticket, at('2026-11-24T09:02:00Z')).tone, 'approaching');
  assert.deepEqual(ageState(ticket, at('2026-11-24T09:05:00Z')), { mins: 5, ratio: 1, tone: 'crashed' });
  assert.equal(isLate(ticket, at('2026-11-24T10:00:00Z'), null), false);
  // A clock behind the ticket never reads as negative age.
  assert.equal(ageState(ticket, at('2026-11-24T08:59:00Z')).mins, 0);
});

test('lateness comes from the workspace setting, else food defaults, and never for retail', () => {
  assert.deepEqual(latenessFor(null, 'menu'), { nearlyMins: 2, lateMins: 5 });
  assert.equal(latenessFor(null, 'retail'), null);
  assert.equal(latenessFor({ lateness: { off: true } }, 'menu'), null);
  assert.deepEqual(latenessFor({ lateness: { nearlyMins: 30, lateMins: 60 } }, 'retail'), { nearlyMins: 30, lateMins: 60 });
  // A "nearly" at or after "late" collapses onto it rather than never warning.
  assert.deepEqual(latenessFor({ lateness: { nearlyMins: 90, lateMins: 60 } }, 'menu'), { nearlyMins: 60, lateMins: 60 });
  assert.deepEqual(latenessFor({ lateness: { lateMins: 0 } }, 'menu'), { nearlyMins: 2, lateMins: 5 });
  assert.deepEqual(splitDuration(120), { amount: 2, unit: 'hours' });
  assert.deepEqual(splitDuration(2880), { amount: 2, unit: 'days' });
  assert.deepEqual(splitDuration(90), { amount: 90, unit: 'minutes' });
  assert.equal(joinDuration('1.5', 'hours'), 90);
  assert.equal(joinDuration('0', 'days'), null);
  assert.equal(durationLabel(1440), '1 day');
  assert.equal(durationLabel(5), '5 minutes');
  assert.deepEqual(latenessProblems(5, 5), { late: undefined, nearly: 'Sooner than “late”.' });
  assert.deepEqual(latenessProblems(null, null), { late: 'More than 0.', nearly: 'More than 0.' });
});

// ── My rota ──────────────────────────────────────────────────────────────────

const shift = (id: string, startsAt: string, endsAt: string, locationId = 'soho') => ({ id, locationId, startsAt, endsAt });

test('a shift is upcoming, now or done against the clock', () => {
  const s = shift('s', '2026-11-24T09:00:00Z', '2026-11-24T17:00:00Z');
  assert.equal(shiftState(s, at('2026-11-24T08:59:00Z')), 'upcoming');
  assert.equal(shiftState(s, at('2026-11-24T09:00:00Z')), 'now');
  assert.equal(shiftState(s, at('2026-11-24T17:00:00Z')), 'done');
  assert.equal(shiftProgress(s, at('2026-11-24T13:00:00Z')), 0.5);
  assert.equal(shiftProgress(s, at('2026-11-24T18:00:00Z')), null);
});

test('the unpaid break sits at the contract threshold and comes off paid minutes', () => {
  const rule = { thresholdMins: 360, unpaidMins: 30 };
  assert.deepEqual(unpaidBreak(480, rule), { from: 360, to: 390 });
  assert.deepEqual(unpaidBreak(370, rule), { from: 360, to: 370 });
  assert.equal(unpaidBreak(359, rule), null);
  assert.equal(unpaidBreak(480, { thresholdMins: 360, unpaidMins: 0 }), null);
  assert.equal(unpaidBreak(480, undefined), null);
  assert.equal(paidMinutes(shift('s', '2026-11-24T09:00:00Z', '2026-11-24T17:00:00Z'), rule), 450);
  assert.equal(paidMinutes(shift('s', '2026-11-24T09:00:00Z', '2026-11-24T13:00:00Z'), rule), 240);
  // An overnight shift across the clocks going back is nine real hours, not eight.
  assert.equal(paidMinutes(shift('s', '2026-10-24T21:00:00Z', '2026-10-25T06:00:00Z'), undefined), 540);
  assert.equal(formatDuration(475), '7h 55m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(480), '8h');
});

test('minutes on the clock count a running entry up to now and trust a recorded duration', () => {
  const now = at('2026-11-24T11:20:00Z');
  assert.equal(
    workedMinutes(
      [
        { id: 'a', locationId: 'soho', clockedIn: '2026-11-24T06:00:00Z', durationMinutes: 30 },
        { id: 'b', locationId: 'soho', clockedIn: '2026-11-24T10:00:00Z', clockedOut: '2026-11-24T10:45:00Z' },
        { id: 'c', locationId: 'soho', clockedIn: '2026-11-24T11:00:00Z' },
      ],
      now,
    ),
    95,
  );
});

test('clock-ins go to their own shift, else the one they touch, and the rest merge into runs', () => {
  const planned = [shift('morning', '2026-11-24T09:00:00Z', '2026-11-24T13:00:00Z'), shift('late', '2026-11-24T14:00:00Z', '2026-11-24T18:00:00Z')];
  const worked = [
    // Linked to the late shift by id, whatever its time.
    { id: 'linked', locationId: 'soho', clockedIn: '2026-11-24T20:00:00Z', clockedOut: '2026-11-24T20:05:00Z', scheduledShiftId: 'late' },
    // On the wrong till, but inside the morning's window from an hour early.
    { id: 'early', locationId: 'camden', clockedIn: '2026-11-24T08:10:00Z', clockedOut: '2026-11-24T12:55:00Z' },
    { id: 'extra1', locationId: 'soho', clockedIn: '2026-11-24T19:00:00Z', clockedOut: '2026-11-24T19:30:00Z' },
    { id: 'extra2', locationId: 'soho', clockedIn: '2026-11-24T20:10:00Z', clockedOut: '2026-11-24T21:00:00Z' },
    { id: 'night', locationId: 'soho', clockedIn: '2026-11-24T23:00:00Z' },
  ];
  const { byShift, unplanned } = assignWorked(planned, worked, at('2026-11-24T23:30:00Z'));
  assert.deepEqual(
    byShift.get('morning')?.map((w) => w.id),
    ['early'],
  );
  assert.deepEqual(
    byShift.get('late')?.map((w) => w.id),
    ['linked'],
  );
  assert.deepEqual(
    unplanned.map((run) => run.map((w) => w.id)),
    [['extra1', 'extra2'], ['night']],
  );

  // Two overlapping shifts: the same location wins over the larger overlap.
  const overlapping = [shift('here', '2026-11-24T10:00:00Z', '2026-11-24T11:00:00Z'), shift('there', '2026-11-24T09:00:00Z', '2026-11-24T17:00:00Z', 'camden')];
  const entry = { id: 'e', locationId: 'soho', clockedIn: '2026-11-24T09:00:00Z', clockedOut: '2026-11-24T17:00:00Z' };
  assert.deepEqual(
    assignWorked(overlapping, [entry], at('2026-11-24T18:00:00Z')).byShift.get('here')?.map((w) => w.id),
    ['e'],
  );
});

test('week offsets count calendar weeks across a clock change', () => {
  assert.equal(weekOffsetFor(new Date('2026-11-02T10:00:00Z'), new Date('2026-10-20T10:00:00Z')), 2);
  assert.equal(weekOffsetFor(new Date('2026-03-30T10:00:00Z'), new Date('2026-03-27T10:00:00Z')), 1);
  assert.equal(weekOffsetFor(new Date('2026-11-29T22:00:00Z'), new Date('2026-11-24T10:00:00Z')), 0);
  assert.equal(weekOffsetFor(new Date('2026-11-16T10:00:00Z'), new Date('2026-11-24T10:00:00Z')), -1);
});

test('leave on a day: standing requests only, approved first', () => {
  const leave = [
    { id: 'pending', startDate: '2026-11-23', endDate: '2026-11-25', status: 'pending' as const },
    { id: 'approved', startDate: '2026-11-24', endDate: '2026-11-24', status: 'approved' as const },
    { id: 'declined', startDate: '2026-11-24', endDate: '2026-11-24', status: 'declined' as const },
  ];
  assert.deepEqual(
    leaveOnDay(leave, new Date('2026-11-24T10:00:00Z')).map((l) => l.id),
    ['approved', 'pending'],
  );
  assert.deepEqual(leaveOnDay(leave, new Date('2026-11-26T10:00:00Z')), []);
});

test('rota changes since last look, and acknowledgement markers from the server', () => {
  const before = rotaSnapshot([{ ...shift('a', '2026-11-24T09:00:00Z', '2026-11-24T17:00:00Z'), role: 'Barista' }]);
  const now = [
    { ...shift('a', '2026-11-24T10:00:00Z', '2026-11-24T17:00:00Z'), role: 'Barista' },
    shift('b', '2026-11-25T09:00:00Z', '2026-11-25T17:00:00Z'),
  ];
  assert.deepEqual([...diffRota(before, now)], [
    ['a', 'changed'],
    ['b', 'new'],
  ]);
  assert.equal(diffRota(null, now).size, 0);

  assert.equal(acknowledgeMarker({ status: 'published' }), undefined);
  assert.equal(acknowledgeMarker({ status: 'published', acknowledgedAt: '2026-11-24T00:00:00Z', publishedAt: null }), null);
  assert.equal(acknowledgeMarker({ status: 'draft', acknowledgedAt: null, publishedAt: null }), null);
  assert.equal(
    acknowledgeMarker({ status: 'published', acknowledgedAt: null, createdAt: '2026-11-24T09:00:00Z', publishedAt: '2026-11-24T09:05:00Z' }),
    'new',
  );
  assert.equal(
    acknowledgeMarker({ status: 'published', acknowledgedAt: null, createdAt: '2026-11-24T09:00:00Z', publishedAt: '2026-11-24T10:00:00Z' }),
    'changed',
  );
});

// ── Trading day ──────────────────────────────────────────────────────────────

const hours = {
  mon: null,
  tue: { open: '08:00', close: '17:00' },
  wed: { open: '08:00', close: '17:00' },
  thu: { open: '08:00', close: '17:00' },
  fri: { open: '08:00', close: '17:00' },
  sat: { open: '18:00', close: '02:00' },
  sun: null,
} as unknown as NonNullable<Parameters<typeof resolveTradingDay>[0]>['openingHours'];
const site = { timezone: 'Europe/London', openingHours: hours };

test('the trading day is read in the site’s zone and hours', () => {
  const open = resolveTradingDay(site, new Date('2026-11-24T10:15:00Z'));
  assert.equal(open.state, 'trading');
  assert.equal(open.weekday, 'tue');
  assert.equal(open.progress, 135 / 540);
  assert.equal(tradingDayLabel(open), 'Open until 17:00');
  assert.equal(tradingDayLabel(resolveTradingDay(site, new Date('2026-11-24T07:00:00Z'))), 'Opens at 08:00');
  assert.equal(tradingDayLabel(resolveTradingDay(site, new Date('2026-11-24T17:00:00Z'))), 'Closed at 17:00');
  assert.equal(resolveTradingDay(site, new Date('2026-11-23T12:00:00Z')).state, 'closed-today');
  assert.equal(resolveTradingDay({ timezone: 'Europe/London' }, new Date('2026-11-24T12:00:00Z')).state, 'no-hours');
  // 07:30 UTC in July is 08:30 in London: open, though UTC would say it hadn't.
  assert.equal(resolveTradingDay(site, new Date('2026-07-01T07:30:00Z')).state, 'trading');
});

test('a late shift runs past midnight on the axis', () => {
  const day = resolveTradingDay(site, new Date('2026-11-28T23:00:00Z'));
  assert.equal(day.state, 'trading');
  assert.equal(day.closeMinutes, 26 * 60);
  assert.equal(isOvernight(day), true);
  assert.equal(axisNowMinutes(day), 23 * 60);
  assert.equal(day.progress, 5 / 8);
});

test('open 24/7 is the whole day, every day', () => {
  assert.equal(isAlwaysOpen(ALWAYS_OPEN_HOURS), true);
  assert.equal(isAlwaysOpen(hours), false);
  const day = resolveTradingDay({ timezone: 'Europe/London', openingHours: ALWAYS_OPEN_HOURS }, new Date('2026-11-23T03:00:00Z'));
  assert.equal(day.state, 'trading');
  assert.equal(day.closeMinutes, 1440);
});
