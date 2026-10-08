'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

import { Building2, CalendarDays, Loader2, Pencil, Tag } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Fact } from '@/components/settings/controls';
import { CatalogKindSetting } from '@/components/settings/workspaces/CatalogKindSetting';
import { LocationList } from '@/components/settings/workspaces/LocationList';
import { WorkspaceList } from '@/components/settings/workspaces/WorkspaceList';
import { WorkspaceReadinessChecklist } from '@/components/settings/workspaces/WorkspaceReadinessChecklist';
import { Bone, FactSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { getWorkspaceSetup, renameCurrentTenant, updateTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
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
          value={new Date(tenant.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        />
        {/* The only place an owner can read their workspace ID. */}
        <Fact icon={Tag} label="Workspace ID" value={<span className="font-mono text-xs">{tenant.slug}</span>} />
      </dl>
      {tenant.status !== 'active' && tenant.statusReason && (
        <p className="mt-3 text-xs text-muted-foreground">Status note: {tenant.statusReason}</p>
      )}
    </SettingsSection>
  );
}
