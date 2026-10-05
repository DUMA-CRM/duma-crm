import assert from 'node:assert/strict';
import test from 'node:test';

const { GENERIC_LINES, PAYROLL_COUNTRIES, countryByCode, presetLinesFor } = await import('../lib/payroll/countries.ts');
const { PERIODS_PER_YEAR, periodContaining, rangeLabel, recentPeriods } = await import('../lib/utils/payroll-periods.ts');
const { expectedNet, formatMoney, itemTotals, netMismatch, runTotals } = await import('../lib/utils/payroll-totals.ts');

const item = (label: string, kind: 'tax' | 'social' | 'pension' | 'other', paidBy: 'employee' | 'employer', amount: string) => ({
  label,
  kind,
  paidBy,
  amount,
});

// ── Countries ────────────────────────────────────────────────────────────────

test('every preset names each line once, with a valid kind and payer, and at least one employee line', () => {
  for (const country of PAYROLL_COUNTRIES) {
    const labels = country.lines.map((line) => line.label);
    assert.equal(new Set(labels).size, labels.length, `${country.code} repeats a line`);
    assert.ok(
      country.lines.some((line) => line.paidBy === 'employee'),
      `${country.code} has no employee line`,
    );
    for (const line of country.lines) {
      assert.ok(['tax', 'social', 'pension', 'other'].includes(line.kind));
      assert.ok(['employee', 'employer'].includes(line.paidBy));
    }
    assert.match(country.code, /^[A-Z]{2}$/);
    assert.match(country.currency, /^[A-Z]{3}$/);
  }
});

test('the countries the product is sold in are all covered', () => {
  for (const code of ['GB', 'US', 'UA', 'FR', 'PL']) assert.ok(countryByCode(code), code);
});

test('an unlisted or unset country falls back to generic names', () => {
  assert.equal(presetLinesFor('BR'), GENERIC_LINES);
  assert.equal(presetLinesFor(null), GENERIC_LINES);
  assert.equal(presetLinesFor('UA')[0].label, 'ПДФО (personal income tax)');
});

// ── Periods ──────────────────────────────────────────────────────────────────

test('each period divides a year the way salaried pay needs', () => {
  assert.deepEqual(PERIODS_PER_YEAR, { weekly: 52, fortnightly: 26, semi_monthly: 24, monthly: 12 });
});

test('the period containing a date', () => {
  const day = new Date(2026, 8, 25); // Friday 25 September 2026
  assert.deepEqual(
    ['weekly', 'fortnightly', 'semi_monthly', 'monthly'].map((period) => {
      const range = periodContaining(period as 'weekly', day);
      return [range.from, range.to];
    }),
    [
      ['2026-09-21', '2026-09-27'],
      ['2026-09-14', '2026-09-27'],
      ['2026-09-16', '2026-09-30'],
      ['2026-09-01', '2026-09-30'],
    ],
  );
});

test('recent periods step back without gaps or overlaps', () => {
  for (const period of ['weekly', 'fortnightly', 'semi_monthly', 'monthly'] as const) {
    const periods = recentPeriods(period, 6, new Date(2026, 2, 3));
    for (let index = 1; index < periods.length; index += 1) {
      const next = new Date(`${periods[index].to}T00:00:00`);
      next.setDate(next.getDate() + 1);
      const [y, m, d] = periods[index - 1].from.split('-').map(Number);
      assert.equal(next.getTime(), new Date(y, m - 1, d).getTime(), `${period} at ${index}`);
    }
  }
});

test('a whole month reads as the month', () => {
  assert.equal(rangeLabel('2026-02-01', '2026-02-28'), 'February 2026');
  assert.equal(rangeLabel('2026-02-16', '2026-02-28'), '16 Feb – 28 Feb 2026');
});

// ── Totals ───────────────────────────────────────────────────────────────────

test('employer lines are a cost on top, never taken from net', () => {
  const items = [
    item('ПДФО', 'tax', 'employee', '3600.00'),
    item('ВЗ', 'tax', 'employee', '1000.00'),
    item('ЄСВ', 'social', 'employer', '4400.00'),
  ];
  assert.deepEqual(itemTotals(items), { employee: '4600.00', employer: '4400.00' });
  assert.equal(expectedNet('20000.00', items), '15400.00');
});

test('a run adds up in cents, counting only lines with figures entered toward net', () => {
  const totals = runTotals([
    { grossPay: '0.10', netPay: '0.10', items: [] },
    { grossPay: '0.20', netPay: null, items: [item('Tax', 'tax', 'employee', '0.05'), item('Er', 'social', 'employer', '0.02')] },
  ]);
  assert.deepEqual(totals, {
    people: 2,
    entered: 1,
    gross: '0.30',
    employeeDeductions: '0.05',
    employerCost: '0.02',
    net: '0.10',
    totalCost: '0.32',
  });
});

test('net pay a penny out is fine; more is flagged with the difference', () => {
  const items = [item('Tax', 'tax', 'employee', '100.00')];
  assert.equal(netMismatch('1000.00', items, '900.01'), null);
  assert.equal(netMismatch('1000.00', items, '880.00'), '-20.00');
});

test('money is written in the workspace currency', () => {
  assert.equal(formatMoney('1234.5', 'GBP'), '£1,234.50');
  assert.match(formatMoney('1234.5', 'UAH'), /1,234\.50/);
  assert.match(formatMoney('10', 'XXQ'), /10\.00 XXQ|XXQ/);
});

// ── My HR reads named lines ──────────────────────────────────────────────────

const { payslipDeductions } = await import('../lib/utils/my-hr.ts');

test('an employee’s payslip lists their own named lines, not the employer’s', () => {
  const lines = payslipDeductions({
    grossPay: '8000.00',
    netPay: '5868.00',
    taxDeducted: '0',
    deductions: [
      item('Zaliczka na PIT', 'tax', 'employee', '560.00'),
      item('ZUS emerytalne', 'pension', 'employee', '780.80'),
      item('ZUS emerytalne (pracodawca)', 'pension', 'employer', '780.80'),
    ],
  } as unknown as Parameters<typeof payslipDeductions>[0]);
  assert.deepEqual(
    lines.map((line: { label: string }) => line.label),
    ['Zaliczka na PIT', 'ZUS emerytalne'],
  );
});

// ── Reading an API from before named lines ───────────────────────────────────

const { withItems } = await import('../lib/utils/payroll-legacy.ts');

test('old-API lines get their UK columns back as named lines, as the 0081 backfill did', () => {
  const line = withItems({ grossPay: '1000.00', netPay: '800.00', taxDeducted: '150.00', nationalInsurance: '50.00', pensionContribution: null } as never);
  assert.deepEqual(
    line.items.map((entry: { label: string; amount: string }) => [entry.label, entry.amount]),
    [
      ['Income tax', '150.00'],
      ['National Insurance', '50.00'],
    ],
  );
  const current = { items: [], netPay: null } as never;
  assert.equal(withItems(current), current);
});
