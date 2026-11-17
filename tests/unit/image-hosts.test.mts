import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedImageHost, viaApiProxy } from '../../lib/utils/image-src.ts';

test('an image host is allowed exactly, or under a wildcard entry — never by a look-alike', () => {
  assert.equal(isAllowedImageHost('duma-coffee.vercel.app'), true);
  assert.equal(isAllowedImageHost('up1nqsxedszhezyw.public.blob.vercel-storage.com'), true);
  assert.equal(isAllowedImageHost('public.blob.vercel-storage.com'), false);
  assert.equal(isAllowedImageHost('evilpublic.blob.vercel-storage.com'), false);
  assert.equal(isAllowedImageHost('public.blob.vercel-storage.com.evil.io'), false);
  assert.equal(isAllowedImageHost('example.com'), false);
});

test('an API photo saved under a stale host still loads through the proxy', () => {
  const api = 'https://api.duma-business.com';
  const photo = '/v1/menu-items/images/0b6f3c1e-1d2a-4f7e-9c11-2a5d8e4f6b70/file/latte.webp';
  const media = '/v1/cms/delivery/assets/0b6f3c1e-1d2a-4f7e-9c11-2a5d8e4f6b70/file/hero.jpg';
  assert.equal(viaApiProxy(`${api}${photo}`, api, '/be'), `/be${photo}`);
  assert.equal(viaApiProxy(`https://api.dudych.cc${photo}`, api, '/be'), `/be${photo}`);
  assert.equal(viaApiProxy(`http://localhost:7777${media}`, api, '/be'), `/be${media}`);
  assert.equal(viaApiProxy(photo, api, '/be'), `/be${photo}`);
  // Anything that isn't an API image path is left alone.
  assert.equal(viaApiProxy('https://cdn.example.com/v1/menu-items/list', api, '/be'), 'https://cdn.example.com/v1/menu-items/list');
  assert.equal(viaApiProxy('https://x.public.blob.vercel-storage.com/a.jpg', api, '/be'), 'https://x.public.blob.vercel-storage.com/a.jpg');
});
