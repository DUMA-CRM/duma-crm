import assert from 'node:assert/strict';
import test from 'node:test';

import { leaveContext, leaveFlag, summariseLeaveQueue } from '../../lib/utils/leave-review.ts';

const request = {
  id: 'r1',
  userId: 'u1',
  startDate: '2026-11-18',
  endDate: '2026-11-20',
  totalDays: '3',
  status: 'pending',
  leaveType: { id: 'annual' },
  employee: { name: 'Ana' },
};

test('a pending request counts against the remaining allowance; clashes ignore the requester', () => {
  const context = leaveContext(request, {
    approved: [
      { ...request, id: 'r2', userId: 'u2', status: 'approved', startDate: '2026-11-20', endDate: '2026-11-21', employee: { name: 'Ben' } },
      { ...request, id: 'r3', userId: 'u1', status: 'approved' },
      { ...request, id: 'r4', userId: 'u3', status: 'approved', startDate: '2026-11-21', endDate: '2026-11-22', employee: { name: 'Cy' } },
    ],
    shifts: [
      { userId: 'u1', startsAt: '2026-11-19T09:00:00Z', status: 'published' },
      { userId: 'u1', startsAt: '2026-11-19T17:00:00Z', status: 'cancelled' },
      { userId: 'u2', startsAt: '2026-11-19T09:00:00Z', status: 'published' },
    ],
    entitlements: [{ userId: 'u1', year: 2026, totalDays: '20', usedDays: '18', leaveType: { id: 'annual' } }],
  });
  assert.deepEqual(context, { alsoOff: ['Ben'], shiftsDuring: 1, balance: { total: 20, remaining: 2, after: -1 } });
});

test('the row leads with over-allowance, then cover, then clashes, then the wait', () => {
  const clear = { alsoOff: [], shiftsDuring: 0, balance: { total: 20, remaining: 10, after: 7 } };
  assert.deepEqual(leaveFlag({ ...clear, balance: { total: 20, remaining: 2, after: -1 }, shiftsDuring: 2 }, 0, false), {
    label: '1 day over allowance',
    tone: 'exception',
    urgency: 'exception',
  });
  assert.deepEqual(leaveFlag({ ...clear, shiftsDuring: 2, alsoOff: ['Ben'] }, 6, false), {
    label: '2 shifts to cover',
    tone: 'warning',
    urgency: 'exception',
  });
  assert.equal(leaveFlag({ ...clear, alsoOff: ['Ben'] }, 0, false).label, '1 also off');
  // While the rota and approved leave load, a clash is unknown — never "clear".
  assert.equal(leaveFlag({ ...clear, alsoOff: ['Ben'] }, 0, true).label, 'New today');
  assert.deepEqual(leaveFlag(clear, 1, false), { label: 'Waiting 1 day', tone: 'warning', urgency: 'warning' });
  assert.deepEqual(leaveFlag(null, 5, false), { label: 'Waiting 5 days', tone: 'exception', urgency: 'exception' });
});

test('the queue summary counts only pending requests and the coming seven days', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const summary = summariseLeaveQueue(
    [
      { status: 'pending', startDate: '2026-11-15', totalDays: '1', createdAt: '2026-11-15T08:00:00Z' },
      { status: 'pending', startDate: '2026-11-21', totalDays: '2.5', createdAt: '2026-11-09T11:00:00Z' },
      { status: 'pending', startDate: '2026-11-22', totalDays: '3', createdAt: '2026-11-12T12:00:00Z' },
      { status: 'approved', startDate: '2026-11-16', totalDays: '4', createdAt: '2026-10-01T00:00:00Z' },
    ],
    now,
    '2026-11-15',
  );
  assert.deepEqual(summary, { waiting: 3, longestWait: 6, startingSoon: 2, days: 6.5 });
});
