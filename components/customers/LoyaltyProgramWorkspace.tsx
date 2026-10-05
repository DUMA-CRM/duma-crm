'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Award, Check, Gift, MapPin, Plus, Sparkles } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SaveBar, SettingRow, SettingRows } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';

import {
  type LoyaltyProgram,
  type LoyaltyProgramInput,
  createLoyaltyProgram,
  getLoyaltyPrograms,
  updateLoyaltyProgram,
} from '@/lib/api/loyalty.service';
import { getMenuCategories, getMenuItems, getModifierGroups } from '@/lib/api/menu.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Draft = LoyaltyProgramInput & { id?: string };

const fieldClass =
  'h-10 w-full rounded-md border border-rule/70 bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15';

function freshDraft(tenantId: string): Draft {
  return {
    tenantId,
    name: 'Coffee card',
    description: '',
    status: 'draft',
    unitSingular: 'stamp',
    unitPlural: 'stamps',
    earnRule: { scope: 'categories', menuItemIds: [], categoryIds: [], unitsPerItem: 1, trigger: 'purchase', benefitMode: 'rewards' },
    rewardRule: {
      kind: 'free_item',
      cost: 9,
      menuItemIds: [],
      categoryIds: [],
      modifierGroupIds: [],
      discountPercent: null,
      maxDiscountCents: null,
      validity: { type: 'never' },
    },
    locationIds: null,
  };
}

function toDraft(programme: LoyaltyProgram): Draft {
  return {
    id: programme.id,
    tenantId: programme.tenantId,
    name: programme.name,
    description: programme.description ?? '',
    status: programme.status,
    unitSingular: programme.unitSingular,
    unitPlural: programme.unitPlural,
    earnRule: { ...programme.earnRule, benefitMode: programme.earnRule.benefitMode ?? 'rewards' },
    rewardRule: { ...programme.rewardRule, validity: programme.rewardRule.validity ?? { type: 'never' } },
    locationIds: programme.locationIds,
  };
}

