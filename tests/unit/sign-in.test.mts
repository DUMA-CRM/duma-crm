import assert from 'node:assert/strict';
import test from 'node:test';

import { chatgptOAuthDestination, chatgptOAuthQuery } from '../../lib/utils/chatgpt-connection.ts';
import { googleLinkError, googleSignInError, signInDestination } from '../../lib/utils/sign-in.ts';

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


test('ChatGPT sign-in only resumes a signed authorization request', () => {
  assert.equal(chatgptOAuthQuery('response_type=code&client_id=duma-chatgpt'), undefined);
  const source = 'response_type=code&client_id=duma-chatgpt&sig=abc&ba_param=state&ba_param=client_id';
  assert.equal(chatgptOAuthQuery(source + '&error=access_denied'), source);
});

test('ChatGPT sign-in only returns to DUMA consent or a known ChatGPT callback', () => {
  const consent = `${origin}/connect/chatgpt?sig=abc`;
  const callback = 'https://chatgpt.com/connector_platform_oauth_redirect?code=abc';
  const connectionCallback = 'https://chatgpt.com/connector/oauth/test-connection?code=abc';
  for (const target of [consent, callback, connectionCallback]) {
    assert.equal(chatgptOAuthDestination(target, origin), target);
  }
  for (const target of [`${origin}/sign-in`, 'https://chatgpt.com.evil.example/connector/oauth/test',
    'https://evil.example/connect/chatgpt', 'https://user@chatgpt.com/connector/oauth/test',
    'https://chatgpt.com/share/test', 'javascript:alert(1)']) {
    assert.equal(chatgptOAuthDestination(target, origin), null, target);
  }
});

test('googleLinkError explains a Google account already used by someone else', () => {
  assert.equal(googleLinkError(null), null);
  assert.match(googleLinkError('account_already_linked_to_different_user') ?? '', /another DUMA account/);
  assert.match(googleLinkError('something_new') ?? '', /couldn’t be connected/);
});
