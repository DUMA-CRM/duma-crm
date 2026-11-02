import assert from 'node:assert/strict';
import test from 'node:test';

import type { CmsFieldDefinition } from '@/lib/api/cms.service';

import { entryClipboard, parseEntryClipboard, planEntryPaste } from '../../lib/utils/cms-entry-clipboard.ts';

const fields: CmsFieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'body', label: 'Body', type: 'richText' },
  { key: 'cover', label: 'Cover', type: 'media' },
  { key: 'related', label: 'Related', type: 'reference', multiple: true },
  {
    key: 'blocks',
    label: 'Blocks',
    type: 'group',
    multiple: true,
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'image', label: 'Image', type: 'media' },
    ],
  },
];
const ASSET = '7f0c4d8e-1a2b-4c3d-9e8f-0a1b2c3d4e5f';
const local = { origin: 'http://localhost:3000', tenantId: 'tenant-local' };
const prod = { origin: 'https://app.duma-business.com', tenantId: 'tenant-prod' };
const prodTypes = [{ id: 'type-prod', key: 'post', name: 'Post', fields }];
const data = {
  title: 'Hello',
  body: `Intro ![](http://localhost:7777/v1/cms/delivery/assets/${ASSET}/file)`,
  cover: ASSET,
  related: [ASSET],
  blocks: [{ heading: 'One', image: ASSET }],
  legacy: 'gone from the model',
};
const copied = () =>
  parseEntryClipboard(JSON.stringify(entryClipboard({ locale: 'en', title: 'Hello', contentType: { key: 'post', name: 'Post' } }, data, local)));

test('an entry survives the clipboard round trip; anything else on it is ignored', () => {
  assert.deepEqual(copied()?.data, data);
  assert.equal(parseEntryClipboard('just some text'), null);
  assert.equal(parseEntryClipboard(JSON.stringify({ title: 'Hello' })), null);
});

// A local asset or entry id means nothing in production; the API would refuse the whole create.
test('pasting into another workspace clears media and references, nested ones too, and keeps the text', () => {
  const plan = planEntryPaste(copied()!, prod, prodTypes, [{ code: 'en' }]);
  assert.ok(plan.ok);
  assert.equal(plan.contentTypeId, 'type-prod');
  assert.equal(plan.locale, 'en');
  assert.deepEqual(plan.data, { title: 'Hello', body: data.body, blocks: [{ heading: 'One' }] });
  assert.deepEqual(plan.cleared, ['cover', 'related', 'blocks.0.image']);
  assert.deepEqual(plan.linkedImages, ['body']);
  assert.deepEqual(plan.unknown, ['legacy']);
});

test('pasting back into the same workspace keeps every link', () => {
  const plan = planEntryPaste(copied()!, local, prodTypes, [{ code: 'en' }]);
  assert.ok(plan.ok);
  assert.equal(plan.data.cover, ASSET);
  assert.deepEqual(plan.cleared, []);
});

test('the model is matched by key; a missing model or language is reported, not guessed', () => {
  assert.equal(planEntryPaste(copied()!, prod, [{ ...prodTypes[0]!, key: 'article' }], [{ code: 'en' }]).ok, false);
  const plan = planEntryPaste(copied()!, prod, prodTypes, [{ code: 'de' }]);
  assert.ok(plan.ok);
  assert.equal(plan.locale, undefined);
});
