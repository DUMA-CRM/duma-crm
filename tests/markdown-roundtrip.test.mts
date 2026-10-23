import assert from 'node:assert/strict';
import test from 'node:test';

const { survivesRoundTrip } = await import('../lib/utils/markdown-roundtrip.ts');

test('survivesRoundTrip: tidied Markdown that renders the same is fine', () => {
  assert.equal(survivesRoundTrip('Hello _there_ and __you__', 'Hello *there* and **you**'), true);
  assert.equal(survivesRoundTrip('* one\n* two', '- one\n- two'), true);
  assert.equal(survivesRoundTrip('- one\n\n- two', '- one\n- two'), true);
  assert.equal(survivesRoundTrip('', ''), true);
});

test('survivesRoundTrip: a change readers would see is not', () => {
  assert.equal(survivesRoundTrip('Hello there', 'Hello  where'), false);
  assert.equal(survivesRoundTrip('# Title', '## Title'), false);
  assert.equal(survivesRoundTrip('| a | b |\n| - | - |\n| 1 | 2 |', 'a b 1 2'), false);
});

test('survivesRoundTrip: callouts and bare video links must survive literally', () => {
  assert.equal(survivesRoundTrip('> [!NOTE]\n> Mind the step.', '> \\[!NOTE\\]\n> Mind the step.'), false);
  assert.equal(survivesRoundTrip('> [!NOTE]\n> Mind the step.', '> [!NOTE]\n> Mind the step.'), true);
  const video = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  assert.equal(survivesRoundTrip(`Watch:\n\n${video}`, `Watch:\n\n[${video}](${video})`), false);
  assert.equal(survivesRoundTrip(`Watch:\n\n${video}`, `Watch:\n\n${video}`), true);
});
