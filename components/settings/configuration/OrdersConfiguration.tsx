'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { InfoRow, InfoRows, PickerRow } from '@/components/cms/rows';
import { AlertTriangle, Bell, CheckCircle2, Clock, type IconComponent, Timer } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { updateTenantModuleConfiguration } from '@/lib/api/modules.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type DurationUnit,
  FOOD_LATENESS,
  type Lateness,
  durationLabel,
  joinDuration,
  latenessFor,
  latenessProblems,
  splitDuration,
} from '@/lib/utils/kitchen-age';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const UNITS: { value: DurationUnit; label: string }[] = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
];

type OrderingModule = NonNullable<Awaited<ReturnType<typeof getCurrentTenantModules>>['modules'][number]>;
type Duration = { amount: string; unit: DurationUnit };
type Draft = { on: boolean; nearly: Duration; late: Duration };
type Row = 'nearly' | 'late';

const durationOf = (mins: number): Duration => {
  const { amount, unit } = splitDuration(mins);
  return { amount: String(amount), unit };
};

// Off still remembers what "on" would be: the defaults for food, a day for products.
const draftOf = (lateness: Lateness | null, vocabulary: 'menu' | 'retail' | 'mixed'): Draft => {
  const start = lateness ?? (vocabulary === 'retail' ? { nearlyMins: 720, lateMins: 1440 } : FOOD_LATENESS);
  return { on: lateness !== null, nearly: durationOf(start.nearlyMins), late: durationOf(start.lateMins) };
};

/**
 * When an order counts as late — per workspace, because five minutes is late
 * for a flat white and nothing for a parcel. Feeds the kitchen screen's colours,
 * the dashboard's "needs you" strip and anything else that flags a late order.
 * Laid out like the other rules tabs: the switch and the two thresholds in the
 * main column, each threshold a row that opens its field; what staff will see
 * alongside.
 */
export function OrdersConfiguration() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const canChange = hasCapability(
    useAuthStore((state) => state.capabilities),
    'settings:write',
  );
  const { vocabulary } = useCatalogWords();
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });

  if (!tenantId) return <p className="text-sm text-muted-foreground">Choose a workspace to see its order settings.</p>;
  if (modules.isPending) return <Bone className="h-96 w-full rounded-lg" />;
  if (modules.isError) return <ErrorState title="Couldn’t load the order settings" onRetry={() => void modules.refetch()} />;
  const ordering = modules.data.modules.find((state) => state.moduleId === 'ordering');
  if (!ordering) {
    return (
      <p className="text-sm text-muted-foreground">
        Orders isn’t set up for this workspace. Turn it on in{' '}
        <Link href="/settings/modules" className="underline underline-offset-2">
          Settings → Modules
        </Link>
        .
      </p>
    );
  }
  // The draft belongs to one workspace: switching drops it.
  return <OrdersForm key={tenantId} ordering={ordering} vocabulary={vocabulary} canChange={canChange} tenantId={tenantId} />;
}

