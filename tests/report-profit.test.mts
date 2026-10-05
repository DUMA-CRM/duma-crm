import assert from 'node:assert/strict';
import test from 'node:test';

import { periodTarget, primeCostBand, profitSummary, targetDays } from '../lib/utils/report-profit.ts';

const sites = [
  { id: 'a', dailyRevenueTarget: '1200.00' },
  { id: 'b', dailyRevenueTarget: '800' },
  { id: 'c', dailyRevenueTarget: null },
  { id: 'd', dailyRevenueTarget: '500', isActive: false },
];

test('the target is one site’s, or the sum of every active site’s', () => {
  assert.deepEqual(periodTarget(sites, 'a'), { daily: 1200, sites: 1, missing: 0 });
  assert.deepEqual(periodTarget(sites, ''), { daily: 2000, sites: 2, missing: 1 });
  assert.equal(periodTarget(sites, 'c'), null);
  assert.equal(periodTarget([], ''), null);
});

test('target days count only the days that have happened', () => {
  const days = [
    { date: '2026-10-01', value: 1300 },
    { date: '2026-10-02', value: 900 },
    { date: '2026-10-03', value: 1200 },
    { date: '2026-10-04', value: 0 },
    { date: '2026-10-05', value: 0 },
  ];
  assert.deepEqual(targetDays(days, 1200, '2026-10-04'), { hit: 2, of: 4 });
});

test('prime cost scales the costed food rate to all sales and adds labour', () => {
  const summary = profitSummary({ salesExVat: 10000, costedSalesExVat: 8000, costedCost: 2400, labour: 3000 })!;
  assert.equal(summary.foodCostPct, 0.3);
  assert.equal(summary.foodCost, 3000);
  assert.equal(summary.grossProfit, 7000);
  assert.equal(summary.labourPct, 0.3);
  assert.equal(summary.primeCost, 6000);
  assert.equal(summary.primeCostPct, 0.6);
  assert.equal(summary.coverage, 0.8);
});

test('no sales or no costed recipes means no profit figure, and missing labour leaves prime cost open', () => {
  assert.equal(profitSummary({ salesExVat: 0, costedSalesExVat: 0, costedCost: 0, labour: 100 }), null);
  assert.equal(profitSummary({ salesExVat: 5000, costedSalesExVat: 0, costedCost: 0, labour: 100 }), null);
  const noLabour = profitSummary({ salesExVat: 5000, costedSalesExVat: 5000, costedCost: 1500, labour: null })!;
  assert.equal(noLabour.primeCostPct, null);
  assert.equal(noLabour.grossProfit, 3500);
});

test('prime cost bands follow the 60 / 65 rule of thumb', () => {
  assert.equal(primeCostBand(0.58), 'healthy');
  assert.equal(primeCostBand(0.6), 'healthy');
  assert.equal(primeCostBand(0.63), 'watch');
  assert.equal(primeCostBand(0.7), 'high');
});
