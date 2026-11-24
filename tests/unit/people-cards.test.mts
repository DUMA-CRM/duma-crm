import assert from 'node:assert/strict';
import test from 'node:test';

// The privacy deadline counts calendar days on the local clock; pin it.
process.env.TZ = 'Europe/London';

const { leaveQueue, openTickets, privacyQueue } = await import('../../lib/dashboard/people-cards.ts');

const NOW = new Date('2026-11-24T12:00:00Z');

test('privacy: open requests only, soonest statutory deadline first, split overdue / due this week / on time', () => {
  const request = (id: string, receivedAt: string, dueAt: string, status = 'received') => ({ id, receivedAt, dueAt, status });
  const { rows, counts } = privacyQueue(
    [
      request('calm', '2026-11-20T09:00:00Z', '2026-12-20T09:00:00Z'),
      request('overdue', '2026-10-20T09:00:00Z', '2026-11-20T09:00:00Z', 'in_progress'),
      request('today', '2026-10-24T09:00:00Z', '2026-11-24T18:00:00Z', 'awaiting_identity'),
      request('soon', '2026-10-29T09:00:00Z', '2026-11-29T09:00:00Z'),
      request('done', '2026-10-01T09:00:00Z', '2026-11-01T09:00:00Z', 'completed'),
      request('declined', '2026-10-01T09:00:00Z', '2026-11-02T09:00:00Z', 'declined'),
    ],
    NOW.getTime(),
  );
  assert.deepEqual(
    rows.map((row) => [row.request.id, row.deadline.label]),
    [
      ['overdue', '4 days overdue'],
      ['today', 'Due today'],
      ['soon', 'Due in 5 days'],
      ['calm', 'Due in 26 days'],
    ],
  );
  assert.deepEqual(counts, { overdue: 1, soon: 2, calm: 1 });
});

const leave = (
  id: string,
  userId: string,
  startDate: string,
  endDate: string,
  totalDays: string,
  createdAt: string,
  status = 'pending',
) => ({
  id,
  userId,
  startDate,
  endDate,
  totalDays,
  status,
  createdAt,
  leaveType: { id: 'annual' },
  employee: { name: id },
});

test('time off: over allowance leads, then clashes, then the calm ones by start date; decided requests drop out', () => {
  const pending = [
    leave('calm-late', 'u1', '2026-12-20', '2026-12-20', '1', '2026-11-24T08:00:00Z'),
    leave('calm-early', 'u2', '2026-12-01', '2026-12-01', '1', '2026-11-24T08:00:00Z'),
    leave('clash', 'u3', '2026-12-10', '2026-12-11', '2', '2026-11-24T08:00:00Z'),
    leave('over', 'u4', '2026-12-15', '2026-12-19', '5', '2026-11-24T08:00:00Z'),
    leave('gone', 'u5', '2026-12-15', '2026-12-19', '5', '2026-11-24T08:00:00Z', 'approved'),
  ];
  const others = {
    approved: [leave('off', 'u9', '2026-12-11', '2026-12-12', '2', '2026-11-01T08:00:00Z', 'approved')],
    shifts: [],
    entitlements: [{ userId: 'u4', year: 2026, totalDays: '20', usedDays: '18', leaveType: { id: 'annual' } }],
  };
  const queue = leaveQueue(pending, others, NOW, false);
  assert.deepEqual(
    queue.rows.map((row) => [row.request.id, row.flag.label]),
    [
      ['over', '3 days over allowance'],
      ['clash', '1 also off'],
      ['calm-early', 'New today'],
      ['calm-late', 'New today'],
    ],
  );
  assert.deepEqual(queue.counts, { exception: 1, warning: 1, calm: 2 });
  assert.equal(queue.days, 9);

  // While approved leave and the rota are still being read, a clash isn't claimed clear — or flagged.
  const checking = leaveQueue(pending, others, NOW, true);
  assert.equal(checking.rows.find((row) => row.request.id === 'clash')?.flag.label, 'New today');
  assert.equal(checking.rows[0].flag.label, '3 days over allowance');
});

test('helpdesk: open tickets only, oldest first; urgent is red, high or untouched three days amber', () => {
  const ticket = (
    id: string,
    priority: 'urgent' | 'high' | 'normal' | 'low',
    createdAt: string,
    updatedAt = createdAt,
    status = 'open' as const,
  ) => ({
    id,
    priority,
    createdAt,
    updatedAt,
    status,
  });
  const { rows, counts, oldestDays } = openTickets(
    [
      ticket('fresh', 'normal', '2026-11-24T09:00:00Z'),
      ticket('urgent', 'urgent', '2026-11-23T09:00:00Z'),
      ticket('stale', 'low', '2026-11-18T09:00:00Z', '2026-11-20T09:00:00Z'),
      ticket('high', 'high', '2026-11-22T09:00:00Z'),
      { ...ticket('working', 'urgent', '2026-11-01T09:00:00Z'), status: 'in_progress' as const },
    ],
    NOW.getTime(),
  );
  assert.deepEqual(
    rows.map((row) => [row.ticket.id, row.urgency]),
    [
      ['stale', 'warning'],
      ['high', 'warning'],
      ['urgent', 'exception'],
      ['fresh', 'calm'],
    ],
  );
  assert.deepEqual(counts, { exception: 1, warning: 2, calm: 1 });
  assert.equal(oldestDays, 6);
});
