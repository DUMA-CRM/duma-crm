'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { InfoRow, InfoRows } from '@/components/cms/rows';
import { AlertTriangle, Bell, CheckCircle2, Clock, type IconComponent, Settings, Timer, Trash2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ChangeRow, Switch, ValueMissing } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { updateTenantModuleConfiguration } from '@/lib/api/modules.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { getCurrentTenantModules, getTradingSettings, saveTradingSettings } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
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
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const UNITS: { value: DurationUnit; label: string }[] = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
];

type OrderingModule = NonNullable<Awaited<ReturnType<typeof getCurrentTenantModules>>['modules'][number]>;
type Duration = { amount: string; unit: DurationUnit };
type LatenessDraft = { on: boolean; nearly: Duration; late: Duration };
type Row = 'nearly' | 'late';

const durationOf = (mins: number): Duration => {
  const { amount, unit } = splitDuration(mins);
  return { amount: String(amount), unit };
};

// Off still remembers what "on" would be: the defaults for food, a day for products.
const draftOf = (lateness: Lateness | null, vocabulary: 'menu' | 'retail' | 'mixed'): LatenessDraft => {
  const start = lateness ?? (vocabulary === 'retail' ? { nearlyMins: 720, lateMins: 1440 } : FOOD_LATENESS);
  return { on: lateness !== null, nearly: durationOf(start.nearlyMins), late: durationOf(start.lateMins) };
};

/**
 * The workspace's order rules, opened from the Orders page's edit mode: when an
 * order counts as late (per workspace — five minutes is late for a flat white
 * and nothing for a parcel; it colours the kitchen screen and feeds the
 * dashboard's Needs you), and whether a cancelled order may be deleted for good.
 * Both are saved for everyone, so the drawer keeps a draft and saves it in one
 * go from its foot. Changing them needs `settings:write`.
 */
