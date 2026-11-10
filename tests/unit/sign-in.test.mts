import assert from 'node:assert/strict';
import test from 'node:test';

import { googleSignInError, signInDestination } from '../../lib/utils/sign-in.ts';

const origin = 'https://app.duma-business.com';

test('signInDestination keeps a same-origin path with its query and hash', () => {
  assert.equal(signInDestination('/inventory?tab=stock#low', origin), '/inventory?tab=stock#low');
});

test('signInDestination refuses destinations off this origin', () => {
  for (const next of ['//evil.example/phish', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)']) {
    assert.equal(signInDestination(next, origin), '/dashboard', next);
  }
});

test('signInDestination falls back to the dashboard without a next', () => {
  assert.equal(signInDestination(null, origin), '/dashboard');
  assert.equal(signInDestination('', origin), '/dashboard');
});

test('googleSignInError says nothing without an error and explains a missing account', () => {
  assert.equal(googleSignInError(null), null);
  assert.match(googleSignInError('signup_disabled') ?? '', /no DUMA account/);
  assert.match(googleSignInError('something_new') ?? '', /didn’t work/);
});
