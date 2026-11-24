'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RowWarning, SectionInfo } from '@/components/shared/rows';
import { Coins, Eye, EyeOff, Layers3, Scale, SlidersHorizontal, Trash2, Type } from '@/components/icons';
import { GroupPicker } from '@/components/menu/GroupPicker';
import { RecipeIngredientEditor, RecipeIngredientSkeleton } from '@/components/menu/RecipeIngredientEditor';
import { RecipeTotals } from '@/components/menu/RecipeTotals';
import { useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { ChangeRow, SaveBar, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { LoadingState } from '@/components/shared/Skeleton';
import { useCurrencySymbol } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { createModifier, deleteModifier, getModifierGroups, getModifiers, updateModifier } from '@/lib/modules/catalog/client';
import { getModifierRecipe, setModifierRecipe } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { formatPriceChange, priceChangeWords } from '@/lib/utils/menu-editor';
import { isSizeModifier, modifierCategory, modifierLabel } from '@/lib/utils/modifiers';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const FORM_ID = 'modifier-detail-form';

type Row = 'name' | 'price' | 'group';

/**
 * A modifier's record: identity and the stock it draws down, on one page.
 *
 * The editor layout: What it uses (the ingredients) gets the main column; the
 * modifier's own rows — name, price change, group, size, available — and What
 * it adds sit in the sidebar, first when stacked. The previous two-equal-panels
 * split gave the ingredient editor half a screen and pushed it into horizontal
 * scrolling as soon as a second size existed.
 *
 * One SaveBar covers the whole record. The fields and the recipe are two API
 * calls, but that is the API's shape, not the user's — an Update button in the
 * header plus a separate Save recipe button lower down meant it was possible to
 * leave with half the work committed.
 */
export function ModifierDetail({ modifierId }: { modifierId?: string }) {
  const symbol = useCurrencySymbol();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Menu opens on menu:read; changing a modifier is menu:write.
  const canWrite = useAuthStore((state) => hasCapability(state.capabilities, 'menu:write'));

  const { data: modifiers = [], isLoading, isError, refetch } = useQuery({
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

  // One row open at a time; a new modifier starts with its name open.
  const [open, setOpen] = useState<Row | null>(modifierId ? null : 'name');
  const [before, setBefore] = useState(form);
  const openRow = (row: Row) => {
    setBefore(form);
    setOpen(row);
  };
  /** Change opens a row; Cancel closes it and puts its fields back as they were when it opened. */
  const toggle = (row: Row) => {
    if (open !== row) return openRow(row);
    const fields =
      row === 'name'
        ? { label: before.label }
        : row === 'price'
          ? { priceAdjust: before.priceAdjust }
          : { groupId: before.groupId, category: before.category, isSize: before.isSize };
    const next = { ...form, ...fields };
    // Back to exactly what is saved: no draft at all, so the SaveBar leaves.
    setDraft(JSON.stringify(next) === JSON.stringify(server) ? null : next);
    setOpen(null);
  };
  /** Enter in a row's field closes it, keeping what was typed. */
  const closeOnEnter = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      setOpen(null);
    }
  };

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
  const submit = () => {
    setSubmitted(true);
    if (!labelError && !priceError) {
      setOpen(null);
      save.mutate();
    } else openRow(labelError ? 'name' : 'price');
  };

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
          <LoadingState label="Loading the modifier" />
        ) : isError ? (
          <ErrorState icon={SlidersHorizontal} title="The modifier couldn’t load" onRetry={() => void refetch()} />
        ) : (
          <EmptyState
            icon={SlidersHorizontal}
            kind="gone"
            title="This modifier no longer exists"
            description="It may have been deleted elsewhere."
          />
        )}
      </EditorShell>
    );
  }

  const groupName = groups.find((group) => group.id === groupId)?.name ?? (category || null);
  const change = formatPriceChange(String(priceAdjust), symbol);

  const details = (
    <RecordGroup
      card
      id="modifier-details"
      title="Modifier"
      actions={
        <SectionInfo label="Sizes get their own quantity column in every recipe, so a large can use more milk than a small. Turn off Available when you run out — it stays set up and keeps its recipe." />
      }
    >
      <ChangeRow
        icon={Type}
        label="Name"
        tone={submitted && labelError ? 'warning' : undefined}
        value={label.trim() ? <span className="truncate">{label.trim()}</span> : <ValueMissing>Not named</ValueMissing>}
        open={open === 'name'}
        onToggle={() => toggle('name')}
      >
        <Input
          aria-label="Name"
          value={label}
          onChange={(e) => patch({ label: e.target.value })}
          onKeyDown={closeOnEnter}
          placeholder="e.g. Oat milk"
          autoFocus
          error={submitted ? (labelError ?? undefined) : undefined}
        />
      </ChangeRow>
      <ChangeRow
        icon={Coins}
        label="Price change"
        tone={submitted && priceError ? 'warning' : undefined}
        value={
          priceError ? (
            <ValueMissing>Not set</ValueMissing>
          ) : change ? (
            <>
              <span className="tabular-nums">{change}</span>
              <ValueAside>· {priceChangeWords(String(priceAdjust)).toLowerCase()}</ValueAside>
            </>
          ) : (
            'No charge'
          )
        }
        open={open === 'price'}
        onToggle={() => toggle('price')}
      >
        <Input
          aria-label="Price change"
          value={priceAdjust}
          onChange={(e) => patch({ priceAdjust: e.target.value })}
          onKeyDown={closeOnEnter}
          inputMode="decimal"
          autoFocus
          placeholder="0.50"
          leftIcon={<span className="text-sm">{symbol}</span>}
          className="tabular-nums sm:max-w-48"
          error={submitted ? (priceError ?? undefined) : undefined}
          hint={!priceError ? priceChangeWords(String(priceAdjust)) : 'Use -0.20 to take money off.'}
        />
      </ChangeRow>
      <ChangeRow
        icon={Layers3}
        label="Group"
        value={groupName ? <span className="truncate">{groupName}</span> : <ValueMissing>No group</ValueMissing>}
        open={open === 'group'}
        onToggle={groups.length ? () => toggle('group') : undefined}
      >
        <GroupPicker
          groups={groups}
          value={groupId}
          onChange={(value) => {
            const selected = groups.find((group) => group.id === value);
            patch({ groupId: value, category: selected?.name ?? '', isSize: selected?.isSize ?? false });
          }}
        />
      </ChangeRow>
      {/* The explicit replacement for the old category === 'size' rule, which
          silently disabled per-size costing if you typed "Sizes". */}
      <ChangeRow
        icon={Scale}
        label="Size"
        value={isSize ? 'Yes — a column in every recipe' : <ValueMissing>No</ValueMissing>}
        trailing={<Switch label="This is a size" checked={isSize} onChange={(checked) => patch({ isSize: checked })} />}
      />
      <ChangeRow
        icon={isAvailable ? Eye : EyeOff}
        label="Available at the till"
        value={isAvailable ? 'Yes' : <ValueMissing>No — hidden at the till</ValueMissing>}
        trailing={<Switch label="Available at the till" checked={isAvailable} onChange={(checked) => patch({ isAvailable: checked })} />}
      />
      {!groups.length && (
        <RowWarning className="mt-3">
          <span>
            No groups yet.{' '}
            <Link href="/menu/modifiers" className="font-semibold underline">
              Create one on Modifiers
            </Link>{' '}
            first — Size, Milk or Extras.
          </span>
        </RowWarning>
      )}
    </RecordGroup>
  );

  return (
    <EditorShell
      eyebrow={modifier ? 'Modifier' : undefined}
      title={label || (modifier ? 'Untitled modifier' : 'New modifier')}
      icon={<SlidersHorizontal size={20} aria-hidden="true" />}
      onClose={() => router.push('/menu/modifiers')}
      dirty={dirty && !save.isPending}
      discardMessage="This modifier has changes that have not been saved. Leaving now discards them."
      actions={
        modifier && canWrite ? (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${label}`}
            title={`Delete ${label}`}
            className="size-9 text-muted-foreground hover:border-exception/40 hover:bg-exception/6 hover:text-exception"
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        ) : undefined
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (canWrite) submit();
        }}
      >
        {/* Read-only for menu:read — the disabled fieldset disables every control, and the SaveBar never appears. */}
        <fieldset disabled={!canWrite} className="contents">
        <motion.div
          initial={reduceMotion ? false : 'hidden'}
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
          className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]"
        >
          {/* What it uses is the work, so it takes the main column. */}
          <div className="flex min-w-0 flex-col gap-5">
            <RecordGroup
              id="modifier-recipe"
              title="What it uses"
              footnote="The stock it adds to a drink — this is what makes stock, cost and allergens right."
            >
              {!modifier ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                  Create the modifier first, then set what it adds to a drink.
                </div>
              ) : recipe.isLoading ? (
                <RecipeIngredientSkeleton />
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
            </RecordGroup>
          </div>
          {/* Stacked (below lg) the settings come first, so a new modifier starts on its name. */}
          <div className="flex min-w-0 flex-col gap-5 max-lg:order-first lg:sticky lg:top-5">
            {details}
            {modifier && recipe.hasIngredients && (
              <RecipeTotals summary={recipe.summary} allAllergens={recipe.allAllergens} title="What it adds" />
            )}
          </div>
        </motion.div>
        </fieldset>

        {canWrite && (
        <SaveBar
          dirty={dirty || !modifier}
          saving={save.isPending}
          saveLabel={modifier ? 'Save changes' : 'Create modifier'}
          message={modifier ? undefined : 'Not created yet'}
          onSave={submit}
          onDiscard={() => {
            setDraft(null);
            recipe.discard();
            setSubmitted(false);
            setOpen(modifier ? null : 'name');
          }}
        />
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
