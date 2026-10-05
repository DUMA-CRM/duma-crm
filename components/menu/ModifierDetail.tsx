'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Eye, EyeOff, Loader2, Scale, SlidersHorizontal, Trash2 } from '@/components/icons';
import { RecipeIngredientEditor } from '@/components/menu/RecipeIngredientEditor';
import { RecipeTotals } from '@/components/menu/RecipeTotals';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { createModifier, deleteModifier, getModifierGroups, getModifiers, updateModifier } from '@/lib/modules/catalog/client';
import { getModifierRecipe, setModifierRecipe } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
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

  const [submitted, setSubmitted] = useState(false);
  const labelError = label.trim().length < 1 ? 'A name is needed.' : null;
  const priceError = !/^-?\d+(\.\d{1,2})?$/.test(String(priceAdjust).trim()) ? 'A price like 0.50, or -0.20 to take money off.' : null;

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
          priceAdjust: String(priceAdjust).trim(),
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
            {save.isPending ? 'Saving…' : modifier ? 'Save changes' : 'Create modifier'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (!labelError && !priceError) save.mutate();
        }}
      >
        <SettingsTabBody
          stickyAside
          aside={
            <>
              <SettingsSection title="Settings">
                <SettingRows>
                  {/* The explicit replacement for the old category === 'size'
                      rule, which silently disabled per-size costing if you typed
                      "Sizes". */}
                  <SettingRow icon={Scale} title="This is a size" description="Sizes get their own quantity column in every recipe, so a large can use more milk than a small.">
                    <Switch label="This is a size" checked={isSize} onChange={(checked) => patch({ isSize: checked })} />
                  </SettingRow>
                  <SettingRow icon={isAvailable ? Eye : EyeOff} title="Available at the till" description="Turn off when you run out. It stays set up and keeps its recipe.">
                    <Switch label="Available at the till" checked={isAvailable} onChange={(checked) => patch({ isAvailable: checked })} />
                  </SettingRow>
                </SettingRows>
              </SettingsSection>
              {modifier && recipe.hasIngredients && <RecipeTotals summary={recipe.summary} allAllergens={recipe.allAllergens} title="What it adds" />}
            </>
          }
        >
          <SettingsSection title="Modifier" description="An option offered with an item — a size, a milk, an extra shot.">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <Input label="Name" value={label} onChange={(e) => patch({ label: e.target.value })} placeholder="e.g. Oat milk" autoFocus={!modifier} error={submitted ? (labelError ?? undefined) : undefined} />
                <Input
                  label="Price change"
                  value={priceAdjust}
                  onChange={(e) => patch({ priceAdjust: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.50"
                  leftIcon={<span className="text-sm">£</span>}
                  className="tabular-nums"
                  error={submitted ? (priceError ?? undefined) : undefined}
                  hint={!priceError ? (Number(priceAdjust) === 0 ? 'No charge' : Number(priceAdjust) < 0 ? 'Takes money off' : 'Added to the item’s price') : undefined}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-label uppercase text-muted-foreground">Group</span>
                {groups.length ? (
                  <ChoiceCards
                    columns={groups.length >= 4 ? 4 : groups.length === 3 ? 3 : 2}
                    value={groupId}
                    onChange={(value) => {
                      const selected = groups.find((group) => group.id === value);
                      patch({ groupId: value, category: selected?.name ?? '', isSize: selected?.isSize ?? false });
                    }}
                    options={groups.map((group) => ({ value: group.id, label: group.name }))}
                  />
                ) : (
                  <p className="rounded-md bg-measured/10 px-3 py-2 text-xs text-measured">
                    No groups yet.{' '}
                    <Link href="/menu/categories" className="font-semibold underline">
                      Create one on Categories
                    </Link>{' '}
                    first — Size, Milk or Extras.
                  </p>
                )}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="What it uses" description="The stock it adds to a drink — this is what makes stock, cost and allergens right.">
            {!modifier ? (
              <p className="rounded-lg border border-dashed border-rule/70 px-4 py-3 text-sm text-muted-foreground">Create the modifier first, then set what it adds to a drink.</p>
            ) : recipe.isLoading ? (
              <div className="h-20 animate-pulse rounded-lg bg-band/60" aria-hidden="true" />
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
          </SettingsSection>
        </SettingsTabBody>
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
