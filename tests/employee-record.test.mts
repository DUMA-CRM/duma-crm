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

// ── Length of service and the statutory ID's name ────────────────────────────

{
  const { lengthOfService, statutoryIdLabel } = await import('../lib/utils/employee-record.ts');
  const at = new Date('2026-09-26T15:00:00Z');

  test('length of service reads like a person says it', () => {
    assert.equal(lengthOfService('2026-09-26', at), 'Started today');
    assert.equal(lengthOfService('2026-09-25', at), '1 day');
    assert.equal(lengthOfService('2026-09-10', at), '2 weeks');
    assert.equal(lengthOfService('2026-08-26', at), '1 month');
    assert.equal(lengthOfService('2026-02-27', at), '6 months');
    assert.equal(lengthOfService('2025-09-26', at), '1 yr');
    assert.equal(lengthOfService('2024-05-01', at), '2 yrs 4 mos');
    assert.equal(lengthOfService('2025-08-01', at), '1 yr 1 mo');
  });

  test('a start on the 31st counts whole calendar months', () => {
    assert.equal(lengthOfService('2026-01-31', new Date('2026-03-01T09:00:00Z')), '1 month');
    assert.equal(lengthOfService('2026-01-31', new Date('2026-02-28T09:00:00Z')), '4 weeks');
  });

  test('a start in the future or an unreadable date has no service', () => {
    assert.equal(lengthOfService('2026-10-01', at), null);
    assert.equal(lengthOfService('not a date', at), null);
  });

  test('the statutory ID is named for the payroll country, neutrally elsewhere', () => {
    assert.equal(statutoryIdLabel('GB'), 'National Insurance');
    assert.equal(statutoryIdLabel('US'), 'SSN');
    assert.equal(statutoryIdLabel('PL'), 'PESEL');
    assert.equal(statutoryIdLabel(null), 'Tax / social ID');
    assert.equal(statutoryIdLabel('BR'), 'Tax / social ID');
  });
}

// ── The UK wage rule stays in the UK ─────────────────────────────────────────

{
  const { ageBasedMinimumWage, employeeSetupChecks } = await import('../lib/utils/employee-compliance.ts');
  const on = new Date('2026-09-26T12:00:00Z');
  const employee = { payType: 'hourly', hourlyRate: '9.00', dateOfBirth: '1990-01-01', hasNiNumber: false } as never;
  const member = { scope: 'global', locationIds: [] } as never;
  const pay = (country: string | null) => employeeSetupChecks(member, employee, [], on, country).find((check) => check.id === 'pay');

  test('the UK minimum wage applies in the UK and where no country is set', () => {
    assert.equal(ageBasedMinimumWage('1990-01-01', on, 'GB')?.rate, 12.71);
    assert.equal(ageBasedMinimumWage('1990-01-01', on)?.rate, 12.71);
    assert.equal(pay('GB')?.tone, 'destructive');
    assert.equal(pay(null)?.tone, 'destructive');
  });

  test('elsewhere the rate is not judged against a UK threshold', () => {
    assert.equal(ageBasedMinimumWage('1990-01-01', on, 'UA'), null);
    assert.equal(pay('UA')?.complete, true);
    assert.doesNotMatch(pay('PL')?.detail ?? '', /£/);
  });

  test('the payroll identity check names the local ID', () => {
    const identity = employeeSetupChecks(member, employee, [], on, 'US').find((check) => check.id === 'statutory');
    assert.match(identity?.detail ?? '', /SSN/);
    assert.doesNotMatch(identity?.detail ?? '', /NI number|P45/);
  });
}

// ── Working days and the requests summary ────────────────────────────────────

{
  const { recordRequestList, workingDaysLabel } = await import('../lib/utils/employee-record.ts');

  test('working days collapse runs of three or more into a range', () => {
    assert.equal(workingDaysLabel([1, 2, 3, 4, 5]), 'Mon–Fri');
    assert.equal(workingDaysLabel([5, 4, 2, 1]), 'Mon, Tue, Thu, Fri');
    assert.equal(workingDaysLabel([1, 2, 3, 5, 6, 7]), 'Mon–Wed, Fri–Sun');
    assert.equal(workingDaysLabel([6, 7]), 'Sat, Sun');
    assert.equal(workingDaysLabel([1, 2, 3, 4, 5, 6, 7]), 'Every day');
    assert.equal(workingDaysLabel([]), null);
  });

  test('the requests panel lists open first, then the newest closed, capped', () => {
    const t = (id: string, status: string, day: number) => ({ id, status, createdAt: `2026-09-${String(day).padStart(2, '0')}T09:00:00Z` }) as never;
    const list = recordRequestList([t('a', 'resolved', 20), t('b', 'open', 1), t('c', 'waiting_employee', 10), t('d', 'in_progress', 5), t('e', 'closed', 25)], 4);
    assert.deepEqual(
      list.map((ticket: { id: string }) => ticket.id),
      ['d', 'b', 'c', 'e'],
    );
  });
}

// ── Month ranges are local dates ─────────────────────────────────────────────

{
  const { monthRangeOf } = await import('../lib/utils/employee-record.ts');

  test('a month runs from its own 1st to its last day, whatever the timezone', () => {
    const now = new Date(2026, 8, 26, 10, 0);
    assert.deepEqual({ ...monthRangeOf(now, 0), label: undefined }, { from: '2026-09-01', to: '2026-09-30', label: undefined });
    assert.equal(monthRangeOf(now, 1).from, '2026-08-01');
    assert.equal(monthRangeOf(now, 1).to, '2026-08-31');
    assert.equal(monthRangeOf(new Date(2026, 2, 15), 1).to, '2026-02-28');
    assert.equal(monthRangeOf(new Date(2026, 0, 10), 1).from, '2025-12-01');
  });
}
