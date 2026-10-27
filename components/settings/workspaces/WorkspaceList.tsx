'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ArrowRight, Building2, Loader2, MoreHorizontal, Pencil, Plus, Search, Tag } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { TileSkeleton } from '@/components/shared/TileSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type PlatformWorkspace, setWorkspaceClassification } from '@/lib/api/platform.service';
import type { WorkspaceClassification } from '@/lib/api/workspace.service';
import { useTenants } from '@/lib/hooks/useTenants';
import { useWorkspaceSwitch } from '@/lib/hooks/useWorkspaceSwitch';
import { type Tenant, type TenantPayload, changeTenantStatus, createTenant, updateTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';

// ── Form ─────────────────────────────────────────────────────────────────────

function TenantForm({
  initial,
  onSubmit,
  onClose,
  isPending,
}: {
  initial?: Tenant;
  onSubmit: (data: TenantPayload) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, slug });
      }}
      className="space-y-4"
    >
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="DUMA Coffee" />
      <Input
        label="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
        required
        placeholder="duma-coffee"
        hint="Lower case, no spaces — used in links and exports."
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Create workspace'}
        </Button>
      </div>
    </form>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; tenant: Tenant }
  | { mode: 'lifecycle'; tenant: Tenant }
  | { mode: 'classify'; tenant: Tenant };

const CLASSIFICATION_COPY: Record<WorkspaceClassification, { label: string; description: string }> = {
  customer: { label: 'Client', description: 'A paying or prospective client. Counted in DUMA Admin’s figures.' },
  internal: { label: 'DUMA internal', description: 'DUMA’s own workspace. Excluded from client figures. Only one workspace can be internal.' },
  demo: { label: 'Demo', description: 'For demonstrations and testing. Excluded from client figures.' },
};

/**
 * What a workspace is for, set by hand and recorded with a reason. DUMA never
 * infers it from a name or slug — a client called "Demo Coffee" is a client.
 */
