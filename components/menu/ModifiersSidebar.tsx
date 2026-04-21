'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, ChevronDown, Layers, SlidersHorizontal } from 'lucide-react';
import { StockLinker } from '@/components/inventory/StockLinker';
import {
  getModifierGroups,
  createModifierGroup,
  updateModifierGroup,
  deleteModifierGroup,
  getModifiersByGroup,
  createModifier,
  updateModifier,
  deleteModifier,
  type ModifierGroup,
  type ModifierGroupPayload,
  type Modifier,
  type ModifierPayload,
} from '@/lib/api/menu.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Modal } from '@/components/shared/Modal';
import { EmptyState } from '@/components/shared/EmptyState';
import { MODIFIER_TYPE_OPTIONS, MODIFIER_TYPE_LABELS, inputClass, selectClass, FormActions } from './shared';
import { cn } from '@/lib/utils/cn';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Group form ────────────────────────────────────────────────────────────────

function GroupForm({
  initial,
  tenantId,
  onSubmit,
  onDelete,
  onClose,
  isPending,
}: {
  initial?: ModifierGroup;
  tenantId: string;
  onSubmit: (data: ModifierGroupPayload) => void;
  onDelete?: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [required, setRequired] = useState(initial?.required ?? false);
  const [multiSelect, setMultiSelect] = useState(initial?.multiSelect ?? false);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ tenantId, name, required, multiSelect, sortOrder: Number(sortOrder) });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Milk Type"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Sort Order</label>
        <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} min={0} className={inputClass} />
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">Required</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={multiSelect}
            onChange={(e) => setMultiSelect(e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">Multi-select</span>
        </label>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full h-9 border border-destructive/30 text-destructive text-sm font-medium rounded-xl hover:bg-destructive/10 transition-colors"
        >
          Delete group
        </button>
      )}
      <FormActions onClose={onClose} isPending={isPending} isEdit={!!initial} />
    </form>
  );
}

// ── Modifier form ─────────────────────────────────────────────────────────────

function ModifierForm({
  initial,
  tenantId,
  groupId,
  onSubmit,
  onDelete,
  onClose,
  isPending,
}: {
  initial?: Modifier;
  tenantId: string;
  groupId: string;
  onSubmit: (data: ModifierPayload) => void;
  onDelete?: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<ModifierPayload['type']>(initial?.type ?? 'milk');
  const [priceAdjust, setPriceAdjust] = useState(initial?.priceAdjust ?? '');
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          tenantId,
          groupId,
          name,
          type,
          priceAdjust: priceAdjust || undefined,
          isDefault,
          isAvailable,
          sortOrder: Number(sortOrder),
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Oat Milk" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as ModifierPayload['type'])} className={selectClass}>
            {MODIFIER_TYPE_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Price Adjust (£)</label>
          <input
            value={priceAdjust}
            onChange={(e) => setPriceAdjust(e.target.value)}
            placeholder="0.50"
            pattern="^-?\d+(\.\d{1,2})?$"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Sort Order</label>
        <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} min={0} className={inputClass} />
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">Default</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">Available</span>
        </label>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full h-9 border border-destructive/30 text-destructive text-sm font-medium rounded-xl hover:bg-destructive/10 transition-colors"
        >
          Delete modifier
        </button>
      )}
      <FormActions onClose={onClose} isPending={isPending} isEdit={!!initial} />
    </form>
  );
}

// ── Accordion group row ───────────────────────────────────────────────────────

