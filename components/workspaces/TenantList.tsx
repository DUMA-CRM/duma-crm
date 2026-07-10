'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';

import { type Tenant, type TenantPayload, createTenant, getTenants, updateTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
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

  const inputClass =
    'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, slug });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="DUMA Coffee" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
          required
          placeholder="duma-coffee"
          className={inputClass}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : initial ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

type ModalState = { mode: 'create' } | { mode: 'edit'; tenant: Tenant };

export function TenantList() {
  const qc = useQueryClient();
  const { tenantId, setTenantId } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);

  const { data: tenants = [], isLoading, isSuccess } = useQuery({
    queryKey: ['tenants'],
    queryFn: getTenants,
  });

  // Reconcile stale persisted selection: if the active workspace no longer
  // exists (deleted, or a different user signed in), clear it so downstream
  // pages don't silently send an invalid tenantId. Only act once the list has
  // actually loaded, never on the transient empty/loading state.
  useEffect(() => {
    if (isSuccess && tenantId && !tenants.some((t) => t.id === tenantId)) {
      setTenantId(null);
    }
  }, [isSuccess, tenants, tenantId, setTenantId]);

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TenantPayload> }) => updateTenant(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      setModal(null);
    },
  });

  const filtered = tenants.filter(
    (t) => !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.slug.toLowerCase().includes(query.toLowerCase()),
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Search + New */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces…"
            className="w-full h-9 bg-background border border-border rounded-lg pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150"
          />
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus size={15} aria-hidden="true" />
          New
        </button>
      </div>

      {/* Tenant cards */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-18 bg-muted rounded-xl animate-pulse" />)
        ) : filtered.length === 0 ? (
          <EmptyState icon={Building2} title="No workspaces found" description="Create your first workspace to get started." />
        ) : (
          filtered.map((tenant) => {
            const isSelected = tenant.id === tenantId;
            return (
              <div
                key={tenant.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setTenantId(isSelected ? null : tenant.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTenantId(isSelected ? null : tenant.id);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl border transition-colors duration-150 cursor-pointer',
                  'outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isSelected ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/30 hover:bg-surface-offset',
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Building2 size={16} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{tenant.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{tenant.slug}</p>
                </div>
                {tenant.locationCount !== undefined && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                    {tenant.locationCount} {tenant.locationCount === 1 ? 'location' : 'locations'}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setModal({ mode: 'edit', tenant });
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-offset hover:text-foreground transition-colors shrink-0"
                  aria-label={`Edit ${tenant.name}`}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <Modal title={modal.mode === 'create' ? 'New Workspace' : 'Edit Workspace'} onClose={() => setModal(null)}>
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
        </Modal>
      )}
    </div>
  );
}
