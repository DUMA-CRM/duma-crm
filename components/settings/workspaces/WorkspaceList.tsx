'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Building2, Loader2, MoreHorizontal, Pencil, Plus, Search } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useTenants } from '@/lib/hooks/useTenants';
import { type Tenant, type TenantPayload, changeTenantStatus, createTenant, updateTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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

type ModalState = { mode: 'create' } | { mode: 'edit'; tenant: Tenant } | { mode: 'lifecycle'; tenant: Tenant };

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
                status === value ? 'border-primary bg-band' : 'border-rule/65 bg-card hover:bg-band/45',
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
          className="mt-2 w-full resize-y rounded-md border border-input bg-field px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:outline-2 focus:outline-primary/25"
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

/** Step 1 of the workspace settings: which business the app is working in. */
export function WorkspaceList() {
  const qc = useQueryClient();
  const role = useAuthStore((state) => state.role);
  const { tenantId, setTenantId } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);

  // Owns the selection rules too: reconciles a stale persisted workspace and
  // selects the sole one — including the first one created here.
  const { tenants, isLoading } = useTenants();

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
      description="One workspace per business or franchise. The selected one sets the context for settings, reporting and connected services."
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

      <div className="flex max-h-128 flex-col gap-2 overflow-y-auto" role="radiogroup" aria-label="Active workspace">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />)
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={query ? 'No workspaces match that search' : 'No workspaces yet'}
            description={query ? 'Try a different name or slug.' : 'Create the first workspace to start setting the business up.'}
          />
        ) : (
          filtered.map((tenant) => {
            const isSelected = tenant.id === tenantId;
            return (
              // A radio, not a toggle: there is always an active workspace, and
              // clearing it only strands the app in an empty context.
              <div
                key={tenant.id}
                role="radio"
                tabIndex={0}
                aria-checked={isSelected}
                onClick={() => setTenantId(tenant.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTenantId(tenant.id);
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors duration-150',
                  'outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isSelected
                    ? 'cursor-default border-primary bg-band'
                    : 'cursor-pointer border-rule bg-card hover:border-primary/30 hover:bg-band',
                )}
              >
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md',
                    isSelected ? 'bg-card text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Building2 size={16} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                    {tenant.name}
                    {isSelected && (
                      <Badge variant="success" className="shrink-0">
                        Current
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
                    {tenant.locationCount !== undefined &&
                      ` · ${tenant.locationCount} ${tenant.locationCount === 1 ? 'location' : 'locations'}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {role === 'super_admin' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal({ mode: 'lifecycle', tenant });
                      }}
                      aria-label={`Manage ${tenant.name} lifecycle`}
                    >
                      <MoreHorizontal size={14} aria-hidden="true" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModal({ mode: 'edit', tenant });
                    }}
                    aria-label={`Edit ${tenant.name}`}
                  >
                    <Pencil size={14} aria-hidden="true" />
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
          title={modal.mode === 'create' ? 'New workspace' : modal.mode === 'edit' ? 'Edit workspace' : `Lifecycle · ${modal.tenant.name}`}
          description={modal.mode === 'lifecycle' ? 'Wind down a workspace without deleting its records.' : undefined}
          onClose={() => setModal(null)}
        >
          {modal.mode === 'lifecycle' ? (
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
