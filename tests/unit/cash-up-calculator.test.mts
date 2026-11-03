import assert from 'node:assert/strict';
import test from 'node:test';

import { balanceOf, countMinor, denominationsFor, needsExplanation } from '../../lib/utils/cash-count.ts';
import { bankingMinor, expectedCashMinor } from '../../lib/utils/cash-up-calculator.ts';

test('expected cash is the float plus cash sales, less anything paid out of the drawer', () => {
  // The glossary's example: £150 float and £262.50 of cash sales should leave £412.50.
  assert.equal(expectedCashMinor({ floatMinor: 15000, cashSalesMinor: 26250 }), 41250);
  // £4.80 of milk bought from the drawer.
  assert.equal(expectedCashMinor({ floatMinor: 15000, cashSalesMinor: 26250, paidOutMinor: 480 }), 40770);
});

test('a counted drawer against expected: short by £10, and that needs a note', () => {
  const counted = countMinor({ 2000: 10, 1000: 8, 500: 10, 200: 10, 100: 25, 50: 20, 20: 40, 10: 50, 5: 40, 2: 50, 1: 150 });
  assert.equal(counted, 40250);
  assert.deepEqual(balanceOf(counted, 41250), { balance: 'short', difference: -1000 });
  assert.equal(needsExplanation(-1000), true);
  // A coin out either way is not worth a note.
  assert.equal(needsExplanation(-50, 99), false);
});

test('banking leaves tomorrow’s float in the drawer, and never goes below zero', () => {
  assert.equal(bankingMinor(40250, 15000), 25250);
  assert.equal(bankingMinor(12000, 15000), 0);
});

test('the calculator counts every UK note and coin, £50 down to 1p', () => {
  const labels = denominationsFor('GBP')!.map((d) => d.label);
  assert.deepEqual(labels, ['£50', '£20', '£10', '£5', '£2', '£1', '50p', '20p', '10p', '5p', '2p', '1p']);
});

test('hryvnia: the notes and coins in circulation, ₴1000 down to 10 kopiyok', () => {
  const uah = denominationsFor('UAH')!;
  assert.deepEqual(
    uah.map((d) => d.label),
    ['₴1000', '₴500', '₴200', '₴100', '₴50', '₴20', '₴10', '₴5', '₴2', '₴1', '50 коп', '10 коп'],
  );
  assert.equal(new Set(uah.map((d) => d.value)).size, uah.length);
  // A ₴500 note, two ₴10 coins and a 50 kopiyok coin.
  assert.equal(countMinor({ 50000: 1, 1000: 2, 50: 1 }), 52050);
});
