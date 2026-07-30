'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { ModifierRecipeEditor } from '@/components/menu/ModifierRecipeEditor';
import { AvailabilityToggle, FormActions, inputClass, labelClass } from '@/components/menu/shared';
import { CategoryCombobox } from '@/components/shared/CategoryCombobox';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';

import { createModifier, deleteModifier, getModifiers, updateModifier } from '@/lib/api/menu.service';
import { encodeModifierName, groupByCategory, parseModifierName } from '@/lib/utils/modifiers';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Modifier } from '@/types/menu';

function formatAdjust(raw?: string): string {
  const n = Number.parseFloat(raw ?? '0');
  if (!n) return '—';
  return `${n > 0 ? '+' : '−'}£${Math.abs(n).toFixed(2)}`;
}

// ── Create / edit form ──────────────────────────────────────────────────────

function ModifierForm({
  tenantId,
  modifier,
  categories,
  onClose,
  formId,
  hideActions,
  onPendingChange,
  onDirtyChange,
}: {
  tenantId: string;
  modifier?: Modifier;
  categories: string[];
  onClose: () => void;
  /** When set, the <form> gets this id so a Save button in the page header can submit it. */
  formId?: string;
  /** Hide the built-in Cancel/Save row (the header owns Save in the page editor). */
  hideActions?: boolean;
  /** Reports the mutation's pending state so the header Save button can reflect it. */
  onPendingChange?: (pending: boolean) => void;
  /** Reports unsaved edits so the page shell can warn before discarding them. */
  onDirtyChange?: (dirty: boolean) => void;
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

  useEffect(() => onPendingChange?.(isPending), [isPending, onPendingChange]);

  const dirty =
    name !== parsed.label ||
    category !== (parsed.category ?? '') ||
    priceAdjust !== (modifier?.priceAdjust ?? '0') ||
    isAvailable !== (modifier?.isAvailable ?? true);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  return (
    <form
      id={formId}
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
        <CategoryCombobox value={category} onChange={setCategory} categories={categories} placeholder="Milk, Size, Syrup… (optional)" />
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
      {!hideActions && <FormActions onClose={onClose} isPending={isPending} isEdit={!!modifier} />}
    </form>
  );
}

// ── In-page editor ─────────────────────────────────────────────────────────────

const MODIFIER_FORM_ID = 'modifier-editor-form';

/** Full-page modifier create/edit (keeps the app sidebar + header visible). */
export function ModifierEditorPage({ modifier, onClose }: { modifier?: Modifier; onClose: () => void }) {
  const { tenantId } = useWorkspaceStore();
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: modifiers = [] } = useQuery({
    queryKey: ['modifiers', tenantId],
    queryFn: () => getModifiers(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const categories = useMemo(() => {
    const all = new Set(modifiers.map((m) => parseModifierName(m.name).category).filter((c): c is string => !!c));
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [modifiers]);

  const sizes = useMemo(
    () =>
      modifiers
        .filter((m) => parseModifierName(m.name).category?.toLowerCase() === 'size')
        .map((m) => ({ id: m.id, label: parseModifierName(m.name).label, priceAdjust: m.priceAdjust })),
    [modifiers],
  );

  if (!tenantId) return null;

  const form = (
    <ModifierForm
      tenantId={tenantId}
      modifier={modifier}
      categories={categories}
      onClose={onClose}
      formId={MODIFIER_FORM_ID}
      hideActions
      onPendingChange={setPending}
      onDirtyChange={setDirty}
    />
  );

  return (
    <EditorShell
      eyebrow="Modifier"
      title={modifier ? parseModifierName(modifier.name).label : 'New Modifier'}
      onClose={onClose}
      dirty={dirty && !pending}
      discardMessage="This modifier has changes that have not been saved. Leaving now discards them."
      actions={
        <Button type="submit" form={MODIFIER_FORM_ID} disabled={pending} className="h-11 px-6 gap-2">
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? 'Saving…' : modifier ? 'Update' : 'Create'}
        </Button>
      }
    >
      {modifier ? (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          <section className="bg-surface-offset/40 border border-border rounded-xl p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Details</p>
            {form}
          </section>
          <section className="bg-surface-offset/40 border border-border rounded-xl p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Recipe &amp; Nutrition</p>
            <ModifierRecipeEditor modifierId={modifier.id} sizes={sizes} />
          </section>
        </div>
      ) : (
        form
      )}
    </EditorShell>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ModifiersPanel({ onEdit }: { onEdit: (modifier: Modifier) => void }) {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const [deleteTarget, setDeleteTarget] = useState<{ modifier: Modifier; label: string } | null>(null);
  const [search, setSearch] = useState('');

  const { data: modifiers = [], isLoading } = useQuery({
    queryKey: ['modifiers', tenantId],
    queryFn: () => getModifiers(tenantId ?? undefined),
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
          <DataTable className="w-full text-sm border-collapse">
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
                        onClick={() => onEdit(m)}
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
          </DataTable>
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
