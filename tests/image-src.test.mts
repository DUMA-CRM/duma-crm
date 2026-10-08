import assert from 'node:assert/strict';
import test from 'node:test';

const { viaApiProxy } = await import('../lib/utils/image-src.ts');

test('API image addresses go through the same-origin proxy; others are untouched', () => {
  const api = 'https://api.dudych.cc';
  assert.equal(
    viaApiProxy('https://api.dudych.cc/v1/cms/delivery/assets/a/file/x.jpg?v=1', api, '/be'),
    '/be/v1/cms/delivery/assets/a/file/x.jpg?v=1',
  );
  assert.equal(viaApiProxy('/v1/cms/delivery/assets/a/file/x.jpg', api, '/be'), '/be/v1/cms/delivery/assets/a/file/x.jpg');
  assert.equal(viaApiProxy('https://cdn.example.com/x.jpg', api, '/be'), 'https://cdn.example.com/x.jpg');
  assert.equal(
    viaApiProxy('https://api.dudych.cc.evil.com/x.jpg', api, '/be'),
    'https://api.dudych.cc.evil.com/x.jpg',
    'a look-alike host is not ours',
  );
  assert.equal(viaApiProxy(null, api, '/be'), null);
});

test('a picked media image is stored as the keyless delivery path, which the proxy serves', async () => {
  const { mediaImagePath, viaApiProxy } = await import('../lib/utils/image-src.ts');
  const path = mediaImagePath({ id: 'a1b2', fileName: 'oat milk.jpg' });
  assert.equal(path, '/v1/cms/delivery/assets/a1b2/file/oat%20milk.jpg');
  assert.equal(viaApiProxy(path, 'https://api.example.com', '/be'), '/be/v1/cms/delivery/assets/a1b2/file/oat%20milk.jpg');
});
