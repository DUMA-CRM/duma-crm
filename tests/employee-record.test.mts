import assert from 'node:assert/strict';
import test from 'node:test';

const { TICKET_STALE_DAYS, buildRecordAttention, openTicketsFor, ticketsForEmployee } = await import('../lib/utils/employee-record.ts');

type Check = NonNullable<Parameters<typeof buildRecordAttention>[0]['checks']>[number];
type Ticket = NonNullable<Parameters<typeof buildRecordAttention>[0]['tickets']>[number];

const NOW = new Date('2026-09-11T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const check = (over: Partial<Check> = {}): Check =>
  ({ id: 'pay', label: 'Pay setup', detail: 'Add a valid hourly rate.', complete: false, tone: 'warning', ...over }) as Check;

const ticket = (over: Partial<Ticket> = {}): Ticket =>
  ({
    id: 't1',
    subject: 'Payslip query',
    category: 'hr',
    priority: 'normal',
    status: 'open',
    createdBy: 'u1',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...over,
  }) as Ticket;

const idsOf = (items: { id: string }[]) => items.map((item) => item.id);

// ── Compliance checks ────────────────────────────────────────────────────────

test('a complete check says nothing', () => {
  const items = buildRecordAttention({ now: NOW, checks: [check({ complete: true, tone: 'success' })] });
  assert.deepEqual(items, []);
});

test('a success-toned check contributes no row even when incomplete', () => {
  // The two cannot disagree in practice; if they ever do, silence is safer
  // than inventing a problem.
  assert.deepEqual(buildRecordAttention({ now: NOW, checks: [check({ tone: 'success' })] }), []);
});

test('destructive maps to blocking, warning to attention', () => {
  const items = buildRecordAttention({
    now: NOW,
    checks: [check({ id: 'statutory', tone: 'warning' }), check({ id: 'right-to-work', tone: 'destructive' })],
  });
  // Worst first, regardless of the order they arrive in.
  assert.deepEqual(idsOf(items), ['check-right-to-work', 'check-statutory']);
  assert.equal(items[0].severity, 'blocking');
  assert.equal(items[1].severity, 'attention');
});

test('each check names where it is fixed', () => {
  const targets = Object.fromEntries(
    buildRecordAttention({
      now: NOW,
      checks: [
        check({ id: 'right-to-work' }),
        check({ id: 'contract' }),
        check({ id: 'access' }),
        check({ id: 'pay' }),
        check({ id: 'statutory' }),
        check({ id: 'profile' }),
      ],
    }).map((item) => [item.id, item.target]),
  );
  assert.equal(targets['check-right-to-work'], 'documents');
  assert.equal(targets['check-contract'], 'documents');
  assert.equal(targets['check-access'], 'access');
  assert.equal(targets['check-pay'], 'edit');
  assert.equal(targets['check-statutory'], 'edit');
  assert.equal(targets['check-profile'], 'edit');
});

test('an unrecognised check still lands somewhere actionable', () => {
  const items = buildRecordAttention({ now: NOW, checks: [check({ id: 'something-new' })] });
  assert.equal(items[0].target, 'edit');
  assert.ok(items[0].actionLabel.length > 0);
});

// ── Tickets ──────────────────────────────────────────────────────────────────

test('tickets are narrowed to the employee and sorted newest first', () => {
  const all = [
    ticket({ id: 'a', createdBy: 'u1', createdAt: daysAgo(3) }),
    ticket({ id: 'b', createdBy: 'u2' }),
    ticket({ id: 'c', createdBy: 'u1', createdAt: daysAgo(1) }),
  ];
  assert.deepEqual(ticketsForEmployee(all, 'u1').map((t) => t.id), ['c', 'a']);
});

test('resolved and closed tickets are not open', () => {
  const all = [ticket(), ticket({ id: 't2', status: 'resolved' }), ticket({ id: 't3', status: 'closed' })];
  assert.deepEqual(openTicketsFor(all).map((t) => t.id), ['t1']);
});

test('a request waiting on the employee is surfaced with its subject', () => {
  const items = buildRecordAttention({
    now: NOW,
    tickets: [ticket({ status: 'waiting_employee', subject: 'Send your P45' })],
  });
  assert.deepEqual(idsOf(items), ['tickets-waiting-employee']);
  assert.match(items[0].title, /A request is waiting on this employee/);
  assert.equal(items[0].detail, 'Send your P45');
});

test('a stale request is reported separately from one waiting on the employee', () => {
  // Different problems: one needs chasing, the other needs answering.
  const items = buildRecordAttention({
    now: NOW,
    tickets: [
      ticket({ id: 'w', status: 'waiting_employee' }),
      ticket({ id: 's', status: 'open', createdAt: daysAgo(TICKET_STALE_DAYS) }),
    ],
  });
  assert.deepEqual(idsOf(items), ['tickets-waiting-employee', 'tickets-stale']);
});

test('a ticket waiting on the employee is never also counted as stale', () => {
  const items = buildRecordAttention({
    now: NOW,
    tickets: [ticket({ status: 'waiting_employee', createdAt: daysAgo(30) })],
  });
  assert.deepEqual(idsOf(items), ['tickets-waiting-employee']);
});

test('a fresh open request is not worth a row', () => {
  assert.deepEqual(buildRecordAttention({ now: NOW, tickets: [ticket({ createdAt: daysAgo(1) })] }), []);
});

test('a capability not held contributes no row, rather than a zero', () => {
  // `undefined` means "not fetched", which is not the same as "nothing found".
  assert.deepEqual(buildRecordAttention({ now: NOW }), []);
});

test('compliance outranks correspondence', () => {
  const items = buildRecordAttention({
    now: NOW,
    checks: [check({ id: 'right-to-work', tone: 'destructive' })],
    tickets: [ticket({ status: 'waiting_employee' })],
  });
  assert.deepEqual(idsOf(items), ['check-right-to-work', 'tickets-waiting-employee']);
});
