import assert from 'node:assert/strict';
import test from 'node:test';

const { scrambleFrame, watchSave } = await import('../lib/utils/motion-feedback.ts');

const zero = () => 0;

test('a finished scramble is the secret itself', () => {
  assert.equal(scrambleFrame('cms_live_Ab12', 1, zero), 'cms_live_Ab12');
  assert.equal(scrambleFrame('cms_live_Ab12', 7, zero), 'cms_live_Ab12');
});

test('an unstarted scramble keeps length and punctuation but hides every character', () => {
  const frame = scrambleFrame('cms_live_Ab12', 0, zero);
  assert.equal(frame.length, 13);
  assert.equal(frame, 'AAA_AAAA_AAAA');
});

test('characters settle left to right', () => {
  assert.equal(scrambleFrame('abcdefgh', 0.5, zero), 'abcdAAAA');
});

test('an empty secret scrambles to nothing', () => {
  assert.equal(scrambleFrame('', 0.5), '');
});

const idle = { saving: false, dirty: true, awaiting: false };
const inFlight = { saving: true, dirty: true, awaiting: false };

test('a save that ends clean is saved at once', () => {
  assert.deepEqual(watchSave(inFlight, { saving: false, dirty: false }), {
    watch: { saving: false, dirty: false, awaiting: false },
    saved: true,
  });
});

test('a save that ends dirty waits for the refetch to clean the form', () => {
  const ended = watchSave(inFlight, { saving: false, dirty: true });
  assert.equal(ended.saved, false);
  assert.equal(ended.watch.awaiting, true);
  assert.equal(watchSave(ended.watch, { saving: false, dirty: false }).saved, true);
});

test('once the wait is dropped, a form coming back clean is not a save', () => {
  const ended = watchSave(inFlight, { saving: false, dirty: true });
  assert.equal(watchSave({ ...ended.watch, awaiting: false }, { saving: false, dirty: false }).saved, false);
});

test('a discard with no save in flight is not a save', () => {
  assert.equal(watchSave(idle, { saving: false, dirty: false }).saved, false);
});

test('starting another save drops the old wait', () => {
  const ended = watchSave(inFlight, { saving: false, dirty: true });
  assert.equal(watchSave(ended.watch, { saving: true, dirty: true }).watch.awaiting, false);
});
