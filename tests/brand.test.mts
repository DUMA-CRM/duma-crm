import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const { BRANDS, DEFAULT_BRAND, parseBrand, brandPrePaintScript } = await import('../lib/utils/brand.ts');

test('forest is the default brand', () => {
  assert.equal(DEFAULT_BRAND, 'forest');
  assert.equal(BRANDS[0].id, 'forest');
});

test('an unknown or missing brand falls back to the default', () => {
  assert.equal(parseBrand('plum'), 'forest');
  assert.equal(parseBrand('magenta'), 'forest');
  assert.equal(parseBrand(undefined), 'forest');
  assert.equal(parseBrand(42), 'forest');
});

test('every brand has a day and a night block in globals.css', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  for (const { id } of BRANDS) {
    assert.ok(css.includes(`[data-brand='${id}'] {`) || css.includes(`[data-brand='${id}'],`), `${id}: no day block`);
    assert.ok(css.includes(`.dark[data-brand='${id}']`), `${id}: no night block`);
  }
});

function runPrePaint(stored: string | null, { throws = false } = {}) {
  const dataset: Record<string, string> = {};
  const scope = {
    localStorage: {
      getItem: () => {
        if (throws) throw new Error('blocked');
        return stored;
      },
    },
    document: { documentElement: { dataset } },
  };
  new Function('localStorage', 'document', brandPrePaintScript)(scope.localStorage, scope.document);
  return dataset.brand;
}

test('the pre-paint script applies the persisted brand', () => {
  assert.equal(runPrePaint(JSON.stringify({ state: { brand: 'ocean' }, version: 3 })), 'ocean');
});

test('the pre-paint script falls back to forest on anything unexpected', () => {
  assert.equal(runPrePaint(JSON.stringify({ state: { brand: 'plum' } })), 'forest');
  assert.equal(runPrePaint(null), 'forest');
  assert.equal(runPrePaint('not json'), 'forest');
  assert.equal(runPrePaint(JSON.stringify({ state: { brand: 'magenta' } })), 'forest');
  assert.equal(runPrePaint(JSON.stringify({ state: {} })), 'forest');
  assert.equal(runPrePaint(null, { throws: true }), 'forest');
});

function runPrePaintIn(settings: unknown, tab: unknown) {
  const dataset: Record<string, string> = {};
  const storage = (value: unknown) => ({ getItem: () => (value === undefined ? null : JSON.stringify(value)) });
  new Function('localStorage', 'sessionStorage', 'document', brandPrePaintScript)(storage(settings), storage(tab), {
    documentElement: { dataset },
  });
  return dataset.brand;
}

const A = '11111111-1111-4111-8111-111111111111';

test("the pre-paint script follows this tab's context, not the last colour on the device", () => {
  const settings = { state: { brand: 'ocean', brands: { [`me|w:${A}`]: 'ocean' } } };
  // A workspace tab paints its own cached colour.
  assert.equal(
    runPrePaintIn(settings, { state: { accountId: 'me', context: { kind: 'workspace', tenantId: A, locationId: null } } }),
    'ocean',
  );
  // DUMA Admin always wears the default, whatever another tab last painted.
  assert.equal(runPrePaintIn(settings, { state: { accountId: 'me', context: { kind: 'platform' } } }), 'forest');
  // A workspace this device has never coloured, or another account's cache, paints the default.
  assert.equal(
    runPrePaintIn(settings, { state: { accountId: 'you', context: { kind: 'workspace', tenantId: A, locationId: null } } }),
    'forest',
  );
  // No context yet: the device's last colour.
  assert.equal(runPrePaintIn(settings, undefined), 'ocean');
});
