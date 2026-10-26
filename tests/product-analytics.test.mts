import assert from 'node:assert/strict';
import test from 'node:test';

const { agentTurnProperties, isTrackedPath, posthogUiHost, scrubEventProperties, stripQuery } =
  await import('../lib/utils/product-analytics.ts');

test('analytics runs in the back office and never on guest surfaces', () => {
  for (const path of ['/', '/sign-in', '/dashboard', '/pos', '/kds', '/forms', '/orders/123', '/bookings'])
    assert.equal(isTrackedPath(path), true, path);
  for (const path of ['/order/abc', '/order', '/book/xyz', '/book/manage', '/f/abc', '/f']) assert.equal(isTrackedPath(path), false, path);
});

test('the PostHog app host follows the ingestion region', () => {
  assert.equal(posthogUiHost('https://eu.i.posthog.com'), 'https://eu.posthog.com');
  assert.equal(posthogUiHost('https://us.i.posthog.com/'), 'https://us.posthog.com');
  assert.equal(posthogUiHost('https://ph.example.com'), 'https://ph.example.com');
});

test('URLs lose their query string and fragment', () => {
  assert.equal(stripQuery('https://duma.app/customers?q=Jane%20Doe#row'), 'https://duma.app/customers');
  assert.equal(stripQuery('/customers#top'), '/customers');
  assert.equal(stripQuery('/customers'), '/customers');
  assert.equal(stripQuery(undefined), undefined);

  const scrubbed = scrubEventProperties({
    $current_url: 'https://duma.app/customers?q=jane',
    $referrer: 'https://duma.app/dashboard?tab=week',
    $pathname: '/customers',
    other: 'kept?as-is',
  });
  assert.deepEqual(scrubbed, {
    $current_url: 'https://duma.app/customers',
    $referrer: 'https://duma.app/dashboard',
    $pathname: '/customers',
    other: 'kept?as-is',
  });
});

test('an agent turn reports its tools, never the question or the error text', () => {
  const turn = {
    question: 'What did Jane Doe order?',
    errorMessage: 'Customer Jane Doe not found',
    tools: ['search_customers', 'list_orders'],
    outcome: 'answered',
    model: 'claude-sonnet-5-5',
    durationMs: 1200,
    page: '/customers?q=jane',
  };
  const properties = agentTurnProperties(turn);
  assert.deepEqual(properties.tools, ['search_customers', 'list_orders']);
  assert.equal(properties.tool_count, 2);
  assert.equal(properties.page, '/customers');
  assert.doesNotMatch(JSON.stringify(properties), /Jane/);
});
