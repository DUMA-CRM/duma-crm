'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Layers, SlidersHorizontal } from 'lucide-react';
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
import { MODIFIER_TYPE_OPTIONS, inputClass, selectClass, FormActions } from './shared';
import { cn } from '@/lib/utils/cn';

// ── Top-level modifier form (includes group picker) ──────────────────────────

function NewModifierForm({
  tenantId,
  groups,
  onSubmit,
  onClose,
  isPending,
}: {
  tenantId: string;
  groups: ModifierGroup[];
  onSubmit: (data: ModifierPayload) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [name, setName] = useState('');
  const [type, setType] = useState<ModifierPayload['type']>('milk');
  const [priceAdjust, setPriceAdjust] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!groupId) return;
        onSubmit({ tenantId, groupId, name, type, priceAdjust: priceAdjust || undefined, isDefault, isAvailable });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Group</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required className={selectClass}>
          <option value="">Select a group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
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
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">Default selection</span>
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
      <FormActions onClose={onClose} isPending={isPending} />
    </form>
  );
}

// ── Modifier Group Form ───────────────────────────────────────────────────────

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
          <span className="text-sm text-foreground">Required selection</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={multiSelect}
            onChange={(e) => setMultiSelect(e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">Allow multiple selections</span>
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

// ── Modifier Form ─────────────────────────────────────────────────────────────

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
            {MODIFIER_TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
          <span className="text-sm text-foreground">Default selection</span>
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

// ── Modifier row ──────────────────────────────────────────────────────────────

function ModifierRow({ modifier, onEdit }: { modifier: Modifier; onEdit: () => void }) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-offset transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{modifier.name}</span>
          {modifier.isDefault && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-info/10 text-info">Default</span>
          )}
          {!modifier.isAvailable && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              Off
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {modifier.type}
          {modifier.priceAdjust ? ` · ${Number(modifier.priceAdjust) >= 0 ? '+' : ''}£${modifier.priceAdjust}` : ''}
        </p>
      </div>
      <button
        onClick={onEdit}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        <Pencil size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Right panel — modifiers for selected group ────────────────────────────────

function ModifiersPanel({ group, tenantId }: { group: ModifierGroup; tenantId: string }) {
  const qc = useQueryClient();
  type ModalState = { mode: 'create' } | { mode: 'edit'; modifier: Modifier };
  const [modal, setModal] = useState<ModalState | null>(null);

  const { data: modifiers = [], isLoading } = useQuery({
    queryKey: ['modifiers', group.id],
    queryFn: () => getModifiersByGroup(group.id),
  });

  const createMutation = useMutation({
    mutationFn: createModifier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifiers', group.id] });
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateModifier>[1] }) => updateModifier(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifiers', group.id] });
      setModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteModifier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifiers', group.id] });
      setModal(null);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Options</p>
          <h3 className="text-base font-semibold text-foreground">{group.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {group.required ? 'Required' : 'Optional'}
            {group.multiSelect ? ' · Multi-select' : ' · Single select'}
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="h-8 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus size={13} aria-hidden="true" />
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : modifiers.length === 0 ? (
          <EmptyState icon={SlidersHorizontal} title="No options yet" description="Add the first modifier to this group." />
        ) : (
          <div className="flex flex-col gap-0.5">
            {modifiers.map((m) => (
              <ModifierRow key={m.id} modifier={m} onEdit={() => setModal({ mode: 'edit', modifier: m })} />
            ))}
          </div>
        )}
      </div>

      {modal?.mode === 'create' && (
        <Modal title="New Modifier" onClose={() => setModal(null)}>
          <ModifierForm
            tenantId={tenantId}
            groupId={group.id}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={(data) => createMutation.mutate(data)}
          />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title="Edit Modifier" onClose={() => setModal(null)}>
          <ModifierForm
            initial={modal.modifier}
            tenantId={tenantId}
            groupId={group.id}
            onClose={() => setModal(null)}
            isPending={isPending}
            onDelete={() => deleteMutation.mutate(modal.modifier.id)}
            onSubmit={({ tenantId: _t, groupId: _g, ...data }) => updateMutation.mutate({ id: modal.modifier.id, data })}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

type GroupModalState = { mode: 'create' } | { mode: 'edit'; group: ModifierGroup };

export function ModifiersTab() {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState<GroupModalState | null>(null);
  const [newModifierOpen, setNewModifierOpen] = useState(false);

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
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['modifier-groups'] });
      if (selectedGroupId === id) setSelectedGroupId(null);
      setGroupModal(null);
    },
  });

  const createModifierMutation = useMutation({
    mutationFn: createModifier,
    onSuccess: (mod) => {
      qc.invalidateQueries({ queryKey: ['modifiers', mod.groupId] });
      qc.invalidateQueries({ queryKey: ['modifiers-all'] });
      setNewModifierOpen(false);
    },
  });

  const isPending = createGroupMutation.isPending || updateGroupMutation.isPending || deleteGroupMutation.isPending;
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  if (!tenantId) {
    return <EmptyState icon={Layers} title="No workspace selected" description="Select a workspace in Workspaces to manage modifiers." />;
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setNewModifierOpen(true)}
          disabled={groups.length === 0}
          className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={15} aria-hidden="true" />
          New Modifier
        </button>
        <button
          onClick={() => setGroupModal({ mode: 'create' })}
          className="h-9 px-3 border border-border text-sm font-medium text-muted-foreground hover:bg-surface-offset rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Plus size={15} aria-hidden="true" />
          New Group
        </button>
        {groups.length === 0 && <p className="text-xs text-muted-foreground">Create a group first before adding modifiers.</p>}
      </div>

      <div className="flex-1 min-h-0 flex gap-5">
        {/* Left — groups */}
        <div className="w-72 shrink-0 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Groups</p>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)
            ) : groups.length === 0 ? (
              <EmptyState icon={Layers} title="No groups" description="Create your first modifier group." />
            ) : (
              groups.map((group) => {
                const isSelected = group.id === selectedGroupId;
                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(isSelected ? null : group.id)}
                    className={cn(
                      'group/item w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-xl border transition-colors duration-150',
                      isSelected ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/30 hover:bg-surface-offset',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.required ? 'Required' : 'Optional'}
                        {group.multiSelect ? ' · Multi' : ''}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupModal({ mode: 'edit', group });
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-offset hover:text-foreground transition-colors shrink-0 opacity-0 group-hover/item:opacity-100"
                      aria-label={`Edit ${group.name}`}
                    >
                      <Pencil size={12} aria-hidden="true" />
                    </button>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-border shrink-0" />

        {/* Right — modifiers */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedGroup && tenantId ? (
            <ModifiersPanel group={selectedGroup} tenantId={tenantId} />
          ) : (
            <EmptyState
              icon={SlidersHorizontal}
              title="Select a group"
              description="Pick a modifier group on the left to manage its options."
            />
          )}
        </div>
      </div>
      {/* end inner flex */}

      {/* New modifier modal */}
      {newModifierOpen && tenantId && (
        <Modal title="New Modifier" onClose={() => setNewModifierOpen(false)}>
          <NewModifierForm
            tenantId={tenantId}
            groups={groups}
            onClose={() => setNewModifierOpen(false)}
            isPending={createModifierMutation.isPending}
            onSubmit={(data) => createModifierMutation.mutate(data)}
          />
        </Modal>
      )}

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
