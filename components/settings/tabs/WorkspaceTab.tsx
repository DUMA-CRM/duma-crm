'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

import { Building2, CalendarDays, Globe, Loader2, Palette, Pencil, Tag } from '@/components/icons';
import { BrandPicker } from '@/components/settings/BrandPicker';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ChangeRow, Fact, ValueAside } from '@/components/settings/controls';
import { CatalogKindSetting } from '@/components/settings/workspaces/CatalogKindSetting';
import { LocationList } from '@/components/settings/workspaces/LocationList';
import { Bone, FactSkeleton } from '@/components/shared/Skeleton';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { WORKSPACE_CONTEXT_KEY } from '@/lib/hooks/useWorkspaceContext';
import { type CurrentTenantPatch, renameCurrentTenant, updateCurrentTenant, updateTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { BRANDS, parseBrand } from '@/lib/utils/brand';
import {
  formatInstant,
  isValidTimeZone,
  timeZoneCity,
  timeZoneGap,
  timeZoneOffsetLabel,
  workspaceTimeZone,
} from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const STATUS = {
  active: { label: 'Active', variant: 'success' },
  winding_down: { label: 'Winding down', variant: 'warning' },
  inactive: { label: 'Inactive', variant: 'muted' },
} as const;

type Row = 'brand' | 'timezone' | 'catalog';

export function WorkspaceTab() {
  const { tenant } = useCurrentWorkspace();

  // The workspace this tab is in. Choosing another one happens in DUMA Admin
  // (or the switcher), not here: settings never change where you are working.
  // The business | where it trades.
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div className="min-w-0">
        <SettingsTabBody>
          <BusinessSection />
          <WorkspaceSettingsSection />
        </SettingsTabBody>
      </div>
      <div className="min-w-0">
        <SettingsTabBody>
          <LocationList tenant={tenant} />
        </SettingsTabBody>
      </div>
    </div>
  );
}

/** Brand colour, timezone and what the business sells: each a row whose Change opens its picker in place, and saves on the pick. */
function WorkspaceSettingsSection() {
  const { tenant } = useCurrentWorkspace();
  const [open, setOpen] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  if (!tenant) return null;
  return (
    <SettingsSection>
      <BrandRow open={open === 'brand'} onToggle={() => toggle('brand')} onDone={() => setOpen(null)} />
      <TimezoneRow open={open === 'timezone'} onToggle={() => toggle('timezone')} onDone={() => setOpen(null)} />
      <CatalogKindSetting open={open === 'catalog'} onToggle={() => toggle('catalog')} onDone={() => setOpen(null)} />
    </SettingsSection>
  );
}

function BusinessSection() {
  const qc = useQueryClient();
  const capabilities = useAuthStore((state) => state.capabilities);
  const { tenant, isPlatform, isLoading } = useCurrentWorkspace();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  // Platform admins rename through the tenant routes; an owner through /tenants/current.
  const canRename = isPlatform ? hasCapability(capabilities, 'tenants:write') : hasCapability(capabilities, 'settings:write');

  const rename = useMutation({
    mutationFn: () => (isPlatform ? updateTenant(tenant!.id, { name: name.trim() }) : renameCurrentTenant(name.trim())),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenants') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant') });
      toast('success', 'Business name saved.');
      setEditing(false);
    },
    onError: (error) => toast('error', error.message),
  });

  if (isLoading)
    return (
      // The business card as it lands: the tile, the name, then the two facts.
      <div role="status" aria-busy="true" aria-label="Loading workspace" className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4" aria-hidden="true">
          <Bone className="size-16 shrink-0 rounded-xl" />
          <span className="min-w-0 flex-1 space-y-2">
            <Bone className="h-6 w-56 max-w-full" />
            <Bone className="h-3.5 w-36" />
          </span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <FactSkeleton key={index} surface="panel" />
          ))}
        </div>
      </div>
    );
  if (!tenant) {
    return (
      <SettingsSection title="Business">
        <p className="text-sm text-muted-foreground">Choose a workspace to see its details.</p>
      </SettingsSection>
    );
  }

  const status = STATUS[tenant.status];

  return (
    <SettingsSection>
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <Building2 size={28} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <motion.form
                key="edit"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  rename.mutate();
                }}
              >
                <div className="min-w-0 flex-1">
                  <Input
                    label="Business name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    minLength={2}
                    maxLength={100}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={name.trim().length < 2 || name.trim() === tenant.name || rename.isPending}>
                    {rename.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                    Save
                  </Button>
                </div>
              </motion.form>
            ) : (
              <motion.div key="show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-2xl font-semibold tracking-headline text-foreground">{tenant.name}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {tenant.status !== 'active' && tenant.statusReason && (
            <p className="mt-1.5 truncate text-sm text-muted-foreground">{tenant.statusReason}</p>
          )}
        </div>
        {canRename && !editing && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 self-start"
            onClick={() => {
              setName(tenant.name);
              setEditing(true);
            }}
          >
            <Pencil aria-hidden="true" /> Rename
          </Button>
        )}
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <Fact
          icon={CalendarDays}
          label="Created"
          value={formatInstant(tenant.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
        />
        {/* The only place an owner can read their workspace ID. */}
        <Fact icon={Tag} label="Workspace ID" value={<span className="font-mono text-xs">{tenant.slug}</span>} />
      </dl>
    </SettingsSection>
  );
}

