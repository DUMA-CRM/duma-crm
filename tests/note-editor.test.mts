import assert from 'node:assert/strict';
import test from 'node:test';

const { NOTE_COLOURS, noteColourOf, noteColourValue, noteLength, noteMediaKind, normaliseNoteLink } =
  await import('../lib/utils/note-editor.ts');

test('a colour is stored as a theme variable and read back from one', () => {
  for (const colour of NOTE_COLOURS) {
    assert.equal(noteColourOf('text', noteColourValue('text', colour)), colour);
    assert.equal(noteColourOf('mark', noteColourValue('mark', colour)), colour);
  }
  assert.equal(noteColourValue('mark', 'yellow'), 'var(--note-mark-yellow)');
  // A text colour is not a highlight, and a pasted hex is no palette entry.
  assert.equal(noteColourOf('mark', 'var(--note-text-red)'), null);
  assert.equal(noteColourOf('text', '#ff0000'), null);
  assert.equal(noteColourOf('text', 'var(--note-text-teal)'), null);
  assert.equal(noteColourOf('text', null), null);
});

test('a typed link gets its scheme, and a script link is refused', () => {
  assert.equal(normaliseNoteLink('costa.co.uk/menu'), 'https://costa.co.uk/menu');
  assert.equal(normaliseNoteLink('  https://example.com '), 'https://example.com');
  assert.equal(normaliseNoteLink('ops@duma.coffee'), 'mailto:ops@duma.coffee');
  assert.equal(normaliseNoteLink('+44 (0)20 7946 0018'), 'tel:+4402079460018');
  assert.equal(normaliseNoteLink('/notes?view=shared'), '/notes?view=shared');
  assert.equal(normaliseNoteLink('javascript:alert(1)'), null);
  assert.equal(normaliseNoteLink(' JavaScript:alert(1)'), null);
  assert.equal(normaliseNoteLink('data:text/html,hi'), null);
  assert.equal(normaliseNoteLink(''), null);
  assert.equal(normaliseNoteLink('https://'), null);
});

test('only images and videos from Content go into a note', () => {
  assert.equal(noteMediaKind('image/webp'), 'image');
  assert.equal(noteMediaKind('video/mp4'), 'video');
  assert.equal(noteMediaKind('application/pdf'), null);
  assert.equal(noteMediaKind('audio/mpeg'), null);
});

test('the length counts words, not punctuation, and rounds reading time up to a minute', () => {
  assert.deepEqual(noteLength(''), { words: 0, characters: 0, minutes: 0 });
  assert.deepEqual(noteLength('Count the drawer — then print\nthe Z report.'), { words: 8, characters: 35, minutes: 1 });
  assert.equal(noteLength('кава '.repeat(500)).words, 500);
  assert.equal(noteLength('word '.repeat(500)).minutes, 3);
});
