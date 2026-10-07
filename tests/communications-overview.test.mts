import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attentionIssues,
  connectionState,
  countByBucket,
  hasUnpublishedChanges,
  missingTemplateCount,
  summariseWeek,
} from '../lib/utils/communications.ts';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const send = (templateId: string) => ({ type: 'send_email', config: { templateId } });
const flow = (...templateIds: string[]) => ({ nodes: [{ type: 'trigger', config: {} }, ...templateIds.map(send)] });

test('summariseWeek counts only the last seven days', () => {
  const week = summariseWeek(
    [
      { status: 'sent', createdAt: ago(1) },
      { status: 'failed', createdAt: ago(2) },
      { status: 'queued', createdAt: ago(3) },
      { status: 'failed', createdAt: ago(9) },
    ],
    NOW,
  );
  assert.deepEqual(week, { total: 3, sent: 1, failed: 1 });
});

test('countByBucket folds queued and sending into waiting', () => {
  const counts = countByBucket([
    { status: 'queued', createdAt: ago(0) },
    { status: 'sending', createdAt: ago(0) },
    { status: 'sent', createdAt: ago(0) },
    { status: 'failed', createdAt: ago(0) },
  ]);
  assert.deepEqual(counts, { all: 4, sent: 1, waiting: 2, failed: 1, cancelled: 0 });
});

test('missingTemplateCount flags archived and deleted templates', () => {
  const templates = [
    { id: 't1', isActive: true },
    { id: 't2', isActive: false },
  ];
  assert.equal(missingTemplateCount(flow('t1', 't2', 't3'), templates), 2);
  assert.equal(missingTemplateCount(flow('t1'), templates), 0);
  assert.equal(missingTemplateCount(undefined, templates), 0);
});

test('hasUnpublishedChanges compares the draft with the live version', () => {
  const base = { id: 'a', name: 'A', isEnabled: true, publishedVersion: 2 };
  assert.equal(hasUnpublishedChanges({ ...base, definition: flow('t1'), publishedDefinition: flow('t1') }), false);
  assert.equal(hasUnpublishedChanges({ ...base, definition: flow('t2'), publishedDefinition: flow('t1') }), true);
  // Never published: that is a draft, not "unpublished changes".
  assert.equal(hasUnpublishedChanges({ ...base, publishedVersion: 0, definition: flow('t2'), publishedDefinition: null }), false);
});

test('connectionState never reports "not set up" when it could not be read', () => {
  assert.equal(connectionState(null, false), 'unknown');
  assert.equal(connectionState(undefined, true), 'unknown');
  assert.equal(connectionState(null, true), 'missing');
  assert.equal(connectionState({ isEnabled: true, lastTestSucceeded: true }, true), 'ready');
  assert.equal(connectionState({ isEnabled: true, lastTestSucceeded: false }, true), 'unverified');
});

test('attentionIssues orders by urgency and skips paused automations', () => {
  const templates = [{ id: 't1', isActive: true }];
  const issues = attentionIssues({
    connection: 'unverified',
    now: NOW,
    templates,
    deliveries: [{ status: 'failed', createdAt: ago(1) }],
    automations: [
      { id: 'a1', name: 'Broken', isEnabled: true, publishedVersion: 1, definition: flow('gone'), publishedDefinition: flow('gone') },
      {
        id: 'a2',
        name: 'Failing',
        isEnabled: true,
        publishedVersion: 1,
        failedRunCount: 3,
        definition: flow('t1'),
        publishedDefinition: flow('t1'),
      },
      { id: 'a3', name: 'Edited', isEnabled: true, publishedVersion: 2, definition: flow('t1', 't1'), publishedDefinition: flow('t1') },
      { id: 'a4', name: 'New', isEnabled: false, publishedVersion: 0, definition: flow('gone') },
      {
        id: 'a5',
        name: 'Paused',
        isEnabled: false,
        publishedVersion: 1,
        failedRunCount: 9,
        definition: flow('gone'),
        publishedDefinition: flow('gone'),
      },
    ],
  });
  assert.deepEqual(
    issues.map((issue) => issue.kind + ('name' in issue ? `:${issue.name}` : '')),
    ['connection', 'failed_deliveries', 'missing_template:Broken', 'failed_runs:Failing', 'unpublished:Edited', 'draft:New'],
  );
});

test('attentionIssues is empty when all is well', () => {
  assert.deepEqual(attentionIssues({ connection: 'ready', now: NOW, templates: [], deliveries: [], automations: [] }), []);
  assert.deepEqual(attentionIssues({ connection: 'unknown', now: NOW, templates: [], deliveries: [], automations: [] }), []);
});

