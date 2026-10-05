import assert from 'node:assert/strict';
import test from 'node:test';

import { balanceOf, countMinor, denominationsFor, needsExplanation, parseMinor, toMinor } from '../lib/utils/cash-count.ts';

test('a pound drawer is counted note by note and coin by coin, largest first', () => {
  const gbp = denominationsFor('gbp')!;
  assert.deepEqual(
    gbp.map((entry) => entry.label),
    ['£50', '£20', '£10', '£5', '£2', '£1', '50p', '20p', '10p', '5p', '2p', '1p'],
  );
  assert.equal(gbp.find((entry) => entry.label === '£2')?.kind, 'coin');
  assert.equal(gbp.find((entry) => entry.label === '£5')?.kind, 'note');
  assert.equal(denominationsFor('JPY'), null);
});

test('the total is exact in pence, and ignores blank or impossible counts', () => {
  // 2 × £20 + 3 × £1 + 7 × 2p = £43.14
  assert.equal(countMinor({ 2000: 2, 100: 3, 2: 7 }), 4314);
  // Ten 10p coins are £1 exactly — no floating-point 0.9999.
  assert.equal(countMinor({ 10: 10 }), 100);
  assert.equal(countMinor({ 500: -2, 100: 1.5, 50: Number.NaN, 20: 1 }), 20);
  assert.equal(countMinor({}), 0);
});

test('typed amounts parse to pence or are refused', () => {
  assert.equal(parseMinor('123.45'), 12345);
  assert.equal(parseMinor('£1,234.5'), 123450);
  assert.equal(parseMinor(' 20 '), 2000);
  assert.equal(parseMinor('0'), 0);
  assert.equal(parseMinor('12.345'), null);
  assert.equal(parseMinor('-5'), null);
  assert.equal(parseMinor(''), null);
  assert.equal(parseMinor('abc'), null);
  assert.equal(toMinor('100.10'), 10010);
  assert.equal(toMinor(null), 0);
});

test('a count is balanced, over or short, and a pound either way needs a note', () => {
  assert.deepEqual(balanceOf(10000, 10000), { balance: 'balanced', difference: 0 });
  assert.deepEqual(balanceOf(10250, 10000), { balance: 'over', difference: 250 });
  assert.deepEqual(balanceOf(9900, 10000), { balance: 'short', difference: -100 });
  assert.equal(needsExplanation(-99, 50), false);
  assert.equal(needsExplanation(0, -100), true);
  assert.equal(needsExplanation(100), true);
});