/**
 * Saving the workspace's clock or colour. Both belong to the business, not the
 * device: every time in the app is read in the zone — wherever the person
 * reading it is — and everyone in the workspace sees the colour.
 */
function useWorkspaceAppearance() {
  const qc = useQueryClient();
  const router = useRouter();
  const capabilities = useAuthStore((state) => state.capabilities);
  const ownTenantId = useWorkspaceStore((state) => state.tenantId);
  const { tenant, isPlatform } = useCurrentWorkspace();
  const canEdit = isPlatform ? hasCapability(capabilities, 'tenants:write') : hasCapability(capabilities, 'settings:write');
  // The workspace this tab is in is the only one it repaints.
  const own = tenant?.id === ownTenantId;

  const save = useMutation({
    mutationFn: (patch: CurrentTenantPatch) => (isPlatform ? updateTenant(tenant!.id, patch) : updateCurrentTenant(patch)),
    onSuccess: (_saved, patch) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenants') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant') });
      // The tab's context carries the colour and zone; reading it again repaints
      // this tab, and other tabs in this workspace within a minute.
      void qc.invalidateQueries({ queryKey: WORKSPACE_CONTEXT_KEY });
      if (patch.brand) toast('success', 'Brand colour saved for everyone in the workspace.');
      // Every time on every page was drawn in the old zone, so redraw them all.
      if (patch.timezone && own) window.location.reload();
      else if (patch.timezone) toast('success', 'Timezone saved.');
      // The layout reads both with the profile — fetch it again.
      router.refresh();
    },
    onError: (error) => toast('error', error.message),
  });

  return { tenant, canEdit, save };
}

/** The wall clock, to the half minute — null on the server, so the server and browser render alike. */
const subscribeClock = (tick: () => void) => {
  const timer = window.setInterval(tick, 30_000);
  return () => window.clearInterval(timer);
};
const clockSnapshot = () => Math.floor(Date.now() / 30_000) * 30_000;
function useNow() {
  const at = useSyncExternalStore(subscribeClock, clockSnapshot, () => null);
  return at === null ? null : new Date(at);
}

const clockIn = (timeZone: string, at: Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(at);

interface RowProps {
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}

/** Where the workspace keeps time, and what time it is there. */
function TimezoneRow({ open, onToggle, onDone }: RowProps) {
  const { tenant, canEdit } = useWorkspaceAppearance();
  const now = useNow();
  if (!tenant) return null;

  const zone = tenant.timezone ?? workspaceTimeZone() ?? 'Europe/London';
  return (
    <ChangeRow
      icon={Globe}
      label="Timezone"
      value={
        <>
          <span className="truncate">{timeZoneCity(zone)}</span>
          <ValueAside>· {now ? `${timeZoneOffsetLabel(zone, now)} · ${clockIn(zone, now)} there now` : zone}</ValueAside>
        </>
      }
      open={open}
      onToggle={canEdit ? onToggle : undefined}
    >
      <TimezoneForm current={zone} onDone={onDone} />
    </ChangeRow>
  );
}

function TimezoneForm({ current, onDone }: { current: string; onDone: () => void }) {
  const { save } = useWorkspaceAppearance();
  const now = useNow() ?? new Date();
  const [zone, setZone] = useState(current);
  const valid = isValidTimeZone(zone);

  return (
    <div className="space-y-3">
      <fieldset disabled={save.isPending} className="disabled:opacity-60">
        <legend className="sr-only">Timezone</legend>
        <TimezoneSelect
          value={zone}
          onChange={(next) => {
            if (save.isPending || next === current || !isValidTimeZone(next)) return;
            setZone(next);
            save.mutate(
              { timezone: next },
              {
                onSuccess: () => onDone(),
                onError: () => setZone(current),
              },
            );
          }}
          required
        />
      </fieldset>
      {save.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Saving…
        </p>
      ) : (
        valid && (
          // The answer to "is this right?": the time it is there, against the time here.
          <p className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(now)} ·{' '}
            {timeZoneGap(zone, undefined, now)}
          </p>
        )
      )}
    </div>
  );
}

/** The workspace's colour, seen by everyone in it. */
function BrandRow({ open, onToggle, onDone }: RowProps) {
  const { tenant, canEdit, save } = useWorkspaceAppearance();
  if (!tenant) return null;
  const brand = parseBrand(tenant.brand);
  const label = BRANDS.find((choice) => choice.id === brand)!.label;

  return (
    <ChangeRow
      icon={Palette}
      label="Brand colour"
      value={
        <>
          <span data-brand={brand} className="size-3.5 shrink-0 rounded-[3px] border border-border bg-(--brand)" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </>
      }
      open={open}
      onToggle={canEdit ? onToggle : undefined}
    >
      <BrandPicker
        value={save.isPending && save.variables?.brand ? parseBrand(save.variables.brand) : brand}
        onChange={(next) => next !== brand && save.mutate({ brand: next }, { onSuccess: () => onDone() })}
        disabled={!canEdit || save.isPending}
      />
    </ChangeRow>
  );
}
