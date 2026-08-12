'use client';

import { ArrowDownRight, ArrowRight, ArrowUpRight } from '@/components/icons';

import type { AgentCard } from '@/lib/ai/agent-types';
import { cn } from '@/lib/utils/cn';

const TONE = {
  default: 'text-foreground',
  positive: 'text-success',
  negative: 'text-exception',
  warning: 'text-stock',
} as const;

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight } as const;

/**
 * Figures the agent read, shown as figures. The prose above still carries the
 * reasoning — this strip exists so the numbers can be scanned without parsing a
 * sentence, and it is built from tool output rather than from model text.
 */
export function AgentMetrics({ card }: { card: AgentCard }) {
  if (card.kind === 'list') {
    return (
      <section className="mt-3 overflow-hidden rounded-md border border-rule bg-field" aria-label={card.title}>
        <header className="border-b border-divider px-3 py-2">
          <p className="text-label uppercase tracking-wide text-muted-foreground">{card.title}</p>
          {card.caption && <p className="mt-0.5 text-label leading-4 text-muted-foreground">{card.caption}</p>}
        </header>
        {card.rows.length ? (
          <ul className="divide-y divide-divider">
            {card.rows.map((row, index) => (
              <li key={`${row.label}-${index}`} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
                  {row.meta ? <p className="mt-0.5 line-clamp-2 text-label leading-4 text-muted-foreground">{row.meta}</p> : null}
                </div>
                {row.value ? (
                  <span className={cn('shrink-0 font-mono text-xs font-semibold tabular-nums', TONE[row.tone ?? 'default'])}>
                    {row.value}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">{card.emptyLabel ?? 'Nothing to show.'}</p>
        )}
      </section>
    );
  }
  if (card.metrics.length === 0) return null;
  return (
    <section className="mt-3 rounded-md border border-rule bg-field" aria-label={card.title}>
      <header className="border-b border-divider px-3 py-2">
        <p className="text-label uppercase tracking-wide text-muted-foreground">{card.title}</p>
        {card.caption && <p className="mt-0.5 text-label leading-4 text-muted-foreground">{card.caption}</p>}
      </header>
      <dl className="grid grid-cols-2">
        {card.metrics.map((metric, index) => {
          const Trend = metric.trend ? TREND_ICON[metric.trend] : null;
          return (
            <div
              key={`${metric.label}-${index}`}
              className={cn('min-w-0 px-3 py-2', index % 2 === 1 && 'border-l border-divider', index > 1 && 'border-t border-divider')}
            >
              <dt className="truncate text-label text-muted-foreground">{metric.label}</dt>
              <dd className={cn('mt-0.5 truncate font-mono text-sm font-semibold tabular-nums', TONE[metric.tone ?? 'default'])}>
                {metric.value}
              </dd>
              {metric.hint && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-label text-muted-foreground">
                  {Trend && (
                    <Trend
                      size={11}
                      className={cn(
                        'shrink-0',
                        metric.trend === 'up' ? 'text-success' : metric.trend === 'down' ? 'text-exception' : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    />
                  )}
                  {metric.hint}
                </p>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
