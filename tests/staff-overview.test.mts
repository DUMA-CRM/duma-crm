import assert from 'node:assert/strict';
import test from 'node:test';

const {
  LEAVE_STALE_DAYS,
  TICKET_STALE_DAYS,
  buildStaffAttention,
  coreSetupChecks,
  daysBetween,
  noShows,
  oldestAgeDays,
  openTickets,
  pendingLeave,
  teamRecordState,
  unpublishedShifts,
} = await import('../lib/utils/staff-overview.ts');

type RecordState = ReturnType<typeof teamRecordState>;
type Staff = Parameters<typeof teamRecordState>[0][number];
type Employee = Parameters<typeof teamRecordState>[1][number];
type Leave = NonNullable<Parameters<typeof buildStaffAttention>[0]['leave']>[number];
type Ticket = NonNullable<Parameters<typeof buildStaffAttention>[0]['tickets']>[number];

const NOW = new Date('2026-09-10T12:00:00Z');

const member = (over: Partial<Staff> = {}): Staff =>
  ({
    id: 's1',
    userId: 'u1',
    tenantId: 't1',
    name: 'Alex Doe',
    role: 'barista',
    scope: 'tenant',
    isActive: true,
    createdAt: '2025-01-06T09:00:00Z',
    ...over,
  }) as Staff;

// Payable and complete — each test breaks exactly one thing.
const employee = (over: Partial<Employee> = {}): Employee =>
  ({
    id: 'e1',
    userId: 'u1',
    tenantId: 't1',
    jobTitle: 'Barista',
    employmentType: 'full_time',
    startDate: '2025-01-06',
    dateOfBirth: '1996-01-01',
    isActive: true,
    createdAt: '2025-01-06T09:00:00Z',
    updatedAt: '2025-01-06T09:00:00Z',
    payType: 'hourly',
    hourlyRate: '13.50',
    hasNiNumber: true,
    ...over,
  }) as Employee;

const leaveRequest = (over: Partial<Leave> = {}): Leave =>
  ({
    id: 'l1',
    userId: 'u1',
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    totalDays: '3',
    status: 'pending',
    leaveType: { id: 'lt1', name: 'Annual Leave' },
    createdAt: NOW.toISOString(),
    ...over,
  }) as Leave;

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

const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

// ── daysBetween ──────────────────────────────────────────────────────────────

test('daysBetween floors to whole elapsed days', () => {
  assert.equal(daysBetween(daysAgo(0), NOW), 0);
  assert.equal(daysBetween(daysAgo(2), NOW), 2);
  // 47 hours is not yet two days.
  assert.equal(daysBetween(new Date(NOW.getTime() - 47 * 3_600_000).toISOString(), NOW), 1);
});

// ── coreSetupChecks ──────────────────────────────────────────────────────────

test('coreSetupChecks drops the two checks derived from documents', () => {
  const ids = coreSetupChecks(member(), employee(), NOW).map((check) => check.id);
  assert.deepEqual(ids, ['profile', 'pay', 'statutory', 'access']);
});

// ── teamRecordState ──────────────────────────────────────────────────────────

test('a complete active record is neither unpayable nor incomplete', () => {
  const state = teamRecordState([member()], [employee()], NOW);
  assert.deepEqual(state.unpayable, []);
  assert.deepEqual(state.incomplete, []);
  assert.equal(state.averageProgress, 100);
});

test('a member with no employment record cannot be paid', () => {
  const state = teamRecordState([member()], [], NOW);
  assert.equal(state.unpayable.length, 1);
  assert.equal(state.incomplete.length, 0);
});

test('a member with a record but no pay basis cannot be paid', () => {
  const state = teamRecordState([member()], [employee({ payType: undefined, hourlyRate: null })], NOW);
  assert.equal(state.unpayable.length, 1);
});

test('a payable record missing only an NI number counts as incomplete, not unpayable', () => {
  const state = teamRecordState([member()], [employee({ hasNiNumber: false })], NOW);
  assert.deepEqual(state.unpayable, []);
  assert.equal(state.incomplete.length, 1);
  assert.ok(state.averageProgress < 100);
});

test('a location-scoped account with no location assigned is incomplete', () => {
  const state = teamRecordState([member({ scope: 'location', locationIds: [] })], [employee()], NOW);
  assert.equal(state.incomplete.length, 1);
});

test('inactive members are ignored entirely', () => {
  const state = teamRecordState([member({ isActive: false })], [], NOW);
  assert.deepEqual(state.unpayable, []);
  assert.deepEqual(state.incomplete, []);
  // Nothing to score, so nothing is wrong.
  assert.equal(state.averageProgress, 100);
});

test('an hourly rate below the age-based minimum is flagged', () => {
  // Age 30 on the reference date: the 21-and-over rate of £12.71 applies.
  const state = teamRecordState([member()], [employee({ hourlyRate: '11.00' })], NOW);
  assert.equal(state.belowMinimumWage.length, 1);
});

test('an 18-year-old on the 18-20 rate is not flagged against the adult rate', () => {
  const state = teamRecordState([member()], [employee({ dateOfBirth: '2008-01-01', hourlyRate: '11.00' })], NOW);
  assert.deepEqual(state.belowMinimumWage, []);
});

