import assert from 'node:assert/strict';
import test from 'node:test';

import { describeError } from '../lib/utils/error-message.ts';

test('offline beats every other signal', () => {
  const description = describeError(new Error('Failed to fetch'), { online: false });
  assert.equal(description.kind, 'offline');
  assert.equal(description.showReference, false);
});

test('the production server placeholder is recognised as a server fault', () => {
  const error = new Error(
    'An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.',
  );
  const description = describeError(error);
  assert.equal(description.kind, 'server');
  assert.equal(description.showReference, true);
});

test('a stale bundle asks for a reload rather than a retry', () => {
  const error = new Error('Failed to fetch dynamically imported module: /_next/static/chunks/page.js');
  error.name = 'ChunkLoadError';
  const description = describeError(error);
  assert.equal(description.kind, 'update');
  assert.equal(description.action, 'reload');
});

test('an expired session sends the user to sign in', () => {
  const description = describeError(new Error('Request failed with status 401 Unauthorized'));
  assert.equal(description.kind, 'session');
  assert.equal(description.action, 'sign-in');
});

test('specific kinds win over the generic network fallback', () => {
  assert.equal(describeError(new Error('403 Forbidden')).kind, 'permission');
  assert.equal(describeError(new Error('429 Too Many Requests')).kind, 'busy');
  assert.equal(describeError(new Error('The operation was aborted due to timeout')).kind, 'timeout');
  assert.equal(describeError(new Error('TypeError: Failed to fetch')).kind, 'network');
  assert.equal(describeError(new Error('502 Bad Gateway')).kind, 'server');
});

test('an unmatched error still offers a retry and a reference', () => {
  const description = describeError(new Error('x.map is not a function'));
  assert.equal(description.kind, 'unknown');
  assert.equal(description.action, 'retry');
  assert.equal(description.showReference, true);
});

test('a missing or malformed error does not throw', () => {
  assert.equal(describeError(null).kind, 'unknown');
  assert.equal(describeError(undefined).kind, 'unknown');
  assert.equal(describeError({}).kind, 'unknown');
});

test('the reference is only offered where it can actually be looked up', () => {
  // A digest exists only for server throws, so kinds that are diagnosed from a
  // client-side message must not promise the user a reference to quote.
  assert.equal(describeError(new Error('403 Forbidden')).showReference, false);
  assert.equal(describeError(new Error('ChunkLoadError: loading chunk 42 failed')).showReference, false);
});
