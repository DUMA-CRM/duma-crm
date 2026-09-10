import assert from 'node:assert/strict';
import test from 'node:test';

import { answerModelIntent, describePreference, detectModelIntent, modelChipLabel } from '../lib/ai/agent-model-intent.ts';

const BOTH = [
  { id: 'gemini', name: 'Gemini', model: 'gemini-3.5-flash-lite' },
  { id: 'openrouter', name: 'OpenRouter', model: 'google/gemma-4-31b-it:free' },
];
const GEMINI_ONLY = [BOTH[0]];

test('asking what is available opens the picker without naming a model', () => {
  for (const question of [
    'what models are available?',
    'which model are you using?',
    'list your models',
    'show me the model picker',
    'what ai is this',
    'which AI model do you run on',
  ]) {
    assert.deepEqual(detectModelIntent(question), { kind: 'list' }, question);
  }
});

test('naming a provider with an intent to move switches to it', () => {
  assert.deepEqual(detectModelIntent('switch to openrouter'), { kind: 'switch', target: 'openrouter' });
  assert.deepEqual(detectModelIntent('use gemini please'), { kind: 'switch', target: 'gemini' });
  assert.deepEqual(detectModelIntent('change the model to open router'), { kind: 'switch', target: 'openrouter' });
  // Typing just the name is an instruction, not a question about it.
  assert.deepEqual(detectModelIntent('OpenRouter'), { kind: 'switch', target: 'openrouter' });
  assert.deepEqual(detectModelIntent('switch model to auto'), { kind: 'switch', target: 'auto' });
  assert.deepEqual(detectModelIntent('let the model choose automatically'), { kind: 'switch', target: 'auto' });
});

test('a complaint about a provider is not a request to select it', () => {
  // "stop using Gemini" has a switch verb next to a provider name, and means
  // the opposite of what that pattern would otherwise imply.
  assert.deepEqual(detectModelIntent('stop using gemini, it keeps failing'), { kind: 'list' });
  assert.deepEqual(detectModelIntent('anything other than gemini'), { kind: 'list' });
  assert.deepEqual(detectModelIntent('is gemini down?'), { kind: 'list' });
});

test('ordinary business questions never reach the picker', () => {
  for (const question of [
    'change the price model for wholesale customers',
    'what model is the espresso machine at Camden?',
    'switch the menu to the winter set',
    'how many flat whites did we sell yesterday?',
    'use the automatic reorder point for oat milk',
    'change my email address',
    '',
  ]) {
    assert.equal(detectModelIntent(question), null, question);
  }
});

test('the list reply names what is configured and where the setting stands', () => {
  const reply = answerModelIntent({ kind: 'list' }, BOTH, 'auto');
  assert.equal(reply.apply, undefined);
  assert.match(reply.message, /\*\*Gemini\*\* or \*\*OpenRouter\*\*/);
  assert.match(reply.message, /Automatic \(Gemini first\)/);
});

test('a switch to a configured provider is applied and quotes the real model id', () => {
  const reply = answerModelIntent({ kind: 'switch', target: 'openrouter' }, BOTH, 'auto');
  assert.equal(reply.apply, 'openrouter');
  assert.match(reply.message, /google\/gemma-4-31b-it:free/);
});

test('a switch to a provider this server lacks is refused, not silently accepted', () => {
  const reply = answerModelIntent({ kind: 'switch', target: 'openrouter' }, GEMINI_ONLY, 'auto');
  assert.equal(reply.apply, undefined);
  assert.match(reply.message, /isn’t configured/);
  assert.match(reply.message, /\*\*Gemini\*\*/);
});

test('a switch made before the list arrives is applied rather than dropped', () => {
  // The preference is inert for a provider the server does not have, and the
  // picker rendered underneath corrects the record as soon as it loads.
  const reply = answerModelIntent({ kind: 'switch', target: 'gemini' }, undefined, 'auto');
  assert.equal(reply.apply, 'gemini');
  assert.match(reply.message, /Switched to \*\*Gemini\*\*/);
});

test('with no model configured, the list reply says so instead of offering a choice', () => {
  const reply = answerModelIntent({ kind: 'list' }, [], 'auto');
  assert.equal(reply.apply, undefined);
  assert.match(reply.message, /No AI model is configured/);
});

test('the chip and the sentence name the model that will actually answer', () => {
  assert.equal(modelChipLabel('auto', BOTH), 'Auto · Gemini');
  assert.equal(modelChipLabel('openrouter', BOTH), 'OpenRouter');
  // Before the list arrives there is still a name worth showing.
  assert.equal(modelChipLabel('openrouter', undefined), 'OpenRouter');
  assert.equal(modelChipLabel('auto', undefined), 'Auto');
  assert.equal(describePreference('gemini', BOTH), 'Gemini');
});
