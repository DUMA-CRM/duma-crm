import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_VAT_CONTEXT,
  type VatContext,
  computeCosting,
  effectiveVatRate,
  vatContextFrom,
} from '../lib/menu/costing.ts';

const registered = (over: Partial<VatContext> = {}): VatContext => ({
  pricesIncludeTax: true,
  defaultVatRate: 20,
  vatRegistered: true,
  ...over,
});

/**
 * The API's own expression, duma-api src/routes/orders.ts. Reproduced so the
 * two can be compared directly: if the till ever changes, this test is where
 * the divergence should surface.
 */
function apiTaxCents(subtotalCents: number, vatRate: number, pricesIncludeTax: boolean): number {
  return pricesIncludeTax === false
    ? Math.round((subtotalCents * vatRate) / 100)
    : Math.round((subtotalCents * vatRate) / (100 + vatRate));
}

test('carves VAT out of a tax-inclusive price rather than ignoring it', () => {
  const c = computeCosting({ price: 3.2, cogs: 0.6, ctx: registered() });
  // £3.20 gross at 20% → 53p VAT, £2.67 kept, £2.07 margin.
  assert.equal(c.vat, 0.53);
  assert.equal(c.netRevenue, 2.67);
  assert.equal(c.margin, 2.07);
  assert.equal(c.grossCharged, 3.2);
  // The old `price - cogs` would have claimed £2.60.
  assert.notEqual(c.margin, 3.2 - 0.6);
});

test('adds VAT on top when prices exclude tax, and keeps the full price', () => {
  const c = computeCosting({ price: 3.2, cogs: 0.6, ctx: registered({ pricesIncludeTax: false }) });
  assert.equal(c.vat, 0.64);
  assert.equal(c.netRevenue, 3.2);
  assert.equal(c.grossCharged, 3.84);
  assert.equal(c.margin, 2.6);
});

test('deducts nothing when the tenant is not VAT registered', () => {
  const c = computeCosting({ price: 3.2, cogs: 0.6, ctx: registered({ vatRegistered: false }) });
  assert.equal(c.vatRate, 0);
  assert.equal(c.vat, 0);
  assert.equal(c.netRevenue, 3.2);
  assert.equal(c.margin, 2.6);
});

test('a per-item rate overrides the tenant default', () => {
  // Cold takeaway food is zero-rated even where the default is 20%.
  assert.equal(effectiveVatRate('0', registered()), 0);
  assert.equal(effectiveVatRate('5', registered()), 5);
  assert.equal(effectiveVatRate(null, registered()), 20);
  assert.equal(effectiveVatRate('', registered()), 20);
  // No override can reintroduce VAT for an unregistered tenant.
  assert.equal(effectiveVatRate('20', registered({ vatRegistered: false })), 0);
});

test('VAT matches the till to the penny across a range of prices', () => {
  for (const pricesIncludeTax of [true, false]) {
    for (const rate of [20, 5, 12.5]) {
      for (const pence of [99, 250, 320, 375, 1099, 4567]) {
        const price = pence / 100;
        const ours = computeCosting({ price, cogs: 0, ctx: registered({ pricesIncludeTax, defaultVatRate: rate }) });
        const theirs = apiTaxCents(pence, rate, pricesIncludeTax) / 100;
        assert.equal(ours.vat, theirs, `£${price} @ ${rate}% inclusive=${pricesIncludeTax}`);
      }
    }
  }
});

test('margin percentage is taken against net revenue, not the gross price', () => {
  const c = computeCosting({ price: 3.2, cogs: 0.6, ctx: registered() });
  // 2.07 / 2.67, not 2.07 / 3.20.
  assert.equal(Math.round(c.marginPct * 10) / 10, 77.5);
});

test('reports a negative margin when ingredients cost more than the item earns', () => {
  const c = computeCosting({ price: 1.0, cogs: 1.5, ctx: registered() });
  assert.ok(c.margin < 0);
  assert.ok(c.marginPct < 0);
});

test('survives a zero price without dividing by zero', () => {
  const c = computeCosting({ price: 0, cogs: 0.4, ctx: registered() });
  assert.equal(c.marginPct, 0);
  assert.equal(c.margin, -0.4);
});

test('falls back safely when trading settings have not loaded', () => {
  assert.deepEqual(vatContextFrom(undefined), DEFAULT_VAT_CONTEXT);
  assert.deepEqual(vatContextFrom(null), DEFAULT_VAT_CONTEXT);
  // Unloaded must not invent a VAT charge.
  const c = computeCosting({ price: 3.2, cogs: 0.6, ctx: DEFAULT_VAT_CONTEXT });
  assert.equal(c.vat, 0);
});

test('reads the tax posture out of a trading-settings payload', () => {
  // Only the three fields the function reads — it no longer takes the whole
  // settings record, so the fixture stopped needing currency, locale and the
  // rest of a payload that has nothing to do with VAT.
  const ctx = vatContextFrom({ pricesIncludeTax: true, vatRegistered: true, defaultVatRate: '20' });
  assert.deepEqual(ctx, { pricesIncludeTax: true, defaultVatRate: 20, vatRegistered: true });
});
