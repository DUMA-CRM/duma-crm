import assert from 'node:assert/strict';
import test from 'node:test';

const { inContainerView, nextToUse, splitParts, totalRemaining, byUseFirst } = await import('../lib/utils/containers.ts');

type Status = 'AVAILABLE' | 'IN_USE' | 'EMPTY' | 'EXPIRED' | 'DISCARDED';
const c = (id: string, status: Status, expiryDate: string | null, createdAt = '2026-09-01', remainingQuantity = '1') => ({ id, status, expiryDate, createdAt, remainingQuantity });

test('use first: open, then earliest expiry, undated last, then oldest; inactive after', () => {
  const list = [c('late', 'AVAILABLE', '2026-10-09'), c('gone', 'EMPTY', null), c('undated', 'AVAILABLE', null), c('open', 'IN_USE', '2026-10-20'), c('soon', 'AVAILABLE', '2026-10-01'), c('exp', 'EXPIRED', '2026-09-20')];
  assert.deepEqual(byUseFirst(list).map((x) => x.id), ['open', 'soon', 'late', 'undated', 'exp', 'gone']);
  assert.equal(nextToUse(list)?.id, 'open');
  assert.equal(nextToUse([c('x', 'EMPTY', null)]), null);
});

test('views', () => {
  assert.equal(inContainerView('active', { status: 'IN_USE' }), true);
  assert.equal(inContainerView('active', { status: 'EXPIRED' }), false);
  assert.equal(inContainerView('expired', { status: 'EXPIRED' }), true);
  assert.equal(inContainerView('finished', { status: 'DISCARDED' }), true);
});

test('split parts add up exactly', () => {
  assert.deepEqual(splitParts(1, 3), [0.334, 0.333, 0.333]);
  assert.deepEqual(splitParts(2, 2), [1, 1]);
  assert.equal(splitParts(0.001, 2), null);
  assert.equal(splitParts(5, 1), null);
  assert.equal(totalRemaining([{ remainingQuantity: '0.1' }, { remainingQuantity: '0.2' }]), 0.3);
});
