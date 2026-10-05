import { ArrowUpRight, Check, TriangleAlert } from '@/components/icons';
import { Markdown } from '@/components/shared/Markdown';

import type { PriorityBrief as PriorityBriefData } from '@/lib/ai/priority-brief';
import { cn } from '@/lib/utils/cn';

const PRIORITY_STYLE = [
  { border: 'border-l-exception', rank: 'bg-exception/10 text-exception', label: 'Act first' },
  { border: 'border-l-stock', rank: 'bg-stock/12 text-stock-foreground', label: 'Next' },
  { border: 'border-l-reference', rank: 'bg-reference/10 text-reference', label: 'Then' },
] as const;

/** A decision brief for ranked operational findings, separate from raw data cards. */
export function PriorityBrief({ brief }: { brief: PriorityBriefData }) {
  return (
    <section aria-labelledby="duma-priorities-title">
      {brief.remainder ? <Markdown content={brief.remainder} variant="compact" className="mb-3" /> : null}
      <div className="mb-2 flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-label font-semibold tracking-label text-muted-foreground uppercase">Today’s priorities</p>
          <h3 id="duma-priorities-title" className="mt-0.5 text-base font-semibold tracking-title text-foreground">
            {brief.items.length} things need attention
          </h3>
        </div>
        <span className="mb-0.5 text-label text-muted-foreground">In priority order</span>
      </div>
      <ol className="space-y-2">
        {brief.items.map((item, index) => {
          const style = PRIORITY_STYLE[Math.min(index, PRIORITY_STYLE.length - 1)];
          return (
            <li key={`${item.rank}-${item.title}`} className={cn('rounded-lg border border-rule/60 border-l-2 bg-field px-3.5 py-3', style.border)}>
              <div className="flex items-start gap-3">
                <span
                  className={cn('flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold tabular-nums', style.rank)}
                  aria-hidden="true"
                >
                  {item.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-semibold leading-5 text-foreground">{item.title}</p>
                    <span className="text-label font-semibold text-muted-foreground">{style.label}</span>
                  </div>
                  <Markdown
                    content={item.evidence}
                    variant="compact"
                    className="mt-1 [&>p]:text-sm [&>p]:leading-5 [&>p]:text-muted-foreground"
                  />
                  {item.next ? (
                    <div className="mt-2 flex items-start gap-1.5 text-xs font-medium leading-5 text-foreground">
                      {index === 0 ? (
                        <TriangleAlert size={13} className="mt-0.5 shrink-0 text-exception" aria-hidden="true" />
                      ) : index === brief.items.length - 1 ? (
                        <Check size={13} className="mt-0.5 shrink-0 text-reference" aria-hidden="true" />
                      ) : (
                        <ArrowUpRight size={13} className="mt-0.5 shrink-0 text-stock" aria-hidden="true" />
                      )}
                      <div>
                        <span className="text-muted-foreground">Next: </span>
                        <Markdown content={item.next} variant="compact" className="inline-block [&>p]:inline [&>p]:text-xs [&>p]:leading-5" />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
