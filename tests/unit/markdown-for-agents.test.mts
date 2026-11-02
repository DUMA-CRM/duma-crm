import assert from 'node:assert/strict';
import test from 'node:test';

import { htmlToMarkdown, prefersMarkdown, servesMarkdown } from '../../lib/utils/markdown-for-agents.ts';

test('Markdown is served only when asked for by name, and never in place of HTML a client prefers', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9, */*;q=0.8'), true);
  assert.equal(prefersMarkdown('text/html, text/markdown'), true);
  // A browser, and anything that only says */*, gets the page.
  assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false);
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(prefersMarkdown(null), false);
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0'), false);
});

test('only marketing and legal pages have a Markdown version — never the app, guest pages or files', () => {
  for (const path of ['/', '/pricing', '/blog/some-post', '/developers/mcp', '/terms']) assert.equal(servesMarkdown(path), true, path);
  for (const path of ['/dashboard', '/order/abc', '/f/form', '/sign-in', '/blogger', '/sitemap.xml', '/llms.txt', '/blog/feed.xml', '/opengraph-image', '/auth.md', '/.well-known/api-catalog']) {
    assert.equal(servesMarkdown(path), false, path);
  }
});

test('a page converts to its title, description and <main>, with links made absolute', () => {
  const html = `<html><head><title>Pricing | DUMA</title><meta name="description" content="Free &amp; fair"/><script>alert(1)</script></head><body>
    <header><nav><a href="/">Home</a></nav></header>
    <main><h1>Pricing</h1><p>Free <strong>forever </strong>— <a href="/sign-up">start</a>.</p>
      <div><span>No card</span><span>Free setup</span></div>
      <ul><li>Till</li><li aria-hidden="true">decoration</li><li>Stock</li></ul>
      <button>Copy</button>
      <table><tr><th>Plan</th><th>Price</th></tr><tr><td>Free</td><td>£0</td></tr></table>
      <pre><code class="language-sh">curl  /v1
  -H x</code></pre></main>
    <footer>© DUMA</footer></body></html>`;
  assert.equal(
    htmlToMarkdown(html, 'https://duma-business.com/pricing'),
    [
      '---',
      'title: "Pricing | DUMA"',
      'description: "Free & fair"',
      'url: https://duma-business.com/pricing',
      '---',
      '',
      '# Pricing',
      '',
      'Free **forever** — [start](https://duma-business.com/sign-up).',
      '',
      'No card Free setup',
      '',
      '- Till',
      '- Stock',
      '',
      '| Plan | Price |',
      '| --- | --- |',
      '| Free | £0 |',
      '',
      '```sh',
      'curl  /v1',
      '  -H x',
      '```',
      '',
    ].join('\n'),
  );
});
