import assert from 'node:assert/strict';
import test from 'node:test';

const { requestDeadline, sortQueue, summariseQueue } = await import('../lib/utils/privacy-deadline.ts');

const now = new Date(2026, 8, 25, 14, 0).getTime();
const at = (month: number, day: number, hour = 10) => new Date(2026, month - 1, day, hour).toISOString();
const request = (dueAt: string, over: Record<string, unknown> = {}) => ({ receivedAt: at(8, 25), dueAt, status: 'received', ...over });

test('the deadline reads in days, counted by calendar day', () => {
  assert.deepEqual(
    [at(10, 7), at(9, 30), at(9, 26), at(9, 25, 9), at(9, 22)].map((due) => requestDeadline(request(due), now).label),
    ['Due in 12 days', 'Due in 5 days', 'Due tomorrow', 'Due today', '3 days overdue'],
  );
});

test('a week out is "soon"; a closed request is simply closed', () => {
  assert.equal(requestDeadline(request(at(10, 2)), now).tone, 'soon');
  assert.equal(requestDeadline(request(at(10, 3)), now).tone, 'calm');
  assert.equal(requestDeadline(request(at(9, 1), { status: 'completed' }), now).tone, 'done');
});

test('time used runs from receipt to the deadline', () => {
  const halfway = requestDeadline({ receivedAt: at(9, 15, 14), dueAt: at(10, 5, 14), status: 'in_progress' }, now);
  assert.ok(Math.abs(halfway.used - 0.5) < 0.02);
});

test('the summary counts open, due soon, overdue and recently closed', () => {
  const summary = summariseQueue(
    [
      request(at(10, 20)),
      request(at(9, 28)),
      request(at(9, 20)),
      request(at(9, 1), { status: 'completed', completedAt: at(9, 10) }),
      request(at(6, 1), { status: 'declined', completedAt: at(6, 1) }),
    ],
    now,
  );
  assert.deepEqual(summary, { open: 3, dueSoon: 1, overdue: 1, closedRecently: 1 });
});

test('open work comes first by deadline, then closed work newest first', () => {
  const sorted = sortQueue([
    { id: 'closed-old', ...request(at(6, 1), { status: 'completed', completedAt: at(6, 2) }) },
    { id: 'late', ...request(at(10, 20)) },
    { id: 'soon', ...request(at(9, 27)) },
    { id: 'closed-new', ...request(at(9, 1), { status: 'declined', completedAt: at(9, 20) }) },
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['soon', 'late', 'closed-new', 'closed-old'],
  );
});
