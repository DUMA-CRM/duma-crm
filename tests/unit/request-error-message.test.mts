import assert from 'node:assert/strict';
import { test } from 'node:test';

import { requestErrorMessage } from '../../lib/utils/error-message.ts';

test('a 403 names the capability the API reported', () => {
  const message = requestErrorMessage({ status: 403, capability: 'hr.leave:config' }, 'save');
  assert.match(message, /hr\.leave:config/);
  assert.match(message, /wasn’t saved/);
});

test('a 403 from an any-of route lists every capability once', () => {
  const message = requestErrorMessage({ status: 403, capability: 'menu:write', capabilities: ['menu:write', 'recipes:write'] }, 'load');
  assert.match(message, /one of these permissions: menu:write, recipes:write/);
});

test('a 403 with no capability falls back to plain words', () => {
  assert.equal(requestErrorMessage({ status: 403 }, 'load'), 'You don’t have permission to load this information.');
});

test('a validation or conflict message from the API is passed through for a save', () => {
  assert.equal(requestErrorMessage({ status: 409, message: 'This shift overlaps another.' }, 'save'), 'This shift overlaps another.');
});

test('offline and network failures say nothing was saved', () => {
  assert.match(requestErrorMessage({ status: 500 }, 'save', { online: false }), /offline.*wasn’t saved/);
  assert.match(
    requestErrorMessage({ name: 'TypeError', message: 'Failed to fetch' }, 'save'),
    /^The change wasn’t saved: DUMA couldn’t reach/,
  );
  assert.match(requestErrorMessage({ status: 503 }, 'save'), /wasn’t saved/);
});

test('an unknown throw gets the generic but specific fallback', () => {
  assert.equal(requestErrorMessage(new Error('boom'), 'save'), 'The change wasn’t saved. Try again.');
  assert.equal(requestErrorMessage(null, 'load'), 'The latest data couldn’t load. Try again.');
});
