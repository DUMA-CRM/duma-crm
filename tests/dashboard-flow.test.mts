import assert from 'node:assert/strict';
import test from 'node:test';

const { dealColumns, flowSegments } = await import('../lib/utils/dashboard-flow.ts');

test('half-width cards that follow one another flow together; wider ones stay rows', () => {
  const placements = [
    { key: 'strip', width: 12 },
    { key: 'chart', width: 8 },
    { key: 'side', width: 4 },
    { key: 'a', width: 6 },
    { key: 'b', width: 6 },
    { key: 'c', width: 6 },
    { key: 'wide', width: 12 },
    { key: 'd', width: 6 },
  ];
  assert.deepEqual(
    flowSegments(placements).map((segment) => [segment.kind, segment.items.map((item) => item.key).join(' ')]),
    [
      ['row', 'strip chart side'],
      ['columns', 'a b c'],
      ['row', 'wide'],
      ['columns', 'd'],
    ],
  );
  assert.deepEqual(flowSegments([]), []);
});

test('dealt left, right, left — the order still reads across', () => {
  assert.deepEqual(dealColumns(['a', 'b', 'c', 'd', 'e'], 2), [
    ['a', 'c', 'e'],
    ['b', 'd'],
  ]);
  assert.deepEqual(dealColumns(['a', 'b'], 1), [['a', 'b']]);
  assert.deepEqual(dealColumns(['a'], 0), [['a']]);
});
