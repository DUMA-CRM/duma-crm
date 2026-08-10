import assert from 'node:assert/strict';
import test from 'node:test';

import { relaxSchema } from '../lib/ai/tool-schema.ts';

// The shape a draft tool actually sends: every key required, optional arguments
// expressed as a union with null (what Gemini wants, and what several other
// OpenAI-compatible routers reject).
const PURCHASE_ORDER = {
  type: 'object',
  properties: {
    supplierId: { type: 'string' },
    expectedAt: { type: ['string', 'null'], description: 'Expected delivery date, or null.' },
    lines: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          stockItemId: { type: 'string' },
          quantityOrdered: { type: 'number', exclusiveMinimum: 0 },
          unitCost: { type: ['number', 'null'] },
        },
        required: ['stockItemId', 'quantityOrdered', 'unitCost'],
        additionalProperties: false,
      },
    },
  },
  required: ['supplierId', 'expectedAt', 'lines'],
  additionalProperties: false,
};

test('nullable arguments become optional single-typed ones', () => {
  const relaxed = relaxSchema(PURCHASE_ORDER) as typeof PURCHASE_ORDER;

  assert.equal(relaxed.properties.expectedAt.type, 'string');
  assert.deepEqual(relaxed.required, ['supplierId', 'lines']);
  // Everything that was never nullable keeps its type and its requirement.
  assert.equal(relaxed.properties.supplierId.type, 'string');
  assert.equal(relaxed.additionalProperties, false);
});

test('array item schemas are relaxed too', () => {
  const items = (relaxSchema(PURCHASE_ORDER).properties as Record<string, { items?: Record<string, unknown> }>).lines.items!;

  assert.equal((items.properties as Record<string, { type: string }>).unitCost.type, 'number');
  assert.deepEqual(items.required, ['stockItemId', 'quantityOrdered']);
  // Constraints the model needs are preserved, not flattened away.
  assert.equal((items.properties as Record<string, { exclusiveMinimum?: number }>).quantityOrdered.exclusiveMinimum, 0);
});

test('a schema with no properties is returned untouched', () => {
  const empty = { type: 'object', properties: {}, required: [], additionalProperties: false };
  assert.deepEqual(relaxSchema(empty), empty);
  assert.deepEqual(relaxSchema({ type: 'object' }), { type: 'object' });
});

test('relaxing does not mutate the schema the primary provider sends', () => {
  const before = JSON.stringify(PURCHASE_ORDER);
  relaxSchema(PURCHASE_ORDER);
  assert.equal(JSON.stringify(PURCHASE_ORDER), before);
});