function WorkspaceClassificationForm({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const qc = useQueryClient();
  const [classification, setClassification] = useState<WorkspaceClassification>(tenant.classification ?? 'customer');
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => setWorkspaceClassification(tenant.id, classification, reason.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenants') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-workspaces') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-overview') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-context') });
      onClose();
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2" role="radiogroup" aria-label="Workspace classification">
        {(Object.keys(CLASSIFICATION_COPY) as WorkspaceClassification[]).map((value) => (
          <label
            key={value}
            className={cn(
              'flex cursor-pointer gap-3 rounded-md border px-3 py-3 transition-[border-color,background-color] duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
              classification === value ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]' : 'border-rule/70 bg-card hover:border-rule hover:bg-band/45',
            )}
          >
            <input
              type="radio"
              name="workspace-classification"
              value={value}
              checked={classification === value}
              onChange={() => setClassification(value)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">{CLASSIFICATION_COPY[value].label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{CLASSIFICATION_COPY[value].description}</span>
            </span>
          </label>
        ))}
      </div>
      <Input
        label="Reason for the change"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        placeholder="For example: sales demo account"
        hint="Recorded in the audit history with your name."
      />
      {mutation.error && <p className="text-sm text-exception">{mutation.error.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={classification === (tenant.classification ?? 'customer') || reason.trim().length < 3 || mutation.isPending}>
          {mutation.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {mutation.isPending ? 'Saving…' : 'Save classification'}
        </Button>
      </div>
    </form>
  );
}

const TENANT_STATUS_COPY: Record<Tenant['status'], { label: string; description: string }> = {
  active: { label: 'Active', description: 'The workspace and its locations can operate normally.' },
  winding_down: { label: 'Winding down', description: 'Keep records available while locations are closed and final work is completed.' },
  inactive: { label: 'Inactive', description: 'Retain the workspace and its history without running day-to-day operations.' },
};

const TENANT_STATUS_TRANSITIONS: Record<Tenant['status'], readonly Tenant['status'][]> = {
  active: ['winding_down'],
  winding_down: ['active', 'inactive'],
  inactive: ['active'],
};

function WorkspaceLifecycleForm({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Tenant['status']>(tenant.status);
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => changeTenantStatus(tenant.id, status, reason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenants') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('locations', tenant.id) });
      onClose();
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2" role="radiogroup" aria-label="Workspace lifecycle">
        {(Object.keys(TENANT_STATUS_COPY) as Tenant['status'][]).map((value) => {
          const copy = TENANT_STATUS_COPY[value];
          const canSelect = value === tenant.status || TENANT_STATUS_TRANSITIONS[tenant.status].includes(value);
          return (
            <label
              key={value}
              className={cn(
                'flex gap-3 rounded-md border px-3 py-3',
                canSelect ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                'transition-[border-color,background-color,box-shadow] duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                status === value
                  ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]'
                  : 'border-rule/70 bg-card hover:border-rule hover:bg-band/45',
              )}
            >
              <input
                type="radio"
                name="workspace-status"
                value={value}
                checked={status === value}
                disabled={!canSelect}
                onChange={() => setStatus(value)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">{copy.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{copy.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-foreground">Reason for the change</span>
        <textarea
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 w-full resize-y rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:outline-2 focus:outline-primary/25"
          placeholder="For example: final trading day completed"
        />
        <span className="mt-1 block text-xs text-muted-foreground">The reason and actor are recorded in the audit history.</span>
      </label>

      {status !== 'active' && (
        <p className="rounded-md bg-band/65 px-3 py-2.5 text-sm text-muted-foreground">
          No workspace data is deleted. Deactivate each location when it stops trading; historical records remain available.
        </p>
      )}

      {mutation.error && <p className="text-sm text-exception">{mutation.error.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={status === tenant.status || reason.trim().length < 3 || mutation.isPending}>
          {mutation.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {mutation.isPending ? 'Saving…' : 'Change status'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Every workspace, in DUMA Admin: create, rename, classify, wind down — and
 * open one, which moves this tab into it. Opening is a switch of context, not
 * a radio button: DUMA Admin stays a place of its own.
 *
 * `directory` adds the exact counts DUMA Admin reads alongside (locations,
 * staff, modules, billing) when the caller has them.
 */
export function WorkspaceList({ directory }: { directory?: ReadonlyMap<string, PlatformWorkspace> } = {}) {
  const qc = useQueryClient();
  const role = useAuthStore((state) => state.role);
  const switchTo = useWorkspaceSwitch();
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);

  const { tenants, isLoading, isError, refetch } = useTenants();
  const open = (tenant: Tenant) => void switchTo({ kind: 'workspace', tenantId: tenant.id, locationId: null });

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenants') });
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TenantPayload> }) => updateTenant(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenants') });
      setModal(null);
    },
  });

  const filtered = tenants.filter(
    (t) => !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.slug.toLowerCase().includes(query.toLowerCase()),
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <SettingsSection
      title="Workspaces"
      actions={
        <Button size="sm" onClick={() => setModal({ mode: 'create' })}>
          <Plus size={14} aria-hidden="true" />
          New
        </Button>
      }
    >
      {/* Search only earns its space once the list is long enough to scan. */}
      {tenants.length > 4 && (
        <div className="mb-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces…"
            aria-label="Search workspaces"
            leftIcon={<Search size={14} aria-hidden="true" />}
          />
        </div>
      )}

      <div className="flex flex-col gap-2" aria-label={isLoading ? 'Loading workspaces' : 'Workspaces'} aria-busy={isLoading || undefined}>
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => <TileSkeleton key={index} index={index} />)
        ) : isError ? (
          <ErrorState title="Workspaces couldn’t be loaded" onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={query ? 'No workspaces match that search' : 'No workspaces yet'}
            description={query ? 'Try a different name or slug.' : 'Create the first workspace to start setting the business up.'}
            kind={query ? 'search' : 'start'}
            action={
              query
                ? { label: 'Clear search', onClick: () => setQuery('') }
                : { label: 'New workspace', icon: Plus, onClick: () => setModal({ mode: 'create' }) }
            }
            compact
          />
        ) : (
          filtered.map((tenant) => {
            const row = directory?.get(tenant.id);
            return (
              // Same row as a location, so a workspace and a site read alike.
              <div
                key={tenant.id}
                className="flex w-full items-center gap-3 rounded-lg border border-rule/70 bg-background/60 px-3.5 py-3 text-left transition-[border-color,background-color] duration-150 hover:border-rule hover:bg-band/45"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
                  <Building2 size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                    {tenant.name}
                    {tenant.classification && tenant.classification !== 'customer' && (
                      <Badge variant={tenant.classification === 'internal' ? 'reference' : 'muted'} className="shrink-0">
                        {CLASSIFICATION_COPY[tenant.classification].label}
                      </Badge>
                    )}
                    {tenant.status !== 'active' && (
                      <Badge variant={tenant.status === 'winding_down' ? 'warning' : 'muted'} className="shrink-0">
                        {TENANT_STATUS_COPY[tenant.status].label}
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tenant.slug}
                    {row
                      ? ` · ${row.activeLocations} ${row.activeLocations === 1 ? 'location' : 'locations'} · ${row.activeStaff} staff · ${row.enabledModules} modules${row.billingStatus && row.billingStatus !== 'not_configured' ? ` · ${row.billingStatus.replace('_', ' ')}` : ''}`
                      : tenant.locationCount !== undefined && ` · ${tenant.locationCount} ${tenant.locationCount === 1 ? 'location' : 'locations'}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {role === 'super_admin' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setModal({ mode: 'classify', tenant })}
                      aria-label={`Classify ${tenant.name}`}
                    >
                      <Tag size={14} aria-hidden="true" />
                    </Button>
                  )}
                  {role === 'super_admin' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setModal({ mode: 'lifecycle', tenant })}
                      aria-label={`Manage ${tenant.name} lifecycle`}
                    >
                      <MoreHorizontal size={14} aria-hidden="true" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setModal({ mode: 'edit', tenant })}
                    aria-label={`Edit ${tenant.name}`}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => open(tenant)} aria-label={`Open ${tenant.name}`}>
                    Open
                    <ArrowRight size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <Modal
          title={
            modal.mode === 'create'
              ? 'New workspace'
              : modal.mode === 'edit'
                ? 'Edit workspace'
                : modal.mode === 'classify'
                  ? `Classification · ${modal.tenant.name}`
                  : `Lifecycle · ${modal.tenant.name}`
          }
          description={
            modal.mode === 'lifecycle'
              ? 'Wind down a workspace without deleting its records.'
              : modal.mode === 'classify'
                ? 'What this workspace is for. Only clients count in DUMA Admin’s figures.'
                : undefined
          }
          onClose={() => setModal(null)}
        >
          {modal.mode === 'classify' ? (
            <WorkspaceClassificationForm tenant={modal.tenant} onClose={() => setModal(null)} />
          ) : modal.mode === 'lifecycle' ? (
            <WorkspaceLifecycleForm tenant={modal.tenant} onClose={() => setModal(null)} />
          ) : (
            <TenantForm
              initial={modal.mode === 'edit' ? modal.tenant : undefined}
              onClose={() => setModal(null)}
              isPending={isPending}
              onSubmit={(data) => {
                if (modal.mode === 'edit') {
                  updateMutation.mutate({ id: modal.tenant.id, data });
                } else {
                  createMutation.mutate(data);
                }
              }}
            />
          )}
        </Modal>
      )}
    </SettingsSection>
  );
}
