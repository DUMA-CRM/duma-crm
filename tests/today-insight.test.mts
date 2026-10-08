import assert from 'node:assert/strict';
import test from 'node:test';

const { todayInsight } = await import('../lib/utils/today-insight.ts');

const money = (value: number) => `£${value.toFixed(2)}`;
const base = {
  weekday: 'Thursday',
  comparable: true,
  open: true,
  orders: 100,
  typicalOrders: 100,
  averageOrder: 8,
  typicalAverageOrder: 8,
  refunds: 0,
  labourPercent: 25,
};

test('the most pressing reading wins', () => {
  assert.match(todayInsight({ ...base, orders: 0 }, money).line, /Nothing in yet/);
  assert.match(todayInsight({ ...base, labourPercent: 41.6, orders: 50 }, money).line, /Labour is 42%/);
  assert.match(todayInsight({ ...base, orders: 80 }, money).line, /20% fewer orders than a typical Thursday/);
  assert.match(todayInsight({ ...base, orders: 120 }, money).line, /20% busier/);
  assert.match(todayInsight({ ...base, averageOrder: 9 }, money).line, /Average order is 13% up/);
  assert.match(todayInsight({ ...base, refunds: 12 }, money).line, /£12.00 refunded/);
  assert.match(todayInsight(base, money).line, /Tracking a typical Thursday/);
});

test('without history it claims nothing it cannot back', () => {
  const insight = todayInsight({ ...base, comparable: false, orders: 40 }, money);
  assert.equal(insight.line, 'Ask for a quick read of the day so far.');
  assert.ok(insight.prompt.length > 0);
});