test('a zero rate is unpayable rather than below the minimum', () => {
  // "No rate recorded" and "underpaid" are different problems with different
  // fixes, and reporting both about one person would double-count them.
  const state = teamRecordState([member()], [employee({ hourlyRate: '0' })], NOW);
  assert.equal(state.unpayable.length, 1);
  assert.deepEqual(state.belowMinimumWage, []);
});

test('a salaried employee is never measured against the hourly minimum', () => {
  const state = teamRecordState([member()], [employee({ payType: 'salaried', hourlyRate: null, annualSalary: '28000' })], NOW);
  assert.deepEqual(state.belowMinimumWage, []);
  assert.deepEqual(state.unpayable, []);
});

// ── Queue helpers ────────────────────────────────────────────────────────────

test('pendingLeave and openTickets select only what is still waiting', () => {
  const leave = [leaveRequest(), leaveRequest({ id: 'l2', status: 'approved' })];
  assert.equal(pendingLeave(leave).length, 1);

  const tickets = [ticket(), ticket({ id: 't2', status: 'resolved' }), ticket({ id: 't3', status: 'closed' })];
  assert.equal(openTickets(tickets).length, 1);
});

test('oldestAgeDays reports the longest wait, and 0 for an empty queue', () => {
  assert.equal(oldestAgeDays([], NOW), 0);
  assert.equal(oldestAgeDays([{ createdAt: daysAgo(1) }, { createdAt: daysAgo(9) }], NOW), 9);
});

test('unpublishedShifts and noShows filter on their status', () => {
  const rota = [{ status: 'draft' }, { status: 'published' }, { status: 'cancelled' }] as Parameters<typeof unpublishedShifts>[0];
  assert.equal(unpublishedShifts(rota).length, 1);

  const variance = [{ status: 'no_show' }, { status: 'worked' }] as Parameters<typeof noShows>[0];
  assert.equal(noShows(variance).length, 1);
});

// ── buildStaffAttention ──────────────────────────────────────────────────────

const idsOf = (items: { id: string }[]) => items.map((item) => item.id);

test('nothing wrong yields no rows at all', () => {
  const items = buildStaffAttention({
    now: NOW,
    records: teamRecordState([member()], [employee()], NOW),
    coverGapCount: 0,
    unpublishedCount: 0,
    noShowCount: 0,
    leave: [],
    tickets: [],
  });
  assert.deepEqual(items, []);
});

test('a capability not held contributes no row, rather than a zero', () => {
  // The distinction this asserts: `undefined` means "never asked", and a
  // manager without payroll access must not be told "0 people cannot be paid".
  const items = buildStaffAttention({ now: NOW, coverGapCount: 2 });
  assert.deepEqual(idsOf(items), ['cover-gaps']);
});

test('rows are ordered by consequence, worst first', () => {
  const items = buildStaffAttention({
    now: NOW,
    records: teamRecordState([member()], [employee({ hasNiNumber: false })], NOW),
    coverGapCount: 1,
    unpublishedCount: 4,
    leave: [leaveRequest()],
    tickets: [ticket()],
  });
  assert.deepEqual(idsOf(items), ['cover-gaps', 'leave-pending', 'rota-unpublished', 'tickets-open', 'records-incomplete']);
});

test('leave escalates to blocking once the oldest request goes stale', () => {
  const fresh = buildStaffAttention({ now: NOW, leave: [leaveRequest({ createdAt: daysAgo(1) })] });
  assert.equal(fresh[0].severity, 'attention');

  const stale = buildStaffAttention({ now: NOW, leave: [leaveRequest({ createdAt: daysAgo(LEAVE_STALE_DAYS) })] });
  assert.equal(stale[0].severity, 'blocking');
  assert.match(stale[0].detail, /waited 5 days/);
});

test('a stale ticket replaces the informational open-requests row rather than adding to it', () => {
  const items = buildStaffAttention({
    now: NOW,
    tickets: [ticket({ createdAt: daysAgo(TICKET_STALE_DAYS) }), ticket({ id: 't2' })],
  });
  assert.deepEqual(idsOf(items), ['tickets-stale']);
});

test('counts are pluralised, and every row names where it is fixed', () => {
  const one = buildStaffAttention({ now: NOW, coverGapCount: 1 })[0];
  assert.equal(one.title, '1 shift uncovered right now');

  const many = buildStaffAttention({ now: NOW, coverGapCount: 3 })[0];
  assert.equal(many.title, '3 shifts uncovered right now');

  for (const item of buildStaffAttention({ now: NOW, coverGapCount: 1, unpublishedCount: 1, leave: [leaveRequest()] })) {
    assert.match(item.href, /^\/staff/);
    assert.ok(item.actionLabel.length > 0, `${item.id} has no action label`);
  }
});

test('underpaid people outrank an unfinished record', () => {
  const state: RecordState = teamRecordState(
    [member(), member({ id: 's2', userId: 'u2' })],
    [employee({ hourlyRate: '11.00' }), employee({ id: 'e2', userId: 'u2', payType: undefined, hourlyRate: null })],
    NOW,
  );
  const items = buildStaffAttention({ now: NOW, records: state });
  assert.deepEqual(idsOf(items), ['below-minimum-wage', 'records-unpayable']);
  assert.ok(items.every((item) => item.severity === 'blocking'));
});
