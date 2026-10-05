import assert from 'node:assert/strict';
import test from 'node:test';

const {
  STAFF_SECTIONS, STAFF_STEPS, bankIssues, emptyStaffDraft, firstIncompleteStep, isStaffStepComplete, isStepSkipped,
  resolveStaffStep, staffOnboardPayload, staffProgressFor,
} = await import('../lib/utils/staff-onboarding.ts');

const uk = { uk: true, today: '2026-09-28' };
const complete = () => ({
  ...emptyStaffDraft('2026-10-01'),
  name: 'Jane Doe',
  email: 'jane@cafe.co.uk',
  role: 'barista',
  scope: 'location' as const,
  locationIds: ['loc-1'],
  jobTitle: 'Barista',
  employmentType: 'part_time' as const,
  payType: 'hourly' as const,
  hourlyRate: '12.60',
});

test('a fresh draft stops at the first question, and optional ones do not block', () => {
  const draft = emptyStaffDraft('2026-10-01');
  assert.equal(firstIncompleteStep(draft, uk), 'name');
  assert.equal(firstIncompleteStep(complete(), uk), 'review');
  for (const step of ['birthday', 'address', 'emergency', 'tax', 'bank'] as const) {
    assert.equal(isStaffStepComplete(step, draft, uk), true, step);
    assert.equal(isStepSkipped(step, draft), true, step);
  }
});

test('location access needs at least one location; wider scopes do not', () => {
  const draft = { ...complete(), locationIds: [] };
  assert.equal(isStaffStepComplete('access', draft, uk), false);
  assert.equal(isStaffStepComplete('access', { ...draft, scope: 'global' as const }, uk), true);
  assert.equal(isStaffStepComplete('access', { ...draft, scope: undefined }, uk), false);
});

test('pay must be positive and within the API limits for its type', () => {
  assert.equal(isStaffStepComplete('pay', { ...complete(), hourlyRate: '0' }, uk), false);
  assert.equal(isStaffStepComplete('pay', { ...complete(), hourlyRate: '10001' }, uk), false);
  assert.equal(isStaffStepComplete('pay', { ...complete(), payType: 'salaried' as const, annualSalary: '26,000' }, uk), true);
  assert.equal(isStaffStepComplete('pay', { ...complete(), payType: undefined }, uk), false);
});

test('a birthday in the future is rejected', () => {
  assert.equal(isStaffStepComplete('birthday', { ...complete(), dateOfBirth: '2030-01-01' }, uk), false);
  assert.equal(isStaffStepComplete('birthday', { ...complete(), dateOfBirth: '2000-01-01' }, uk), true);
});

test('bank details are all-or-nothing, and UK formats are checked only in the UK', () => {
  const partial = { ...complete(), sortCode: '04-00-04' };
  assert.deepEqual(Object.keys(bankIssues(partial, true)).sort(), ['accountNumber', 'holder']);
  const full = { ...partial, accountHolder: 'Jane Doe', accountNumber: '12345678' };
  assert.deepEqual(bankIssues(full, true), {});
  const polish = { ...complete(), accountHolder: 'Jan', sortCode: '1090', accountNumber: 'PL61 1090 1014 0000 0712' };
  assert.equal(isStaffStepComplete('bank', polish, { uk: true, today: uk.today }), false);
  assert.equal(isStaffStepComplete('bank', polish, { uk: false, today: uk.today }), true);
});

test('NI numbers are checked as NI numbers in the UK only', () => {
  assert.equal(isStaffStepComplete('tax', { ...complete(), niNumber: 'QQ123456C' }, uk), false);
  assert.equal(isStaffStepComplete('tax', { ...complete(), niNumber: 'AB 12 34 56 C' }, uk), true);
  assert.equal(isStaffStepComplete('tax', { ...complete(), niNumber: '44051401359' }, { uk: false, today: uk.today }), true);
});

test('a step past an unanswered question resolves back to it', () => {
  const draft = { ...complete(), jobTitle: '' };
  assert.equal(resolveStaffStep('review', draft, uk), 'job');
  assert.equal(resolveStaffStep('email', draft, uk), 'email');
});

test('progress fills section by section', () => {
  const first = staffProgressFor('name');
  assert.equal(first.activeSection, 'account');
  assert.deepEqual([first.position, first.total], [1, 4]);
  assert.equal(first.overall, 0);
  const review = staffProgressFor('review');
  assert.deepEqual(review.sections, STAFF_SECTIONS.map(() => 1));
  assert.equal(review.activeSection, null);
  assert.equal(STAFF_STEPS.at(-1)?.id, 'review');
});

test('the payload normalises UK identifiers and sends only the pay that applies', () => {
  const payload = staffOnboardPayload(
    { ...complete(), niNumber: 'ab 12 34 56 c', accountHolder: 'Jane Doe', sortCode: '04-00-04', accountNumber: '1234 5678', department: '  ' },
    true,
  );
  assert.equal(payload.niNumber, 'AB123456C');
  assert.equal(payload.sortCode, '040004');
  assert.equal(payload.accountNumber, '12345678');
  assert.equal(payload.hourlyRate, 12.6);
  assert.equal(payload.annualSalary, undefined);
  assert.equal(payload.department, undefined);
  assert.deepEqual(payload.locationIds, ['loc-1']);
  assert.equal(staffOnboardPayload({ ...complete(), scope: 'global' }, true).locationIds, undefined);
  assert.equal(staffOnboardPayload(complete(), true).sortCode, undefined);
});
