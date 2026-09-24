'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Eye, EyeOff, Loader2, Scale, SlidersHorizontal, Trash2 } from '@/components/icons';
import { RecipeIngredientEditor } from '@/components/menu/RecipeIngredientEditor';
import { RecipeTotals } from '@/components/menu/RecipeTotals';
import { inputClass, labelClass } from '@/components/menu/shared';
import { useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { createModifier, deleteModifier, getModifierGroups, getModifiers, updateModifier } from '@/lib/modules/catalog/client';
import { getModifierRecipe, setModifierRecipe } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { isSizeModifier, modifierCategory, modifierLabel } from '@/lib/utils/modifiers';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const FORM_ID = 'modifier-detail-form';

/**
 * A modifier's record: identity and the stock it draws down, on one page.
 *
 * Laid out board-then-workbench, the same as the menu item recipe editor — the
 * editing gets the width, the cost figures stay in a stable narrow column. The
 * previous two-equal-panels split gave the ingredient editor half a screen and
 * pushed it into horizontal scrolling as soon as a second size existed.
 *
 * One Save covers the whole record. The fields and the recipe are two API
 * calls, but that is the API's shape, not the user's — an Update button in the
 * header plus a separate Save recipe button lower down meant it was possible to
 * leave with half the work committed.
 */
export function ModifierDetail({ modifierId }: { modifierId?: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: modifiers = [], isLoading } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifiers', tenantId),
    queryFn: () => getModifiers(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: groups = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifier-groups', tenantId),
    queryFn: () => getModifierGroups(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });

  const modifier = modifierId ? modifiers.find((m) => m.id === modifierId) : undefined;

  // No useMemo: React Compiler handles it, and manual memoization it cannot
  // prove safe makes it skip optimizing the component entirely.
  // A size cannot be its own size column.
  const sizes = modifiers
    .filter((m) => isSizeModifier(m) && m.id !== modifierId)
    .map((m) => ({ id: m.id, label: modifierLabel(m), priceAdjust: m.priceAdjust }));

  // Draft mirrors the server record; the first edit copies it in. No effect, so
  // a late-arriving record cannot clobber something already typed.
  const server = {
    label: modifier ? modifierLabel(modifier) : '',
    groupId: modifier?.groupId ?? '',
    category: (modifier ? modifierCategory(modifier) : '') ?? '',
    isSize: modifier ? isSizeModifier(modifier) : false,
    priceAdjust: modifier?.priceAdjust ?? '0',
    isAvailable: modifier?.isAvailable ?? true,
  };
  const [draft, setDraft] = useState<typeof server | null>(null);
  const form = draft ?? server;
  const { label, groupId, category, isSize, priceAdjust, isAvailable } = form;
  const patch = (changes: Partial<typeof server>) => setDraft({ ...form, ...changes });

  const recipe = useRecipeDraft({
    queryKey: moduleQueryKeys.inventory.key('modifier-recipe', modifierId),
    fetchLines: () => (modifierId ? getModifierRecipe(modifierId) : Promise.resolve([])),
    saveLines: (lines) => (modifierId ? setModifierRecipe(modifierId, lines) : Promise.resolve()),
    sizes,
  });

  const fieldsDirty = draft !== null;
  const dirty = fieldsDirty || recipe.dirty;

  const save = useMutation({
    mutationFn: async () => {
      if (fieldsDirty || !modifier) {
        const payload = {
          label: label.trim(),
          category: category.trim() || null,
          groupId: groupId || null,
          isSize,
          priceAdjust,
          isAvailable,
        };
        const saved = modifier ? await updateModifier(modifier.id, payload) : await createModifier({ tenantId: tenantId!, ...payload });
        if (recipe.dirty) await recipe.save.mutateAsync();
        return saved;
      }
      await recipe.save.mutateAsync();
      return modifier;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('modifiers') });
      setDraft(null);
      toast('success', modifier ? 'Modifier saved.' : 'Modifier created.');
      if (!modifier && saved) router.replace(`/menu/modifiers/${saved.id}`);
    },
    onError: (err) => toast('error', err.message || 'The modifier wasn’t saved. Try again.'),
  });

  const remove = useMutation({
    mutationFn: () => deleteModifier(modifier!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('modifiers') });
      setConfirmingDelete(false);
      toast('success', 'Modifier deleted.');
      router.push('/menu/modifiers');
    },
    onError: (err) => toast('error', err.message || 'The modifier wasn’t deleted. Try again.'),
  });

  if (!tenantId) return null;

  if (modifierId && !modifier) {
    return (
      <EditorShell title="Modifier" onClose={() => router.push('/menu/modifiers')}>
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <EmptyState icon={SlidersHorizontal} title="This modifier no longer exists" description="It may have been deleted elsewhere." />
        )}
      </EditorShell>
    );
  }

  return (
    <EditorShell
      eyebrow={modifier ? 'Modifier' : undefined}
      title={label || (modifier ? 'Untitled modifier' : 'New modifier')}
      icon={<SlidersHorizontal size={20} aria-hidden="true" />}
      onClose={() => router.push('/menu/modifiers')}
      dirty={dirty && !save.isPending}
      discardMessage="This modifier has changes that have not been saved. Leaving now discards them."
      actions={
        <>
          {modifier && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${label}`}
              className="size-9 text-muted-foreground/70 hover:text-destructive"
            >
              <Trash2 size={16} />
            </Button>
          )}
          {dirty && !save.isPending && <span className="hidden text-label font-semibold text-warning sm:inline">Unsaved changes</span>}
          <Button type="submit" form={FORM_ID} disabled={save.isPending} className="h-9 gap-2 px-5">
            {save.isPending && <Loader2 size={15} className="animate-spin" />}
            {save.isPending ? 'Saving…' : modifier ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        // Board and workbench: the editing column takes the width, the figures
        // stay in a stable rail that sticks as the ingredient list grows.
        className="grid gap-6 lg:items-start"
      >
        <div className="min-w-0">
          <section>
            <div className="mt-4 space-y-4">
              {/* Name, price and group are the whole identity of an option —
                  one row, so it reads as a single decision rather than a
                  vertical form to work down. */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_8rem_minmax(0,14rem)]">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className={labelClass} htmlFor="modifier-label">
                    Name
                  </label>
                  <input
                    id="modifier-label"
                    value={label}
                    onChange={(e) => patch({ label: e.target.value })}
                    required
                    minLength={1}
                    placeholder="Oat Milk"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="modifier-price">
                    Price change
                  </label>
                  <input
                    id="modifier-price"
                    value={priceAdjust}
                    onChange={(e) => patch({ priceAdjust: e.target.value })}
                    required
                    pattern="^-?\d+(\.\d{1,2})?$"
                    placeholder="0.50"
                    aria-describedby="modifier-price-hint"
                    className={cn(inputClass, 'tabular-nums')}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="modifier-group">
                    Group
                  </label>
                  <Select
                    value={groupId}
                    onValueChange={(value) => {
                      const selected = groups.find((group) => group.id === value);
                      patch({ groupId: value, category: selected?.name ?? '', isSize: selected?.isSize ?? false });
                    }}
                    options={groups.map((group) => ({ value: group.id, label: group.name }))}
                    ariaLabel="Modifier group"
                  />
                  {!groups.length && <p className="mt-1 text-label text-warning">Create a group from the Modifiers list first.</p>}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* The explicit replacement for the old category === 'size'
                    rule, which silently disabled per-size costing if you typed
                    "Sizes". */}
                <label
                  className={cn(
                    'flex cursor-pointer select-none items-start gap-3 rounded-sm border p-3 transition-colors',
                    isSize ? 'border-primary/40 bg-band' : 'border-rule hover:bg-band',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSize}
                    onChange={(e) => patch({ isSize: e.target.checked })}
                    className="mt-0.5 size-4 rounded accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Scale size={14} aria-hidden="true" />
                      This is a size option
                    </span>
                    <span className="mt-0.5 block text-label leading-relaxed text-muted-foreground">
                      Sizes get their own quantity column in every recipe, so a large can use more milk than a small.
                    </span>
                  </span>
                </label>

                <label
                  className={cn(
                    'flex cursor-pointer select-none items-start gap-3 rounded-sm border p-3 transition-colors',
                    isAvailable ? 'border-primary/40 bg-band' : 'border-rule hover:bg-band',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => patch({ isAvailable: e.target.checked })}
                    className="mt-0.5 size-4 rounded accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {/* The glyph changes with the state, so availability does
                          not travel on the checkbox alone. */}
                      {isAvailable ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                      Available in the POS
                    </span>
                    <span className="mt-0.5 block text-label leading-relaxed text-muted-foreground">
                      Turn off when you run out. The option stays set up and keeps its recipe, it just stops being offered.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </section>

          <section className="pt-6">
            <h2 className="text-sm font-semibold text-foreground">What it uses</h2>

            <div className="mt-4">
              {!modifier ? (
                <div className="rounded-sm border border-dashed border-rule px-4 py-6 text-center">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Create the modifier first, then set what it adds to a drink.
                  </p>
                </div>
              ) : recipe.isLoading ? (
                <div className="h-20 animate-pulse rounded-sm bg-muted" aria-hidden="true" />
              ) : (
                <RecipeIngredientEditor
                  rows={recipe.rows}
                  onChange={recipe.edit}
                  columns={recipe.columns}
                  stockItems={recipe.stockItems}
                  itemMap={recipe.itemMap}
                  usedIds={recipe.usedIds}
                  sizes={sizes}
                  emptyHint="Nothing yet. Add what this option adds to a drink — Oat Milk uses 200ml of oat milk, an extra shot uses 9g of beans."
                />
              )}
            </div>
          </section>
        </div>

        {/* Workbench. Sticky, so the cost stays visible while the ingredient
            list grows past the fold. */}
        {modifier && recipe.hasIngredients && (
          <aside className="lg:sticky lg:top-4">
            <RecipeTotals summary={recipe.summary} allAllergens={recipe.allAllergens} title="What it adds" />
          </aside>
        )}
      </form>

      {confirmingDelete && modifier && (
        <ConfirmModal
          title="Delete this modifier?"
          message={
            <>
              Delete <span className="font-semibold text-foreground">{label}</span>? Items using it will lose this option. This cannot be
              undone.
            </>
          }
          confirmLabel="Delete modifier"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </EditorShell>
  );
}
