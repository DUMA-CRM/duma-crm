import assert from 'node:assert/strict';
import test from 'node:test';

const { filterSuppliers, missingDetails, supplierFormErrors, supplierInitials, supplierPayload, unreachable } = await import('../lib/utils/suppliers.ts');

const s = (name: string, over: Record<string, unknown> = {}) => ({ name, contactName: 'Jo', email: 'jo@x.test', phone: '07700 900123', isActive: true, ...over });

test('search matches name, contact and email, and phone by its digits', () => {
  const list = [s('Dairy Direct'), s('Bean Co', { contactName: 'Sam', email: 'orders@bean.co', phone: '020 7946 0000' }), s('Old Mill', { isActive: false })];
  assert.deepEqual(filterSuppliers(list, 'active', '').map((x) => x.name), ['Bean Co', 'Dairy Direct']);
  assert.deepEqual(filterSuppliers(list, 'all', 'sam').map((x) => x.name), ['Bean Co']);
  assert.deepEqual(filterSuppliers(list, 'all', '7946').map((x) => x.name), ['Bean Co']);
  assert.deepEqual(filterSuppliers(list, 'inactive', '').map((x) => x.name), ['Old Mill']);
});

test('missing details and reachability', () => {
  assert.deepEqual(missingDetails(s('A', { contactName: '', phone: null })), ['contact', 'phone']);
  assert.equal(unreachable(s('A', { email: '', phone: ' ' })), true);
  assert.equal(unreachable(s('A', { email: '' })), false);
});

const form = (over: Record<string, string> = {}) => ({ name: 'Dairy Direct', contactName: '', email: '', phone: '', address: '', notes: '', ...over });

test('form errors follow the API limits', () => {
  assert.deepEqual(supplierFormErrors(form()), {});
  assert.ok(supplierFormErrors(form({ name: ' D ' })).name);
  assert.ok(supplierFormErrors(form({ email: 'orders@dairy' })).email);
  assert.equal(supplierFormErrors(form({ email: 'orders@dairy.co.uk' })).email, undefined);
  assert.ok(supplierFormErrors(form(), true).email, 'a stored email cannot be blanked');
  assert.ok(supplierFormErrors(form({ phone: 'call Bob' })).phone);
  assert.ok(supplierFormErrors(form({ phone: '0'.repeat(31) })).phone);
});

test('an edit sends cleared fields as blank; a new supplier leaves them out', () => {
  assert.equal(supplierPayload(form({ phone: '  ' }), true).phone, '');
  assert.equal(supplierPayload(form({ phone: '  ' }), false).phone, undefined);
  assert.equal(supplierPayload(form(), true).email, undefined);
  assert.equal(supplierPayload(form({ name: ' Bean Co ' }), false).name, 'Bean Co');
});

test('initials skip symbols', () => {
  assert.equal(supplierInitials('Crate & Barrel Bakery'), 'CB');
  assert.equal(supplierInitials('bean'), 'B');
});
