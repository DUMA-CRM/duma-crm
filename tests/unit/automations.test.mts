import assert from 'node:assert/strict';
import test from 'node:test';

import { automationFlags, automationsOverview, inAutomationView } from '../../lib/utils/communications.ts';

const send = (templateId: string) => ({ nodes: [{ type: 'send_email', config: { templateId } }] });

const automation = (patch: Record<string, unknown> = {}) => ({
  id: 'a1',
  name: 'Thanks',
  isEnabled: true,
  publishedVersion: 2,
  runCount: 0,
  failedRunCount: 0,
  definition: send('t1'),
  publishedDefinition: send('t1'),
  ...patch,
});

test('a published workflow with nothing wrong flags nothing', () => {
  assert.deepEqual(automationFlags(automation(), 0), []);
});

test('a draft is never also "unpublished changes"', () => {
  assert.deepEqual(automationFlags(automation({ publishedVersion: 0, publishedDefinition: null }), 0), ['draft']);
  assert.deepEqual(automationFlags(automation({ definition: send('t2') }), 0), ['unpublished']);
});

test('a deleted template is flagged first, alongside the draft state', () => {
  assert.deepEqual(automationFlags(automation({ publishedVersion: 0 }), 1), ['missing_template', 'draft']);
});

test('failed runs count a switched-off workflow too', () => {
  const off = automation({ isEnabled: false, failedRunCount: 3 });
  assert.equal(inAutomationView(off, 'failed', 0), true);
  assert.equal(inAutomationView(off, 'sending', 0), false);
  assert.equal(inAutomationView(off, 'off', 0), true);
  assert.equal(inAutomationView(off, 'attention', 0), false);
});

test('the overview counts each view and sums the runs', () => {
  const list = [
    automation({ id: 'a', runCount: 10, failedRunCount: 2 }),
    automation({ id: 'b', isEnabled: false, publishedVersion: 0, runCount: 0 }),
    automation({ id: 'c', runCount: 5 }),
  ];
  const overview = automationsOverview(list, (item) => (item.id === 'c' ? 1 : 0));
  assert.deepEqual(overview, { all: 3, sending: 2, off: 1, attention: 2, failed: 1, runs: 15, failedRuns: 2 });
});
