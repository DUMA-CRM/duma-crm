import assert from 'node:assert/strict';
import test from 'node:test';

const { canReadSessionList } = await import('../lib/utils/session-freshness.ts');
const now = Date.parse('2026-10-17T12:00:00Z');

test('session listing waits for an authenticated current session', () => {
  assert.equal(canReadSessionList(undefined, now), false);
  assert.equal(canReadSessionList(null, now), false);
});

test('the server deadline gates old sessions including the exact expiry boundary', () => {
  assert.equal(canReadSessionList({ security: { sessionFreshUntil: '2026-10-17T12:00:01Z' } }, now), true);
  assert.equal(canReadSessionList({ security: { sessionFreshUntil: '2026-10-17T12:00:00Z' } }, now), false);
  assert.equal(canReadSessionList({ security: { sessionFreshUntil: '2026-10-16T12:00:00Z' } }, now), false);
  assert.equal(canReadSessionList({ security: { sessionFreshUntil: 'invalid' } }, now), false);
});

test('disabled freshness and an older API retain the protected-endpoint fallback', () => {
  assert.equal(canReadSessionList({ security: { sessionFreshUntil: null } }, now), true);
  assert.equal(canReadSessionList({}, now), true);
});
