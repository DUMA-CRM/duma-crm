import type { AgentChartCard, AgentChartPoint, AgentChartSeries } from './agent-types';

const MAX_SERIES = 3;
const MAX_BAR_POINTS = 10;
const MAX_LINE_POINTS = 24;

function shortText(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/**
 * Conversations can be restored from storage long after their original code
 * ran. Normalise chart payloads again at render time so stale or malformed
 * history cannot produce an unreadable SVG or non-finite geometry.
 */
export function normaliseAgentChart(card: AgentChartCard): AgentChartCard | null {
  const seen = new Set<string>();
  const series = card.series
    .map(
      (item): AgentChartSeries => ({
        key: shortText(item.key, 32),
        label: shortText(item.label, 40),
        ...(item.tone ? { tone: item.tone } : {}),
      }),
    )
    .filter((item) => item.key && item.label && !seen.has(item.key) && seen.add(item.key))
    .slice(0, MAX_SERIES);
  if (!series.length) return null;

  const limit = card.type === 'line' ? MAX_LINE_POINTS : MAX_BAR_POINTS;
  const points = card.points
    .map((point): AgentChartPoint | null => {
      const label = shortText(point.label, 40);
      if (!label) return null;
      const values = Object.fromEntries(
        series.flatMap((item) => {
          const value = point.values?.[item.key];
          return typeof value === 'number' && Number.isFinite(value) ? [[item.key, value] as const] : [];
        }),
      );
      return Object.keys(values).length ? { label, values } : null;
    })
    .filter((point): point is AgentChartPoint => Boolean(point))
    .slice(0, limit);
  if (!points.length || (card.type === 'line' && points.length < 2)) return null;

  const caption = shortText(card.caption, 120);
  const rest = { ...card };
  delete rest.caption;
  return {
    ...rest,
    title: shortText(card.title, 80) || 'Chart',
    ...(caption ? { caption } : {}),
    series,
    points,
  };
}

export function formatAgentChartValue(value: number, format: AgentChartCard['format']) {
  if (format === 'currency')
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: value >= 100 ? 0 : 2 }).format(
      value,
    );
  if (format === 'percent') return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);
}
