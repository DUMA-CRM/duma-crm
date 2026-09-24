'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Target } from '@/components/icons';

import { setLocationDailyTarget } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { formatMoney } from '@/lib/utils/dashboard';

/* Setting today's target from the page that judges you against it.
   The full location form is super_admin only, so without this a store manager
   could see a target but never own one. */

export function DailyTargetControl({ locationId, target }: { locationId: string; target: number | null }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(target != null ? String(target) : '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (next: number | null) => setLocationDailyTarget(locationId, next),
    onSuccess: () => {
      setEditing(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('locations-accessible') });
    },
    onError: (mutationError) => setError((mutationError as Error).message || 'The target was not saved. Try again.'),
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(target != null ? String(target) : '');
          setEditing(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
      >
        <Target size={13} aria-hidden="true" />
        {target != null ? `Target ${formatMoney(target)}` : 'Set a target'}
      </button>
    );
  }

  const parsed = value.trim() === '' ? null : Number(value);
  const valid = parsed === null || (Number.isFinite(parsed) && parsed >= 0);

  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save.mutate(parsed);
      }}
    >
      <label className="sr-only" htmlFor="daily-target">
        Daily revenue target
      </label>
      <input
        id="daily-target"
        type="number"
        min={0}
        step={10}
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="No target"
        className="h-8 w-28 rounded-md border border-input bg-field px-2 text-sm tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <button
        type="submit"
        disabled={!valid || save.isPending}
        className="h-8 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {save.isPending ? 'Saving' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        className="h-8 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-band"
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-exception">
          {error}
        </p>
      )}
    </form>
  );
}
