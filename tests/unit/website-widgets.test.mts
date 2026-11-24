import assert from 'node:assert/strict';
import test from 'node:test';

import { fortnightReading, todaySoFar, topRows, webWindows } from '../../lib/dashboard/website-widgets.ts';

const ZONE = 'Europe/London';

test('windows: whole days in the workspace zone, the fortnight ending yesterday', () => {
  // 00:30 on 1 July in London is still 30 June in UTC.
  const windows = webWindows(new Date('2026-06-30T23:30:00Z'), ZONE);
  assert.equal(windows.today, '2026-07-01');
  assert.equal(windows.yesterday, '2026-06-30');
  assert.deepEqual(windows.todayWindow, { from: '2026-06-30T23:00:00.000Z', to: '2026-07-01T22:59:59.999Z' });
  assert.equal(windows.week.keys[0], '2026-06-25');
  assert.equal(windows.week.window.from, '2026-06-24T23:00:00.000Z');
  assert.equal(windows.fortnight.current.length, 14);
  assert.equal(windows.fortnight.current.at(-1), '2026-06-30');
  assert.equal(windows.fortnight.previous.at(-1), '2026-06-16');
  assert.equal(windows.fortnight.window.from, '2026-06-02T23:00:00.000Z');
  assert.equal(windows.fortnight.window.to, '2026-06-30T22:59:59.999Z');
});

test('today against yesterday to the same minute, the current hour prorated', () => {
  const reading = todaySoFar({
    todayRows: [
      { hour: '2026-11-24 09', visitors: 10, pageviews: 30 },
      { hour: '2026-11-24 14', visitors: 4, pageviews: 8 },
    ],
    yesterdayRows: [
      { hour: '2026-11-23 09', visitors: 6, pageviews: 20 },
      { hour: '2026-11-23 14', visitors: 8, pageviews: 16 },
      // After the same time yesterday: not in the comparison.
      { hour: '2026-11-23 18', visitors: 50, pageviews: 90 },
    ],
    today: '2026-11-24',
    yesterday: '2026-11-23',
    // 14:30 in London (GMT in November).
    now: new Date('2026-11-24T14:30:00Z'),
    timeZone: ZONE,
  });
  assert.equal(reading.compared, 'same-time');
  assert.equal(reading.visitors, 14);
  assert.equal(reading.pageviews, 38);
  // 6 before 14:00, then half of 14:00's 8.
  assert.deepEqual(reading.then, { visitors: 10, pageviews: 28 });
  assert.equal(reading.visitorsChange?.ratio, 0.4);
  assert.equal(reading.hours[15]!.future, true);
  assert.equal(reading.hours[14]!.future, false);
});

test('today without yesterday’s hours falls back to yesterday’s whole day, and says so', () => {
  const reading = todaySoFar({
    todayRows: [{ hour: '2026-11-24 09', visitors: 5, pageviews: 9 }],
    yesterdayRows: null,
    yesterdayTotal: { visitors: 20, pageviews: 0 },
    today: '2026-11-24',
    yesterday: '2026-11-23',
    now: new Date('2026-11-24T10:00:00Z'),
    timeZone: ZONE,
  });
  assert.equal(reading.compared, 'day');
  assert.equal(reading.visitorsChange?.ratio, -0.75);
  // From zero is new, not infinite.
  assert.deepEqual(reading.pageviewsChange, { change: 9, ratio: null });
});

test('fortnight: visitors a day on average against the fortnight before; no comparison with no history', () => {
  const current = ['2026-11-22', '2026-11-23'];
  const previous = ['2026-11-20', '2026-11-21'];
  const reading = fortnightReading(
    [
      { date: '2026-11-20', visitors: 10, pageviews: 20 },
      { date: '2026-11-22', visitors: 12, pageviews: 30 },
      { date: '2026-11-23', visitors: 18, pageviews: 30 },
    ],
    current,
    previous,
  );
  assert.equal(reading.perDay, 15);
  assert.equal(reading.perDayChange?.ratio, 2);
  assert.equal(reading.pageviewsChange?.ratio, 2);
  assert.equal(reading.busiest?.date, '2026-11-23');

  const fresh = fortnightReading([{ date: '2026-11-23', visitors: 3, pageviews: 4 }], current, previous);
  assert.equal(fresh.perDayChange, null);
});

test('top rows: biggest first, shares of the whole, the rest counted', () => {
  const top = topRows(
    [
      { key: '/menu', value: 30 },
      { key: '/', value: 60 },
      { key: '/book', value: 10 },
      { key: '/gone', value: 0 },
    ],
    2,
  );
  assert.deepEqual(
    top.rows.map((row) => [row.key, row.share, row.ofMax]),
    [
      ['/', 0.6, 1],
      ['/menu', 0.3, 0.5],
    ],
  );
  assert.equal(top.more, 1);
  assert.equal(top.total, 100);
});
