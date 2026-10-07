import assert from 'node:assert/strict';
import test from 'node:test';

const { shiftBarGeometry } = await import('../lib/utils/shift-bar.ts');

const at = (hhmm: string) => `2026-10-05T${hhmm}:00Z`;
const NOW = Date.parse(at('12:00'));

test('a shift worked exactly as planned fills the bar twice', () => {
  const bar = shiftBarGeometry({
    plannedStart: at('09:00'),
    plannedEnd: at('17:00'),
    workedStart: at('09:00'),
    workedEnd: at('17:00'),
    now: NOW,
  });
  assert.deepEqual(bar, { planned: { left: 0, width: 100 }, worked: { left: 0, width: 100 } });
});

test('a late start pushes the worked band right of the planned one', () => {
  const bar = shiftBarGeometry({
    plannedStart: at('09:00'),
    plannedEnd: at('17:00'),
    workedStart: at('11:00'),
    workedEnd: at('17:00'),
    now: NOW,
  });
  assert.equal(bar?.planned?.left, 0);
  assert.equal(bar?.worked?.left, 25);
  assert.equal(bar?.worked?.width, 75);
});

test('a running shift is drawn to now', () => {
  const bar = shiftBarGeometry({ plannedStart: at('08:00'), plannedEnd: at('16:00'), workedStart: at('08:00'), workedEnd: null, now: NOW });
  assert.equal(bar?.worked?.width, 50);
});

test('unplanned work and nothing at all', () => {
  const bar = shiftBarGeometry({ workedStart: at('10:00'), workedEnd: at('12:00'), now: NOW });
  assert.equal(bar?.planned, null);
  assert.deepEqual(bar?.worked, { left: 0, width: 100 });
  assert.equal(shiftBarGeometry({ now: NOW }), null);
});
