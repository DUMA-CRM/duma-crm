import assert from 'node:assert/strict';
import test from 'node:test';

import { type AutosaveStatus, type AutosaveTimers, createAutosaver } from '../../lib/utils/autosave.ts';

/** A clock the test moves by hand. */
function fakeTimers() {
  let now = 0;
  let next = 1;
  const queue = new Map<number, { at: number; run: () => void }>();
  const timers: AutosaveTimers = {
    set: (run, ms) => {
      const id = next++;
      queue.set(id, { at: now + ms, run });
      return id;
    },
    clear: (handle) => void queue.delete(handle as number),
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, entry] of [...queue].sort((a, b) => a[1].at - b[1].at)) {
      if (entry.at > now) continue;
      queue.delete(id);
      entry.run();
    }
  };
  return { timers, advance };
}

/** A save the test resolves or rejects when it chooses. */
function controlledSave() {
  const calls: { value: string; resolve: () => void; reject: (error: unknown) => void }[] = [];
  const save = (value: string) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ value, resolve, reject });
    });
  return { calls, save };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('saves once, a delay after the last change', async () => {
  const { timers, advance } = fakeTimers();
  const { calls, save } = controlledSave();
  const saver = createAutosaver({ delay: 1000, save, timers });

  saver.schedule('a');
  advance(600);
  saver.schedule('ab');
  advance(600);
  assert.equal(calls.length, 0, 'still typing');
  advance(400);
  assert.deepEqual(
    calls.map((call) => call.value),
    ['ab'],
  );
});

test('never overlaps: a change during a save waits, then only the latest goes', async () => {
  const { timers, advance } = fakeTimers();
  const { calls, save } = controlledSave();
  const statuses: AutosaveStatus[] = [];
  const saver = createAutosaver({ delay: 1000, save, timers, onStatus: (status) => statuses.push(status) });

  saver.schedule('one');
  advance(1000);
  assert.equal(calls.length, 1);
  saver.schedule('two');
  saver.schedule('three');
  advance(1000);
  assert.equal(calls.length, 1, 'the first save is still in flight');

  calls[0]!.resolve();
  await tick();
  assert.deepEqual(
    calls.map((call) => call.value),
    ['one', 'three'],
  );
  calls[1]!.resolve();
  await tick();
  assert.equal(saver.status(), 'saved');
  assert.equal(saver.busy(), false);
  assert.deepEqual(statuses.at(-1), 'saved');
});

test('flush sends what is pending now and resolves once it has landed', async () => {
  const { timers } = fakeTimers();
  const { calls, save } = controlledSave();
  const saver = createAutosaver({ delay: 1000, save, timers });

  saver.schedule('draft');
  const flushed = saver.flush();
  await tick();
  assert.deepEqual(
    calls.map((call) => call.value),
    ['draft'],
  );
  calls[0]!.resolve();
  assert.equal(await flushed, true);
});

test('flush waits for the save in flight, then sends the newer change', async () => {
  const { timers, advance } = fakeTimers();
  const { calls, save } = controlledSave();
  const saver = createAutosaver({ delay: 1000, save, timers });

  saver.schedule('one');
  advance(1000);
  saver.schedule('two');
  const flushed = saver.flush();
  await tick();
  assert.equal(calls.length, 1, 'no second save while the first is in flight');
  calls[0]!.resolve();
  await tick();
  assert.deepEqual(
    calls.map((call) => call.value),
    ['one', 'two'],
  );
  calls[1]!.resolve();
  assert.equal(await flushed, true);
});

test('a failed save is kept: Retry sends it again', async () => {
  const { timers, advance } = fakeTimers();
  const { calls, save } = controlledSave();
  const saver = createAutosaver({ delay: 1000, save, timers });

  saver.schedule('draft');
  advance(1000);
  calls[0]!.reject(new Error('offline'));
  await tick();
  assert.equal(saver.status(), 'error');
  assert.equal(saver.busy(), true, 'the change is still unsaved');

  const retried = saver.retry();
  await tick();
  assert.equal(calls[1]!.value, 'draft');
  calls[1]!.resolve();
  assert.equal(await retried, true);
  assert.equal(saver.status(), 'saved');
});

test('flush reports a failure instead of pretending it saved', async () => {
  const { timers } = fakeTimers();
  const { calls, save } = controlledSave();
  const saver = createAutosaver({ delay: 1000, save, timers });

  saver.schedule('draft');
  const flushed = saver.flush();
  await tick();
  calls[0]!.reject(new Error('400'));
  assert.equal(await flushed, false);
});

test('a conflict stops autosaving: later changes are never sent over someone else’s', async () => {
  const { timers, advance } = fakeTimers();
  const { calls, save } = controlledSave();
  const conflict = new Error('409');
  const saver = createAutosaver({ delay: 1000, save, timers, isConflict: (error) => error === conflict });

  saver.schedule('mine');
  advance(1000);
  calls[0]!.reject(conflict);
  await tick();
  assert.equal(saver.status(), 'conflict');

  saver.schedule('more');
  advance(5000);
  assert.equal(await saver.flush(), false);
  assert.equal(calls.length, 1);
});

test('dispose stops the timer', () => {
  const { timers, advance } = fakeTimers();
  const { calls, save } = controlledSave();
  const saver = createAutosaver({ delay: 1000, save, timers });
  saver.schedule('draft');
  saver.dispose();
  advance(5000);
  assert.equal(calls.length, 0);
});
