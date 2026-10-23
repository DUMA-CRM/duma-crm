import type { BreakdownKey, BreakdownRow, FunnelStep, FunnelStepResult, ReportSection, WebAnalyticsReport } from '@/lib/api/analytics.service';

// ---------------------------------------------------------------------------
// The Website analytics report, kept pure: which widgets it draws and what
// each one asks the API for, the funnel's saved steps, and the arithmetic
// behind the donut, the heatmap, the funnel and the "website and sales" row.
// ---------------------------------------------------------------------------

// ── Widgets & layout ────────────────────────────────────────────────────────

export type WidgetId =
  | 'kpis'
  | 'trend'
  | 'sources'
  | 'pages'
  | 'referrers'
  | 'countries'
  | 'devices'
  | 'tech'
  | 'heatmap'
  | 'events'
  | 'funnel';

export interface WidgetDefinition {
  id: WidgetId;
  title: string;
  description: string;
  /** How much of a row it takes from xl up: the whole row, or half of it. */
  span: 'full' | 'half';
  /** What it reads for the period. */
  sections: ReportSection[];
  /** What it also reads for the comparison period, for change pills and the ghost line. */
  previousSections?: ReportSection[];
}

// Default order, read in pairs from xl up: sources | devices, pages | countries,
// referrers | browsers.
export const WIDGETS: readonly WidgetDefinition[] = [
  {
    id: 'kpis',
    title: 'Headline figures',
    description: 'Visitors, pageviews, visits, bounce rate and visit length.',
    span: 'full',
    sections: ['summary'],
    previousSections: ['summary'],
  },
  {
    id: 'trend',
    title: 'Visitors over time',
    description: 'Visitors and pageviews a day, against the comparison.',
    span: 'full',
    sections: ['daily'],
    previousSections: ['daily'],
  },
  { id: 'sources', title: 'Traffic sources', description: 'Search, social, direct and the rest.', span: 'half', sections: ['channels', 'referrers'] },
  { id: 'devices', title: 'Devices', description: 'Phone, laptop, desktop or tablet.', span: 'half', sections: ['devices'] },
  { id: 'pages', title: 'Top pages', description: 'The pages people view most.', span: 'half', sections: ['pages', 'entries'] },
  { id: 'countries', title: 'Countries', description: 'Where your visitors are.', span: 'half', sections: ['countries'] },
  { id: 'referrers', title: 'Referrers & campaigns', description: 'Sites and UTM campaigns that send visitors.', span: 'half', sections: ['referrers', 'campaigns'] },
  { id: 'tech', title: 'Browsers & systems', description: 'What your visitors browse with.', span: 'half', sections: ['browsers', 'os'] },
  { id: 'heatmap', title: 'Visits by day and hour', description: 'When people visit your website.', span: 'full', sections: ['weekly'] },
  {
    id: 'events',
    title: 'Custom events',
    description: 'Actions your website tracks — signups, orders, clicks.',
    span: 'half',
    sections: ['events', 'eventsDaily'],
    previousSections: ['events'],
  },
  { id: 'funnel', title: 'Funnel', description: 'How many visitors get through each step you choose.', span: 'half', sections: [] },
];

export const WIDGET_BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]));

/** Every widget, in the order the report draws them (fixed since 2026-10-23 — no show/hide). */
export const ALL_WIDGETS: WidgetId[] = WIDGETS.map((widget) => widget.id);

/** A first funnel that most café sites can fill in: home, then the menu. */
export const DEFAULT_FUNNEL: FunnelStep[] = [
  { type: 'page', value: '/' },
  { type: 'page', value: '/menu' },
];

export const MIN_FUNNEL_STEPS = 2;
export const MAX_FUNNEL_STEPS = 6;

const isStep = (step: unknown): step is FunnelStep =>
  !!step &&
  typeof step === 'object' &&
  ((step as FunnelStep).type === 'page' || (step as FunnelStep).type === 'event') &&
  typeof (step as FunnelStep).value === 'string' &&
  (step as FunnelStep).value.trim() !== '';

/**
 * Saved funnel steps made safe: a list of steps, or the older saved layout
 * that carried them under `funnel`. Anything unusable falls back to the default.
 */
export function normalizeFunnel(raw: unknown): FunnelStep[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? (raw as { funnel?: unknown }).funnel : null;
  const steps = Array.isArray(list) ? list.filter(isStep).slice(0, MAX_FUNNEL_STEPS) : [];
  return steps.length >= MIN_FUNNEL_STEPS ? steps : DEFAULT_FUNNEL;
}

