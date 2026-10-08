import assert from 'node:assert/strict';
import test from 'node:test';

const { addToBasket, basketCount, basketTotalPence, manualOrderPayload, setLineNote, setLineQuantity } = await import('../lib/utils/manual-order.ts');

const tee = { menuItemId: 'tee', variantId: 'black-l', name: 'T-shirt', unitPence: 2500, quantity: 1, modifierIds: [] as string[] };
const latte = { menuItemId: 'latte', name: 'Latte', unitPence: 380, quantity: 2, modifierIds: ['oat', 'shot'] };

test('the same item, variant and options merge into one line', () => {
  let basket = addToBasket([], tee);
  basket = addToBasket(basket, tee);
  basket = addToBasket(basket, { ...tee, variantId: 'black-m' });
  basket = addToBasket(basket, latte);
  basket = addToBasket(basket, { ...latte, modifierIds: ['shot', 'oat'] });
  assert.equal(basket.length, 3);
  assert.equal(basket[0]!.quantity, 2);
  assert.equal(basket[2]!.quantity, 4, 'option order does not make a new line');
  assert.equal(basketCount(basket), 7);
  assert.equal(basketTotalPence(basket), 2500 * 3 + 380 * 4);
});

test('setting a quantity to 0 takes the line off', () => {
  const basket = addToBasket([], tee);
  assert.equal(setLineQuantity(basket, basket[0]!.key, 3)[0]!.quantity, 3);
  assert.deepEqual(setLineQuantity(basket, basket[0]!.key, 0), []);
});

test('an order taken by hand is sent as manual; paid only when it was', () => {
  const lines = addToBasket(addToBasket([], tee), latte);
  const paid = manualOrderPayload({ locationId: 'loc', customerId: 'c1', lines, notes: ' Collect at 3 ', payment: { paid: true, method: 'bank_transfer' } });
  assert.deepEqual(paid, {
    locationId: 'loc',
    customerId: 'c1',
    source: 'manual',
    paid: true,
    paymentMethod: 'bank_transfer',
    notes: 'Collect at 3',
    items: [
      { menuItemId: 'tee', variantId: 'black-l', quantity: 1 },
      { menuItemId: 'latte', quantity: 2, modifiers: [{ modifierId: 'oat' }, { modifierId: 'shot' }] },
    ],
  });
  const later = manualOrderPayload({ locationId: 'loc', lines, payment: { paid: false } });
  assert.equal('paid' in later, false);
  assert.equal('paymentMethod' in later, false);
  assert.equal('customerId' in later, false);
});

test('editing a note keeps the line in place, under the same key', () => {
  const basket = addToBasket(addToBasket([], tee), latte);
  const noted = setLineNote(basket, basket[0]!.key, 'Gift wrap');
  assert.equal(noted[0]!.key, basket[0]!.key);
  assert.equal(noted[0]!.note, 'Gift wrap');
  assert.equal(setLineNote(noted, basket[0]!.key, '')[0]!.note, undefined);
});

test('till prices show the currency sign, not its code', async () => {
  const { formatPrice } = await import('../lib/utils/pos.ts');
  assert.equal(formatPrice(1250, 'UAH'), '₴12.50');
  assert.equal(formatPrice(1250, 'GBP'), '£12.50');
  assert.equal(formatPrice(1250), '£12.50');
});
