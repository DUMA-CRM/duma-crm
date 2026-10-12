import assert from 'node:assert/strict';
import test from 'node:test';

const { rankSwitcher, switcherScore, titleParts } = await import('../lib/utils/notes-switcher.ts');

const notes = [
  { id: 'a', title: 'Closing the till', updatedAt: '2026-10-01T10:00:00Z' },
  { id: 'b', title: 'Disclosure policy', updatedAt: '2026-10-09T10:00:00Z' },
  { id: 'c', title: 'Opening checklist', updatedAt: '2026-10-05T10:00:00Z' },
  { id: 'd', title: '', updatedAt: '2026-10-10T10:00:00Z' },
];

test('a title you can type the start of beats one that only contains it', () => {
  assert.deepEqual(
    rankSwitcher(notes, 'clo').map((note) => note.id),
    ['a', 'b'],
  );
  assert.equal(switcherScore('Closing the till', 'till clo') !== null, true);
  assert.equal(switcherScore('Closing the till', 'oven'), null);
});

test('with nothing typed, the most recently edited come first', () => {
  assert.deepEqual(
    rankSwitcher(notes, '  ').map((note) => note.id),
    ['d', 'b', 'c', 'a'],
  );
  assert.deepEqual(
    rankSwitcher(notes, 'new').map((note) => note.id),
    ['d'],
  );
  assert.equal(rankSwitcher(notes, '', 2).length, 2);
});

test('the typed parts of a title are marked, wherever they fall in a word', () => {
  assert.deepEqual(titleParts('Closing the till', 'los TIL'), [
    { text: 'C', match: false },
    { text: 'los', match: true },
    { text: 'ing the ', match: false },
    { text: 'til', match: true },
    { text: 'l', match: false },
  ]);
  assert.deepEqual(titleParts('Bar', ''), [{ text: 'Bar', match: false }]);
  assert.deepEqual(titleParts('', 'x'), []);
});
