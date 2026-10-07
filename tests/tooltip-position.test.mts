import assert from 'node:assert/strict';
import test from 'node:test';

const { placeTooltip } = await import('../lib/utils/tooltip-position.ts');

const viewport = { width: 1000, height: 800 };
const tooltip = { width: 100, height: 30 };
const anchorAt = (left: number, top: number) => ({ left, top, width: 20, height: 20 });

test('sits centred above the trigger when there is room', () => {
  const p = placeTooltip({ anchor: anchorAt(500, 400), tooltip, viewport, side: 'top' });
  assert.deepEqual(p, { side: 'top', top: 400 - 8 - 30, left: 510 - 50, arrow: 50 });
});

test('flips below when the top of the page would cut it off', () => {
  const p = placeTooltip({ anchor: anchorAt(500, 10), tooltip, viewport, side: 'top' });
  assert.equal(p.side, 'bottom');
  assert.equal(p.top, 10 + 20 + 8);
});

test('flips left when a right-side tooltip would run off screen', () => {
  const p = placeTooltip({ anchor: anchorAt(950, 400), tooltip, viewport, side: 'right' });
  assert.equal(p.side, 'left');
  assert.equal(p.left, 950 - 8 - 100);
});

test('slides left to stay on screen at the right edge, arrow still on the trigger', () => {
  const p = placeTooltip({ anchor: anchorAt(960, 400), tooltip, viewport, side: 'top' });
  assert.equal(p.side, 'top');
  assert.equal(p.left, 1000 - 8 - 100);
  assert.equal(p.arrow, 970 - p.left);
});

test('slides right at the left edge', () => {
  const p = placeTooltip({ anchor: anchorAt(0, 400), tooltip, viewport, side: 'top' });
  assert.equal(p.left, 8);
  assert.equal(p.arrow, 10);
});

test('end alignment lines up the right edges', () => {
  const p = placeTooltip({ anchor: anchorAt(500, 400), tooltip, viewport, side: 'top', align: 'end' });
  assert.equal(p.left + tooltip.width, 520);
});

test('with no room either side it keeps the roomier one and stays inside the page', () => {
  const tall = { width: 100, height: 500 };
  const p = placeTooltip({ anchor: anchorAt(500, 300), tooltip: tall, viewport, side: 'top' });
  assert.equal(p.side, 'bottom');
  assert.ok(p.top >= 8 && p.top + tall.height <= 800 - 8);
});
