import assert from 'node:assert/strict';
import test from 'node:test';

const {
  APP_BACKGROUND,
  MAX_DRAWING_CHARS,
  drawingNoteSnapshot,
  emptyDrawing,
  isDrawingNote,
  newDrawingNote,
  parseDrawing,
  parseDrawingNote,
  serializeDrawing,
} = await import('../lib/utils/note-drawing.ts');

test('a drawing round-trips; anything unreadable is treated as no drawing', () => {
  const scene = { elements: [{ id: 'a', type: 'rectangle' }], background: '#fef3c7' };
  assert.deepEqual(parseDrawing(serializeDrawing(scene)), scene);
  assert.equal(parseDrawing(null), null);
  assert.equal(parseDrawing('not json'), null);
  assert.equal(parseDrawing('{"elements":"nope"}'), null);
  assert.deepEqual(parseDrawing('{"elements":[1,{"id":"b"}]}'), { elements: [{ id: 'b' }], background: '#ffffff' });
  assert.deepEqual(emptyDrawing(), { elements: [], background: '#ffffff' });
});

test('a drawing too big to keep in a note is refused, not truncated', () => {
  const huge = { elements: [{ text: 'x'.repeat(MAX_DRAWING_CHARS) }], background: '#fff' };
  assert.equal(serializeDrawing(huge), null);
});

test('a drawing note is told apart from a text note by its content', () => {
  assert.equal(isDrawingNote(newDrawingNote()), true);
  assert.equal(isDrawingNote({ type: 'doc', content: [] }), false);
  assert.equal(isDrawingNote({}), false);
  assert.equal(isDrawingNote(null), false);
});

test('a drawing note saves the words on its canvas, top to bottom, under its title', () => {
  const snapshot = drawingNoteSnapshot({
    title: ' Floor plan ',
    background: '#ffffff',
    elements: [
      { id: 't2', type: 'text', text: 'Bar', x: 0, y: 200 },
      { id: 't1', type: 'text', text: 'Kitchen', originalText: 'Kitchen', x: 0, y: 10 },
      { id: 'gone', type: 'text', text: 'Old', x: 0, y: 0, isDeleted: true },
      { id: 'img', type: 'image', fileId: 'f1', x: 0, y: 0 },
      { id: 'vid', type: 'embeddable', link: '/be/v1/cms/files/tour.mp4', x: 0, y: 0 },
    ],
    files: { f1: { mimeType: 'image/png', url: '/be/v1/cms/files/plan.png' }, unused: { mimeType: 'image/png', url: '/x.png' } },
  });
  assert.ok(snapshot);
  assert.equal(snapshot.text, 'Floor plan\nKitchen\nBar');
  assert.equal(
    snapshot.markdown,
    '# Floor plan\n\nKitchen\n\nBar\n\n![Photo](/be/v1/cms/files/plan.png)\n\n[▶ Video](/be/v1/cms/files/tour.mp4)',
  );
  assert.deepEqual(Object.keys(snapshot.content.files), ['f1']);
  assert.equal(snapshot.content.elements.length, 4);
  assert.equal(snapshot.content.title, 'Floor plan');
  assert.equal(snapshot.content.background, APP_BACKGROUND);
});

test('an untitled drawing note still has a title, and reads back what it saved', () => {
  const snapshot = drawingNoteSnapshot({ title: '', background: '#fef3c7', elements: [], files: {} });
  assert.equal(snapshot?.text, 'Untitled drawing');
  assert.deepEqual(parseDrawingNote(snapshot?.content), { type: 'drawing', title: '', elements: [], background: '#fef3c7', files: {} });
  assert.deepEqual(parseDrawingNote({ type: 'drawing', files: { a: { url: 1 } } }), newDrawingNote());
});

test('a drawing note too big to keep is refused', () => {
  const huge = [{ type: 'text', text: 'x'.repeat(MAX_DRAWING_CHARS) }];
  assert.equal(drawingNoteSnapshot({ title: '', background: '#fff', elements: huge, files: {} }), null);
});

test('a drawing follows the app’s background until someone picks a colour', () => {
  assert.equal(newDrawingNote().background, 'transparent');
  // Missing, Excalidraw's white, or transparent: the app's background.
  assert.equal(parseDrawingNote({ type: 'drawing' }).background, APP_BACKGROUND);
  assert.equal(parseDrawingNote({ type: 'drawing', elements: [], background: '#FFFFFF' }).background, APP_BACKGROUND);
  assert.equal(drawingNoteSnapshot({ title: '', background: '#fff', elements: [], files: {} })?.content.background, APP_BACKGROUND);
  // A colour someone chose is kept.
  assert.equal(parseDrawingNote({ type: 'drawing', elements: [], background: '#fef3c7' }).background, '#fef3c7');
});
