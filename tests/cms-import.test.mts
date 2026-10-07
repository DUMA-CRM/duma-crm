import assert from 'node:assert/strict';
import test from 'node:test';

const { autoMap, coerce, htmlToMarkdown, isImportablePost, parseCsv, rowsToEntries } = await import('../lib/utils/cms-import.ts');

test('CSV handles quotes, commas, newlines in quotes, CRLF and a BOM', () => {
  const text = '﻿Title,Body\r\n"Latte, oat","Line one\nLine ""two"""\r\nMocha,\r\n\r\n';
  assert.deepEqual(parseCsv(text), [
    ['Title', 'Body'],
    ['Latte, oat', 'Line one\nLine "two"'],
    ['Mocha', ''],
  ]);
});

const fields = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'price', label: 'Price (£)', type: 'number' },
  { key: 'vegan', label: 'Vegan', type: 'boolean' },
  { key: 'tags', label: 'Tags', type: 'select', multiple: true, options: ['hot', 'iced'] },
  { key: 'hero', label: 'Hero', type: 'media' },
] as const;

test('columns map to fields by key or label, once each; media is not importable', () => {
  assert.deepEqual(autoMap(['TITLE', 'price £', 'Vegan?', 'hero', 'Title'], fields as never), ['title', 'price', 'vegan', '', '']);
});

test('cells become the value their field stores', () => {
  assert.equal(coerce('1,250.5', fields[1] as never), 1250.5);
  assert.equal(coerce('Yes', fields[2] as never), true);
  assert.equal(coerce('maybe', fields[2] as never), null);
  assert.deepEqual(coerce('hot; iced', fields[3] as never), ['hot', 'iced']);
  assert.equal(coerce('2026-10-06', { key: 'd', label: 'D', type: 'date' } as never), '2026-10-06');
  const entries = rowsToEntries(
    [
      ['Latte', '3.2', 'no'],
      ['', '', ''],
    ],
    ['title', 'price', 'vegan'],
    fields as never,
  );
  assert.deepEqual(entries, [{ title: 'Latte', price: 3.2, vegan: false }]);
});

/** A tiny DOM, enough for the converter. */
const el = (name: string, children: unknown[] = [], attrs: Record<string, string> = {}) => ({
  nodeType: 1,
  nodeName: name.toUpperCase(),
  textContent: children.map((child) => (typeof child === 'string' ? child : (child as { textContent: string }).textContent)).join(''),
  childNodes: children.map((child) =>
    typeof child === 'string' ? { nodeType: 3, nodeName: '#text', textContent: child, childNodes: [] } : child,
  ),
  getAttribute: (key: string) => attrs[key] ?? null,
});

test('WordPress HTML becomes Markdown', () => {
  const body = el('body', [
    el('h2', ['Autumn ', el('em', ['menu'])]),
    el('p', ['Try the ', el('a', ['pumpkin latte'], { href: 'https://cafe.example/p' }), ', ', el('strong', ['now']), '.']),
    el('figure', [el('img', [], { src: 'https://cafe.example/cup.jpg', alt: 'A cup' })]),
    el('ul', [el('li', ['Oat']), el('li', ['Soy'])]),
    el('blockquote', [el('p', ['Best in town'])]),
  ]);
  assert.equal(
    htmlToMarkdown(body as never),
    '## Autumn _menu_\n\nTry the [pumpkin latte](https://cafe.example/p), **now**.\n\n![A cup](https://cafe.example/cup.jpg)\n\n- Oat\n- Soy\n\n> Best in town',
  );
});

test('only real posts and pages are imported', () => {
  assert.equal(isImportablePost('post', 'publish'), true);
  assert.equal(isImportablePost('attachment', 'inherit'), false);
  assert.equal(isImportablePost('post', 'trash'), false);
});
