'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Target } from '@/components/icons';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import { setLocationDailyTarget } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

/* Setting today's target from the page that judges you against it.
   The full location form is super_admin only, so without this a store manager
   could see a target but never own one. */

export function DailyTargetControl({ locationId, target }: { locationId: string; target: number | null }) {
  const formatMoney = useFormatMoney();
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
      <Button
        variant="outline"
        size="xs"
        onClick={() => {
          setValue(target != null ? String(target) : '');
          setEditing(true);
        }}
      >
        <Target aria-hidden="true" />
        {target != null ? formatMoney(target) : 'Set target'}
      </Button>
    );
  }

  const parsed = value.trim() === '' ? null : Number(value);
  const valid = parsed === null || (Number.isFinite(parsed) && parsed >= 0);

  return (
    <form
      className="relative flex items-center gap-1"
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
        className="h-7 w-24 rounded-md border border-input bg-control px-2 text-xs tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <Button type="submit" size="xs" disabled={!valid || save.isPending}>
        {save.isPending ? 'Saving' : 'Save'}
      </Button>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
      >
        Cancel
      </Button>
      {error && (
        <p role="alert" className="absolute top-full right-0 mt-1 w-48 rounded-md bg-card p-1.5 text-xs text-exception shadow-md">
          {error}
        </p>
      )}
    </form>
  );
}
