import assert from 'node:assert/strict';
import test from 'node:test';

import type { PayItem } from '../../lib/api/payroll.service.ts';
import { expectedNet, netMismatch, runTotals } from '../../lib/utils/payroll-totals.ts';

const items: PayItem[] = [
  { label: 'Tax', kind: 'tax', paidBy: 'employee', amount: '20.10' },
  { label: 'Refund', kind: 'tax', paidBy: 'employee', amount: '-5.05' },
  { label: 'Employer pension', kind: 'pension', paidBy: 'employer', amount: '10.20' },
];

test('employee deductions and refunds affect net pay; employer contributions do not', () => {
  assert.equal(expectedNet('100.00', items), '84.95');
  assert.equal(expectedNet('100.00', undefined), '100.00');
});

test('run totals keep employer costs separate and do not count missing net pay as entered', () => {
  assert.deepEqual(
    runTotals([
      { grossPay: '100.00', netPay: '84.95', items },
      { grossPay: '50.10', netPay: null },
      { grossPay: '0.00', netPay: '0.00' },
    ]),
    {
      people: 3,
      entered: 2,
      gross: '150.10',
      employeeDeductions: '15.05',
      employerCost: '10.20',
      net: '84.95',
      totalCost: '160.30',
    },
  );
});

test('net pay tolerates one penny of rounding but flags larger discrepancies in either direction', () => {
  assert.equal(netMismatch('100.00', items, '84.94'), null);
  assert.equal(netMismatch('100.00', items, '84.96'), null);
  assert.equal(netMismatch('100.00', items, '84.93'), '-0.02');
  assert.equal(netMismatch('100.00', items, '84.97'), '0.02');
});
