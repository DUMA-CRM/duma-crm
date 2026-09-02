import assert from 'node:assert/strict';
import test from 'node:test';

import { type QrAvailabilityConfig, explainQrOrderingAvailability } from '../lib/ai/qr-ordering.ts';

const ACTIVE: QrAvailabilityConfig = {
  isEnabled: true,
  isPaused: false,
  cardEnabled: true,
  cashEnabled: false,
  publishedContent: { schemaVersion: 1 },
};

const LOCATION = {
  isActive: true,
  timezone: 'Europe/London',
  openingHours: { tue: { open: '07:00', close: '18:00' } },
};

test('explains that checkout is closed using the location clock and today’s hours', () => {
  const result = explainQrOrderingAvailability(ACTIVE, LOCATION, true, new Date('2026-08-18T18:49:00Z'));

  assert.equal(result.localTime, '19:49');
  assert.equal(result.canBrowse, true);
  assert.equal(result.canOrder, false);
  assert.equal(result.blocker, 'outside_trading_hours');
  assert.match(result.explanation, /closed at 19:49/i);
  assert.match(result.explanation, /07:00–18:00/);
});

test('distinguishes a manual pause from trading hours', () => {
  const result = explainQrOrderingAvailability({ ...ACTIVE, isPaused: true }, LOCATION, true, new Date('2026-08-18T10:00:00Z'));

  assert.equal(result.blocker, 'paused');
  assert.match(result.explanation, /paused/i);
});

test('reports a missing Stripe connection when card is the only payment method', () => {
  const result = explainQrOrderingAvailability(ACTIVE, LOCATION, false, new Date('2026-08-18T10:00:00Z'));

  assert.equal(result.blocker, 'stripe_not_connected');
  assert.match(result.explanation, /Stripe Online/i);
});

test('accepts orders when the channel, hours and payment method are ready', () => {
  const result = explainQrOrderingAvailability(ACTIVE, LOCATION, true, new Date('2026-08-18T10:00:00Z'));

  assert.equal(result.canOrder, true);
  assert.equal(result.blocker, null);
});