// ── Editing the funnel ──────────────────────────────────────────────────────

export const moveStep = (steps: FunnelStep[], index: number, by: -1 | 1): FunnelStep[] => {
  const to = index + by;
  if (to < 0 || to >= steps.length) return steps;
  const next = [...steps];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
};

export const addStep = (steps: FunnelStep[], step: FunnelStep = { type: 'event', value: '' }): FunnelStep[] =>
  steps.length >= MAX_FUNNEL_STEPS ? steps : [...steps, step];

export const removeStep = (steps: FunnelStep[], index: number): FunnelStep[] =>
  steps.length <= MIN_FUNNEL_STEPS ? steps : steps.filter((_, at) => at !== index);

/** What's wrong with a draft funnel, or null: every step named, two to six of them, no step twice in a row. */
export function funnelProblem(steps: FunnelStep[]): string | null {
  if (steps.length < MIN_FUNNEL_STEPS) return `A funnel needs at least ${MIN_FUNNEL_STEPS} steps.`;
  if (steps.some((step) => !step.value.trim())) return 'Name every step — a page path or an event.';
  const repeated = steps.findIndex((step, index) => index > 0 && step.type === steps[index - 1]!.type && step.value.trim() === steps[index - 1]!.value.trim());
  if (repeated > 0) return `Step ${repeated + 1} is the same as the one before it.`;
  return null;
}

/** Ready to save: trimmed, and a page always starts with "/". */
export const cleanFunnel = (steps: FunnelStep[]): FunnelStep[] =>
  steps.map((step) => {
    const value = step.value.trim();
    return { type: step.type, value: step.type === 'page' && !value.startsWith('/') ? `/${value}` : value };
  });

/**
 * What to ask the API for: the union of what the shown widgets draw, in a
 * stable order. A short range reads the trend hour by hour instead of by day.
 */
export function sectionsFor(widgets: WidgetId[], which: 'current' | 'previous', { hourly = false } = {}): ReportSection[] {
  const wanted = new Set<ReportSection>();
  for (const id of widgets) {
    const widget = WIDGET_BY_ID.get(id);
    for (const section of (which === 'current' ? widget?.sections : widget?.previousSections) ?? []) {
      wanted.add(hourly && section === 'daily' ? 'hourly' : hourly && section === 'eventsDaily' ? 'eventsHourly' : section);
    }
  }
  return [...wanted].sort();
}

// ── Hours ───────────────────────────────────────────────────────────────────

/** Below this many days, the trend is drawn hour by hour — a day or two is a handful of points otherwise. */
export const HOURLY_BELOW_DAYS = 3;

