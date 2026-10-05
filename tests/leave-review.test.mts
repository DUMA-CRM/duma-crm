import assert from 'node:assert/strict';
import test from 'node:test';

const { leaveContext } = await import('../lib/utils/leave-review.ts');

const leave = (id: string, userId: string, startDate: string, endDate: string, over: Record<string, unknown> = {}) => ({
  id,
  userId,
  startDate,
  endDate,
  totalDays: '3',
  status: 'pending',
  leaveType: { id: 'annual' },
  employee: { name: userId.toUpperCase() },
  ...over,
});

const request = leave('r1', 'sam', '2026-10-05', '2026-10-07');

test('someone else off on any of the same days is a clash; the same person is not', () => {
  const context = leaveContext(request, {
    approved: [
      leave('a1', 'mia', '2026-10-07', '2026-10-09', { status: 'approved' }),
      leave('a2', 'kai', '2026-10-08', '2026-10-10', { status: 'approved' }),
      leave('a3', 'sam', '2026-10-01', '2026-10-06', { status: 'approved' }),
    ],
    shifts: [],
    entitlements: null,
  });
  assert.deepEqual(context.alsoOff, ['MIA']);
});

test('their own non-cancelled shifts inside the leave need cover', () => {
  const context = leaveContext(request, {
    approved: [],
    shifts: [
      { userId: 'sam', startsAt: '2026-10-05T09:00:00Z', status: 'published' },
      { userId: 'sam', startsAt: '2026-10-07T09:00:00Z', status: 'draft' },
      { userId: 'sam', startsAt: '2026-10-06T09:00:00Z', status: 'cancelled' },
      { userId: 'sam', startsAt: '2026-10-08T09:00:00Z', status: 'published' },
      { userId: 'mia', startsAt: '2026-10-05T09:00:00Z', status: 'published' },
    ],
    entitlements: null,
  });
  assert.equal(context.shiftsDuring, 2);
});

test('the balance after a pending request takes its days off what is left', () => {
  const entitlements = [{ userId: 'sam', year: 2026, totalDays: '28', usedDays: '10', leaveType: { id: 'annual' } }];
  assert.deepEqual(leaveContext(request, { approved: [], shifts: [], entitlements }).balance, { total: 28, remaining: 18, after: 15 });
  const approved = { ...request, status: 'approved' };
  assert.deepEqual(leaveContext(approved, { approved: [], shifts: [], entitlements }).balance, { total: 28, remaining: 18, after: 18 });
});

test('no entitlement on file means no balance, not zero', () => {
  assert.equal(leaveContext(request, { approved: [], shifts: [], entitlements: [] }).balance, null);
});
