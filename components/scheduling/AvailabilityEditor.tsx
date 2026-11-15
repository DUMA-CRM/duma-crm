'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { CalendarDays, Moon, Star } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ChangeRow, SaveBar, Switch, ValueAside } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';

import { getAvailability, getMyAvailability, setAvailability, setMyAvailability } from '@/lib/api/rota.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import {
  type AvailabilityDay,
  type DayMode,
  NOTE_MAX,
  WEEKDAY_NAMES,
  dayProblem,
  daysToRules,
  rulesToDays,
} from '@/lib/utils/availability';

const MODES: { value: DayMode; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable_all_day', label: 'Not all day' },
  { value: 'unavailable_between', label: 'Not between' },
];

/** The query key both screens share, so saving on one refreshes the other. */
export const availabilityKey = (userId: string | 'me') => moduleQueryKeys.workforce.key('rota-availability', userId);

function dayValue(day: AvailabilityDay): string {
  if (day.mode === 'unavailable_all_day') return 'Unavailable';
  if (day.mode === 'unavailable_between') return `Not ${day.from}–${day.to === '00:00' ? 'midnight' : day.to}`;
  return 'Available';
}

/**
 * Weekly availability as seven rows — Settings → Account's rows, one per day:
 * the day's rule as the value, Change opening its form in place, one draft
 * saved through the SaveBar. `userId` omitted means your own (`/rota/availability/me`);
 * a manager passes the person's id and `canEdit` from `scheduling:write`.
 */
export function AvailabilityEditor({ userId, canEdit, title = 'Availability' }: { userId?: string; canEdit: boolean; title?: string }) {
  const qc = useQueryClient();
  const key = availabilityKey(userId ?? 'me');
  const query = useQuery({
    queryKey: key,
    queryFn: () => (userId ? getAvailability(userId) : getMyAvailability()),
  });
  const saved = useMemo(() => rulesToDays(query.data ?? []), [query.data]);
  const [draft, setDraft] = useState<AvailabilityDay[] | null>(null);
  const [open, setOpen] = useState<{ weekday: number; before: AvailabilityDay } | null>(null);
  const days = draft ?? saved;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const problem = days.map(dayProblem).find(Boolean) ?? null;

  const save = useMutation({
    mutationFn: () => {
      const rules = daysToRules(days);
      return userId ? setAvailability(userId, rules) : setMyAvailability(rules);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('rota-availability') });
      // The planner bundle carries everyone's availability.
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('rota-planner') });
      setDraft(null);
      setOpen(null);
    },
    onError: (error) => toast('error', (error as Error).message || 'Availability wasn’t saved. Try again.'),
  });

  const update = (weekday: number, patch: Partial<AvailabilityDay>) =>
    setDraft((current) => (current ?? saved).map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));

  const toggle = (day: AvailabilityDay) => {
    if (open?.weekday === day.weekday) {
      // Cancel puts the day back as it was when its row opened.
      update(day.weekday, open.before);
      setOpen(null);
    } else setOpen({ weekday: day.weekday, before: day });
  };

  return (
    <SettingsSection id={userId ? 'record-availability' : 'my-availability'} title={title}>
      {query.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading availability" className="space-y-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Bone className="size-10 shrink-0 rounded-md" />
              <div className="space-y-1.5">
                <Bone className="h-2.5 w-16" />
                <Bone className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState className="py-6" title="Availability couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : (
        <div>
          {days.map((day) => {
            const isOpen = open?.weekday === day.weekday;
            return (
              <ChangeRow
                key={day.weekday}
                icon={day.mode === 'unavailable_all_day' ? Moon : day.preferred ? Star : CalendarDays}
                label={WEEKDAY_NAMES[day.weekday]}
                value={
                  <>
                    <span className="shrink-0">{dayValue(day)}</span>
                    {(day.preferred || day.note) && (
                      <ValueAside>· {[day.preferred && 'prefers to work', day.note].filter(Boolean).join(' · ')}</ValueAside>
                    )}
                  </>
                }
                open={isOpen}
                onToggle={canEdit ? () => toggle(day) : undefined}
              >
                <DayForm day={day} onChange={(patch) => update(day.weekday, patch)} />
              </ChangeRow>
            );
          })}
        </div>
      )}
      {canEdit && (
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          disabled={Boolean(problem)}
          message={problem ?? 'Availability changed'}
          onSave={() => save.mutate()}
          onDiscard={() => {
            setDraft(null);
            setOpen(null);
          }}
        />
      )}
    </SettingsSection>
  );
}

function DayForm({ day, onChange }: { day: AvailabilityDay; onChange: (patch: Partial<AvailabilityDay>) => void }) {
  const problem = dayProblem(day);
  return (
    <div className="space-y-4">
      <SegmentedControl
        options={MODES}
        value={day.mode}
        onChange={(mode) => onChange({ mode, ...(mode === 'unavailable_all_day' ? { preferred: false } : {}) })}
        ariaLabel={`${WEEKDAY_NAMES[day.weekday]} availability`}
      />
      {day.mode === 'unavailable_between' && (
        <div className="grid grid-cols-2 gap-3">
          <TimePicker label="From" value={day.from} onValueChange={(from) => onChange({ from })} minuteStep={15} />
          <TimePicker
            label="Until"
            value={day.to}
            onValueChange={(to) => onChange({ to })}
            minuteStep={15}
            error={problem && problem !== `Keep the note under ${NOTE_MAX} characters` ? problem : undefined}
          />
        </div>
      )}
      {day.mode !== 'unavailable_all_day' && (
        <div className="flex items-center justify-between gap-3">
          <FieldLabel as="span">Prefer to work</FieldLabel>
          <Switch checked={day.preferred} onChange={(preferred) => onChange({ preferred })} label="Prefer to work this day" />
        </div>
      )}
      {(day.mode !== 'available' || day.preferred) && (
        <Input
          label="Note"
          value={day.note}
          maxLength={NOTE_MAX}
          placeholder="College, childcare…"
          onChange={(event) => onChange({ note: event.target.value })}
        />
      )}
    </div>
  );
}
