'use client';

import { type ReportChartTone, ReportTrendChart } from '@/components/reports/ReportChart';
import { useState } from 'react';

import type { AgentChartCard } from '@/lib/ai/agent-types';
import { formatAgentChartValue, normaliseAgentChart } from '@/lib/ai/chart';
import { cn } from '@/lib/utils/cn';

const TONE = {
  primary: { bar: 'bg-measured', dot: 'bg-measured', report: 'primary' },
  comparison: { bar: 'bg-reference', dot: 'bg-reference', report: 'comparison' },
  positive: { bar: 'bg-momentum', dot: 'bg-momentum', report: 'success' },
  warning: { bar: 'bg-exception', dot: 'bg-exception', report: 'warning' },
} as const;

export function AgentChart({ card: source }: { card: AgentChartCard }) {
  const card = normaliseAgentChart(source);
  const [view, setView] = useState<'bar' | 'column'>(source.type === 'bar' ? 'bar' : 'column');
  if (!card) return null;
  const format = (value: number) => formatAgentChartValue(value, card.format);

  return (
    <section className="mt-4" aria-label={card.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-label font-semibold tracking-label uppercase text-muted-foreground">
          <span title={card.title}>{card.title}</span>
          {card.caption && <span className="font-normal tracking-normal normal-case">{card.caption}</span>}
        </p>
        {card.type !== 'line' ? <div className="flex rounded-md border border-rule/60 bg-field p-0.5" aria-label="Chart view">
          {(['column', 'bar'] as const).map((type) => <button key={type} type="button" aria-pressed={view === type} onClick={() => setView(type)} className={cn('rounded px-2 py-0.5 text-label font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring', view === type ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{type === 'column' ? 'Columns' : 'Bars'}</button>)}
        </div> : null}
      </div>
      <div className="mt-1.5 overflow-hidden rounded-lg border border-rule/60 bg-field px-3.5 py-3">
        {card.type === 'line' ? (
          <ReportTrendChart
            labels={card.points.map((point) => point.label)}
            series={card.series.map((series) => ({
              name: series.label,
              values: card.points.map((point) => point.values[series.key] ?? 0),
              tone: TONE[series.tone ?? 'primary'].report as ReportChartTone,
              dashed: series.tone === 'comparison',
            }))}
            formatValue={format}
            formatAxis={format}
            ariaLabel={`${card.title}${card.caption ? `, ${card.caption}` : ''}`}
            className="[&_.plot-field]:mt-2"
          />
        ) : view === 'column' ? (
          <ColumnComparison card={card} format={format} />
        ) : (
          <BarComparison card={card} format={format} />
        )}
      </div>
    </section>
  );
}

function ColumnComparison({ card, format }: { card: AgentChartCard; format: (value: number) => string }) {
  const series = card.series[0];
  const values = card.points.map((point) => Math.max(0, point.values[series.key] ?? 0));
  const maximum = Math.max(1, ...values);

  return (
    <div>
      <div
        className="relative grid h-44 items-end gap-4 border-b border-rule/70 px-3 pt-7"
        style={{ gridTemplateColumns: `repeat(${card.points.length}, minmax(0, 1fr))` }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-rule/45" aria-hidden="true" />
        {card.points.map((point, index) => {
          const value = values[index];
          const height = value === 0 ? 2 : Math.max(8, (value / maximum) * 100);
          const current = index === card.points.length - 1;
          return (
            <div key={point.label} className="relative flex h-full min-w-0 flex-col justify-end text-center">
              <span className="mb-2 truncate font-mono text-xs font-semibold tracking-figure tabular-nums text-foreground">
                {format(value)}
              </span>
              <div
                className={cn(
                  'mx-auto w-full max-w-24 rounded-t-md transition-[height] duration-500',
                  current ? 'bg-measured' : 'bg-reference/65',
                  value === 0 && 'border-t-2 border-rule bg-transparent',
                )}
                style={{ height: `${height}%` }}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
      <div className="grid gap-4 px-3 pt-2" style={{ gridTemplateColumns: `repeat(${card.points.length}, minmax(0, 1fr))` }}>
        {card.points.map((point, index) => (
          <p
            key={point.label}
            className={cn(
              'truncate text-center text-label',
              index === card.points.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {point.label}
          </p>
        ))}
      </div>
      <p className="sr-only">{card.points.map((point, index) => `${point.label}: ${series.label} ${format(values[index])}`).join('. ')}</p>
    </div>
  );
}

function BarComparison({ card, format }: { card: AgentChartCard; format: (value: number) => string }) {
  const maximum = Math.max(1, ...card.points.flatMap((point) => card.series.map((series) => Math.max(0, point.values[series.key] ?? 0))));
  return (
    <div>
      {card.series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-label text-muted-foreground">
          {card.series.map((series) => (
            <span key={series.key} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2 rounded-sm', TONE[series.tone ?? 'primary'].dot)} aria-hidden="true" />
              {series.label}
            </span>
          ))}
        </div>
      )}
      <ul className="space-y-3">
        {card.points.map((point) => (
          <li key={point.label}>
            <p className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-muted-foreground">{point.label}</span>
              {card.series.length === 1 && (
                <span className="shrink-0 font-mono font-semibold tracking-figure tabular-nums text-foreground">
                  {format(point.values[card.series[0].key] ?? 0)}
                </span>
              )}
            </p>
            <div className="space-y-1.5">
              {card.series.map((series) => {
                const value = point.values[series.key] ?? 0;
                return (
                  <div key={series.key} className="flex items-center gap-2">
                    <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-band" aria-hidden="true">
                      <div
                        className={cn('h-full min-w-px rounded-sm transition-[width] duration-500', TONE[series.tone ?? 'primary'].bar)}
                        style={{ width: `${Math.max(0, Math.min(100, (value / maximum) * 100))}%` }}
                      />
                    </div>
                    {card.series.length > 1 && (
                      <span className="w-20 shrink-0 text-right font-mono text-label font-semibold tracking-figure tabular-nums text-foreground">
                        {format(value)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="sr-only">
        {card.points
          .map(
            (point) =>
              `${point.label}: ${card.series.map((series) => `${series.label} ${format(point.values[series.key] ?? 0)}`).join(', ')}`,
          )
          .join('. ')}
      </p>
    </div>
  );
}
