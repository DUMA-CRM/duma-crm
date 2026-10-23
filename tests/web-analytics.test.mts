import assert from 'node:assert/strict';
import test from 'node:test';

const {
  CHANNEL_GROUPS,
  DEFAULT_FUNNEL,
  addStep,
  cleanFunnel,
  funnelProblem,
  moveStep,
  normalizeFunnel,
  removeStep,
  DEVICE_GROUPS,
  analyticsSnapshot,
  eventStack,
  arcPath,
  countryFlag,
  countryName,
  donutSlices,
  funnelRows,
  funnelSummary,
  heatLevel,
  heatmapPeak,
  hourKey,
  hoursIn,
  fillHours,
  iconSite,
  faviconPath,
  pagesPerVisit,
  sectionsFor,
} = await import('../lib/utils/web-analytics.ts');

test('saved funnel steps survive old layouts and junk', () => {
  const steps = [{ type: 'page', value: '/menu' }, { type: 'event', value: 'order_placed' }];
  assert.deepEqual(normalizeFunnel(steps), steps);
  assert.deepEqual(normalizeFunnel({ order: ['kpis'], hidden: [], funnel: steps }), steps, 'the older saved layout');
  assert.deepEqual(normalizeFunnel([{ type: 'page', value: '/' }]), DEFAULT_FUNNEL, 'one step is not a funnel');
  assert.deepEqual(normalizeFunnel('junk'), DEFAULT_FUNNEL);
});

test('editing a funnel keeps it between two and six steps', () => {
  const two: { type: 'page' | 'event'; value: string }[] = [{ type: 'page', value: '/' }, { type: 'page', value: '/menu' }];
  assert.equal(removeStep(two, 0), two, 'never below two');
  assert.deepEqual(moveStep(two, 0, 1).map((step) => step.value), ['/menu', '/']);
  assert.equal(moveStep(two, 0, -1), two);
  let many = two;
  for (let i = 0; i < 6; i++) many = addStep(many);
  assert.equal(many.length, 6, 'never above six');
  assert.equal(funnelProblem(addStep(two)), 'Name every step — a page path or an event.');
  assert.match(funnelProblem([...two, { type: 'page', value: '/menu ' }])!, /Step 3 is the same/);
  assert.equal(funnelProblem(two), null);
  assert.deepEqual(cleanFunnel([{ type: 'page', value: ' menu ' }, { type: 'event', value: ' order_placed' }]), [
    { type: 'page', value: '/menu' },
    { type: 'event', value: 'order_placed' },
  ]);
});

test('only what the shown widgets draw is fetched; the comparison only for totals', () => {
  assert.deepEqual(sectionsFor(['kpis'], 'current'), ['summary']);
  assert.deepEqual(sectionsFor(['kpis', 'events'], 'previous'), ['events', 'summary']);
  assert.deepEqual(sectionsFor(['countries', 'funnel'], 'previous'), []);
  assert.deepEqual(sectionsFor(['funnel'], 'current'), [], 'the funnel has its own endpoint');
});

test('channel colours follow the channel, not its rank', () => {
  const slices = donutSlices(
    [
      { key: 'direct', value: 50 },
      { key: 'organicSearch', value: 30 },
      { key: 'paidSearch', value: 10 },
      { key: 'email', value: 10 },
    ],
    (key) => key,
    CHANNEL_GROUPS,
  );
  const search = slices.find((slice) => slice.key === 'search')!;
  assert.equal(search.value, 40, 'paid and organic search together');
  assert.equal(search.slot, 1);
  assert.equal(slices.find((slice) => slice.key === 'direct')!.slot, 3, 'Direct keeps its slot though it is biggest');
  assert.deepEqual(slices.at(-1), { key: '__other', label: 'Other', value: 10, share: 0.1, slot: 0 });
  assert.equal(slices.reduce((sum, slice) => sum + slice.share, 0), 1);
});

test('without groups, the top four take slots and the rest folds into Other', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((key, index) => ({ key, value: 10 - index }));
  const slices = donutSlices(rows, (key) => key.toUpperCase());
  assert.deepEqual(slices.map((slice) => slice.slot), [1, 2, 3, 4, 0]);
  assert.equal(slices[0]!.label, 'A');
  assert.equal(slices[4]!.value, 11, 'e (6) and f (5) folded');
  assert.deepEqual(donutSlices([{ key: 'mobile', value: 0 }], String, DEVICE_GROUPS), []);
});

test('a ring arc is a closed path, and a whole ring still draws', () => {
  assert.match(arcPath(50, 50, 40, 20, 0, 0.25), /^M50\.00,10\.00A40,40 0 0 1 90\.00,50\.00L70\.00,50\.00A20,20 0 0 0 50\.00,30\.00Z$/);
  assert.match(arcPath(50, 50, 40, 20, 0, 1), /A40,40 0 1 1/);
});

