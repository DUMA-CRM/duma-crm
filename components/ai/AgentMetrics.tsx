'use client';

import { AgentChart } from '@/components/ai/AgentChart';
import { CheckCircle2, CircleDashed, Search } from '@/components/icons';
import { DeltaBadge } from '@/components/shared/StatCard';

import type { AgentCard, AgentEmptyTone } from '@/lib/ai/agent-types';
import { cn } from '@/lib/utils/cn';

const TONE = {
  default: 'text-foreground',
  positive: 'text-success',
  negative: 'text-exception',
  warning: 'text-stock',
} as const;

/** The glyph an empty result earns: reassurance, a miss, or a plain absence. */
const EMPTY_MARK: Record<AgentEmptyTone, { icon: typeof CheckCircle2; className: string }> = {
  clean: { icon: CheckCircle2, className: 'text-momentum' },
  search: { icon: Search, className: 'text-muted-foreground' },
  none: { icon: CircleDashed, className: 'text-muted-foreground' },
};

/** Money, counts and percentages align in columns; words do not. */
const FIGURE = /^[£$€]?\s*[\d][\d.,\s]*%?$/;

/**
 * Figures the agent read, shown as figures. The prose above still carries the
 * reasoning — these exist so the numbers can be scanned without parsing a
 * sentence, and they are built from tool output rather than from model text.
 *
 * The title sits outside the frame rather than in a filled header bar: inside a
 * chat the card is a quotation from the data, and a banded strip above every one
 * of them was more chrome than the answer it supported.
 */
export function AgentMetrics({ card }: { card: AgentCard }) {
  if (card.kind === 'chart') return <AgentChart card={card} />;

  if (card.kind === 'list') {
    return (
      <section className="mt-4" aria-label={card.title}>
        <CardLabel title={card.title} caption={card.caption} />
        {card.rows.length ? (
          <ul className="mt-1.5 divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-field">
            {card.rows.map((row, index) => (
              <li key={`${row.label}-${index}`} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm leading-5 text-foreground">{row.label}</p>
                  {row.meta ? <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">{row.meta}</p> : null}
                </div>
                {row.value ? (
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 text-right text-xs font-semibold',
                      // A status word set in the figure face is monospace worn as
                      // a costume; only actual figures earn the column alignment.
                      FIGURE.test(row.value) ? 'font-mono tracking-figure tabular-nums' : 'tracking-normal',
                      TONE[row.tone ?? 'default'],
                    )}
                  >
                    {row.value}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyResult tone={card.emptyTone ?? 'none'} label={card.emptyLabel ?? 'Nothing to show.'} />
        )}
      </section>
    );
  }

  if (card.metrics.length === 0) return null;

  return (
    <section className="mt-4" aria-label={card.title}>
      <CardLabel title={card.title} caption={card.caption} />
      {/* Separate tiles rather than one ruled grid: an internal lattice is the
          chart-paper look the design system lists as an anti-reference, and it
          left an empty cell whenever the count was odd. */}
      <dl className="mt-1.5 grid grid-cols-2 gap-1.5">
        {card.metrics.map((metric, index) => (
          <div key={`${metric.label}-${index}`} className="min-h-24 min-w-0 rounded-lg border border-rule/60 bg-field px-3.5 py-3">
            <dt className="line-clamp-2 text-label uppercase leading-4 text-muted-foreground">{metric.label}</dt>
            <dd
              className={cn('mt-1 truncate font-mono text-base font-semibold tracking-figure tabular-nums', TONE[metric.tone ?? 'default'])}
            >
              {metric.value}
            </dd>
            {metric.hint && (
              // The product's own delta pill, so a change in chat reads exactly
              // as it does on a dashboard — glyph, figure, and the comparison it
              // was measured against, in words.
              <DeltaBadge delta={{ value: metric.hint, trend: metric.trend ?? 'flat' }} size="sm" className="mt-1.5 flex-wrap" />
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

function EmptyResult({ tone, label }: { tone: AgentEmptyTone; label: string }) {
  const { icon: Icon, className } = EMPTY_MARK[tone];
  return (
    <p className="mt-1.5 flex items-center gap-2 rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
      <Icon size={14} className={cn('shrink-0', className)} aria-hidden="true" />
      {label}
    </p>
  );
}

function CardLabel({ title, caption }: { title: string; caption?: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-label font-semibold tracking-label uppercase text-muted-foreground">
      <span title={title}>{title}</span>
      {caption && <span className="font-normal tracking-normal normal-case">{caption}</span>}
    </p>
  );
}
