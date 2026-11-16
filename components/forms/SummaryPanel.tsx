'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

import { CalendarDays, ClipboardList, ListChecks, Star, TrendingUp } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, FactsSkeleton } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';

import { type FormDetail, type FormSummary, getFormSummary } from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { fillResponseDays } from '@/lib/utils/forms-overview';
import { formatCalendarDate } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type SummaryField = FormSummary['fields'][number];

const FACT_COLUMNS = ['', 'sm:grid-cols-2', 'sm:grid-cols-3', 'sm:grid-cols-2 xl:grid-cols-4'] as const;

/**
 * Every question at a glance, over the open responses (not archived): the
 * figures first, responses per day, then a card per question — how many
 * answered, the split of each choice, the average of a rating or a scale,
 * the latest few written answers — in two stacked columns. One hue
 * throughout: each chart is one series, and the numbers are written beside
 * every bar.
 */
export function SummaryPanel({ form }: { form: FormDetail }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const reduceMotion = useReducedMotion();
  const query = useQuery({
    queryKey: moduleQueryKeys.forms.key('summary', form.id, tenantId),
    queryFn: () => getFormSummary(form.id, tenantId),
  });
  const days = useMemo(() => fillResponseDays(query.data?.byDay ?? []), [query.data]);

  if (query.isPending)
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <FactsSkeleton count={3} label="Loading the summary" className="gap-3 sm:grid-cols-3" />
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Bone className="h-64 rounded-lg" />
          <Bone className="h-48 rounded-lg" />
        </div>
      </div>
    );
  if (query.isError) return <ErrorState title="Couldn’t load the summary" onRetry={() => void query.refetch()} />;
  const summary = query.data;
  if (summary.responses === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={ClipboardList}
        title="Nothing to summarise yet"
        description="Once people answer, each question’s split, averages and latest answers show here."
      />
    );
  }

  const busiest = days.reduce<{ date: string; total: number } | null>((best, day) => (!best || day.total > best.total ? day : best), null);
  const rating = summary.fields.find((field) => field.type === 'rating' && field.average !== null);
  const facts = [
    <Fact
      key="responses"
      surface="page"
      icon={ListChecks}
      label="Responses"
      value={summary.responses.toLocaleString('en-GB')}
      hint="Archived ones aren’t counted"
    />,
    ...(busiest
      ? [
          <Fact
            key="busiest"
            surface="page"
            icon={TrendingUp}
            label="Busiest day"
            value={busiest.total.toLocaleString('en-GB')}
            hint={formatCalendarDate(busiest.date, { weekday: 'short', day: 'numeric', month: 'short' })}
          />,
        ]
      : []),
    ...(rating
      ? [
          <Fact
            key="rating"
            surface="page"
            icon={Star}
            label="Average rating"
            value={`${rating.average!.toLocaleString('en-GB')} ★`}
            hint={rating.label || rating.key}
          />,
        ]
      : []),
  ];
  // Alternate the questions between the two columns, so the reading order stays close to the form's.
  const columns = [summary.fields.filter((_, index) => index % 2 === 0), summary.fields.filter((_, index) => index % 2 === 1)];

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      <motion.dl variants={SECTION_RISE} className={cn('grid gap-3', FACT_COLUMNS[facts.length - 1])}>
        {facts}
      </motion.dl>

      {days.length > 1 && <PerDay days={days} />}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {columns.map((column, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-5">
            {column.map((field) => (
              <QuestionSummary key={field.id} field={field} responses={summary.responses} />
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/** One question: its average, its split, or its latest written answers. */
function QuestionSummary({ field, responses }: { field: SummaryField; responses: number }) {
  const latest = field.latest ?? [];
  return (
    <RecordGroup
      card
      id={`form-summary-${field.id}`}
      title={field.label || field.key}
      actions={
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {field.answered} of {responses} answered
        </span>
      }
      footnote={
        !field.breakdown && field.answered > latest.length && latest.length > 0
          ? `The latest ${latest.length} — every answer is in Responses.`
          : undefined
      }
    >
      {field.average !== null && (
        <p className="mb-3 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums tracking-title text-foreground">
            {field.average.toLocaleString('en-GB')}
          </span>
          <span className="text-xs text-muted-foreground">average{field.type === 'rating' ? ' stars' : ''}</span>
        </p>
      )}
      {field.breakdown ? (
        <Breakdown rows={field.breakdown} answered={field.answered} />
      ) : latest.length > 0 ? (
        <ul className="space-y-2.5">
          {latest.map((answer, index) => (
            <li key={index} className="text-sm leading-relaxed whitespace-pre-line text-foreground">
              {answer}
            </li>
          ))}
        </ul>
      ) : (
        field.average === null && <p className="text-sm text-muted-foreground">No answers yet.</p>
      )}
    </RecordGroup>
  );
}

/** One bar per answer, longest first (choices keep the form's order); count and share in text. */
function Breakdown({ rows, answered }: { rows: { label: string; total: number }[]; answered: number }) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const share = answered ? Math.round((row.total / answered) * 100) : 0;
        return (
          <li key={row.label} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
            <span className="truncate text-foreground" title={row.label}>
              {row.label}
            </span>
            <span className="h-2.5 rounded-full bg-band/70" aria-hidden="true">
              <span className="block h-full rounded-full bg-series-1" style={{ width: `${(row.total / max) * 100}%` }} />
            </span>
            <span className="text-right text-xs tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{row.total}</span> · {share}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A column per day, the quiet days kept as gaps. */
function PerDay({ days }: { days: { date: string; total: number }[] }) {
  const peak = Math.max(1, ...days.map((day) => day.total));
  return (
    <RecordGroup card id="form-summary-per-day" title="Per day" footnote="Up to the latest 5,000 responses, over the last 60 days.">
      <div className="flex h-28 items-end gap-0.5" role="img" aria-label={`Responses per day, most ${peak} in a day`}>
        {days.map((day) => (
          <Tooltip
            key={day.date}
            label={`${formatCalendarDate(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${day.total}`}
            side="top"
          >
            <span className="flex h-full min-w-0 flex-1 items-end">
              <span
                className="block w-full rounded-t-[4px] bg-series-1 transition-opacity hover:opacity-80"
                style={{
                  height: day.total ? `${Math.max(4, (day.total / peak) * 100)}%` : '2px',
                  opacity: day.total ? undefined : 0.25,
                }}
              />
            </span>
          </Tooltip>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={11} aria-hidden="true" />
          {formatCalendarDate(days[0]!.date, { day: 'numeric', month: 'short' })}
        </span>
        <span>{formatCalendarDate(days.at(-1)!.date, { day: 'numeric', month: 'short' })}</span>
      </div>
    </RecordGroup>
  );
}