function OrdersForm({
  ordering,
  vocabulary,
  canChange,
  tenantId,
}: {
  ordering: OrderingModule;
  vocabulary: 'menu' | 'retail' | 'mixed';
  canChange: boolean;
  tenantId: string;
}) {
  const qc = useQueryClient();
  // The module as this page last saved it — ahead of the list until that refetches, so a second save sends the right version.
  const [base, setBase] = useState(ordering);
  const latest = ordering.configurationVersion > base.configurationVersion ? ordering : base;
  const saved = latenessFor(latest.configuration, vocabulary);

  const [draftState, setDraftState] = useState<Draft | null>(null);
  // One threshold open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<Row | null>(null);
  const draft = draftState ?? draftOf(saved, vocabulary);
  const set = (patch: Partial<Draft>) => setDraftState({ ...draft, ...patch });

  const nearlyMins = joinDuration(draft.nearly.amount, draft.nearly.unit);
  const lateMins = joinDuration(draft.late.amount, draft.late.unit);
  const problems = draft.on ? latenessProblems(nearlyMins, lateMins) : {};
  const valid = !problems.nearly && !problems.late;
  // Compared in minutes, not as typed, so "5" and "5.0" are the same.
  const next: Lateness | null = draft.on && valid ? { nearlyMins: nearlyMins!, lateMins: lateMins! } : null;
  const dirty = JSON.stringify(draft.on ? { nearlyMins, lateMins } : null) !== JSON.stringify(saved);

  const save = useMutation({
    mutationFn: (lateness: Lateness | null) =>
      updateTenantModuleConfiguration(
        tenantId,
        'ordering',
        latest,
        { lateness: lateness ?? { off: true } },
        lateness ? `Orders late after ${durationLabel(lateness.lateMins)}` : 'Late orders not flagged',
      ),
    onSuccess: async (result) => {
      setBase(result.module);
      setDraftState(null);
      setOpen(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules') }),
        qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenant-modules') }),
      ]);
    },
    onError: (error) => toast('error', error.message || 'Changes couldn’t be saved. Try again.'),
  });

  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  /** A threshold: its length on the row, the amount and unit (and what it does) underneath. */
  const durationRow = (row: Row, icon: IconComponent, title: string, hint: string) => {
    const value = draft[row];
    const mins = row === 'nearly' ? nearlyMins : lateMins;
    return (
      <PickerRow icon={icon} title={title} value={mins === null ? 'Not set' : durationLabel(mins)} muted={mins === null} open={open === row} onToggle={() => toggle(row)}>
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-2">
          <Input
            aria-label={title}
            value={value.amount}
            onChange={(event) => set({ [row]: { ...value, amount: event.target.value } })}
            inputMode="decimal"
            autoFocus
            error={problems[row]}
          />
          <Select
            value={value.unit}
            onValueChange={(unit) => set({ [row]: { ...value, unit: unit as DurationUnit } })}
            options={UNITS}
            ariaLabel={`${title} unit`}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      </PickerRow>
    );
  };

  return (
    <SettingsTabBody
      narrowAside
      aside={
        <SettingsSection title="What staff see" actions={<Badge variant={draft.on ? 'success' : 'muted'}>{draft.on ? 'On' : 'Off'}</Badge>}>
          {!draft.on ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No order turns amber or red on the kitchen screen, and the dashboard doesn’t list late orders.
              </p>
              {vocabulary === 'retail' && (
                <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                  Off by default for products — a parcel isn’t late after five minutes.
                </p>
              )}
            </div>
          ) : next ? (
            <>
              <InfoRows>
                <InfoRow icon={CheckCircle2} tone="success" title="On time">
                  <span className="text-sm text-muted-foreground">Under {durationLabel(next.nearlyMins)}</span>
                </InfoRow>
                <InfoRow icon={Timer} tone="warning" title="Nearly late">
                  <span className="text-sm text-muted-foreground">After {durationLabel(next.nearlyMins)}</span>
                </InfoRow>
                <InfoRow icon={AlertTriangle} tone="danger" title="Late">
                  <span className="text-sm text-muted-foreground">After {durationLabel(next.lateMins)}</span>
                </InfoRow>
              </InfoRows>
              <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                Counted in each stage — how long an order has been new, preparing or ready — not since it was placed. Late orders also show on the dashboard.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Fix the times and you’ll see here when an order turns amber and red.</p>
          )}
        </SettingsSection>
      }
    >
      <SettingsSection title="Late orders" footnote={canChange ? undefined : 'Only someone who can change workspace settings can change this.'}>
        <fieldset disabled={!canChange} className="space-y-3">
          <InfoRow icon={Bell} title="Flag late orders">
            <Switch checked={draft.on} onChange={(on) => set({ on })} label="Flag late orders" disabled={!canChange} />
          </InfoRow>
          {draft.on && durationRow('nearly', Timer, 'Nearly late after', 'The ticket turns amber.')}
          {draft.on && durationRow('late', Clock, 'Late after', 'It turns red and shows on the dashboard.')}
        </fieldset>
      </SettingsSection>

      {canChange && (
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          disabled={!valid}
          message={valid ? undefined : 'Check the times — each more than 0, nearly late sooner than late'}
          onSave={() => save.mutate(next)}
          onDiscard={() => {
            setDraftState(null);
            setOpen(null);
          }}
        />
      )}
    </SettingsTabBody>
  );
}
