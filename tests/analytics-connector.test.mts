import assert from 'node:assert/strict';
import test from 'node:test';

const {
  EMPTY_ANALYTICS_FORM,
  UMAMI_CLOUD_API,
  analyticsConnectionInput,
  analyticsFormReady,
  analyticsHelp,
  apiUrlProblem,
  formatRate,
  formatVisitDuration,
  setupFrom,
  setupOf,
} = await import('../lib/utils/analytics-connector.ts');

const filled = { ...EMPTY_ANALYTICS_FORM, displayName: 'Café', siteId: ' site-1 ', apiKey: ' key ', username: ' viewer ', password: ' pw ' };

test('Umami Cloud always calls the cloud API, whatever is in the address field', () => {
  assert.deepEqual(analyticsConnectionInput('umami-cloud', 'login', { ...filled, apiUrl: 'https://cloud.umami.is' }), {
    provider: 'umami',
    displayName: 'Café',
    siteId: 'site-1',
    apiUrl: UMAMI_CLOUD_API,
    apiKey: 'key',
  });
});

test('a self-hosted Umami sends either its API key or a username with the password untrimmed', () => {
  const form = { ...filled, apiUrl: ' https://stats.example.com ' };
  assert.equal(analyticsConnectionInput('umami-self', 'apiKey', form).apiKey, 'key');
  assert.equal(analyticsConnectionInput('umami-self', 'apiKey', form).username, undefined);
  const login = analyticsConnectionInput('umami-self', 'login', form);
  assert.equal(login.apiUrl, 'https://stats.example.com');
  assert.equal(login.username, 'viewer');
  assert.equal(login.apiKey, ' pw ');
});

test('PostHog defaults to US Cloud when the address is left empty', () => {
  assert.equal(analyticsConnectionInput('posthog', 'apiKey', filled).apiUrl, 'https://us.posthog.com');
});

test('the address must be a public https host the API is willing to call', () => {
  assert.equal(apiUrlProblem('umami-cloud', ''), null);
  assert.match(apiUrlProblem('umami-self', '')!, /address you open Umami on/);
  assert.match(apiUrlProblem('umami-self', 'stats.example.com')!, /https:\/\//);
  assert.match(apiUrlProblem('umami-self', 'http://stats.example.com')!, /https/);
  assert.match(apiUrlProblem('umami-self', 'https://stats.example.com:3000')!, /port/);
  assert.match(apiUrlProblem('umami-self', 'https://192.168.1.4')!, /public domain/);
  assert.equal(apiUrlProblem('umami-self', 'https://stats.example.com/websites/abc'), null);
});

test('the form is ready only with what the chosen sign-in needs', () => {
  const base = { ...EMPTY_ANALYTICS_FORM, displayName: 'Café', siteId: 'site-1' };
  assert.equal(analyticsFormReady(null, 'apiKey', { ...base, apiKey: 'k' }), false);
  assert.equal(analyticsFormReady('umami-cloud', 'apiKey', { ...base, apiKey: 'k' }), true);
  assert.equal(analyticsFormReady('umami-self', 'apiKey', { ...base, apiKey: 'k' }), false, 'no address');
  assert.equal(analyticsFormReady('umami-self', 'apiKey', { ...base, apiKey: 'k', apiUrl: 'https://s.example.com' }), true);
  assert.equal(analyticsFormReady('umami-self', 'login', { ...base, apiKey: 'k', apiUrl: 'https://s.example.com' }), false);
  assert.equal(analyticsFormReady('umami-self', 'login', { ...base, username: 'u', password: 'p', apiUrl: 'https://s.example.com' }), true);
});

test('the questions settle on a setup only once each one is answered', () => {
  assert.equal(setupFrom(null, null), null);
  assert.equal(setupFrom('posthog', null), 'posthog');
  assert.equal(setupFrom('umami', null), null, 'Umami still needs cloud or self-hosted');
  assert.equal(setupFrom('umami', 'cloud'), 'umami-cloud');
  assert.equal(setupFrom('umami', 'self'), 'umami-self');
});

test('each field says where to find its value, for the setup and sign-in chosen', () => {
  const cloud = analyticsHelp('umami-cloud', 'apiKey');
  assert.equal(cloud.address, undefined, 'Umami Cloud has no address to enter');
  assert.deepEqual(cloud.siteId.path, ['Settings', 'Websites', 'your website']);
  assert.deepEqual(cloud.credential.path, ['Settings', 'API keys', 'Create key']);
  assert.match(analyticsHelp('umami-self', 'apiKey').address!.text, /https/);
  assert.match(analyticsHelp('umami-self', 'apiKey').credential.text, /umami_/);
  assert.match(analyticsHelp('umami-self', 'login').credential.text, /View only/);
  assert.match(analyticsHelp('posthog', 'apiKey').credential.text, /Query: Read/);
});

test('a saved connection is recognised as cloud or self-hosted Umami', () => {
  assert.equal(setupOf({ provider: 'umami', apiUrl: 'https://api.umami.is/v1' }), 'umami-cloud');
  assert.equal(setupOf({ provider: 'umami', apiUrl: 'https://stats.example.com' }), 'umami-self');
  assert.equal(setupOf({ provider: 'posthog', apiUrl: 'https://eu.posthog.com' }), 'posthog');
});

test('visit length and bounce rate read like people say them', () => {
  assert.equal(formatVisitDuration(null), '—');
  assert.equal(formatVisitDuration(42), '42s');
  assert.equal(formatVisitDuration(125), '2m 05s');
  assert.equal(formatRate(0.456), '46%');
  assert.equal(formatRate(null), '—');
});
