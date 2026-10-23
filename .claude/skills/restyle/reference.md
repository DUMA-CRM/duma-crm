# Booking rules skeleton

`components/reservations/BookingRules.tsx` reduced to its structure. Replace every `<Thing>` and the example rows.

```tsx
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { InfoRow, PickerRow } from '@/components/cms/rows';
import { AlertTriangle, Clock, Globe, type IconComponent, Users } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';

type Draft = Required<ThingInput>;
type Row = 'maxGuests' | 'holdMinutes';

const draftOf = (thing: Thing): Draft => ({ enabled: thing.enabled, maxGuests: thing.maxGuests, holdMinutes: thing.holdMinutes });

/** What this screen configures, and what sits in its aside. */
export function ThingRules({ ownerId, canEdit }: { ownerId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: moduleQueryKeys.thing.key('settings', ownerId), queryFn: () => getThing(ownerId) });
  // The draft remembers whose it is, so switching owner drops it.
  const [draftState, setDraftState] = useState<{ ownerId: string; value: Draft } | null>(null);
  const [open, setOpen] = useState<Row | null>(null);

  const saved = query.data ? draftOf(query.data) : null;
  const draft = draftState?.ownerId === ownerId ? draftState.value : saved;
  const dirty = Boolean(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraftState({ ownerId, value: { ...draft!, [key]: value } });

  const save = useMutation({
    mutationFn: () => saveThing(ownerId, draft!),
    onSuccess: async (next) => {
      setDraftState(null);
      queryClient.setQueryData(moduleQueryKeys.thing.key('settings', ownerId), next);
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.thing.all });
    },
    onError: (error) => toast('error', error.message),
  });

  if (query.isPending) return <Bone className="h-96 w-full rounded-lg" />;
  if (query.isError) return <ErrorState title="Couldn’t load the <thing>" onRetry={() => void query.refetch()} />;
  const value = draft!;

  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  const numberRow = (row: Row, icon: IconComponent, title: string, shown: string, hint: string, min: number, max: number, step: number, unit: string) => (
    <PickerRow icon={icon} title={title} value={shown} open={open === row} onToggle={() => toggle(row)}>
      <NumberStepper label={title} value={value[row]} min={min} max={max} step={step} unit={unit} onChange={(next) => set(row, next)} />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </PickerRow>
  );

  return (
    <SettingsTabBody
      narrowAside
      aside={
        <SettingsSection title="<Result>" actions={<Badge variant={query.data.enabled ? 'success' : 'muted'}>{query.data.enabled ? 'Live' : 'Off'}</Badge>}>
          {/* The artefact the rules produce: a preview, link, QR, summary. Empty → say how it appears. */}
        </SettingsSection>
      }
    >
      <SettingsSection title="<Group>">
        <fieldset disabled={!canEdit} className="min-w-0 space-y-3">
          <InfoRow icon={Globe} title="<Turn it on>">
            <Switch checked={value.enabled} onChange={(next) => set('enabled', next)} label="<Turn it on>" disabled={!canEdit} />
          </InfoRow>
          {numberRow('maxGuests', Users, 'Largest party', `${value.maxGuests} guests`, 'Why this number matters, in one line.', 1, 50, 1, 'guests')}
          {numberRow('holdMinutes', Clock, 'Held for', `${value.holdMinutes} min`, 'Why this number matters, in one line.', 15, 720, 15, 'min')}
        </fieldset>
        {!query.data.prerequisiteMet && (
          <Warning>
            What breaks and why. Fix it in{' '}
            <Link href="/settings/<where>" className="underline underline-offset-2">
              Settings → Where
            </Link>
            .
          </Warning>
        )}
      </SettingsSection>

      {canEdit && <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setDraftState(null)} />}
    </SettingsTabBody>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
```
