import assert from 'node:assert/strict';
import test from 'node:test';

const { IMAGE_PLACEHOLDER_SRC, emailImageUrl, imageHost, previewEmailHtml, previewImageSrc } = await import('../lib/utils/email-images.ts');
const { renderTemplateDesign, defaultTemplateDesign } = await import('../components/communications/templateDesign.ts');

const api = 'https://api.dudych.cc';
const hosts = ['duma-coffee.vercel.app'];

test('a Media image is put in an email at an absolute address', () => {
  assert.equal(emailImageUrl('https://api.dudych.cc/v1/cms/delivery/assets/a/file/x.jpg', api), 'https://api.dudych.cc/v1/cms/delivery/assets/a/file/x.jpg');
  assert.equal(emailImageUrl('/v1/cms/delivery/assets/a/file/x.jpg', `${api}/`), 'https://api.dudych.cc/v1/cms/delivery/assets/a/file/x.jpg');
  assert.equal(emailImageUrl('https://cdn.example.com/x.jpg', api), 'https://cdn.example.com/x.jpg');
});

test('the editor loads Media through /be and allowed hosts directly; any other host is a placeholder', () => {
  assert.equal(previewImageSrc('https://api.dudych.cc/v1/cms/delivery/assets/a/file/x.jpg', api, '/be', hosts), '/be/v1/cms/delivery/assets/a/file/x.jpg');
  assert.equal(previewImageSrc('https://duma-coffee.vercel.app/x.png', api, '/be', hosts), 'https://duma-coffee.vercel.app/x.png');
  assert.equal(previewImageSrc('http://duma-coffee.vercel.app/x.png', api, '/be', hosts), null, 'not https');
  assert.equal(previewImageSrc('https://images.unsplash.com/photo.jpg', api, '/be', hosts), null);
  assert.equal(previewImageSrc('//evil.com/x.png', api, '/be', hosts), null, 'protocol-relative is another host');
  assert.equal(previewImageSrc('data:image/png;base64,AAAA', api, '/be', hosts), 'data:image/png;base64,AAAA');
  assert.equal(previewImageSrc('not a url', api, '/be', hosts), null);
  assert.equal(previewImageSrc('', api, '/be', hosts), null);
});

test('the preview frame swaps blocked images for the placeholder and keeps everything else', () => {
  const html = '<p>Hi</p><img src="https://images.unsplash.com/a.jpg?w=1&amp;h=2" alt="Latte" style="width:100%" /><img alt="x" src=\'https://api.dudych.cc/v1/cms/delivery/assets/a/file/x.jpg\'>';
  const out = previewEmailHtml(html, (url) => previewImageSrc(url, api, '/be', hosts));
  assert.match(out, /^<p>Hi<\/p>/);
  assert.ok(out.includes(`src="${IMAGE_PLACEHOLDER_SRC}" alt="Latte" style="width:100%"`));
  assert.ok(out.includes('src="/be/v1/cms/delivery/assets/a/file/x.jpg"'));
  assert.doesNotMatch(out, /unsplash/);
});

test('the preview leaves the sent HTML alone and decodes attribute entities before deciding', () => {
  const design = defaultTemplateDesign();
  design.blocks = [{ id: 'i', type: 'image', url: 'https://duma-coffee.vercel.app/a.png?x=1&y=2', alt: 'A', href: '', width: 100, align: 'center' }];
  const html = renderTemplateDesign(design);
  const seen: string[] = [];
  const out = previewEmailHtml(html, (url) => (seen.push(url), url));
  assert.deepEqual(seen, ['https://duma-coffee.vercel.app/a.png?x=1&y=2']);
  assert.ok(out.includes('src="https://duma-coffee.vercel.app/a.png?x=1&amp;y=2"'));
  assert.ok(html.includes('https://duma-coffee.vercel.app/a.png?x=1&amp;y=2'));
});

test('a placeholder names the image host', () => {
  assert.equal(imageHost('https://images.unsplash.com/a.jpg'), 'images.unsplash.com');
  assert.equal(imageHost('nope'), null);
});
