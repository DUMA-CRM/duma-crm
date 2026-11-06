import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  emailConnectorState,
  paymentsConnectorState,
  storageConnectorState,
  telegramConnectorState,
  tillHardwareState,
} from '../../lib/utils/connector-state.ts';

test('Telegram needs attention until a test has been delivered, and a failure outranks pausing', () => {
  const working = { lastError: null, isEnabled: true, lastTestedAt: '2026-11-06T09:00:00Z' };
  assert.equal(telegramConnectorState(undefined), 'disconnected');
  assert.equal(telegramConnectorState(working), 'connected');
  assert.equal(telegramConnectorState({ ...working, lastTestedAt: null }), 'attention');
  assert.equal(telegramConnectorState({ ...working, isEnabled: false }), 'paused');
  assert.equal(telegramConnectorState({ ...working, isEnabled: false, lastError: 'Bot was removed' }), 'attention');
});

test('email: a failed check needs attention even when sending is paused; never checked is still set up', () => {
  assert.equal(emailConnectorState(null), 'disconnected');
  assert.equal(emailConnectorState({ isEnabled: true, lastTestSucceeded: null }), 'connected');
  assert.equal(emailConnectorState({ isEnabled: false, lastTestSucceeded: true }), 'paused');
  assert.equal(emailConnectorState({ isEnabled: false, lastTestSucceeded: false }), 'attention');
});

test('card readers: paused-only locations count as set up, so they offer Manage rather than Connect', () => {
  assert.equal(paymentsConnectorState(undefined), 'disconnected');
  assert.equal(paymentsConnectorState([]), 'disconnected');
  assert.equal(paymentsConnectorState([{ isActive: false }]), 'paused');
  assert.equal(paymentsConnectorState([{ isActive: false }, {}]), 'connected');
});

test('storage: only a bucket receiving uploads counts, and its last error needs attention', () => {
  assert.equal(storageConnectorState(undefined), 'disconnected');
  assert.equal(storageConnectorState({ connections: [{ isActive: false, lastError: 'Access denied' }] }), 'disconnected');
  assert.equal(storageConnectorState({ connections: [{ isActive: true, lastError: null }] }), 'connected');
  assert.equal(storageConnectorState({ connections: [{ isActive: true, lastError: 'Access denied' }] }), 'attention');
});

test('a saved till is set up even without a printer connection (regression: it stayed under Not set up)', () => {
  assert.equal(tillHardwareState(undefined), 'disconnected');
  assert.equal(tillHardwareState({ connector: 'none', drawer: 'manual' }), 'connected');
  assert.equal(tillHardwareState({ connector: 'epson-epos', drawer: 'printer' }), 'connected');
});
