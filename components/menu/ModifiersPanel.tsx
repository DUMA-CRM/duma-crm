'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { FormActions, inputClass, labelClass } from '@/components/menu/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';

import { createModifier, deleteModifier, getModifiers, updateModifier } from '@/lib/api/menu.service';
import { UNCATEGORISED_LABEL, encodeModifierName, parseModifierName } from '@/lib/utils/modifiers';
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
        <label className={labelClass}>Category</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="modifier-categories"
          placeholder="Milk, Size, Syrup… (optional)"
          className={inputClass}
        />
        <datalist id="modifier-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-muted-foreground">Modifiers with the same category are grouped together in the POS.</p>
      </div>
      <div>
        <label className={labelClass}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={1} placeholder="Oat Milk" className={inputClass} autoFocus />
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
        <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
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
  const closeCreate = () => onCreateOpenChange(false);

  const { data: modifiers = [], isLoading } = useQuery({
    queryKey: ['modifiers'],
    queryFn: getModifiers,
    enabled: !!tenantId,
  });

  const removeMutation = useMutation({
    mutationFn: deleteModifier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modifiers'] }),
  });

  // Parse the category prefix out of each name, then sort by category
  // (uncategorised last) then label so same-category modifiers sit together.
  const rows = useMemo(
    () =>
      modifiers
        .map((m) => ({ modifier: m, ...parseModifierName(m.name) }))
        .sort((a, b) => {
          const ca = a.category ?? '￿';
          const cb = b.category ?? '￿';
          return ca.localeCompare(cb) || a.label.localeCompare(b.label);
        }),
    [modifiers],
  );

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted">
                <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Category</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Name</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Price</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                <th className="px-5 py-3.5 pr-6 w-16" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 13 + j * 17) % 40)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !tenantId ? (
                <tr>
                  <td colSpan={5} className="py-24">
                    <EmptyState icon={SlidersHorizontal} title="No workspace selected" description="Select a workspace to manage modifiers." />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24">
                    <EmptyState icon={SlidersHorizontal} title="No modifiers" description='Click "New Modifier" to add a reusable add-on.' />
                  </td>
                </tr>
              ) : (
                rows.map(({ modifier: m, category, label }) => (
                  <tr
                    key={m.id}
                    className="group border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                    onClick={() => setEditModifier(m)}
                  >
                    <td className="px-5 py-3.5">
                      {category ? (
                        <Badge variant="muted">{category}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{UNCATEGORISED_LABEL}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">{label}</td>
                    <td className="px-5 py-3.5 tabular-nums text-muted-foreground">{formatAdjust(m.priceAdjust)}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={m.isAvailable ? 'success' : 'muted'}>{m.isAvailable ? 'Available' : 'Hidden'}</Badge>
                    </td>
                    <td className="px-5 py-3.5 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => removeMutation.mutate(m.id)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        aria-label={`Delete ${label}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {modifiers.length > 0 && (
          <div className="px-5 py-3 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {modifiers.length} {modifiers.length === 1 ? 'modifier' : 'modifiers'}
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
        <Modal title="Edit Modifier" onClose={() => setEditModifier(null)}>
          <ModifierForm tenantId={tenantId} modifier={editModifier} categories={categories} onClose={() => setEditModifier(null)} />
        </Modal>
      )}
    </div>
  );
}
