'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { InfoRow } from '@/components/cms/rows';
import { CalendarDays, ClipboardList, ListChecks, Star } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';

import { type FormDetail, type FormSummary, getFormSummary } from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { formatCalendarDate } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { FIELD_ICONS } from './field-icons';

/**
 * Every question at a glance, over the open responses (not archived): how
 * many answered, the split of each choice, the average of a rating or a
 * scale, the latest few written answers. One hue throughout — each chart is
 * one series, so colour carries nothing a label doesn't; the numbers are
 * written beside every bar.
 */
export function SummaryPanel({ form }: { form: FormDetail }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const query = useQuery({
    queryKey: moduleQueryKeys.forms.key('summary', form.id, tenantId),
    queryFn: () => getFormSummary(form.id, tenantId),
  });

  if (query.isPending) return <Bone className="h-96 w-full rounded-lg" />;
  if (query.isError) return <ErrorState title="Couldn’t load the summary" onRetry={() => void query.refetch()} />;
  const summary = query.data;
  if (summary.responses === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nothing to summarise yet"
        description="Once people answer, each question’s split, averages and latest answers show here."
      />
    );
  }

  return (
    <SettingsTabBody narrowAside aside={<Overview summary={summary} />}>
      {summary.fields.map((field) => {
        const Icon = FIELD_ICONS[field.type];
        return (
          <SettingsSection
            key={field.id}
            title={field.label || field.key}
            icon={Icon}
            actions={
              <span className="text-xs tabular-nums text-muted-foreground">
                {field.answered} of {summary.responses} answered
              </span>
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
            ) : field.latest && field.latest.length > 0 ? (
              <ul className="space-y-1.5">
                {field.latest.map((answer, index) => (
                  <li key={index} className="rounded-md bg-band/45 px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-foreground">
                    {answer}
                  </li>
                ))}
                {field.answered > field.latest.length && (
                  <li className="text-xs text-muted-foreground">The latest {field.latest.length} — see every answer in Responses.</li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No answers yet.</p>
            )}
          </SettingsSection>
        );
      })}
    </SettingsTabBody>
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

function Overview({ summary }: { summary: FormSummary }) {
  // Every day from the first response to the last, so quiet days show as gaps rather than vanishing.
  const days = useMemo(() => {
    if (summary.byDay.length === 0) return [];
    const totals = new Map(summary.byDay.map((day) => [day.date, day.total]));
    const out: { date: string; total: number }[] = [];
    const end = Date.parse(`${summary.byDay.at(-1)!.date}T00:00:00Z`);
    const start = Math.max(Date.parse(`${summary.byDay[0]!.date}T00:00:00Z`), end - 59 * 86_400_000);
    for (let at = start; at <= end; at += 86_400_000) {
      const date = new Date(at).toISOString().slice(0, 10);
      out.push({ date, total: totals.get(date) ?? 0 });
    }
    return out;
  }, [summary.byDay]);
  const peak = Math.max(1, ...days.map((day) => day.total));
  const ratings = summary.fields.filter((field) => field.type === 'rating' && field.average !== null);

  return (
    <>
      <SettingsSection title="Responses">
        <div className="space-y-3">
          <InfoRow icon={ListChecks} title="Counted here">
            <span className="text-sm tabular-nums text-muted-foreground">{summary.responses.toLocaleString('en-GB')}</span>
          </InfoRow>
          {ratings.map((field) => (
            <InfoRow key={field.id} icon={Star} title={field.label || field.key}>
              <span className="text-sm tabular-nums text-muted-foreground">{field.average} ★</span>
            </InfoRow>
          ))}
          <p className="text-xs text-muted-foreground">Archived responses aren’t counted. Up to the latest 5,000.</p>
        </div>
      </SettingsSection>
      {days.length > 1 && (
        <SettingsSection title="Per day" icon={CalendarDays}>
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
            <span>{formatCalendarDate(days[0]!.date, { day: 'numeric', month: 'short' })}</span>
            <span>{formatCalendarDate(days.at(-1)!.date, { day: 'numeric', month: 'short' })}</span>
          </div>
        </SettingsSection>
      )}
    </>
  );
}
