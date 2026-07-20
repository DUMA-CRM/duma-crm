'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { ModifierRecipeEditor } from '@/components/menu/ModifierRecipeEditor';
import { AvailabilityToggle, FormActions, inputClass, labelClass } from '@/components/menu/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Input } from '@/components/ui/input';

import { createModifier, deleteModifier, getModifiers, updateModifier } from '@/lib/api/menu.service';
import { cn } from '@/lib/utils/cn';
import { encodeModifierName, groupByCategory, parseModifierName } from '@/lib/utils/modifiers';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Modifier } from '@/types/menu';

function formatAdjust(raw?: string): string {
  const n = Number.parseFloat(raw ?? '0');
  if (!n) return '—';
  return `${n > 0 ? '+' : '−'}£${Math.abs(n).toFixed(2)}`;
}

// ── Category combobox ─────────────────────────────────────────────────────────
// Free-text input with a suggestions dropdown: focusing shows every existing
// category immediately; typing filters them; anything else creates a new one.

function CategoryCombobox({ value, onChange, categories }: { value: string; onChange: (v: string) => void; categories: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q ? categories.filter((c) => c.toLowerCase().includes(q)) : categories;
  const isNew = q.length > 0 && !categories.some((c) => c.toLowerCase() === q);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          // Close just the dropdown on Escape without closing the whole modal.
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder="Milk, Size, Syrup… (optional)"
        className={inputClass + ' pr-9'}
        role="combobox"
        aria-expanded={open}
        aria-controls="modifier-category-listbox"
        aria-autocomplete="list"
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        tabIndex={-1}
        aria-label="Show categories"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown size={14} className={cn('transition-transform duration-150', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div
          id="modifier-category-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 bg-surface border border-border rounded-xl shadow-lg py-1 z-50 max-h-48 overflow-y-auto"
        >
          {/* No category */}
          <button
            type="button"
            onClick={() => pick('')}
            className={cn(
              'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-surface-offset',
              !value ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            <span>No category</span>
            {!value && <Check size={14} className="text-primary shrink-0" aria-hidden="true" />}
          </button>

          {filtered.length > 0 && <div className="my-1 h-px bg-divider mx-3" aria-hidden="true" />}

          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-surface-offset',
                c === value.trim() ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              <span className="truncate">{c}</span>
              {c === value.trim() && <Check size={14} className="text-primary shrink-0" aria-hidden="true" />}
            </button>
          ))}

          {isNew && (
            <button
              type="button"
              onClick={() => pick(value.trim())}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-left text-primary font-medium transition-colors hover:bg-surface-offset"
            >
              <Plus size={13} className="shrink-0" aria-hidden="true" />
              <span className="truncate">Create “{value.trim()}”</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create / edit form ──────────────────────────────────────────────────────

function ModifierForm({
  tenantId,
  modifier,
  categories,
  onClose,
}: {
  tenantId: string;
  modifier?: Modifier;
  categories: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const parsed = modifier ? parseModifierName(modifier.name) : { category: '', label: '' };
  const [name, setName] = useState(parsed.label);
  const [category, setCategory] = useState(parsed.category ?? '');
  const [priceAdjust, setPriceAdjust] = useState(modifier?.priceAdjust ?? '0');
  const [isAvailable, setIsAvailable] = useState(modifier?.isAvailable ?? true);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const fullName = encodeModifierName(category, name);
      return modifier
        ? updateModifier(modifier.id, { name: fullName, priceAdjust, isAvailable })
        : createModifier({ tenantId, name: fullName, priceAdjust, isAvailable });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifiers'] });
      toast('success', modifier ? 'Modifier updated.' : 'Modifier created.');
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={1}
          placeholder="Oat Milk"
          className={inputClass}
          autoFocus
        />
      </div>
      <div>
        <label className={labelClass}>Category</label>
        <CategoryCombobox value={category} onChange={setCategory} categories={categories} />
        <p className="mt-1 text-xs text-muted-foreground">Modifiers with the same category are grouped together in the POS.</p>
      </div>
      <div>
        <label className={labelClass}>Price adjustment (£)</label>
        <input
          value={priceAdjust}
          onChange={(e) => setPriceAdjust(e.target.value)}
          required
          pattern="^-?\d+(\.\d{1,2})?$"
          placeholder="0.50 or -0.20"
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm text-foreground">Available</span>
      </label>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      <FormActions onClose={onClose} isPending={isPending} isEdit={!!modifier} />
    </form>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ModifiersPanel({ createOpen, onCreateOpenChange }: { createOpen: boolean; onCreateOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const [editModifier, setEditModifier] = useState<Modifier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ modifier: Modifier; label: string } | null>(null);
  const [search, setSearch] = useState('');
  const closeCreate = () => onCreateOpenChange(false);

  const { data: modifiers = [], isLoading } = useQuery({
    queryKey: ['modifiers'],
    queryFn: getModifiers,
    enabled: !!tenantId,
  });

  const removeMutation = useMutation({
    mutationFn: deleteModifier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifiers'] });
      setDeleteTarget(null);
      toast('success', 'Modifier deleted.');
    },
    onError: (err) => toast('error', err.message || 'Failed to delete the modifier.'),
  });

  // One-tap availability from the table row (e.g. oat milk ran out).
  const availabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => updateModifier(id, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modifiers'] }),
    onError: (err) => toast('error', err.message || 'Failed to update availability.'),
  });

  // Parse the category prefix out of each name, sort by category (uncategorised
  // last) then label, then bucket into groups for the sectioned table. The name
  // includes the category prefix, so searching matches labels and categories.
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = modifiers
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .map((m) => ({ modifier: m, ...parseModifierName(m.name) }))
      .sort((a, b) => {
        const ca = a.category ?? '￿';
        const cb = b.category ?? '￿';
        return ca.localeCompare(cb) || a.label.localeCompare(b.label);
      });
    return groupByCategory(rows, (r) => r.category);
  }, [modifiers, search]);

  const visibleCount = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);

  // The combobox needs every category, not just the ones matching the search.
  const categories = useMemo(() => {
    const all = new Set(modifiers.map((m) => parseModifierName(m.name).category).filter((c): c is string => !!c));
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [modifiers]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      {tenantId && modifiers.length > 0 && (
        <div className="mb-3 shrink-0 max-w-xs">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
            placeholder="Search modifiers…"
          />
        </div>
      )}

      <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted">
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Name
                </th>
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Price
                </th>
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Status
                </th>
                <th className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 w-16" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-3 md:px-5 py-4">
                        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 13 + j * 17) % 40)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !tenantId ? (
                <tr>
                  <td colSpan={4} className="py-24">
                    <EmptyState
                      icon={SlidersHorizontal}
                      title="No workspace selected"
                      description="Select a workspace to manage modifiers."
                    />
                  </td>
                </tr>
              ) : modifiers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-24">
                    <EmptyState
                      icon={SlidersHorizontal}
                      title="No modifiers"
                      description='Click "New Modifier" to add a reusable add-on.'
                    />
                  </td>
                </tr>
              ) : visibleCount === 0 ? (
                <tr>
                  <td colSpan={4} className="py-24">
                    <EmptyState icon={Search} title="No matching modifiers" description="Try a different search." />
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <Fragment key={group.category}>
                    {/* Category section header */}
                    <tr className="border-b border-border/50 bg-surface-offset/60">
                      <td colSpan={4} className="px-3 md:px-5 py-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{group.category}</span>
                        <span className="ml-2 text-[10px] font-semibold text-muted-foreground/60 tabular-nums">{group.items.length}</span>
                      </td>
                    </tr>

                    {group.items.map(({ modifier: m, label }) => (
                      <tr
                        key={m.id}
                        className="group border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                        onClick={() => setEditModifier(m)}
                      >
                        <td className="px-3 md:px-5 py-3.5 font-medium text-foreground">{label}</td>
                        <td className="px-3 md:px-5 py-3.5 tabular-nums text-muted-foreground">{formatAdjust(m.priceAdjust)}</td>
                        <td className="px-3 md:px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <AvailabilityToggle
                            on={m.isAvailable}
                            pending={availabilityMutation.isPending && availabilityMutation.variables?.id === m.id}
                            onToggle={() => availabilityMutation.mutate({ id: m.id, isAvailable: !m.isAvailable })}
                          />
                        </td>
                        <td className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                          {/* Always visible — hover-reveal buttons don't exist on touch screens */}
                          <button
                            onClick={() => setDeleteTarget({ modifier: m, label })}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            aria-label={`Delete ${label}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        {modifiers.length > 0 && (
          <div className="px-5 py-3 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {visibleCount !== modifiers.length && `${visibleCount} of `}
              {modifiers.length} {modifiers.length === 1 ? 'modifier' : 'modifiers'} · {groups.length}{' '}
              {groups.length === 1 ? 'category' : 'categories'}
            </p>
          </div>
        )}
      </div>

      {createOpen && tenantId && (
        <Modal title="New Modifier" onClose={closeCreate}>
          <ModifierForm tenantId={tenantId} categories={categories} onClose={closeCreate} />
        </Modal>
      )}
      {editModifier && tenantId && (
        <Modal title="Edit Modifier" onClose={() => setEditModifier(null)} className="max-w-4xl">
          <div className="grid md:grid-cols-2 gap-4 items-start">
            <section className="bg-surface-offset/40 border border-border rounded-xl p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Details</p>
              <ModifierForm tenantId={tenantId} modifier={editModifier} categories={categories} onClose={() => setEditModifier(null)} />
            </section>
            <section className="bg-surface-offset/40 border border-border rounded-xl p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Recipe &amp; Nutrition</p>
              <ModifierRecipeEditor
                modifierId={editModifier.id}
                sizes={modifiers
                  .filter((m) => parseModifierName(m.name).category?.toLowerCase() === 'size')
                  .map((m) => ({ id: m.id, label: parseModifierName(m.name).label, priceAdjust: m.priceAdjust }))}
              />
            </section>
          </div>
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Modifier"
          message={
            <>
              Delete <span className="font-semibold text-foreground">{deleteTarget.label}</span>? Items using it will lose this option. This
              cannot be undone.
            </>
          }
          isPending={removeMutation.isPending}
          onConfirm={() => removeMutation.mutate(deleteTarget.modifier.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
