import assert from 'node:assert/strict';
import test from 'node:test';

import { isTopDrawer, visibleDrawerControls } from '../lib/utils/drawer-focus.ts';

const control = (visible: boolean, inert = false) =>
  ({
    closest: () => (inert ? {} : null),
    getClientRects: () => (visible ? [{}] : []),
  }) as unknown as HTMLElement;

test('drawer focus excludes collapsed disclosure fields and inactive controls', () => {
  const summary = control(true);
  const hiddenField = control(false);
  const inactiveControl = control(true, true);
  const save = control(true);
  let selector = '';
  const panel = {
    querySelectorAll: (value: string) => {
      selector = value;
      return [summary, hiddenField, inactiveControl, save];
    },
  } as unknown as HTMLElement;
  assert.deepEqual(visibleDrawerControls(panel), [summary, save]);
  assert.match(selector, /summary/);
  assert.match(selector, /button:not\(\[disabled\]\)/);
});

test('only the visible top dialog handles Escape and traps focus', () => {
  const outer = control(true);
  const inner = control(true);
  const hidden = control(false);
  assert.equal(isTopDrawer(outer, [outer, inner, hidden]), false);
  assert.equal(isTopDrawer(inner, [outer, inner, hidden]), true);
  assert.equal(isTopDrawer(outer, [outer, hidden]), true);
});
