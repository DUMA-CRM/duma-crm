import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedImageHost } from '../../lib/utils/image-src.ts';

test('an image host is allowed exactly, or under a wildcard entry — never by a look-alike', () => {
  assert.equal(isAllowedImageHost('duma-coffee.vercel.app'), true);
  assert.equal(isAllowedImageHost('up1nqsxedszhezyw.public.blob.vercel-storage.com'), true);
  assert.equal(isAllowedImageHost('public.blob.vercel-storage.com'), false);
  assert.equal(isAllowedImageHost('evilpublic.blob.vercel-storage.com'), false);
  assert.equal(isAllowedImageHost('public.blob.vercel-storage.com.evil.io'), false);
  assert.equal(isAllowedImageHost('example.com'), false);
});
