import assert from 'node:assert/strict';
import test from 'node:test';

const { DONE_LIMIT, buildBoard, columnOf, ticketAge } = await import('../lib/utils/helpdesk-board.ts');

const ticket = (id: string, status: string, priority: string, createdAt: string, updatedAt = createdAt) =>
  ({ id, status, priority, createdAt, updatedAt }) as Parameters<typeof buildBoard>[0][number];

test('resolved and closed share the Done column; the rest are their own', () => {
  assert.equal(columnOf('resolved'), 'done');
  assert.equal(columnOf('closed'), 'done');
  assert.equal(columnOf('waiting_employee'), 'waiting_employee');
});

test('open work is most urgent first, then the longest waiting', () => {
  const { columns } = buildBoard([
    ticket('a', 'open', 'normal', '2026-09-20'),
    ticket('b', 'open', 'urgent', '2026-09-24'),
    ticket('c', 'open', 'normal', '2026-09-18'),
  ]);
  assert.deepEqual(
    columns[0].tickets.map((item: { id: string }) => item.id),
    ['b', 'c', 'a'],
  );
});

test('done is newest first and capped, with the overflow counted', () => {
  const many = Array.from({ length: DONE_LIMIT + 3 }, (_, index) =>
    ticket(
      `d${index}`,
      'closed',
      'low',
      '2026-01-01',
      `2026-09-${String((index % 28) + 1).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:00:00Z`,
    ),
  );
  const { columns, hiddenDone } = buildBoard(many);
  assert.equal(columns[3].tickets.length, DONE_LIMIT);
  assert.equal(hiddenDone, 3);
  const updated = columns[3].tickets.map((item: { updatedAt: string }) => item.updatedAt);
  assert.deepEqual(updated, [...updated].sort().reverse());
});

test('an open ticket untouched for three days is stale; a done one never is', () => {
  const now = new Date('2026-09-25T12:00:00Z').getTime();
  assert.deepEqual(ticketAge({ status: 'open', updatedAt: '2026-09-22T11:00:00Z' }, now), { days: 3, stale: true });
  assert.deepEqual(ticketAge({ status: 'resolved', updatedAt: '2026-09-01T11:00:00Z' }, now).stale, false);
});
