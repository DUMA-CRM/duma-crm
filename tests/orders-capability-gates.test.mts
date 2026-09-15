import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('../app/(crm)/orders/layout.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/(crm)/orders/page.tsx', import.meta.url), 'utf8');

test('the orders workspace requires read access, not bulk access', () => {
  assert.match(layout, /requireCapability\('orders:read'\)/);
  assert.doesNotMatch(layout, /requireCapability\('orders:bulk'\)/);
});

test('refund controls are unavailable without orders:refund', () => {
  assert.match(page, /hasCapability\([^;]+, 'orders:refund'\)/);
  assert.match(page, /canRefund && data\.status === 'done'/);
  assert.match(page, /canRefund && showRefund/);
});
