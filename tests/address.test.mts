import assert from 'node:assert/strict';
import test from 'node:test';

const { combineAddress, parseAddress } = await import('../lib/utils/address.ts');

test('a full address round-trips through the four fields', () => {
  const full = '12 North Street, London, SW1A 1AA, United Kingdom';
  assert.deepEqual(parseAddress(full), { line1: '12 North Street', city: 'London', postcode: 'SW1A 1AA', country: 'United Kingdom' });
  assert.equal(combineAddress(parseAddress(full)), full);
});

test('the last part is a country only when it is one', () => {
  assert.deepEqual(parseAddress('7 Mill Lane, London E2 8QT'), { line1: '7 Mill Lane', city: 'London E2 8QT', postcode: '', country: '' });
  assert.deepEqual(parseAddress('7 Mill Lane, London, E2 8QT'), { line1: '7 Mill Lane', city: 'London', postcode: 'E2 8QT', country: '' });
  assert.equal(parseAddress('ul. Floriańska 3, Kraków, 31-019, poland').country, 'poland');
});

test('a first line with its own commas stays whole', () => {
  assert.equal(parseAddress('Flat 2, 7 Mill Lane, London, E2 8QT, United Kingdom').line1, 'Flat 2, 7 Mill Lane');
});

test('empty and single-part addresses', () => {
  assert.deepEqual(parseAddress(null), { line1: '', city: '', postcode: '', country: '' });
  assert.deepEqual(parseAddress('Somewhere'), { line1: 'Somewhere', city: '', postcode: '', country: '' });
});