test('heat levels step by share of the busiest hour; the peak is found', () => {
  assert.equal(heatLevel(0, 10), 0);
  assert.equal(heatLevel(1, 10), 1);
  assert.equal(heatLevel(10, 10), 5);
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  grid[4]![12] = 9;
  assert.deepEqual(heatmapPeak(grid), { day: 4, hour: 12, value: 9 });
  assert.equal(heatmapPeak(Array.from({ length: 7 }, () => Array<number>(24).fill(0))), null);
});

test('the funnel reports each step against the first and what was lost since the last', () => {
  const rows = funnelRows([
    { type: 'page', value: '/menu', visitors: 200 },
    { type: 'event', value: 'add_to_cart', visitors: 50 },
    { type: 'event', value: 'order_placed', visitors: 0 },
    { type: 'event', value: 'review', visitors: 0 },
  ]);
  assert.equal(rows[0]!.dropoff, null);
  assert.equal(rows[1]!.ofFirst, 0.25);
  assert.equal(rows[1]!.dropoff, 0.75);
  assert.equal(rows[2]!.dropoff, 1);
  assert.equal(rows[3]!.dropoff, null, 'nothing to lose from zero');
});

test('pages per visit, and countries by name with a flag', () => {
  assert.equal(pagesPerVisit({ pageviews: 30, visitors: 5, visits: 10, bounceRate: null, avgVisitSeconds: null }), 3);
  assert.equal(pagesPerVisit({ pageviews: 30, visitors: 5, visits: 0, bounceRate: null, avgVisitSeconds: null }), null);
  assert.equal(countryName('GB'), 'United Kingdom');
  assert.equal(countryName('(unknown)'), '(unknown)');
  assert.equal(countryFlag('gb'), '🇬🇧');
  assert.equal(countryFlag('XYZ'), '🌐');
});

test('each breakdown row knows whose icon to show, or none', () => {
  assert.equal(iconSite('referrers', 'google.com'), 'google.com');
  assert.equal(iconSite('referrers', '(direct)'), null);
  assert.equal(iconSite('browsers', 'crios'), 'chrome.com');
  assert.equal(iconSite('browsers', 'ios'), 'apple.com');
  assert.equal(iconSite('browsers', 'edge-chromium'), 'microsoftedge.com');
  assert.equal(iconSite('browsers', 'netscape'), null);
  assert.equal(iconSite('os', 'Windows 10'), 'microsoft.com');
  assert.equal(iconSite('os', 'Mac OS'), 'apple.com');
  assert.equal(iconSite('os', 'Android OS'), 'android.com');
  assert.equal(iconSite('os', 'BeOS'), null);
  assert.equal(iconSite('campaigns', 'Meta'), 'meta.com');
  assert.equal(iconSite('campaigns', 'newsletter'), null);
  assert.equal(iconSite('campaigns', 'partner.co.uk'), 'partner.co.uk');
  assert.equal(faviconPath('a.com'), '/v1/analytics-connections/favicon?domain=a.com');
});

test('a short range reads the trend by the hour', () => {
  assert.deepEqual(sectionsFor(['trend'], 'current', { hourly: true }), ['hourly']);
  assert.deepEqual(sectionsFor(['trend', 'kpis'], 'previous', { hourly: true }), ['hourly', 'summary']);
  assert.deepEqual(sectionsFor(['trend'], 'current'), ['daily']);
});

test('hours are keyed in the report’s timezone and stop at the current hour', () => {
  const at = new Date('2026-10-23T09:58:00Z');
  assert.equal(hourKey(at, 'Europe/London'), '2026-10-23 10');
  assert.equal(hourKey(at, 'America/New_York'), '2026-10-23 05');
  assert.equal(hourKey(new Date('2026-10-23T23:30:00Z'), 'Europe/London'), '2026-10-24 00', 'midnight is 00, not 24');
  const today = hoursIn(['2026-10-23'], '2026-10-23 10');
  assert.equal(today.length, 11);
  assert.equal(today.at(-1), '2026-10-23 10');
  assert.equal(hoursIn(['2026-10-22', '2026-10-23']).length, 48);
  assert.deepEqual(fillHours([{ hour: '2026-10-23 01', n: 4 }], ['2026-10-23 00', '2026-10-23 01'], (row) => row.n), [
    { hour: '2026-10-23 00', value: 0 },
    { hour: '2026-10-23 01', value: 4 },
  ]);
});

