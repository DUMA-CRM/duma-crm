import assert from 'node:assert/strict';
import test from 'node:test';

const { linePence, receiptTotals } = await import('../lib/utils/receipt-preview.ts');

const lines = [
  { quantity: 2, name: 'Flat white', unitPence: 360 },
  { quantity: 1, name: 'Oat latte', unitPence: 390, extras: [{ name: 'Extra shot', pence: 60 }] },
];

test('a line counts its extras once per item', () => {
  assert.equal(linePence({ quantity: 2, name: 'x', unitPence: 300, extras: [{ name: 'y', pence: 50 }] }), 700);
});

test('VAT inclusive prices keep the total and take VAT out of it', () => {
  assert.deepEqual(receiptTotals(lines, { registered: true, ratePercent: 20, pricesIncludeTax: true }), {
    itemsPence: 1170,
    vatPence: 195,
    totalPence: 1170,
  });
});

test('VAT exclusive prices add VAT on top', () => {
  assert.deepEqual(receiptTotals(lines, { registered: true, ratePercent: 20, pricesIncludeTax: false }), {
    itemsPence: 1170,
    vatPence: 234,
    totalPence: 1404,
  });
});

test('not VAT registered means no VAT at all', () => {
  assert.equal(receiptTotals(lines, { registered: false, ratePercent: 20, pricesIncludeTax: false }).vatPence, 0);
});
