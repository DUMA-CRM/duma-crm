'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

import { Building2, CalendarDays, Globe, Loader2, Pencil, Tag } from '@/components/icons';
import { BrandPicker } from '@/components/settings/BrandPicker';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Fact } from '@/components/settings/controls';
import { CatalogKindSetting } from '@/components/settings/workspaces/CatalogKindSetting';
import { LocationList } from '@/components/settings/workspaces/LocationList';
import { WorkspaceList } from '@/components/settings/workspaces/WorkspaceList';
import { WorkspaceReadinessChecklist } from '@/components/settings/workspaces/WorkspaceReadinessChecklist';
import { Modal } from '@/components/shared/Modal';
import { Bone, FactSkeleton } from '@/components/shared/Skeleton';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import {
  type CurrentTenantPatch,
  getWorkspaceSetup,
  renameCurrentTenant,
  updateCurrentTenant,
  updateTenant,
} from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type Brand, parseBrand } from '@/lib/utils/brand';
import {
  formatInstant,
  isValidTimeZone,
  timeZoneCity,
  timeZoneGap,
  timeZoneOffsetLabel,
  workspaceTimeZone,
} from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const STATUS = {
  active: { label: 'Active', variant: 'success' },
  winding_down: { label: 'Winding down', variant: 'warning' },
  inactive: { label: 'Inactive', variant: 'muted' },
} as const;

export function WorkspaceTab() {
  const { tenant, isPlatform } = useCurrentWorkspace();

  return (
    <SettingsTabBody>
      <BusinessSection />
      <BrandSection />
      <CatalogKindSetting />
      <ReadinessSection />
      {isPlatform ? (
        // Pick the workspace on the left, its locations follow on the right.
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <WorkspaceList />
          <LocationList tenant={tenant} />
        </div>
      ) : (
        <LocationList tenant={tenant} />
      )}
    </SettingsTabBody>
  );
}

/**
 * Shown while there is setup left to do, gone once the owner has confirmed the
 * workspace ready. It comes back by itself if a later change (a module switched
 * on, a reader removed) breaks readiness — the API recomputes the checks.
 */
function ReadinessSection() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // Same key and fetcher as the checklist, so this reads its cache rather than asking twice.
  const setup = useQuery({
    queryKey: ['workspace-setup', tenantId],
    queryFn: () => getWorkspaceSetup(tenantId!),
    enabled: Boolean(tenantId),
  });
  const confirmed = setup.data?.status === 'completed' && setup.data.readiness.ready;
  if (!tenantId || confirmed) return null;
  return (
    <SettingsSection>
      <WorkspaceReadinessChecklist />
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
      // The business card as it lands: the big tile, the name, then three facts.
      <div role="status" aria-busy="true" aria-label="Loading workspace" className="rounded-lg border border-rule/60 bg-field p-5">
        <div className="flex items-center gap-4" aria-hidden="true">
          <Bone className="size-24 shrink-0 rounded-xl" />
          <span className="min-w-0 flex-1 space-y-2">
            <Bone className="h-6 w-56 max-w-full" />
            <Bone className="h-3.5 w-36" />
          </span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
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
        <span className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <Building2 size={40} aria-hidden="true" />
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
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Fact
          icon={CalendarDays}
          label="Created"
          value={formatInstant(tenant.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
        />
        {/* The only place an owner can read their workspace ID. */}
        <Fact icon={Tag} label="Workspace ID" value={<span className="font-mono text-xs">{tenant.slug}</span>} />
        <TimezoneFact />
      </dl>
      {tenant.status !== 'active' && tenant.statusReason && (
        <p className="mt-3 text-xs text-muted-foreground">Status note: {tenant.statusReason}</p>
      )}
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
  const setDeviceBrand = useUiSettingsStore((state) => state.setBrand);
  const { tenant, isPlatform } = useCurrentWorkspace();
  const canEdit = isPlatform ? hasCapability(capabilities, 'tenants:write') : hasCapability(capabilities, 'settings:write');
  // A platform admin may be looking at someone else's workspace; only our own repaints this browser.
  const own = !isPlatform || tenant?.id === ownTenantId;

  const save = useMutation({
    mutationFn: (patch: CurrentTenantPatch) => (isPlatform ? updateTenant(tenant!.id, patch) : updateCurrentTenant(patch)),
    onSuccess: (_saved, patch) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenants') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant') });
      if (patch.brand) {
        if (own) setDeviceBrand(parseBrand(patch.brand));
        toast('success', 'Brand colour saved for everyone in the workspace.');
      }
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

/** The business card's third figure: where the workspace keeps time, and what time it is there. */
function TimezoneFact() {
  const { tenant, canEdit } = useWorkspaceAppearance();
  const now = useNow();
  const [editing, setEditing] = useState(false);
  if (!tenant) return null;

  const zone = tenant.timezone ?? workspaceTimeZone() ?? 'Europe/London';
  return (
    <>
      <Fact
        icon={Globe}
        label="Timezone"
        value={timeZoneCity(zone)}
        hint={now ? `${timeZoneOffsetLabel(zone, now)} · ${clockIn(zone, now)} there now` : zone}
        {...(canEdit ? { onSelect: () => setEditing(true), action: 'Change' } : {})}
      />
      {editing && <TimezoneDialog current={zone} onClose={() => setEditing(false)} />}
    </>
  );
}

function TimezoneDialog({ current, onClose }: { current: string; onClose: () => void }) {
  const { save } = useWorkspaceAppearance();
  const now = useNow() ?? new Date();
  const [zone, setZone] = useState(current);
  const valid = isValidTimeZone(zone);
  const changed = valid && zone !== current;

  return (
    <Modal
      title="Workspace timezone"
      description="Every time in DUMA is shown in this zone, wherever you are. Reports and scheduled posts follow it too."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!changed || save.isPending} onClick={() => save.mutate({ timezone: zone })}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save timezone
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TimezoneSelect value={zone} onChange={setZone} required />

        {valid && (
          // The answer to "is this right?": the time it is there, against the time here.
          <div className="flex items-center gap-4 rounded-lg border border-rule/60 bg-band/40 px-4 py-3">
            <span className="text-3xl font-semibold tabular-nums tracking-headline text-foreground">{clockIn(zone, now)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                {timeZoneCity(zone)} · {timeZoneOffsetLabel(zone, now)}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(now)} ·{' '}
                {timeZoneGap(zone, undefined, now)}
              </span>
            </span>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Each location keeps its own zone for its trading day and opening hours. Saving reloads DUMA so every time is redrawn.
        </p>
      </div>
    </Modal>
  );
}

function BrandSection() {
  const { tenant, canEdit, save } = useWorkspaceAppearance();
  if (!tenant) return null;
  const brand: Brand | undefined = tenant.brand ? parseBrand(tenant.brand) : undefined;

  return (
    <SettingsSection
      title="Brand colour"
      description="Buttons, links, the navigation bar and the DUMA assistant take this colour, for everyone in the workspace. Status colours keep their meaning whichever you pick."
    >
      <BrandPicker
        value={save.isPending && save.variables?.brand ? parseBrand(save.variables.brand) : brand}
        onChange={(next) => next !== brand && save.mutate({ brand: next })}
        disabled={!canEdit || save.isPending}
      />
    </SettingsSection>
  );
}