function GroupAccordion({ group, tenantId, onEditGroup }: { group: ModifierGroup; tenantId: string; onEditGroup: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  type ModModal = { mode: 'create' } | { mode: 'edit'; modifier: Modifier };
  const [modModal, setModModal] = useState<ModModal | null>(null);

  const { data: modifiers = [], isLoading } = useQuery({
    queryKey: ['modifiers', group.id],
    queryFn: () => getModifiersByGroup(group.id),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: createModifier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifiers', group.id] });
      qc.invalidateQueries({ queryKey: ['modifiers-all'] });
      setModModal(null);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateModifier>[1] }) => updateModifier(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifiers', group.id] });
      setModModal(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteModifier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifiers', group.id] });
      setModModal(null);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Group header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-card">
          <button onClick={() => setOpen((v) => !v)} className="flex-1 flex items-center gap-2 min-w-0 text-left">
            <ChevronDown
              size={14}
              className={cn('text-muted-foreground shrink-0 transition-transform duration-150', open && 'rotate-180')}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{group.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {group.required ? 'Required' : 'Optional'}
                {group.multiSelect ? ' · Multi' : ''}
              </p>
            </div>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModModal({ mode: 'create' });
              setOpen(true);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
            aria-label={`Add modifier to ${group.name}`}
          >
            <Plus size={13} aria-hidden="true" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditGroup();
            }}
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-offset transition-colors shrink-0"
            aria-label={`Edit ${group.name}`}
          >
            <Pencil size={12} aria-hidden="true" />
          </button>
        </div>

        {/* Modifiers list */}
        {open && (
          <div className="border-t border-border">
            {isLoading ? (
              <div className="flex flex-col gap-1 p-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-8 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : modifiers.length === 0 ? (
              <p className="text-xs text-muted-foreground px-4 py-3">No options yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {modifiers.map((m) => (
                  <div key={m.id} className="group flex items-center gap-2 px-4 py-2 hover:bg-surface-offset transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-foreground">{m.name}</span>
                        {m.isDefault && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-1 py-0.5 rounded bg-info/10 text-info">
                            Default
                          </span>
                        )}
                        {!m.isAvailable && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-1 py-0.5 rounded bg-muted text-muted-foreground">
                            Off
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {MODIFIER_TYPE_LABELS[m.type as keyof typeof MODIFIER_TYPE_LABELS] ?? m.type}
                        {m.priceAdjust ? ` · ${Number(m.priceAdjust) >= 0 ? '+' : ''}£${m.priceAdjust}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setModModal({ mode: 'edit', modifier: m })}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      aria-label={`Edit ${m.name}`}
                    >
                      <Pencil size={11} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modModal?.mode === 'create' && (
        <Modal title={`New option — ${group.name}`} onClose={() => setModModal(null)}>
          <ModifierForm
            tenantId={tenantId}
            groupId={group.id}
            onClose={() => setModModal(null)}
            isPending={isPending}
            onSubmit={(data) => createMutation.mutate(data)}
          />
        </Modal>
      )}
      {modModal?.mode === 'edit' && (
        <Modal title="Edit Modifier" onClose={() => setModModal(null)}>
          <ModifierForm
            initial={modModal.modifier}
            tenantId={tenantId}
            groupId={group.id}
            onClose={() => setModModal(null)}
            isPending={isPending}
            onDelete={() => deleteMutation.mutate(modModal.modifier.id)}
            onSubmit={({ tenantId: _t, groupId: _g, ...data }) => updateMutation.mutate({ id: modModal.modifier.id, data })}
          />
          <StockLinker type="modifier" entityId={modModal.modifier.id} />
        </Modal>
      )}
    </>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

type GroupModal = { mode: 'create' } | { mode: 'edit'; group: ModifierGroup };

export function ModifiersSidebar() {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const [groupModal, setGroupModal] = useState<GroupModal | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: getModifierGroups,
    enabled: !!tenantId,
  });

  const createGroupMutation = useMutation({
    mutationFn: createModifierGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifier-groups'] });
      setGroupModal(null);
    },
  });
  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateModifierGroup>[1] }) => updateModifierGroup(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifier-groups'] });
      setGroupModal(null);
    },
  });
  const deleteGroupMutation = useMutation({
    mutationFn: deleteModifierGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifier-groups'] });
      setGroupModal(null);
    },
  });

  const isPending = createGroupMutation.isPending || updateGroupMutation.isPending || deleteGroupMutation.isPending;

  return (
    <div className="w-100 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Options</p>
          <p className="font-semibold text-foreground">Modifier Groups</p>
        </div>
        <button
          onClick={() => setGroupModal({ mode: 'create' })}
          className="h-8 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Plus size={13} aria-hidden="true" />
          New Group
        </button>
      </div>

      {/* Groups list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)
          ) : groups.length === 0 ? (
            <EmptyState icon={Layers} title="No groups" description="Create a modifier group to get started." />
          ) : (
            groups.map((group) => (
              <GroupAccordion
                key={group.id}
                group={group}
                tenantId={tenantId!}
                onEditGroup={() => setGroupModal({ mode: 'edit', group })}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Group modals */}
      {groupModal?.mode === 'create' && tenantId && (
        <Modal title="New Modifier Group" onClose={() => setGroupModal(null)}>
          <GroupForm
            tenantId={tenantId}
            onClose={() => setGroupModal(null)}
            isPending={isPending}
            onSubmit={(data) => createGroupMutation.mutate(data)}
          />
        </Modal>
      )}
      {groupModal?.mode === 'edit' && tenantId && (
        <Modal title="Edit Modifier Group" onClose={() => setGroupModal(null)}>
          <GroupForm
            initial={groupModal.group}
            tenantId={tenantId}
            onClose={() => setGroupModal(null)}
            isPending={isPending}
            onDelete={() => deleteGroupMutation.mutate(groupModal.group.id)}
            onSubmit={({ tenantId: _, ...data }) => updateGroupMutation.mutate({ id: groupModal.group.id, data })}
          />
        </Modal>
      )}
    </div>
  );
}
