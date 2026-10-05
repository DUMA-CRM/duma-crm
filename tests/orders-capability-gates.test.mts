import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('../app/(crm)/orders/layout.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/(crm)/orders/page.tsx', import.meta.url), 'utf8');
// The order detail — and its refund controls — moved into a drawer on 2026-09-26.
const drawer = readFileSync(new URL('../components/orders/OrderDrawer.tsx', import.meta.url), 'utf8');

test('the orders workspace requires read access, not bulk access', () => {
  assert.match(layout, /requireCapability\('orders:read'\)/);
  assert.doesNotMatch(layout, /requireCapability\('orders:bulk'\)/);
});

test('refund controls are unavailable without orders:refund', () => {
  assert.match(drawer, /hasCapability\(\s*useAuthStore\([^;]+?\),\s*'orders:refund',?\s*\)/);
  assert.match(drawer, /canRefund && data\.status === 'done'/);
  assert.match(drawer, /canRefund && showRefund/);
});

test('the CSV export is offered only with orders:bulk, the capability GET /orders/export checks', () => {
  assert.match(page, /const canExport = hasCapability\(capabilities, 'orders:bulk'\)/);
  assert.match(page, /canExport && \(/);
});