export function OrdersSettingsDrawer({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
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
  // The Delete action reads this same key (`useMayDeleteOrder`), so saving here shows or hides it at once.
  const trading = useQuery({
    queryKey: moduleQueryKeys.organization.key('trading', tenantId),
    queryFn: () => getTradingSettings(tenantId!),
    enabled: Boolean(tenantId),
  });

  const ordering = modules.data?.modules.find((state) => state.moduleId === 'ordering');
  // The module as this drawer last saved it — ahead of the list until that refetches, so a second save sends the right version.
  const [base, setBase] = useState<OrderingModule | null>(null);
  const latest = ordering && base && base.configurationVersion >= ordering.configurationVersion ? base : ordering;
  const savedLateness = latest ? latenessFor(latest.configuration, vocabulary) : null;
  const savedDeletion = trading.data?.allowOrderDeletion ?? false;

  const [latenessDraft, setLatenessDraft] = useState<LatenessDraft | null>(null);
  const [deletionDraft, setDeletionDraft] = useState<boolean | null>(null);
  const lateness = latenessDraft ?? draftOf(savedLateness, vocabulary);
  const deletion = deletionDraft ?? savedDeletion;
  const setLateness = (patch: Partial<LatenessDraft>) => setLatenessDraft({ ...lateness, ...patch });

  const nearlyMins = joinDuration(lateness.nearly.amount, lateness.nearly.unit);
  const lateMins = joinDuration(lateness.late.amount, lateness.late.unit);
  const problems = lateness.on ? latenessProblems(nearlyMins, lateMins) : {};
  const valid = !problems.nearly && !problems.late;
  const nextLateness: Lateness | null = lateness.on && valid ? { nearlyMins: nearlyMins!, lateMins: lateMins! } : null;
  // Compared in minutes, not as typed, so "5" and "5.0" are the same.
  const latenessDirty = JSON.stringify(lateness.on ? { nearlyMins, lateMins } : null) !== JSON.stringify(savedLateness);
  const deletionDirty = deletion !== savedDeletion;
  const dirty = latenessDirty || deletionDirty;

  // One threshold open at a time. Closing it again puts it back as it was when it opened; the draft is saved from the foot.
  const [open, setOpen] = useState<Row | null>(null);
  const [before, setBefore] = useState<LatenessDraft | null>(null);
  const toggle = (row: Row) => {
    if (open === row) {
      if (before) setLateness({ [row]: before[row] });
      setOpen(null);
      return;
    }
    setBefore(lateness);
    setOpen(row);
  };
  const discard = () => {
    setLatenessDraft(null);
    setDeletionDraft(null);
    setOpen(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (latenessDirty && latest && tenantId) {
        const result = await updateTenantModuleConfiguration(
          tenantId,
          'ordering',
          latest,
          { lateness: nextLateness ?? { off: true } },
          nextLateness ? `Orders late after ${durationLabel(nextLateness.lateMins)}` : 'Late orders not flagged',
        );
        setBase(result.module);
      }
      // The trading settings save whole; everything but this switch goes back as it came.
      if (deletionDirty && trading.data) {
        await saveTradingSettings({ ...trading.data, defaultVatRate: Number(trading.data.defaultVatRate), allowOrderDeletion: deletion });
      }
    },
    onSuccess: async () => {
      discard();
      toast('success', 'Order settings saved.');
      await Promise.all([
        qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules') }),
        qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenant-modules') }),
        qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('trading') }),
      ]);
    },
    onError: (error) => toast('error', error.message || 'Changes couldn’t be saved. Try again.'),
  });

  /** A threshold: its length on the row, the amount and unit underneath. */
  const durationRow = (row: Row, icon: IconComponent, title: string) => {
    const value = lateness[row];
    const mins = row === 'nearly' ? nearlyMins : lateMins;
    return (
      <ChangeRow
        icon={icon}
        label={title}
        value={mins === null ? <ValueMissing>Not set</ValueMissing> : durationLabel(mins)}
        open={open === row}
        onToggle={() => toggle(row)}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-2">
          <Input
            aria-label={title}
            value={value.amount}
            onChange={(event) => setLateness({ [row]: { ...value, amount: event.target.value } })}
            inputMode="decimal"
            autoFocus
            error={problems[row]}
          />
          <Select
            value={value.unit}
            onValueChange={(unit) => setLateness({ [row]: { ...value, unit: unit as DurationUnit } })}
            options={UNITS}
            ariaLabel={`${title} unit`}
          />
        </div>
      </ChangeRow>
    );
  };

  let body: React.ReactNode;
  if (!tenantId) body = <p className="text-sm text-muted-foreground">Choose a workspace to see its order settings.</p>;
  else if (modules.isPending) body = <ListSkeleton rows={4} label="Loading order settings" />;
  else if (modules.isError) body = <ErrorState title="Couldn’t load the order settings" onRetry={() => void modules.refetch()} />;
  else if (!ordering) {
    body = (
      <p className="text-sm text-muted-foreground">
        Orders isn’t set up for this workspace. Turn it on in{' '}
        <Link href="/settings/modules" className="underline underline-offset-2">
          Settings → Modules
        </Link>
        .
      </p>
    );
  } else {
    body = (
      <fieldset disabled={!canChange || save.isPending} className="flex min-w-0 flex-col gap-5">
        <SettingsSection
          title="Late orders"
          footnote="Counted in each stage — how long an order has been new, preparing or ready — not since it was placed."
        >
          <div>
            <ChangeRow
              icon={Bell}
              label="Late orders"
              value={lateness.on ? 'Flagged' : <ValueMissing>Not flagged</ValueMissing>}
              trailing={
                <Switch checked={lateness.on} onChange={(on) => setLateness({ on })} label="Flag late orders" disabled={!canChange} />
              }
            />
            {lateness.on && durationRow('nearly', Timer, 'Nearly late after')}
            {lateness.on && durationRow('late', Clock, 'Late after')}
          </div>
        </SettingsSection>

        <LatenessPreview on={lateness.on} next={nextLateness} retail={vocabulary === 'retail'} />

        <SettingsSection
          title="Deleting orders"
          footnote="Delete shows only on a cancelled order, and only to staff who can refund. A deleted order is gone for good."
        >
          {trading.isError ? (
            <ErrorState title="Couldn’t load this setting" onRetry={() => void trading.refetch()} />
          ) : (
            <div>
              <ChangeRow
                icon={Trash2}
                label="Delete cancelled orders"
                value={deletion ? 'Allowed' : <ValueMissing>Off — cancelled orders are kept</ValueMissing>}
                trailing={
                  <Switch
                    checked={deletion}
                    onChange={(next) => setDeletionDraft(next)}
                    label="Delete cancelled orders"
                    disabled={!canChange || trading.isPending}
                  />
                }
              />
            </div>
          )}
        </SettingsSection>
      </fieldset>
    );
  }

  return (
    <Drawer
      title="Order settings"
      description="For the whole workspace — the kitchen screen, the dashboard and this list all follow them."
      icon={Settings}
      modal={false}
      onClose={onClose}
      bodyClassName="px-5 py-5 sm:px-6"
      footer={
        !canChange ? (
          <p className="text-xs text-muted-foreground">Only someone who can change workspace settings can change these.</p>
        ) : dirty ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {valid ? 'Unsaved changes' : 'Check the times — each more than 0, nearly late sooner than late'}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={discard} disabled={save.isPending}>
                Discard
              </Button>
              <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
                {save.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Saved for the whole workspace.</p>
        )
      }
    >
      {body}
    </Drawer>
  );
}

/** What staff will see with the draft: when a ticket turns amber and red, or that nothing does. */
function LatenessPreview({ on, next, retail }: { on: boolean; next: Lateness | null; retail: boolean }) {
  return (
    <SettingsSection title="What staff see">
      {!on ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No order turns amber or red on the kitchen screen, and the dashboard doesn’t list late orders.
          </p>
          {retail && <p className="text-xs text-muted-foreground">Off by default for products — a parcel isn’t late after five minutes.</p>}
        </div>
      ) : next ? (
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
      ) : (
        <p className="text-sm text-muted-foreground">Fix the times and you’ll see here when an order turns amber and red.</p>
      )}
    </SettingsSection>
  );
}
