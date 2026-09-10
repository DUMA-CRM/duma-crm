import assert from 'node:assert/strict';
import test from 'node:test';

// At least 32 characters: `approvalSecret()` rejects anything shorter, because
// an HMAC key short enough to guess is not a key. See lib/ai/action-seal.ts.
process.env.AI_AGENT_APPROVAL_SECRET = 'test-approval-secret-long-enough-to-pass';

const { ApprovalError, resolveSealedSubmission, sealAction } = await import('../lib/ai/action-seal.ts');
type PendingAction = Parameters<typeof sealAction>[0];

const DRAFT: PendingAction = {
  kind: 'create_purchase_order',
  title: 'Purchase order',
  summary: 'Draft order for supplier approval',
  confirmLabel: 'Create draft order',
  fields: [
    {
      key: 'supplierId',
      label: 'Supplier',
      type: 'select',
      value: 'sup-1',
      options: [
        { value: 'sup-1', label: 'Bean Bros' },
        { value: 'sup-2', label: 'Dairy Direct' },
      ],
    },
    { key: 'expectedAt', label: 'Expected', type: 'date', value: '', optional: true },
    { key: 'notes', label: 'Notes', type: 'textarea', value: '', optional: true },
  ],
  lineGroup: {
    label: 'Items',
    addLabel: 'Add item',
    emptyLabel: 'No items yet.',
    options: [
      { value: 'item-oat', label: 'Oat milk', prefill: { quantityOrdered: 6, unitCost: 1.1 } },
      { value: 'item-beans', label: 'House beans', prefill: { quantityOrdered: 2, unitCost: 18 } },
    ],
    template: [
      { key: 'quantityOrdered', label: 'Quantity', type: 'number', value: 1, min: 0.01, max: 1_000 },
      { key: 'unitCost', label: 'Unit cost', type: 'money', value: 0, min: 0, max: 500 },
    ],
    lines: [
      {
        id: 'item-oat',
        title: 'Oat milk',
        fields: [
          { key: 'quantityOrdered', label: 'Quantity', type: 'number', value: 10, min: 0.01, max: 1_000 },
          { key: 'unitCost', label: 'Unit cost', type: 'money', value: 1.2, min: 0, max: 500 },
        ],
      },
    ],
    minLines: 1,
    maxLines: 5,
  },
};

const token = () => sealAction(DRAFT).approvalToken ?? '';

test('operator edits inside the offered draft are applied', () => {
  const resolved = resolveSealedSubmission({
    approvalToken: token(),
    fields: { supplierId: 'sup-2', expectedAt: '2026-08-20', notes: '  Leave at the back door  ' },
    lines: [{ id: 'item-oat', values: { quantityOrdered: 12, unitCost: 1.35 } }],
  });

  assert.equal(resolved.kind, 'create_purchase_order');
  assert.equal(resolved.fields.supplierId, 'sup-2');
  assert.equal(resolved.fields.expectedAt, '2026-08-20');
  assert.equal(resolved.fields.notes, 'Leave at the back door');
  assert.deepEqual(resolved.lines, [{ id: 'item-oat', values: { quantityOrdered: 12, unitCost: 1.35 } }]);
});

test('a choice the draft never offered falls back to what the agent proposed', () => {
  const resolved = resolveSealedSubmission({
    approvalToken: token(),
    fields: { supplierId: 'sup-999-not-offered', expectedAt: 'not-a-date' },
    lines: [{ id: 'item-oat', values: {} }],
  });

  assert.equal(resolved.fields.supplierId, 'sup-1');
  assert.equal(resolved.fields.expectedAt, '');
});

test('numbers are clamped to the bounds the draft carried', () => {
  const resolved = resolveSealedSubmission({
    approvalToken: token(),
    fields: { supplierId: 'sup-1' },
    lines: [{ id: 'item-oat', values: { quantityOrdered: 9_999_999, unitCost: -40 } }],
  });

  assert.deepEqual(resolved.lines[0].values, { quantityOrdered: 1_000, unitCost: 0 });
});

test('lines can be added from the offered options but never invented', () => {
  const resolved = resolveSealedSubmission({
    approvalToken: token(),
    fields: { supplierId: 'sup-1' },
    lines: [
      { id: 'item-oat', values: { quantityOrdered: 10, unitCost: 1.2 } },
      { id: 'item-beans', values: { quantityOrdered: 3, unitCost: 18.5 } },
      { id: 'item-smuggled-in', values: { quantityOrdered: 500, unitCost: 0 } },
    ],
  });

  assert.deepEqual(
    resolved.lines.map((line) => line.id),
    ['item-oat', 'item-beans'],
  );
});

test('an unsigned or edited token is rejected', () => {
  const [payload] = token().split('.');
  assert.throws(() => resolveSealedSubmission({ approvalToken: `${payload}.forged`, fields: {} }), ApprovalError);
  assert.throws(() => resolveSealedSubmission({ approvalToken: 'nonsense', fields: {} }), ApprovalError);
});

test('an expired approval is rejected', () => {
  const stale = sealAction(DRAFT, -1).approvalToken ?? '';
  assert.throws(() => resolveSealedSubmission({ approvalToken: stale, fields: { supplierId: 'sup-1' } }), /expired/i);
});

test('an action that needs lines refuses to run without them', () => {
  assert.throws(() => resolveSealedSubmission({ approvalToken: token(), fields: { supplierId: 'sup-1' }, lines: [] }), /at least 1 item/i);
});

test('a short secret, or the model key, cannot sign an approval', async () => {
  const original = process.env.AI_AGENT_APPROVAL_SECRET;
  try {
    // UI-TD-008: this used to fall back to GEMINI_API_KEY, so a key handed to a
    // third party on every completion also forged every write approval.
    process.env.AI_AGENT_APPROVAL_SECRET = '';
    process.env.GEMINI_API_KEY = 'a-model-key-that-is-long-enough-to-pass-length';
    assert.throws(() => sealAction(DRAFT), ApprovalError);

    process.env.AI_AGENT_APPROVAL_SECRET = 'too-short';
    assert.throws(() => sealAction(DRAFT), ApprovalError);

    process.env.AI_AGENT_APPROVAL_SECRET = process.env.GEMINI_API_KEY;
    assert.throws(() => sealAction(DRAFT), ApprovalError);
  } finally {
    process.env.AI_AGENT_APPROVAL_SECRET = original;
    delete process.env.GEMINI_API_KEY;
  }
});

test('every approval carries a unique id, so it can be spent exactly once', () => {
  // The seal proves a proposal was authorised and when it expires. Neither
  // fact says it has not already been used, and the same token creates the
  // same purchase order as often as it is submitted inside the 15 minutes.
  // duma-api `POST /v1/agent/approvals/claim` records this id the first time.
  const first = sealAction(DRAFT);
  const second = sealAction(DRAFT);
  assert.notEqual(first.approvalToken, second.approvalToken, 'two seals of the same draft must not be interchangeable');

  const submit = (approvalToken: string) =>
    resolveSealedSubmission({ approvalToken, fields: { supplierId: 'sup-1' }, lines: [{ id: 'item-oat', values: {} }] });

  const resolved = submit(first.approvalToken!);
  assert.match(resolved.approvalId, /^[0-9a-f-]{36}$/, 'the approval id must be a real uuid');
  assert.notEqual(resolved.approvalId, submit(second.approvalToken!).approvalId);

  // Replaying the same token yields the same id — which is what lets the API
  // recognise the replay rather than treat it as a new approval.
  assert.equal(submit(first.approvalToken!).approvalId, resolved.approvalId);
});
