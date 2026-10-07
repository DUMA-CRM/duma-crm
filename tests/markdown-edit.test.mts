import assert from 'node:assert/strict';
import test from 'node:test';

const { applyEdit, continueList, imageMarkdown, insertBlock, insertLink, toggleLinePrefix, toggleWrap, uploadPlaceholder } =
  await import('../lib/utils/markdown-edit.ts');

/** Run an edit and show the result with the selection marked as [ ]. */
function run(text: string, start: number, end: number, edit: (text: string, start: number, end: number) => ReturnType<typeof toggleWrap>) {
  const result = edit(text, start, end);
  const next = applyEdit(text, result);
  return `${next.slice(0, result.selectFrom)}[${next.slice(result.selectFrom, result.selectTo)}]${next.slice(result.selectTo)}`;
}

test('bold wraps the selection, inserts a placeholder when empty, and unwraps', () => {
  assert.equal(
    run('make this bold', 5, 9, (t, s, e) => toggleWrap(t, s, e, '**', 'bold text')),
    'make **[this]** bold',
  );
  assert.equal(
    run('ab', 1, 1, (t, s, e) => toggleWrap(t, s, e, '**', 'bold text')),
    'a**[bold text]**b',
  );
  assert.equal(
    run('make **this** bold', 7, 11, (t, s, e) => toggleWrap(t, s, e, '**', 'x')),
    'make [this] bold',
  );
  assert.equal(
    run('make **this** bold', 5, 13, (t, s, e) => toggleWrap(t, s, e, '**', 'x')),
    'make [this] bold',
  );
});

test('a link takes the selection as its text and selects the url', () => {
  assert.equal(run('see docs here', 4, 8, insertLink), 'see [docs]([url]) here');
});

test('line prefixes apply to every selected line and toggle off', () => {
  assert.equal(applyEdit('one\ntwo', toggleLinePrefix('one\ntwo', 0, 7, 'bullet')), '- one\n- two');
  assert.equal(applyEdit('- one\n- two', toggleLinePrefix('- one\n- two', 0, 11, 'bullet')), 'one\ntwo');
  assert.equal(applyEdit('a\nb\nc', toggleLinePrefix('a\nb\nc', 0, 5, 'number')), '1. a\n2. b\n3. c');
  // Switching list kind swaps the marker rather than stacking it.
  assert.equal(applyEdit('- a', toggleLinePrefix('- a', 0, 3, 'task')), '- [ ] a');
  assert.equal(applyEdit('intro\nTitle', toggleLinePrefix('intro\nTitle', 8, 8, 'heading')), 'intro\n### Title');
});

test('a block lands on its own lines at the caret, with blank lines around it', () => {
  const image = '![Cup](https://x/cup.webp)';
  assert.equal(applyEdit('First para.Second.', insertBlock('First para.Second.', 11, 11, image)), `First para.\n\n${image}\n\nSecond.`);
  assert.equal(applyEdit('', insertBlock('', 0, 0, image)), `${image}\n`);
  assert.equal(applyEdit('Para\n\n', insertBlock('Para\n\n', 6, 6, image)), `Para\n\n${image}\n`);
});

test('image markdown escapes alt text and wraps awkward URLs', () => {
  assert.equal(imageMarkdown('Latte [hot]', 'https://x/a.webp'), '![Latte \\[hot\\]](https://x/a.webp)');
  assert.equal(imageMarkdown('A', 'https://x/my file (1).png'), '![A](<https://x/my file (1).png>)');
  assert.notEqual(uploadPlaceholder('a.png', '1'), uploadPlaceholder('a.png', '2'));
});

test('Enter continues a list, numbers on, and ends it on an empty item', () => {
  const bullet = continueList('- milk', 6)!;
  assert.equal(applyEdit('- milk', bullet), '- milk\n- ');
  assert.equal(applyEdit('1. grind', continueList('1. grind', 8)!), '1. grind\n2. ');
  assert.equal(applyEdit('- [x] done', continueList('- [x] done', 10)!), '- [x] done\n- [ ] ');
  assert.equal(applyEdit('- a\n- ', continueList('- a\n- ', 6)!), '- a\n');
  assert.equal(continueList('plain text', 10), null);
});

const { insertNamedLink, insertCallout, calloutKind, videoEmbed } = await import('../lib/utils/markdown-edit.ts');

test('an entry link uses the selection as its text, else the entry title', () => {
  assert.equal(applyEdit('read this', insertNamedLink('read this', 5, 9, 'https://site/menu', 'Menu')), 'read [this](https://site/menu)');
  assert.equal(applyEdit('', insertNamedLink('', 0, 0, '/menu', 'Autumn [new] menu')), '[Autumn \\[new\\] menu](/menu)');
});

test('a callout quotes the selected lines under a GitHub alert marker', () => {
  assert.equal(applyEdit('Open late\nFridays', insertCallout('Open late\nFridays', 0, 18, 'TIP')), '> [!TIP]\n> Open late\n> Fridays\n');
  const empty = insertCallout('', 0, 0, 'NOTE');
  assert.equal(applyEdit('', empty).slice(empty.selectFrom, empty.selectTo), 'Something readers should know.');
  assert.equal(calloutKind('[!warning]'), 'WARNING');
  assert.equal(calloutKind('Just a quote'), null);
});

test('YouTube and Vimeo URLs are recognised as videos; other links are not', () => {
  assert.equal(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.id, 'dQw4w9WgXcQ');
  assert.equal(videoEmbed('https://youtu.be/dQw4w9WgXcQ')?.provider, 'youtube');
  assert.equal(videoEmbed('https://youtube.com/shorts/abcdefghijk')?.id, 'abcdefghijk');
  assert.equal(videoEmbed('https://vimeo.com/123456789')?.provider, 'vimeo');
  assert.equal(videoEmbed('https://example.com/watch?v=x'), null);
});