test('timeAgo reads in plain steps', async () => {
  const { timeAgo } = await import('../lib/utils/communications.ts');
  assert.equal(timeAgo(new Date(NOW - 20_000).toISOString(), NOW), 'just now');
  assert.equal(timeAgo(new Date(NOW - 12 * 60_000).toISOString(), NOW), '12m ago');
  assert.equal(timeAgo(new Date(NOW - 3 * 3_600_000).toISOString(), NOW), '3h ago');
  assert.equal(timeAgo(ago(2), NOW), '2d ago');
});

test('groupAutomations groups by trigger and puts sending first', async () => {
  const { groupAutomations } = await import('../lib/utils/communications.ts');
  const list = [
    { name: 'Receipt', trigger: 'order_created', isEnabled: false },
    { name: 'Ready', trigger: 'order_ready', isEnabled: true },
    { name: 'Birthday', trigger: 'customer_birthday', isEnabled: true },
    { name: 'Welcome aboard', trigger: 'staff_onboarded', isEnabled: false },
  ];
  assert.deepEqual(
    groupAutomations(list).map((group) => [group.group, group.items.map((item) => item.name), group.sending]),
    [
      ['orders', ['Ready', 'Receipt'], 1],
      ['customers', ['Birthday'], 1],
      ['staff', ['Welcome aboard'], 0],
    ],
  );
  assert.deepEqual(groupAutomations([]), []);
});

test('templateUsage counts each automation once per template', async () => {
  const { templateUsage } = await import('../lib/utils/communications.ts');
  const usage = templateUsage([{ definition: flow('t1', 't1', 't2') }, { definition: flow('t1') }, {}]);
  assert.equal(usage.get('t1'), 2);
  assert.equal(usage.get('t2'), 1);
  assert.equal(usage.get('t3'), undefined);
});

test('groupTemplates follows the category order and drops deleted templates', async () => {
  const { groupTemplates } = await import('../lib/utils/communications.ts');
  const t = (id: string, name: string, category: string, isActive = true) => ({ id, name, category, isActive });
  const groups = groupTemplates(
    [
      t('1', 'Receipt', 'orders'),
      t('2', 'Old promo', 'Promos'),
      t('3', 'Birthday', 'lifecycle'),
      t('4', 'Ready', 'orders'),
      t('5', 'Gone', 'orders', false),
    ],
    ['orders', 'loyalty', 'marketing', 'lifecycle', 'general'],
    new Map([['4', 3]]),
  );
  assert.deepEqual(
    groups.map((group) => [group.category, group.items.map((item) => item.name), group.inUse]),
    [
      ['orders', ['Ready', 'Receipt'], 1],
      ['lifecycle', ['Birthday'], 0],
      // A free-text category from before the fixed list sorts last.
      ['Promos', ['Old promo'], 0],
    ],
  );
});

const delivery = (id: string, status: 'sent' | 'failed' | 'queued', hoursAgo: number, extra: Record<string, unknown> = {}) => ({
  id,
  status,
  createdAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
  sentAt: status === 'sent' ? new Date(NOW - hoursAgo * 3_600_000).toISOString() : null,
  toEmail: `${id}@example.com`,
  toName: null,
  subject: 'Your order is ready',
  template: { id: 't1', name: 'Order ready' },
  ...extra,
});

test('filterDeliveries combines status, template, window and search', async () => {
  const { filterDeliveries } = await import('../lib/utils/communications.ts');
  const list = [
    delivery('a', 'sent', 1),
    delivery('b', 'failed', 2, { toName: 'Priya Shah' }),
    delivery('c', 'queued', 3),
    delivery('d', 'sent', 24 * 10, { template: { id: 't2', name: 'Birthday' }, subject: 'A birthday treat' }),
  ];
  const run = (patch: Record<string, unknown>) =>
    filterDeliveries(list, { search: '', status: 'all', template: 'all', window: 'all', now: NOW, ...patch }).map((item) => item.id);
  assert.deepEqual(run({}), ['a', 'b', 'c', 'd']);
  assert.deepEqual(run({ status: 'waiting' }), ['c']);
  assert.deepEqual(run({ template: 't2' }), ['d']);
  assert.deepEqual(run({ window: '7d' }), ['a', 'b', 'c']);
  assert.deepEqual(run({ search: 'priya' }), ['b']);
  assert.deepEqual(run({ search: 'birthday', window: '7d' }), []);
});

test('deliveriesByDay groups newest first by the day it happened', async () => {
  const { deliveriesByDay } = await import('../lib/utils/communications.ts');
  const key = (date: Date) => date.toISOString().slice(0, 10);
  const days = deliveriesByDay([delivery('old', 'sent', 30), delivery('new', 'sent', 1), delivery('mid', 'failed', 2)], key);
  assert.deepEqual(
    days.map((day) => day.items.map((item) => item.id)),
    [['new', 'mid'], ['old']],
  );
});

