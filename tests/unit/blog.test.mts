import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { extractHeadings, headingIds, readingMinutes, verifyCmsWebhook } from '../../lib/utils/blog.ts';

test('table-of-contents anchors are unique and follow the headings in order', () => {
  const headings = extractHeadings('# Title\n\n## Pricing\n\ntext\n\n### What **you** get\n\n## Pricing\n\n#### Too deep');
  assert.deepEqual(headings, [
    { depth: 2, text: 'Pricing', id: 'pricing' },
    { depth: 3, text: 'What you get', id: 'what-you-get' },
    { depth: 2, text: 'Pricing', id: 'pricing-2' },
  ]);
  // The renderer makes its own generator and walks every heading, h1 included — the ids must still agree.
  const id = headingIds();
  assert.deepEqual(['Title', 'Pricing', 'What you get', 'Pricing'].map(id), ['title', 'pricing', 'what-you-get', 'pricing-2']);
});

test('reading time counts words, not Markdown, and is at least a minute', () => {
  assert.equal(readingMinutes('## Hi\n\nShort.'), 1);
  const long = Array.from({ length: 900 }, () => 'word').join(' ');
  assert.equal(readingMinutes(`${long} [link text](https://example.com/a-very-long-address)`), 4);
});

test('a CMS webhook is accepted only with a fresh, matching signature', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ event: 'entry.published', data: { type: 'blog-post' } });
  const now = 1_800_000_000;
  const sign = (ts: number, b: string) => `v1=${createHmac('sha256', secret).update(`${ts}.${b}`).digest('hex')}`;

  assert.equal(verifyCmsWebhook(secret, String(now), body, sign(now, body), now), true);
  assert.equal(verifyCmsWebhook(secret, String(now), `${body} `, sign(now, body), now), false, 'body changed');
  assert.equal(verifyCmsWebhook('other', String(now), body, sign(now, body), now), false, 'wrong secret');
  assert.equal(verifyCmsWebhook(secret, String(now - 301), body, sign(now - 301, body), now), false, 'replayed after five minutes');
  assert.equal(verifyCmsWebhook(secret, null, body, sign(now, body), now), false, 'no timestamp');
  assert.equal(verifyCmsWebhook('', String(now), body, sign(now, body), now), false, 'no secret configured');
});
