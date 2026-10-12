import assert from 'node:assert/strict';
import test from 'node:test';

const { noteHref, noteIdFromHref, noteLinkQuery } = await import('../lib/utils/note-links.ts');

const id = '0f8fad5b-d9cb-469f-a165-70867728950e';

test('a note link is found relative or absolute, and nothing else counts', () => {
  assert.equal(noteIdFromHref(noteHref(id)), id);
  assert.equal(noteIdFromHref(`https://crm.dudych.cc/notes?folder=x&note=${id.toUpperCase()}`), id);
  assert.equal(noteIdFromHref(`/notes?note=${id}#top`), id);
  assert.equal(noteIdFromHref('https://example.com/blog?note=nope'), null);
  assert.equal(noteIdFromHref(`/notes?note=${id}x`), null);
  assert.equal(noteIdFromHref(null), null);
});

test('[[ opens the picker with what follows it, until it is closed or the line ends', () => {
  assert.equal(noteLinkQuery('See [['), '');
  assert.equal(noteLinkQuery('See [[clos'), 'clos');
  assert.equal(noteLinkQuery('See [[Closing the till'), 'Closing the till');
  assert.equal(noteLinkQuery('See [[done]] after'), null);
  assert.equal(noteLinkQuery('See [x'), null);
  assert.equal(noteLinkQuery('[[\nnext line'), null);
});

test('a link made by [[ follows its note when it is renamed; text someone wrote stays', async () => {
  const { relinkedText } = await import('../lib/utils/note-links.ts');
  // Made by the picker, never edited: follows the rename.
  assert.equal(relinkedText({ text: 'Closing', savedTitle: 'Closing' }, 'Closing the till'), 'Closing the till');
  // Already right.
  assert.equal(relinkedText({ text: 'Closing the till', savedTitle: 'Closing' }, 'Closing the till'), null);
  // Its text was changed by hand: left alone.
  assert.equal(relinkedText({ text: 'see here', savedTitle: 'Closing' }, 'Closing the till'), null);
  // Made before titles were remembered: follows, unless it's a pasted URL.
  assert.equal(relinkedText({ text: 'Closing', savedTitle: null }, 'Closing the till'), 'Closing the till');
  assert.equal(relinkedText({ text: '/notes?note=x', savedTitle: null }, 'Closing the till'), null);
  assert.equal(relinkedText({ text: 'https://duma.app/notes?note=x', savedTitle: null }, 'Closing the till'), null);
  // A title can't become empty text.
  assert.equal(relinkedText({ text: 'Closing', savedTitle: 'Closing' }, '  '), null);
});