function sentenceList(names: string[], fallback: string) {
  if (!names.length) return fallback;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex min-h-10 items-center gap-2 rounded-md border px-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            value === option.value
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-rule/60 bg-background text-muted-foreground hover:bg-band/45',
          )}
        >
          <span
            className={cn(
              'flex size-4 items-center justify-center rounded-full border',
              value === option.value ? 'border-primary bg-primary text-white' : 'border-rule',
            )}
          >
            {value === option.value && <Check size={11} aria-hidden="true" />}
          </span>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Checklist({
  label,
  rows,
  selected,
  onChange,
  empty,
}: {
  label: string;
  rows: Array<{ id: string; name: string; hint?: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  empty: string;
}) {
  const selectedSet = new Set(selected);
  return (
    <fieldset>
      <legend className="mb-2 text-label uppercase text-muted-foreground">{label}</legend>
      <div className="overflow-hidden rounded-md border border-rule/60 bg-background">
        {rows.length ? (
          <div className="max-h-64 divide-y divide-rule/40 overflow-auto">
            {rows.map((row) => {
              const checked = selectedSet.has(row.id);
              return (
                <label key={row.id} className="flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors hover:bg-band/35">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(checked ? selected.filter((id) => id !== row.id) : [...selected, row.id])}
                    className="size-4 rounded border-rule text-primary accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{row.name}</span>
                  {row.hint && <span className="text-xs tabular-nums text-muted-foreground">{row.hint}</span>}
                </label>
              );
            })}
          </div>
        ) : (
          <p className="px-3.5 py-4 text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </fieldset>
  );
}

function programmeSummary(programme: LoyaltyProgram) {
  const mode = programme.earnRule.benefitMode ?? 'rewards';
  const earn =
    programme.earnRule.scope === 'all_items'
      ? 'all products'
      : programme.earnRule.scope === 'categories'
        ? 'selected categories'
        : 'selected products';
  const reward =
    programme.rewardRule.kind === 'free_item'
      ? 'free item'
      : programme.rewardRule.kind === 'free_modifier'
        ? 'free modifier'
        : `${programme.rewardRule.discountPercent ?? 0}% off`;
  if (mode === 'points')
    return `${programme.earnRule.unitsPerItem} point${programme.earnRule.unitsPerItem === 1 ? '' : 's'} per qualifying item · ${earn}`;
  const prefix = mode === 'both' ? 'Points + rewards · ' : '';
  return (
    prefix +
    (programme.earnRule.trigger === 'birthday'
      ? `Birthday reward · ${reward}`
      : `${programme.earnRule.unitsPerItem} ${programme.earnRule.unitsPerItem === 1 ? programme.unitSingular : programme.unitPlural} per item · ${programme.rewardRule.cost} for a ${reward} · ${earn}`)
  );
}

function validityLabel(validity: LoyaltyProgram['rewardRule']['validity']) {
  if (!validity || validity.type === 'never') return 'Rewards do not expire.';
  if (validity.type === 'days') return `Rewards are valid for ${validity.days ?? 1} days after issue.`;
  if (validity.type === 'end_of_year') return 'Rewards expire at the end of the year they are issued.';
  return validity.date
    ? `Rewards expire on ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(`${validity.date}T12:00:00Z`))}.`
    : 'Rewards use a fixed expiry date.';
}

export function LoyaltyProgramWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedDraft, setSavedDraft] = useState<Draft | null>(null);

  const programmesQuery = useQuery({
    queryKey: moduleQueryKeys.customers.key('loyalty-programmes', tenantId),
    queryFn: () => getLoyaltyPrograms(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const itemsQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const categoriesQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const modifierGroupsQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifier-groups', tenantId),
    queryFn: () => getModifierGroups(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const locationsQuery = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: Boolean(tenantId),
  });

  const programmes = useMemo(() => programmesQuery.data?.data ?? [], [programmesQuery.data]);

  useEffect(() => {
    if (draft || !programmes.length) return;
    const next = toDraft(programmes[0]);
    setDraft(next);
    setSavedDraft(next);
  }, [draft, programmes]);

  const patch = (value: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...value } : current));
  const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(savedDraft));

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('Choose a loyalty programme first.');
      const { id, ...input } = draft;
      return id ? updateLoyaltyProgram(id, input) : createLoyaltyProgram(input);
    },
    onSuccess: (programme) => {
      const next = toDraft(programme);
      setDraft(next);
      setSavedDraft(next);
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('loyalty-programmes') });
      toast('success', programme.status === 'active' ? 'Loyalty programme is live' : 'Loyalty programme saved');
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The loyalty programme could not be saved.'),
  });

  const selectProgramme = (programme: LoyaltyProgram) => {
    if (dirty && !window.confirm('Discard your unsaved loyalty programme changes?')) return;
    const next = toDraft(programme);
    setDraft(next);
    setSavedDraft(next);
  };

  const startNew = () => {
    if (!tenantId) return;
    if (dirty && !window.confirm('Discard your unsaved loyalty programme changes?')) return;
    const next = freshDraft(tenantId);
    setDraft(next);
    setSavedDraft(null);
  };

  const itemNames = new Map((itemsQuery.data ?? []).map((item) => [item.id, item.name]));
  const categoryNames = new Map((categoriesQuery.data ?? []).map((category) => [category.id, category.name]));
  const groupNames = new Map((modifierGroupsQuery.data ?? []).map((group) => [group.id, group.name]));

  const earnNames = draft
    ? draft.earnRule.scope === 'all_items'
      ? 'every product'
      : draft.earnRule.scope === 'categories'
        ? sentenceList(draft.earnRule.categoryIds.map((id) => categoryNames.get(id) ?? '').filter(Boolean), 'selected categories')
        : sentenceList(draft.earnRule.menuItemIds.map((id) => itemNames.get(id) ?? '').filter(Boolean), 'selected products')
    : '';
  const rewardNames = draft
    ? draft.rewardRule.kind === 'free_modifier'
      ? sentenceList(draft.rewardRule.modifierGroupIds.map((id) => groupNames.get(id) ?? '').filter(Boolean), 'selected modifiers')
      : sentenceList(
          [
            ...draft.rewardRule.categoryIds.map((id) => categoryNames.get(id) ?? ''),
            ...draft.rewardRule.menuItemIds.map((id) => itemNames.get(id) ?? ''),
          ].filter(Boolean),
          'any item',
        )
    : '';
  const benefitMode = draft?.earnRule.benefitMode ?? 'rewards';
  const rewardsEnabled = benefitMode !== 'points';
  const pointsEnabled = benefitMode !== 'rewards';

  const validationMessage = !draft?.name.trim()
    ? 'Add a programme name.'
    : draft.earnRule.trigger !== 'birthday' && draft.earnRule.scope === 'categories' && !draft.earnRule.categoryIds.length
      ? 'Choose at least one earning category.'
      : draft.earnRule.scope === 'menu_items' && !draft.earnRule.menuItemIds.length
        ? 'Choose at least one earning product.'
        : rewardsEnabled && draft.rewardRule.kind === 'free_modifier' && !draft.rewardRule.modifierGroupIds.length
          ? 'Choose at least one modifier group.'
          : rewardsEnabled && draft.rewardRule.validity?.type === 'date' && !draft.rewardRule.validity.date
            ? 'Choose the reward expiry date.'
            : null;

  return (
    <EditorShell
      title="Loyalty programmes"
      icon={<Gift size={20} aria-hidden="true" />}
      onClose={() => router.push('/customers')}
      dirty={dirty}
      actions={
        <Button onClick={startNew} className="gap-1.5" disabled={!tenantId}>
          <Plus size={15} aria-hidden="true" />
          New programme
        </Button>
      }
      flush
    >
      <div className="grid min-h-0 flex-1 md:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-auto border-b border-rule/60 bg-field md:border-b-0 md:border-r" aria-label="Loyalty programmes">
          <div className="border-b border-rule/50 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Your programmes</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Each programme keeps its own earning rule and customer benefits.
            </p>
          </div>
          {programmesQuery.isError ? (
            <div className="p-4">
              <ErrorState title="Loyalty programmes unavailable" onRetry={() => void programmesQuery.refetch()} />
            </div>
          ) : programmesQuery.isLoading ? (
            <div className="divide-y divide-rule/40" aria-label="Loading loyalty programmes">
              {[1, 2, 3].map((row) => (
                <div key={row} className="h-24 animate-pulse bg-band/30" />
              ))}
            </div>
          ) : programmes.length ? (
            <div className="divide-y divide-rule/40">
              {programmes.map((programme) => {
                const selected = draft?.id === programme.id;
                return (
                  <button
                    key={programme.id}
                    type="button"
                    onClick={() => selectProgramme(programme)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'w-full border-l-2 px-4 py-4 text-left transition-colors hover:bg-band/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                      selected ? 'border-l-primary bg-primary/5' : 'border-l-transparent',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-foreground">{programme.name}</span>
                      <span
                        className={cn('text-label uppercase', programme.status === 'active' ? 'text-primary' : 'text-muted-foreground')}
                      >
                        {programme.status}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{programmeSummary(programme)}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={Award}
                title="No loyalty programmes"
                description="Create rewards, points, or both across products, categories and modifiers."
              />
              <div className="-mt-9 flex justify-center pb-8">
                <Button onClick={startNew}>Create programme</Button>
              </div>
            </div>
          )}
        </aside>

        <main className="min-h-0 overflow-auto">
          {draft ? (
            <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 md:px-6 md:py-6 lg:py-8">
              <section className="rounded-lg border border-primary/30 bg-primary/[0.045] px-5 py-4" aria-label="Programme summary">
                <div className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-white">
                    <Sparkles size={17} />
                  </span>
                  <div>
                    <p className="text-label uppercase text-primary">Customer promise</p>
                    <p className="mt-1 text-base font-semibold leading-relaxed text-foreground">
                      {draft.earnRule.trigger === 'birthday' && benefitMode === 'points' ? (
                        `Receive ${draft.earnRule.unitsPerItem} point${draft.earnRule.unitsPerItem === 1 ? '' : 's'} automatically on your birthday.`
                      ) : draft.earnRule.trigger === 'birthday' ? (
                        `Receive ${benefitMode === 'both' ? `${draft.earnRule.unitsPerItem} point${draft.earnRule.unitsPerItem === 1 ? '' : 's'} and ` : ''}${draft.rewardRule.kind === 'percentage_off' ? `${draft.rewardRule.discountPercent ?? 25}% off` : draft.rewardRule.kind === 'free_modifier' ? 'a free modifier' : 'a free item'} automatically on your birthday, valid on ${rewardNames}.`
                      ) : benefitMode === 'points' ? (
                        `Buy ${earnNames} to collect ${draft.earnRule.unitsPerItem} point${draft.earnRule.unitsPerItem === 1 ? '' : 's'} per item.`
                      ) : (
                        <>
                          Buy {earnNames} to collect{' '}
                          {pointsEnabled ? `${draft.earnRule.unitsPerItem} point${draft.earnRule.unitsPerItem === 1 ? '' : 's'} and ` : ''}
                          {draft.earnRule.unitsPerItem} {draft.earnRule.unitsPerItem === 1 ? draft.unitSingular : draft.unitPlural} per
                          item. Spend {draft.rewardRule.cost} {draft.rewardRule.cost === 1 ? draft.unitSingular : draft.unitPlural} on{' '}
                          {rewardNames}.
                        </>
                      )}
                    </p>
                    {rewardsEnabled && <p className="mt-1 text-sm text-muted-foreground">{validityLabel(draft.rewardRule.validity)}</p>}
                    {rewardsEnabled && draft.rewardRule.maxDiscountCents !== null && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Reward value is capped at £{(draft.rewardRule.maxDiscountCents / 100).toFixed(2)}.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <SettingsSection title="Programme details" description="Name the reward in language customers and staff will recognise.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="text-sm font-medium">Name</span>
                    <input className={fieldClass} value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="text-sm font-medium">
                      Description <span className="font-normal text-muted-foreground">optional</span>
                    </span>
                    <textarea
                      className={cn(fieldClass, 'h-20 resize-y py-2.5')}
                      value={draft.description ?? ''}
                      onChange={(event) => patch({ description: event.target.value })}
                    />
                  </label>
                  {rewardsEnabled && (
                    <>
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium">One progress unit</span>
                        <input
                          className={fieldClass}
                          value={draft.unitSingular}
                          onChange={(event) => patch({ unitSingular: event.target.value })}
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium">Several progress units</span>
                        <input
                          className={fieldClass}
                          value={draft.unitPlural}
                          onChange={(event) => patch({ unitPlural: event.target.value })}
                        />
                      </label>
                    </>
                  )}
                </div>
                <SettingRows>
                  <SettingRow
                    icon={Award}
                    title="Programme status"
                    description="Drafts are hidden from customers and checkout. Active programmes issue the benefits configured below."
                  >
                    <select
                      className={cn(fieldClass, 'w-32')}
                      value={draft.status}
                      onChange={(event) => patch({ status: event.target.value as Draft['status'] })}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </SettingRow>
                </SettingRows>
              </SettingsSection>

              <SettingsSection
                title="What customers earn"
                description="Choose a simple reward card, a points balance, or let each purchase build both."
              >
                <div className="grid gap-4 sm:grid-cols-[18rem_minmax(0,1fr)]">
                  <ChoiceGroup
                    label="Loyalty benefit"
                    value={benefitMode}
                    options={[
                      { value: 'rewards', label: 'Rewards' },
                      { value: 'points', label: 'Points' },
                      { value: 'both', label: 'Points and rewards' },
                    ]}
                    onChange={(benefitMode) => patch({ earnRule: { ...draft.earnRule, benefitMode } })}
                  />
                  <div className="flex min-h-32 items-center rounded-md border border-rule/60 bg-background px-5 text-sm leading-relaxed text-muted-foreground">
                    {benefitMode === 'rewards'
                      ? 'Qualifying items build progress toward a defined free item, modifier or discount.'
                      : benefitMode === 'points'
                        ? 'Qualifying items add points to the customer’s shared points balance. No reward card is created.'
                        : 'The same qualifying item adds points and builds progress toward the configured reward.'}
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="How customers receive it"
                description="Build purchase progress or issue one reward automatically on the customer’s birthday."
              >
                <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <ChoiceGroup
                      label="Issue method"
                      value={draft.earnRule.trigger ?? 'purchase'}
                      options={[
                        { value: 'purchase', label: 'Purchase progress' },
                        { value: 'birthday', label: 'Birthday benefit' },
                      ]}
                      onChange={(trigger) => patch({ earnRule: { ...draft.earnRule, trigger } })}
                    />
                    {draft.earnRule.trigger !== 'birthday' && (
                      <>
                        <ChoiceGroup
                          label="Earning scope"
                          value={draft.earnRule.scope}
                          options={[
                            { value: 'all_items', label: 'Every product' },
                            { value: 'categories', label: 'Selected categories' },
                            { value: 'menu_items', label: 'Selected products' },
                          ]}
                          onChange={(scope) => patch({ earnRule: { ...draft.earnRule, scope } })}
                        />
                        <label className="grid gap-1.5">
                          <span className="text-sm font-medium">
                            {benefitMode === 'points'
                              ? 'Points earned per item'
                              : benefitMode === 'both'
                                ? 'Points and units per item'
                                : 'Units earned per item'}
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            className={fieldClass}
                            value={draft.earnRule.unitsPerItem}
                            onChange={(event) =>
                              patch({ earnRule: { ...draft.earnRule, unitsPerItem: Math.max(1, Number(event.target.value) || 1) } })
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                  {draft.earnRule.trigger === 'birthday' ? (
                    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-rule bg-background px-5 text-center text-sm text-muted-foreground">
                      {benefitMode === 'points'
                        ? 'Points are added once each year when the customer’s saved birthday arrives.'
                        : benefitMode === 'both'
                          ? 'Points and a reward are issued once each year when the customer’s saved birthday arrives.'
                          : 'A reward is issued once each year when the customer’s saved birthday arrives.'}
                    </div>
                  ) : draft.earnRule.scope === 'categories' ? (
                    <Checklist
                      label="Earning categories"
                      rows={(categoriesQuery.data ?? []).map((category) => ({
                        id: category.id,
                        name: category.name,
                        hint: `${category.itemCount} items`,
                      }))}
                      selected={draft.earnRule.categoryIds}
                      onChange={(categoryIds) => patch({ earnRule: { ...draft.earnRule, categoryIds } })}
                      empty="Add a menu category before using a category rule."
                    />
                  ) : draft.earnRule.scope === 'menu_items' ? (
                    <Checklist
                      label="Earning products"
                      rows={(itemsQuery.data ?? []).map((item) => ({
                        id: item.id,
                        name: item.name,
                        hint: `£${Number(item.price).toFixed(2)}`,
                      }))}
                      selected={draft.earnRule.menuItemIds}
                      onChange={(menuItemIds) => patch({ earnRule: { ...draft.earnRule, menuItemIds } })}
                      empty="Add a menu product before using a product rule."
                    />
                  ) : (
                    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-rule bg-background px-5 text-center text-sm text-muted-foreground">
                      Every qualifying item in the order earns{' '}
                      {benefitMode === 'points' ? 'points' : benefitMode === 'both' ? 'points and reward progress' : 'reward progress'}.
                    </div>
                  )}
                </div>
              </SettingsSection>

              {rewardsEnabled && (
                <SettingsSection
                  title="What customers can claim"
                  description="A reward can cover one eligible product or one selected modifier."
                >
                  <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
                    <div className="space-y-4">
                      <ChoiceGroup
                        label="Reward type"
                        value={draft.rewardRule.kind}
                        options={[
                          { value: 'free_item', label: 'Free item' },
                          { value: 'free_modifier', label: 'Free modifier' },
                          { value: 'percentage_off', label: 'Percentage off' },
                        ]}
                        onChange={(kind) =>
                          patch({
                            rewardRule: {
                              ...draft.rewardRule,
                              kind,
                              discountPercent: kind === 'percentage_off' ? (draft.rewardRule.discountPercent ?? 25) : null,
                            },
                          })
                        }
                      />
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium">Units to redeem</span>
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          className={fieldClass}
                          value={draft.rewardRule.cost}
                          onChange={(event) =>
                            patch({ rewardRule: { ...draft.rewardRule, cost: Math.max(1, Number(event.target.value) || 1) } })
                          }
                        />
                      </label>
                      {draft.rewardRule.kind === 'percentage_off' && (
                        <label className="grid gap-1.5">
                          <span className="text-sm font-medium">Discount percentage</span>
                          <div className="relative">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              className={cn(fieldClass, 'pr-8')}
                              value={draft.rewardRule.discountPercent ?? 25}
                              onChange={(event) =>
                                patch({
                                  rewardRule: {
                                    ...draft.rewardRule,
                                    discountPercent: Math.max(1, Math.min(100, Number(event.target.value) || 1)),
                                  },
                                })
                              }
                            />
                            <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                          </div>
                        </label>
                      )}
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium">
                          Maximum reward value <span className="font-normal text-muted-foreground">optional</span>
                        </span>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">£</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className={cn(fieldClass, 'pl-7')}
                            value={draft.rewardRule.maxDiscountCents === null ? '' : (draft.rewardRule.maxDiscountCents / 100).toFixed(2)}
                            placeholder="No limit"
                            onChange={(event) =>
                              patch({
                                rewardRule: {
                                  ...draft.rewardRule,
                                  maxDiscountCents:
                                    event.target.value === '' ? null : Math.round(Math.max(0, Number(event.target.value)) * 100),
                                },
                              })
                            }
                          />
                        </div>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium">Reward expiry</span>
                        <select
                          className={fieldClass}
                          value={
                            draft.rewardRule.validity?.type === 'days'
                              ? `days:${draft.rewardRule.validity.days ?? 7}`
                              : (draft.rewardRule.validity?.type ?? 'never')
                          }
                          onChange={(event) => {
                            const value = event.target.value;
                            const validity = value.startsWith('days:')
                              ? { type: 'days' as const, days: Number(value.slice(5)) }
                              : value === 'date'
                                ? { type: 'date' as const, date: draft.rewardRule.validity?.date ?? '' }
                                : { type: value as 'never' | 'end_of_year' };
                            patch({ rewardRule: { ...draft.rewardRule, validity } });
                          }}
                        >
                          <option value="never">Does not expire</option>
                          <option value="days:7">Valid for 7 days</option>
                          <option value="days:30">Valid for 30 days</option>
                          <option value="end_of_year">Until the end of the year</option>
                          <option value="date">Specific date</option>
                        </select>
                      </label>
                      {draft.rewardRule.validity?.type === 'date' && (
                        <div className="grid gap-1.5">
                          <span className="text-sm font-medium">Expiry date</span>
                          <DatePicker
                            value={draft.rewardRule.validity.date ?? ''}
                            onValueChange={(date) =>
                              patch({
                                rewardRule: { ...draft.rewardRule, validity: { type: 'date', date } },
                              })
                            }
                            aria-label="Expiry date"
                            required
                          />
                        </div>
                      )}
                    </div>
                    {draft.rewardRule.kind === 'free_modifier' ? (
                      <Checklist
                        label="Reward modifier groups"
                        rows={(modifierGroupsQuery.data ?? []).map((group) => ({
                          id: group.id,
                          name: group.name,
                          hint: `${group.modifierCount} choices`,
                        }))}
                        selected={draft.rewardRule.modifierGroupIds}
                        onChange={(modifierGroupIds) => patch({ rewardRule: { ...draft.rewardRule, modifierGroupIds } })}
                        empty="Create a modifier group before offering a modifier reward."
                      />
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Leave both lists empty to allow any item. Selecting both means an item must match one of the products and one of
                          the categories.
                        </p>
                        <Checklist
                          label="Reward categories"
                          rows={(categoriesQuery.data ?? []).map((category) => ({
                            id: category.id,
                            name: category.name,
                            hint: `${category.itemCount} items`,
                          }))}
                          selected={draft.rewardRule.categoryIds}
                          onChange={(categoryIds) => patch({ rewardRule: { ...draft.rewardRule, categoryIds } })}
                          empty="No menu categories yet."
                        />
                        <Checklist
                          label="Reward products"
                          rows={(itemsQuery.data ?? []).map((item) => ({
                            id: item.id,
                            name: item.name,
                            hint: `£${Number(item.price).toFixed(2)}`,
                          }))}
                          selected={draft.rewardRule.menuItemIds}
                          onChange={(menuItemIds) => patch({ rewardRule: { ...draft.rewardRule, menuItemIds } })}
                          empty="No menu products yet."
                        />
                      </div>
                    )}
                  </div>
                </SettingsSection>
              )}

              <SettingsSection title="Where it applies" description="Use one programme everywhere, or limit it to selected locations.">
                <SettingRows>
                  <SettingRow icon={MapPin} title="All locations" description="New locations will be included automatically.">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={draft.locationIds === null}
                      onChange={(event) => patch({ locationIds: event.target.checked ? null : [] })}
                      aria-label="Use at all locations"
                    />
                  </SettingRow>
                </SettingRows>
                {draft.locationIds !== null && (
                  <Checklist
                    label="Programme locations"
                    rows={(locationsQuery.data ?? []).map((location) => ({
                      id: location.id,
                      name: location.name,
                      hint: location.isActive ? 'Active' : 'Inactive',
                    }))}
                    selected={draft.locationIds}
                    onChange={(locationIds) => patch({ locationIds })}
                    empty="No locations are available."
                  />
                )}
              </SettingsSection>

              {validationMessage && (
                <p className="rounded-md border border-measured/35 bg-measured/5 px-4 py-3 text-sm text-foreground">{validationMessage}</p>
              )}
              <SaveBar
                dirty={dirty}
                saving={save.isPending}
                onSave={() => save.mutate()}
                onDiscard={() => setDraft(savedDraft ?? (tenantId ? freshDraft(tenantId) : null))}
                disabled={Boolean(validationMessage)}
                saveLabel={draft.id ? 'Save programme' : 'Create programme'}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6">
              <EmptyState
                icon={Gift}
                title="Build a loyalty programme"
                description="Create flexible earning and reward rules for your menu."
              />
              <Button className="-mt-9" onClick={startNew}>
                Create programme
              </Button>
            </div>
          )}
        </main>
      </div>
    </EditorShell>
  );
}
