import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentChartCard } from '../lib/ai/agent-types.ts';
import { formatAgentChartValue, normaliseAgentChart } from '../lib/ai/chart.ts';

test('a valid comparison chart keeps exact finite values', () => {
  const card: AgentChartCard = {
    kind: 'chart',
    type: 'bar',
    title: 'Net revenue comparison',
    format: 'currency',
    series: [{ key: 'value', label: 'Net revenue' }],
    points: [
      { label: 'Last week', values: { value: 120.5 } },
      { label: 'This week', values: { value: 143.25 } },
    ],
  };

  assert.deepEqual(normaliseAgentChart(card), card);
});

test('a side-by-side period comparison keeps the column presentation', () => {
  const card: AgentChartCard = {
    kind: 'chart',
    type: 'column',
    title: 'Orders comparison',
    format: 'number',
    series: [{ key: 'orders', label: 'Orders' }],
    points: [
      { label: 'Last week', values: { orders: 8 } },
      { label: 'This week', values: { orders: 12 } },
    ],
  };

  assert.equal(normaliseAgentChart(card)?.type, 'column');
});

test('malformed values, duplicate series and excess bar points are bounded', () => {
  const card: AgentChartCard = {
    kind: 'chart',
    type: 'bar',
    title: '  Sales   comparison  ',
    format: 'number',
    series: [
      { key: 'sales', label: 'Sales' },
      { key: 'sales', label: 'Duplicate' },
      { key: '', label: 'Missing key' },
    ],
    points: Array.from({ length: 14 }, (_, index) => ({
      label: `Point ${index + 1}`,
      values: { sales: index === 3 ? Number.NaN : index },
    })),
  };

  const result = normaliseAgentChart(card);
  assert.equal(result?.title, 'Sales comparison');
  assert.equal(result?.series.length, 1);
  assert.equal(result?.points.length, 10);
  assert.equal(
    result?.points.some((point) => point.label === 'Point 4'),
    false,
  );
});

test('a line chart needs two usable points and chart values use operator-friendly formats', () => {
  const card: AgentChartCard = {
    kind: 'chart',
    type: 'line',
    title: 'Orders',
    format: 'number',
    series: [{ key: 'orders', label: 'Orders' }],
    points: [{ label: '09:00', values: { orders: 4 } }],
  };

  assert.equal(normaliseAgentChart(card), null);
  assert.equal(formatAgentChartValue(12.5, 'currency'), '£12.50');
  assert.equal(formatAgentChartValue(28.94, 'percent'), '28.9%');
  assert.equal(formatAgentChartValue(1200, 'number'), '1,200');
});
