import assert from 'node:assert/strict';
import test from 'node:test';

import { accentInk, contrastRatio, parseHex, relativeLuminance } from '../../lib/utils/form-accent.ts';

test('parseHex reads short and long hex, and refuses anything else', () => {
  assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
  assert.deepEqual(parseHex('#2B2A28'), [43, 42, 40]);
  assert.equal(parseHex('var(--primary)'), null);
  assert.equal(parseHex('#12345'), null);
});

test('contrast ratio matches WCAG: black on white is 21, a colour on itself is 1', () => {
  const white = relativeLuminance([255, 255, 255]);
  const black = relativeLuminance([0, 0, 0]);
  assert.equal(Math.round(contrastRatio(white, black)), 21);
  assert.equal(contrastRatio(white, white), 1);
});

test('a guest form keeps readable text on any accent a workspace picks', () => {
  // Dark accents keep white text.
  assert.equal(accentInk('#2b2a28'), '#ffffff');
  assert.equal(accentInk('#1d4ed8'), '#ffffff');
  // Pale accents switch to dark ink — white on yellow is about 1.1:1.
  assert.equal(accentInk('#facc15'), '#141412');
  assert.equal(accentInk('#a7f3d0'), '#141412');
  // No accent (the brand green) or an unreadable value: white, as before.
  assert.equal(accentInk(null), '#ffffff');
  assert.equal(accentInk('var(--primary)'), '#ffffff');
});