test('suppression labels cover the API enums and humanise the rest', async () => {
  const { suppressionReasonLabel, suppressionSourceLabel } = await import('../lib/utils/communications.ts');
  assert.equal(suppressionReasonLabel('invalid_address'), 'Address doesn’t work');
  assert.equal(suppressionSourceLabel('email_unsubscribe'), 'Unsubscribe link');
  assert.equal(suppressionReasonLabel('hard_bounce'), 'Hard bounce');
});

test('groupSuppressions orders by reason, newest first, and searches the visible words', async () => {
  const { groupSuppressions } = await import('../lib/utils/communications.ts');
  const s = (masked: string, reason: string, source: string, daysAgo: number, customer?: { firstName: string; lastName: string }) => ({
    maskedValue: masked,
    reason,
    source,
    createdAt: ago(daysAgo),
    customer: customer ?? null,
  });
  const list = [
    s('o***@old.com', 'invalid_address', 'bounce', 5),
    s('e***@example.com', 'customer_request', 'email_unsubscribe', 9, { firstName: 'Emma', lastName: 'Clarke' }),
    s('t***@example.com', 'customer_request', 'staff', 1),
    s('x***@x.com', 'legacy_reason', 'staff', 2),
  ];
  assert.deepEqual(
    groupSuppressions(list, '').map((group) => [group.reason, group.items.map((item) => item.maskedValue)]),
    [
      ['customer_request', ['t***@example.com', 'e***@example.com']],
      ['invalid_address', ['o***@old.com']],
      ['legacy_reason', ['x***@x.com']],
    ],
  );
  // "Unsubscribe link" is how the source reads on screen, so it is searchable.
  assert.deepEqual(
    groupSuppressions(list, 'unsubscribe').flatMap((group) => group.items.map((item) => item.maskedValue)),
    ['e***@example.com'],
  );
  assert.deepEqual(
    groupSuppressions(list, 'bounced').map((group) => group.reason),
    ['invalid_address'],
  );
});

test('describeStep says what each step does in plain words', async () => {
  const { describeStep } = await import('../components/communications/stepSummary.ts');
  const opts = { templateName: (id: string) => (id === 't1' ? 'Order ready' : 'an email'), staff: false };
  assert.equal(
    describeStep({ id: 'a', type: 'trigger', name: 'T', config: { event: 'order_ready' } }, { ...opts, locationName: 'North Street' }),
    'Starts when an order is ready for collection at North Street.',
  );
  assert.equal(
    describeStep({ id: 'b', type: 'trigger', name: 'T', config: { event: 'customer_birthday', offsetDays: -3 } }, opts),
    'Starts 3 days before each opted-in customer’s birthday.',
  );
  assert.equal(
    describeStep({ id: 'c', type: 'send_email', name: 'S', config: { templateId: 't1' } }, opts),
    'Emails “Order ready” to the customer.',
  );
  assert.equal(
    describeStep({ id: 'd', type: 'delay', name: 'W', config: { amount: 1, unit: 'days' } }, opts),
    'Waits 1 day before the next step.',
  );
  assert.equal(
    describeStep(
      { id: 'e', type: 'condition', name: 'C', config: { field: 'order.totalAmount', operator: 'greater_than', value: 20 } },
      opts,
    ),
    'If the order total is more than “20”, it follows Yes; otherwise No.',
  );
});

test('templateChecks flags what would break or weaken a send', async () => {
  const { templateChecks, defaultTemplateDesign, renderTemplateDesign } = await import('../components/communications/templateDesign.ts');
  const design = defaultTemplateDesign();
  design.blocks = [
    { id: 'h', type: 'heading', text: 'Hi {{customer.firstName}} {{customer.nickname}}', align: 'center' },
    { id: 'b', type: 'button', text: 'Order now', url: 'https://', align: 'center' },
    { id: 'i', type: 'image', url: 'https://x.test/a.png', alt: '', href: '', width: 100, align: 'center' },
  ];
  const keys = templateChecks(design, '', ['customer.firstName']).map((check) => `${check.tone}:${check.key}`);
  assert.deepEqual(keys, [
    'exception:subject',
    'exception:var-customer.nickname',
    'exception:btn-b',
    'measured:alt-i',
    'measured:preheader',
  ]);

  design.preheader = 'Your treat is waiting';
  design.blocks = [{ id: 'b', type: 'button', text: 'Order now', url: 'https://north.test', align: 'center' }];
  assert.deepEqual(templateChecks(design, 'Hello', ['customer.firstName']), []);
  // The preview line is rendered hidden, ahead of the content.
  assert.match(renderTemplateDesign(design), /display:none[^>]*>Your treat is waiting/);
});
