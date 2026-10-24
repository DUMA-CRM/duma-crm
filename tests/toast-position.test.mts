import assert from 'node:assert/strict';
import test from 'node:test';

const { toastPositionFor } = await import('../lib/utils/toast-position.ts');

test('critical confirmations land top-center on any screen', () => {
  assert.equal(toastPositionFor('/pos', true), 'top-center');
  assert.equal(toastPositionFor('/settings', true), 'top-center');
});

test('data-heavy screens and their sub-routes use bottom-right', () => {
  for (const path of ['/pos', '/kds', '/orders', '/orders/abc', '/reports/sales', '/inventory', '/audit-log', '/cash-up']) {
    assert.equal(toastPositionFor(path), 'bottom-right', path);
  }
});

test('everything else uses top-center', () => {
  for (const path of ['/dashboard', '/customers', '/settings/connectors', '/ordersheet', '/', null, undefined]) {
    assert.equal(toastPositionFor(path), 'top-center', String(path));
  }
});