test('Copy JSON: self-describing, labelled, with changes — and only what is shown', () => {
  const summary = { pageviews: 300, visitors: 100, visits: 120, bounceRate: 0.4, avgVisitSeconds: 95 };
  const input = {
    website: { name: 'Café site', provider: 'Umami' },
    period: { label: 'Yesterday', dates: '22 Oct 2026', from: '2026-10-21T23:00:00.000Z', to: '2026-10-22T22:59:59.999Z', timezone: 'Europe/London' },
    comparison: { label: 'Previous period', dates: 'vs 21 Oct' },
    current: {
      provider: 'umami' as const,
      summary,
      breakdowns: {
        channels: [{ key: 'organicSearch', value: 30 }, { key: 'direct', value: 10 }],
        countries: [{ key: 'GB', value: 90 }],
        events: [{ key: 'order_placed', value: 12 }],
      },
      weekly: Array.from({ length: 7 }, () => Array<number>(24).fill(0)),
    },
    previous: { provider: 'umami' as const, summary: { ...summary, visitors: 80 }, breakdowns: { events: [{ key: 'order_placed', value: 8 }] } },
    trend: { granularity: 'hour' as const, rows: [{ key: '2026-10-22 09', visitors: 4, pageviews: 9 }] },
    funnel: [{ type: 'page' as const, value: '/menu', visitors: 50 }, { type: 'event' as const, value: 'order_placed', visitors: 10 }],
    shown: ['kpis', 'trend', 'sources', 'countries', 'events', 'funnel'] as const,
  };
  // Round-trip through JSON: what the clipboard holds is what's checked.
  const json = JSON.parse(JSON.stringify(analyticsSnapshot({ ...input, shown: [...input.shown] })));
  assert.match(json.about, /Café site.*22 Oct 2026 \(Yesterday\).*against 21 Oct.*Europe\/London/);
  assert.deepEqual(json.summary.visitors, { value: 100, previous: 80, changePct: 25 });
  assert.deepEqual(json.summary.bounceRatePct, { value: 40, previous: 40, changePct: 0 });
  assert.equal(json.summary.pagesPerVisit, 2.5);
  assert.deepEqual(json.trend.rows[0], { hour: '2026-10-22 09:00', visitors: 4, pageviews: 9 });
  assert.equal(json.trafficSources[0].name, 'Search');
  assert.equal(json.trafficSources[0].sharePct, 75);
  assert.equal(json.countries[0].name, 'United Kingdom');
  assert.deepEqual(json.customEvents[0], { event: 'order_placed', count: 12, previous: 8, changePct: 50 });
  assert.equal(json.funnel.steps[1].droppedSincePreviousPct, 80);
  assert.equal(json.visitsByWeekdayAndHour, undefined, 'the heatmap is not shown');
  assert.equal(json.devices, undefined);
});

test('the funnel leads with its answer and points at the worst step', () => {
  const rows = funnelRows([
    { type: 'event', value: 'view_menu', visitors: 1000 },
    { type: 'event', value: 'add_to_cart', visitors: 600 },
    { type: 'event', value: 'order_placed', visitors: 120 },
  ]);
  assert.equal(rows[1]!.dropped, 400);
  assert.equal(rows[2]!.dropped, 480);
  const previous = funnelRows([
    { type: 'event', value: 'view_menu', visitors: 800 },
    { type: 'event', value: 'add_to_cart', visitors: 400 },
    { type: 'event', value: 'order_placed', visitors: 80 },
  ]);
  const summary = funnelSummary(rows, previous);
  assert.equal(summary.conversion, 0.12);
  assert.equal(summary.previousConversion, 0.1);
  assert.equal(summary.biggestDrop, 2, 'add to cart → order loses 80%');
  assert.deepEqual([summary.started, summary.completed], [1000, 120]);
  assert.equal(funnelSummary(funnelRows([{ type: 'page', value: '/', visitors: 0 }, { type: 'page', value: '/menu', visitors: 0 }])).conversion, null);
});

test('events stack as the top four plus Other, on every bucket', () => {
  const keys = ['2026-10-22', '2026-10-23'];
  const rows = [
    { bucket: '2026-10-22', event: 'a', count: 10 },
    { bucket: '2026-10-23', event: 'b', count: 8 },
    { bucket: '2026-10-23', event: 'c', count: 6 },
    { bucket: '2026-10-22', event: 'd', count: 4 },
    { bucket: '2026-10-23', event: 'e', count: 2 },
    { bucket: '2026-10-23', event: 'f', count: 1 },
    { bucket: '2026-09-01', event: 'a', count: 99 },
  ];
  const stack = eventStack(rows, keys);
  assert.deepEqual(stack.map((line) => [line.key, line.slot]), [['a', 1], ['b', 2], ['c', 3], ['d', 4], ['__other', 0]]);
  assert.deepEqual(stack[0]!.values, [10, 0], 'outside the keys is ignored');
  assert.deepEqual(stack[4]!.values, [0, 3], 'e and f folded');
  assert.equal(eventStack(rows.slice(0, 2), keys).at(-1)!.key, 'b', 'no Other when nothing folds');
});
