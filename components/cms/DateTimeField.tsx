'use client';

import { useId, useState } from 'react';

import { X } from '@/components/icons';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';

import { isoToLocalParts, localPartsToIso } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';

import { FIELD_LABEL_CLASS } from './shared';

/**
 * A moment in time, picked as the app picks every date — the shared
 * DatePicker — plus a time box. Value in and out is an ISO instant (or '' when
 * cleared), shown in the viewer's own time zone.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
  min,
}: {
  label: React.ReactNode;
  value: string | null | undefined;
  onChange: (iso: string) => void;
  hint?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  /** Earliest selectable day, `YYYY-MM-DD`. */
  min?: string;
}) {
  const id = useId();
  const parts = isoToLocalParts(value);
  // The time is kept while no date is chosen, so typing it first isn't lost.
  const [pendingTime, setPendingTime] = useState(parts.time || '09:00');
  const time = parts.time || pendingTime;

  const commit = (date: string, nextTime: string) => onChange(date ? (localPartsToIso(date, nextTime) ?? '') : '');

  return (
    <div>
      <span className={FIELD_LABEL_CLASS} id={`${id}-label`}>
        {label}
      </span>
      <div className="mt-1 flex items-start gap-2" role="group" aria-labelledby={`${id}-label`}>
        <div className="min-w-0 flex-1">
          <DatePicker aria-label="Date" value={parts.date} min={min} disabled={disabled} onValueChange={(date) => commit(date, time)} />
        </div>
        <div className="w-28 shrink-0">
          <TimePicker
            aria-label="Time"
            value={time}
            required
            disabled={disabled}
            onValueChange={(next) => {
              setPendingTime(next);
              if (parts.date) commit(parts.date, next);
            }}
          />
        </div>
        {parts.date && !disabled && (
          <button
            type="button"
            aria-label="Clear"
            title="Clear"
            onClick={() => onChange('')}
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {(error || hint) && <p className={cn('mt-1 text-xs', error ? 'text-exception' : 'text-muted-foreground')}>{error ?? hint}</p>}
    </div>
  );
}