/** `YYYY-MM-DD HH` for an instant, in a timezone — the API's hourly key. */
export function hourKey(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}`;
}

/** Every hour of these days, up to and including `until` (the current hour) — the future isn't zero, it hasn't happened. */
export function hoursIn(dateKeys: string[], until?: string): string[] {
  const keys = dateKeys.flatMap((date) => Array.from({ length: 24 }, (_, hour) => `${date} ${String(hour).padStart(2, '0')}`));
  return until ? keys.filter((key) => key <= until) : keys;
}

/** An hourly series with every hour present; hours with no visits are zero. */
export function fillHours<T extends { hour: string }>(rows: T[], keys: string[], pick: (row: T) => number) {
  const byHour = new Map(rows.map((row) => [row.hour, row]));
  return keys.map((hour) => {
    const row = byHour.get(hour);
    return { hour, value: row ? pick(row) : 0 };
  });
}

// ── Labels ──────────────────────────────────────────────────────────────────

const CHANNELS: Record<string, string> = {
  direct: 'Direct',
  organicSearch: 'Search',
  paidSearch: 'Paid search',
  organicSocial: 'Social',
  paidSocial: 'Paid social',
  paidAds: 'Paid ads',
  referral: 'Other websites',
  email: 'Email',
  sms: 'Text message',
  organicShopping: 'Shopping',
  paidShopping: 'Paid shopping',
  organicVideo: 'Video',
  paidVideo: 'Paid video',
  affiliate: 'Affiliates',
  display: 'Display ads',
};
export const channelLabel = (key: string) => CHANNELS[key] ?? sentence(key);

const DEVICES: Record<string, string> = { mobile: 'Phone', desktop: 'Desktop', laptop: 'Laptop', tablet: 'Tablet' };
export const deviceLabel = (key: string) => DEVICES[key.toLowerCase()] ?? sentence(key);

const BROWSERS: Record<string, string> = {
  ios: 'Safari (iPhone)',
  'ios-webview': 'In-app (iPhone)',
  safari: 'Safari',
  chrome: 'Chrome',
  crios: 'Chrome (iPhone)',
  firefox: 'Firefox',
  fxios: 'Firefox (iPhone)',
  'edge-chromium': 'Edge',
  edge: 'Edge',
  samsung: 'Samsung Internet',
  opera: 'Opera',
  facebook: 'Facebook app',
  instagram: 'Instagram app',
  'chromium-webview': 'In-app (Android)',
};
export const browserLabel = (key: string) => BROWSERS[key.toLowerCase()] ?? sentence(key);

function sentence(key: string) {
  const spaced = key.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase() : 'Unknown';
}

// ── Site icons ──────────────────────────────────────────────────────────────

/** The site whose icon stands for a browser — its maker's, where that's the familiar mark. */
const BROWSER_SITES: Record<string, string> = {
  chrome: 'chrome.com',
  crios: 'chrome.com',
  'chromium-webview': 'chromium.org',
  ios: 'apple.com',
  'ios-webview': 'apple.com',
  safari: 'apple.com',
  firefox: 'firefox.com',
  fxios: 'firefox.com',
  'edge-chromium': 'microsoftedge.com',
  edge: 'microsoftedge.com',
  'edge-ios': 'microsoftedge.com',
  samsung: 'samsung.com',
  opera: 'opera.com',
  'opera-mini': 'opera.com',
  brave: 'brave.com',
  vivaldi: 'vivaldi.com',
  yandexbrowser: 'yandex.com',
  duckduckgo: 'duckduckgo.com',
  facebook: 'facebook.com',
  instagram: 'instagram.com',
  silk: 'amazon.com',
};

const OS_SITES: [RegExp, string][] = [
  [/^(ios|ipados|mac ?os|os x)/i, 'apple.com'],
  [/^android/i, 'android.com'],
  [/^windows/i, 'microsoft.com'],
  [/^chrome ?os/i, 'chromium.org'],
  [/^ubuntu/i, 'ubuntu.com'],
  [/^linux/i, 'kernel.org'],
];

/** UTM sources people write by name rather than domain. */
const CAMPAIGN_SITES: Record<string, string> = {
  google: 'google.com',
  facebook: 'facebook.com',
  fb: 'facebook.com',
  meta: 'meta.com',
  instagram: 'instagram.com',
  ig: 'instagram.com',
  tiktok: 'tiktok.com',
  linkedin: 'linkedin.com',
  twitter: 'x.com',
  x: 'x.com',
  bing: 'bing.com',
  youtube: 'youtube.com',
  pinterest: 'pinterest.com',
  reddit: 'reddit.com',
  snapchat: 'snapchat.com',
  mailchimp: 'mailchimp.com',
  tripadvisor: 'tripadvisor.com',
  ubereats: 'ubereats.com',
  deliveroo: 'deliveroo.co.uk',
  justeat: 'just-eat.co.uk',
};

const looksLikeDomain = (value: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value);

/** The domain whose icon stands beside a breakdown row, or null for none. */
export function iconSite(kind: 'referrers' | 'campaigns' | 'browsers' | 'os', key: string): string | null {
  const value = key.trim().toLowerCase();
  if (!value) return null;
  if (kind === 'referrers') return looksLikeDomain(value) ? value : null;
  if (kind === 'browsers') return BROWSER_SITES[value] ?? null;
  if (kind === 'os') return OS_SITES.find(([pattern]) => pattern.test(value))?.[1] ?? null;
  return CAMPAIGN_SITES[value] ?? (looksLikeDomain(value) ? value : null);
}

/** Served by the API from its own cache — the CSP keeps browsers off third-party hosts. */
export const faviconPath = (domain: string) => `/v1/analytics-connections/favicon?domain=${encodeURIComponent(domain)}`;

/** "United Kingdom" for "GB", in the reader's language; the code itself if unknown. */
export function countryName(code: string, locale = 'en-GB') {
  if (!/^[A-Za-z]{2}$/.test(code)) return code || 'Unknown';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** 🇬🇧 for "GB" — regional-indicator letters; shows as the two letters where flags don't render. */
export function countryFlag(code: string) {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

// ── Donut ───────────────────────────────────────────────────────────────────

export interface Slice {
  key: string;
  label: string;
  value: number;
  share: number;
  /** 1–4 for the series slots; 0 for "Other". */
  slot: number;
}

/** A fixed slice: the provider keys it gathers, and the series slot (1–4) it always wears. */
export interface SliceGroup {
  key: string;
  label: string;
  slot: 1 | 2 | 3 | 4;
  match: readonly string[];
}

/** Umami's channels in four families, so Search is the same colour whatever else is in the period. */
export const CHANNEL_GROUPS: readonly SliceGroup[] = [
  { key: 'search', label: 'Search', slot: 1, match: ['organicSearch', 'paidSearch'] },
  { key: 'social', label: 'Social', slot: 2, match: ['organicSocial', 'paidSocial'] },
  { key: 'direct', label: 'Direct', slot: 3, match: ['direct'] },
  { key: 'referral', label: 'Other websites', slot: 4, match: ['referral'] },
];

export const DEVICE_GROUPS: readonly SliceGroup[] = [
  { key: 'mobile', label: 'Phone', slot: 1, match: ['mobile'] },
  { key: 'desktop', label: 'Desktop', slot: 2, match: ['desktop'] },
  { key: 'laptop', label: 'Laptop', slot: 3, match: ['laptop'] },
  { key: 'tablet', label: 'Tablet', slot: 4, match: ['tablet'] },
];

/**
 * Donut slices. With `groups`, colour follows the entity: each group keeps its
 * slot and anything outside them folds into "Other". Without (a provider with
 * no channels), the biggest four take slots in rank order and the rest fold —
 * a fifth hue is never invented.
 */
export function donutSlices(rows: BreakdownRow[], label: (key: string) => string, groups?: readonly SliceGroup[]): Slice[] {
  const positive = rows.filter((row) => row.value > 0);
  const total = positive.reduce((sum, row) => sum + row.value, 0);
  if (total === 0) return [];
  const slice = (key: string, name: string, value: number, slot: number): Slice => ({ key, label: name, value, share: value / total, slot });
  let slices: Slice[];
  let rest: number;
  if (groups) {
    slices = groups
      .map((group) => slice(group.key, group.label, positive.filter((row) => group.match.includes(row.key)).reduce((sum, row) => sum + row.value, 0), group.slot))
      .filter((entry) => entry.value > 0);
    rest = positive.filter((row) => !groups.some((group) => group.match.includes(row.key))).reduce((sum, row) => sum + row.value, 0);
  } else {
    const sorted = [...positive].sort((a, b) => b.value - a.value);
    slices = sorted.slice(0, 4).map((row, index) => slice(row.key, label(row.key), row.value, index + 1));
    rest = sorted.slice(4).reduce((sum, row) => sum + row.value, 0);
  }
  if (rest > 0) slices.push(slice('__other', 'Other', rest, 0));
  return slices;
}

/** Arc path for one slice of a ring, angles in turns (0 = 12 o'clock). */
export function arcPath(cx: number, cy: number, outer: number, inner: number, from: number, to: number) {
  const point = (radius: number, turn: number) => {
    const angle = turn * 2 * Math.PI - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  };
  // A full ring can't be one arc; stop a hair short.
  const end = to - from >= 1 ? from + 0.9999 : to;
  const large = end - from > 0.5 ? 1 : 0;
  return `M${point(outer, from)}A${outer},${outer} 0 ${large} 1 ${point(outer, end)}L${point(inner, end)}A${inner},${inner} 0 ${large} 0 ${point(inner, from)}Z`;
}

// ── Heatmap ─────────────────────────────────────────────────────────────────

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** 0 for none, else 1–5 by share of the busiest hour — five steps of one hue. */
export function heatLevel(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((value / max) * 5)));
}

export function heatmapPeak(grid: number[][]): { day: number; hour: number; value: number } | null {
  let peak: { day: number; hour: number; value: number } | null = null;
  grid.forEach((hours, day) =>
    hours.forEach((value, hour) => {
      if (value > 0 && (!peak || value > peak.value)) peak = { day, hour, value };
    }),
  );
  return peak;
}

export const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

// ── Funnel ──────────────────────────────────────────────────────────────────

export interface FunnelRow extends FunnelStepResult {
  /** Of the first step's visitors, 0–1. */
  ofFirst: number;
  /** Lost since the previous step, 0–1; null on the first. */
  dropoff: number | null;
  /** Visitors lost since the previous step; null on the first. */
  dropped: number | null;
}

export function funnelRows(steps: FunnelStepResult[]): FunnelRow[] {
  const first = steps[0]?.visitors ?? 0;
  return steps.map((step, index) => {
    const before = index === 0 ? null : steps[index - 1]!.visitors;
    return {
      ...step,
      ofFirst: first > 0 ? step.visitors / first : 0,
      dropoff: before === null ? null : before > 0 ? Math.max(0, 1 - step.visitors / before) : null,
      dropped: before === null ? null : Math.max(0, before - step.visitors),
    };
  });
}

/**
 * The funnel's answer, before its detail: how many got all the way through,
 * the same for the comparison period, and the step that loses the most — the
 * one worth fixing first. `biggestDrop` is a row index (the step people didn't
 * reach), or null when nothing was lost.
 */
export function funnelSummary(rows: FunnelRow[], previous?: FunnelRow[] | null) {
  const conversion = (list: FunnelRow[] | null | undefined) =>
    list && list.length > 1 && list[0]!.visitors > 0 ? list.at(-1)!.visitors / list[0]!.visitors : null;
  let biggestDrop: number | null = null;
  rows.forEach((row, index) => {
    if (row.dropoff !== null && row.dropoff > 0 && (biggestDrop === null || row.dropoff > rows[biggestDrop]!.dropoff!)) biggestDrop = index;
  });
  return {
    conversion: conversion(rows),
    previousConversion: conversion(previous),
    completed: rows.at(-1)?.visitors ?? 0,
    started: rows[0]?.visitors ?? 0,
    biggestDrop,
  };
}

export const stepLabel = (step: FunnelStep) => (step.type === 'page' ? step.value : step.value.replaceAll('_', ' '));

export function pagesPerVisit(summary: WebAnalyticsReport['summary']) {
  return summary?.visits && summary.pageviews !== null ? summary.pageviews / summary.visits : null;
}

export type { BreakdownKey };

// ── Events over time ────────────────────────────────────────────────────────

export interface StackSeries {
  key: string;
  label: string;
  /** 1–4 for the series slots; 0 for "Other". */
  slot: number;
  values: number[];
}

/**
 * Custom events per bucket, stacked: the four busiest events in the period
 * each get a series slot, everything else folds into one "Other" — a fifth
 * hue is never invented. Every bucket in `keys` is present (zero when quiet).
 */
export function eventStack(rows: { bucket: string; event: string; count: number }[], keys: string[]): StackSeries[] {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.event, (totals.get(row.event) ?? 0) + row.count);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([event]) => event);
  const index = new Map(keys.map((key, at) => [key, at]));
  const series: StackSeries[] = top.map((event, at) => ({ key: event, label: event, slot: at + 1, values: keys.map(() => 0) }));
  const other: StackSeries = { key: '__other', label: 'Other', slot: 0, values: keys.map(() => 0) };
  for (const row of rows) {
    const at = index.get(row.bucket);
    if (at === undefined) continue;
    const target = series.find((line) => line.key === row.event) ?? other;
    target.values[at]! += row.count;
  }
  return other.values.some((value) => value > 0) ? [...series, other] : series;
}

// ── Copy as JSON ────────────────────────────────────────────────────────────

export interface SnapshotInput {
  website: { name: string; provider: string };
  period: { label: string; dates: string; from: string; to: string; timezone: string };
  comparison: { label: string; dates: string } | null;
  current: WebAnalyticsReport;
  previous?: WebAnalyticsReport;
  trend: { granularity: 'hour' | 'day'; rows: { key: string; visitors: number; pageviews: number }[] };
  funnel?: FunnelStepResult[] | null;
  /** The widgets on screen: the snapshot holds what the reader is looking at, nothing more. */
  shown: WidgetId[];
}

/** Percent change, one decimal; null with nothing to compare against. */
const changePct = (now: number | null | undefined, before: number | null | undefined) =>
  now === null || now === undefined || before === null || before === undefined || before === 0
    ? null
    : Math.round(((now - before) / Math.abs(before)) * 1000) / 10;

/**
 * The dashboard as JSON for pasting into an AI: self-describing (what, when,
 * against what, which timezone), readable labels beside the raw keys, and the
 * change beside every figure that has one. Only what the shown widgets draw.
 */
export function analyticsSnapshot(input: SnapshotInput) {
  const { current, previous, shown } = input;
  const on = (id: WidgetId) => shown.includes(id);
  const rows = (key: BreakdownKey, label: (key: string) => string = (value) => value) => {
    const list = current.breakdowns[key];
    if (!list) return undefined;
    const total = list.reduce((sum, row) => sum + row.value, 0);
    return list.map((row) => ({ name: label(row.key), key: row.key, count: row.value, sharePct: total ? Math.round((row.value / total) * 1000) / 10 : 0 }));
  };
  const metric = (now: number | null | undefined, before: number | null | undefined) => ({
    value: now ?? null,
    ...(input.comparison ? { previous: before ?? null, changePct: changePct(now, before) } : {}),
  });
  const s = current.summary;
  const p = previous?.summary;
  const snapshot: Record<string, unknown> = {
    about: [
      `Website analytics exported from DUMA (${input.website.provider}) for "${input.website.name}".`,
      `Period: ${input.period.dates}${input.period.label !== input.period.dates ? ` (${input.period.label})` : ''}.`,
      input.comparison ? `Changes are against ${input.comparison.dates.replace(/^vs /, '')} (${input.comparison.label.toLowerCase()}).` : 'No comparison period.',
      `Times are in ${input.period.timezone}. Counts are visitors (unique) and pageviews unless named otherwise.`,
    ].join(' '),
    website: input.website,
    period: input.period,
    comparison: input.comparison,
  };
  if (on('kpis') && s) {
    snapshot.summary = {
      visitors: metric(s.visitors, p?.visitors),
      pageviews: metric(s.pageviews, p?.pageviews),
      visits: metric(s.visits, p?.visits),
      pagesPerVisit: pagesPerVisit(s) === null ? null : Math.round(pagesPerVisit(s)! * 100) / 100,
      bounceRatePct: metric(s.bounceRate === null ? null : Math.round(s.bounceRate * 1000) / 10, p?.bounceRate == null ? null : Math.round(p.bounceRate * 1000) / 10),
      averageVisitSeconds: metric(s.avgVisitSeconds, p?.avgVisitSeconds),
    };
  }
  if (on('trend') && input.trend.rows.length) {
    snapshot.trend = {
      granularity: input.trend.granularity,
      rows: input.trend.rows.map((row) => ({ [input.trend.granularity === 'hour' ? 'hour' : 'date']: input.trend.granularity === 'hour' ? `${row.key}:00` : row.key, visitors: row.visitors, pageviews: row.pageviews })),
    };
  }
  if (on('sources')) snapshot.trafficSources = rows('channels', channelLabel) ?? rows('referrers');
  if (on('devices')) snapshot.devices = rows('devices', deviceLabel);
  if (on('pages')) {
    snapshot.topPages = rows('pages');
    snapshot.landingPages = rows('entries');
  }
  if (on('countries')) snapshot.countries = rows('countries', (code) => countryName(code));
  if (on('referrers')) {
    snapshot.referrers = rows('referrers');
    snapshot.utmCampaigns = rows('campaigns');
  }
  if (on('tech')) {
    snapshot.browsers = rows('browsers', browserLabel);
    snapshot.operatingSystems = rows('os');
  }
  if (on('heatmap') && current.weekly) {
    snapshot.visitsByWeekdayAndHour = {
      note: 'Visits per hour of the day (index 0 = 00:00), summed over the period.',
      ...Object.fromEntries(current.weekly.map((hours, day) => [WEEKDAYS[day], hours])),
    };
  }
  if (on('events') && current.breakdowns.events) {
    const before = new Map((previous?.breakdowns.events ?? []).map((row) => [row.key, row.value]));
    snapshot.customEvents = current.breakdowns.events.map((row) => ({
      event: row.key,
      count: row.value,
      ...(input.comparison && previous ? { previous: before.get(row.key) ?? 0, changePct: changePct(row.value, before.get(row.key) ?? 0) } : {}),
    }));
  }
  if (on('funnel') && input.funnel?.length) {
    snapshot.funnel = {
      note: 'Visitors who reached each step after every step before it, within an hour.',
      steps: funnelRows(input.funnel).map((step) => ({
        type: step.type,
        step: step.value,
        visitors: step.visitors,
        ofFirstStepPct: Math.round(step.ofFirst * 1000) / 10,
        droppedSincePreviousPct: step.dropoff === null ? null : Math.round(step.dropoff * 1000) / 10,
      })),
    };
  }
  // Sections the provider couldn't answer are left out rather than sent as empty.
  return Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value !== undefined));
}
