'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { InfoRow, PickerRow, RowWarning } from '@/components/shared/rows';
import { StampCard } from '@/components/customers/CustomerLoyaltyCards';
import {
  Activity,
  AlignLeft,
  Award,
  Calendar,
  ChevronRight,
  Clock,
  Coffee,
  Coins,
  Copy,
  ExternalLink,
  FileText,
  Gift,
  type IconComponent,
  LayoutGrid,
  MapPin,
  Pause,
  Play,
  Plus,
  ShoppingBag,
  Tag,
  TicketPercent,
  Type,
  Wallet,
} from '@/components/icons';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards, Hint, NumberStepper } from '@/components/shared/FormParts';
import { Pill } from '@/components/shared/Pill';
import { LoadingState, RowSkeleton } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { useCurrencySymbol } from '@/components/shared/useWorkspaceMoney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL_CLASS } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CARD_SURFACE } from '@/components/shared/surface';

import {
  type CustomerLoyaltyProgram,
  type LoyaltyEarnRule,
  type LoyaltyProgram,
  type LoyaltyProgramInput,
  type LoyaltyProgramStatus,
  type LoyaltyRewardRule,
  createLoyaltyProgram,
  getLoyaltyPrograms,
  updateLoyaltyProgram,
} from '@/lib/api/loyalty.service';
import { getMenuCategories, getMenuItems, getModifierGroups } from '@/lib/api/menu.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import {
  ANY_ITEM,
  type ProgrammeRules,
  type ProgrammeSection,
  countOf,
  expiryShort,
  programmeProblem,
  programmePromise,
  sentenceList,
  validityLabel,
} from '@/lib/utils/loyalty-programme';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Draft = LoyaltyProgramInput & { id?: string };

const BASE = '/customers/loyalty';

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

/** A saved programme as the create call takes it. */
function toInput(programme: LoyaltyProgram): LoyaltyProgramInput {
  const input: Draft = toDraft(programme);
  delete input.id;
  return input;
}

const STATUS: Record<LoyaltyProgramStatus, { label: string; tone: Tone; detail: string }> = {
  draft: { label: 'Draft', tone: 'muted', detail: 'Hidden from customers and the till.' },
  active: { label: 'Live', tone: 'success', detail: 'Customers earn with every qualifying purchase.' },
  paused: { label: 'Paused', tone: 'warning', detail: 'Not offered until you make it live again.' },
};

/** A stamp card, a points balance or a birthday treat — the icon says which before the words do. */
function ProgrammeIcon({ rules, size }: { rules: Pick<ProgrammeRules, 'earnRule'>; size: number }) {
  if (rules.earnRule.trigger === 'birthday') return <Gift size={size} aria-hidden="true" />;
  return rules.earnRule.benefitMode === 'points' ? <Coins size={size} aria-hidden="true" /> : <Coffee size={size} aria-hidden="true" />;
}

interface CatalogNames {
  items: Map<string, string>;
  categories: Map<string, string>;
}

function useCatalogNames(tenantId: string | null): CatalogNames {
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
  return useMemo(
    () => ({
      items: new Map((itemsQuery.data ?? []).map((item) => [item.id, item.name])),
      categories: new Map((categoriesQuery.data ?? []).map((category) => [category.id, category.name])),
    }),
    [itemsQuery.data, categoriesQuery.data],
  );
}

/** The names the promise reads — what earns, and what the reward can be spent on. */
function promiseFor(rules: ProgrammeRules, names: CatalogNames) {
  const pick = (ids: string[], map: Map<string, string>) => ids.map((id) => map.get(id) ?? '').filter(Boolean);
  const earnOn =
    rules.earnRule.scope === 'categories'
      ? sentenceList(pick(rules.earnRule.categoryIds, names.categories), 'chosen')
      : sentenceList(pick(rules.earnRule.menuItemIds, names.items), 'chosen item');
  const spendOn = sentenceList(
    [...pick(rules.rewardRule.categoryIds, names.categories), ...pick(rules.rewardRule.menuItemIds, names.items)],
    ANY_ITEM,
  );
  return programmePromise(rules, { earnOn, spendOn });
}

/**
 * Loyalty: the programmes as a list, each opening its own setup page —
 * `?programme=<id>` or `?programme=new`, so the back button steps out of one
 * the way it should. Square and Toast lay setup out the same way: how
 * customers earn, then the reward, then where it applies, with the card the
 * customer will see kept in view beside it.
 */
export function LoyaltyProgramWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const opened = searchParams.get('programme');
  const names = useCatalogNames(tenantId);

  const programmesQuery = useQuery({
    queryKey: moduleQueryKeys.customers.key('loyalty-programmes', tenantId),
    queryFn: () => getLoyaltyPrograms(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const programmes = programmesQuery.data?.data ?? [];
  const open = (id: string) => router.push(`${BASE}?programme=${id}`);

  if (tenantId && opened) {
    const programme = programmes.find((entry) => entry.id === opened);
    if (opened !== 'new' && !programme) {
      return (
        <EditorShell eyebrow="Loyalty programme" title="Programme" onClose={() => router.push(BASE)}>
          {programmesQuery.isPending ? (
            <LoadingState label="Loading the programme" className="flex-1" />
          ) : programmesQuery.isError ? (
            <ErrorState title="Couldn’t load the programme" onRetry={() => void programmesQuery.refetch()} />
          ) : (
            <EmptyState icon={Award} kind="gone" title="This programme no longer exists" description="The link may be out of date." />
          )}
        </EditorShell>
      );
    }
    return (
      // Keyed by the URL, so opening another programme starts from its own saved state.
      <ProgrammeEditor
        key={opened}
        tenantId={tenantId}
        programme={programme}
        names={names}
        onClose={() => router.push(BASE)}
        onCreated={(id) => router.replace(`${BASE}?programme=${id}`)}
      />
    );
  }

  return (
    <EditorShell
      title="Loyalty"
      icon={<Gift size={20} aria-hidden="true" />}
      onClose={() => router.push('/customers')}
      actions={
        tenantId && programmes.length > 0 ? (
          <Button className="gap-1.5" onClick={() => open('new')}>
            <Plus size={15} aria-hidden="true" />
            New programme
          </Button>
        ) : undefined
      }
    >
      {!tenantId ? (
        <EmptyState icon={Award} title="No workspace selected" description="Choose a workspace to set up its loyalty." />
      ) : programmesQuery.isError ? (
        <ErrorState title="Couldn’t load loyalty programmes" onRetry={() => void programmesQuery.refetch()} />
      ) : programmesQuery.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading loyalty programmes" className="space-y-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className={CARD_SURFACE} aria-hidden="true">
              <RowSkeleton index={index} />
            </div>
          ))}
        </div>
      ) : programmes.length === 0 ? (
        <EmptyState
          icon={Coffee}
          kind="start"
          className="flex-1"
          title="No loyalty programmes yet"
          description="A stamp card is the easiest start: buy nine coffees, get the tenth free."
          action={{ label: 'Create a programme', icon: Plus, onClick: () => open('new') }}
        />
      ) : (
        <motion.ul
          initial="hidden"
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.04 } } }}
          // A card per programme: each is a whole scheme with its own rules, not a line in a table.
          className="space-y-2"
        >
          {programmes.map((programme) => {
            const status = STATUS[programme.status];
            return (
              <motion.li
                key={programme.id}
                variants={SECTION_RISE}
                className={CARD_SURFACE}
              >
                <ProgrammeRowMenu programme={programme} onOpen={() => open(programme.id)}>
                  <button
                    type="button"
                    onClick={() => open(programme.id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-band/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary"
                      aria-hidden="true"
                    >
                      <ProgrammeIcon rules={programme} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{programme.name}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{promiseFor(programme, names)}</span>
                    </span>
                    <Pill tone={status.tone} className="shrink-0">
                      {status.label}
                    </Pill>
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </ProgrammeRowMenu>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </EditorShell>
  );
}

/**
 * Right-click (or long-press) on a programme: open it, switch it live, pause
 * it or park it as a draft, or start a copy. Every item is also reachable from
 * the programme's own page — the menu is a shortcut, not a route.
 */
function ProgrammeRowMenu({ programme, onOpen, children }: { programme: LoyaltyProgram; onOpen: () => void; children: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const invalidate = () => qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('loyalty-programmes') });

  const setStatus = useMutation({
    mutationFn: (status: LoyaltyProgramStatus) => updateLoyaltyProgram(programme.id, { status }),
    onSuccess: (result) => {
      void invalidate();
      toast('success', `${result.name} is ${STATUS[result.status].label.toLowerCase()}.`);
    },
    onError: (error) => toast('error', error.message || 'The status wasn’t changed. Try again.'),
  });
  // A copy starts as a draft, so nothing changes for customers until it's made live.
  const duplicate = useMutation({
    mutationFn: () => createLoyaltyProgram({ ...toInput(programme), name: `${programme.name} (copy)`, status: 'draft' }),
    onSuccess: async (result) => {
      await invalidate();
      toast('success', 'Copy created as a draft.');
      router.push(`${BASE}?programme=${result.id}`);
    },
    onError: (error) => toast('error', error.message || 'The copy wasn’t created. Try again.'),
  });
  const busy = setStatus.isPending || duplicate.isPending;

  const STATUS_ACTIONS: { status: LoyaltyProgramStatus; label: string; icon: IconComponent }[] = [
    { status: 'active', label: 'Make live', icon: Play },
    { status: 'paused', label: 'Pause', icon: Pause },
    { status: 'draft', label: 'Move to draft', icon: FileText },
  ];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>{programme.name}</ContextMenuLabel>
        <ContextMenuItem icon={ExternalLink} onSelect={onOpen}>
          Open
        </ContextMenuItem>
        <ContextMenuSeparator />
        {STATUS_ACTIONS.filter((action) => action.status !== programme.status).map((action) => (
          <ContextMenuItem key={action.status} icon={action.icon} disabled={busy} onSelect={() => setStatus.mutate(action.status)}>
            {action.label}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem icon={Copy} disabled={busy} onSelect={() => duplicate.mutate()}>
          Duplicate
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── One programme's setup ────────────────────────────────────────────────────

type Row =
  | 'name'
  | 'description'
  | 'status'
  | 'when'
  | 'collect'
  | 'units'
  | 'perItem'
  | 'earnOn'
  | 'reward'
  | 'cost'
  | 'spendOn'
  | 'cap'
  | 'expires';

const STATUS_BADGE: Record<LoyaltyProgramStatus, 'success' | 'muted' | 'warning'> = {
  draft: 'muted',
  active: 'success',
  paused: 'warning',
};

/**
 * One programme, in the Booking rules layout: porcelain sections of rows —
 * each says its value in words and opens its control on a tap, one at a time —
 * with the card the customer will see in the aside, and one Save bar.
 */
function ProgrammeEditor({
  tenantId,
  programme,
  names,
  onClose,
  onCreated,
}: {
  tenantId: string;
  programme?: LoyaltyProgram;
  names: CatalogNames;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const symbol = useCurrencySymbol();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => (programme ? toDraft(programme) : freshDraft(tenantId)));
  const [saved, setSaved] = useState<Draft | null>(() => (programme ? toDraft(programme) : null));
  // A new programme opens on its name — the one thing it can't save without.
  const [open, setOpen] = useState<Row | null>(programme ? null : 'name');

  const itemsQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId),
  });
  const categoriesQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId),
  });
  const groupsQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifier-groups', tenantId),
    queryFn: () => getModifierGroups(tenantId),
  });
  const locationsQuery = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId),
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const problem = programmeProblem(draft);
  const mode = draft.earnRule.benefitMode ?? 'rewards';
  const rewards = mode !== 'points';
  const purchase = draft.earnRule.trigger !== 'birthday';
  const one = draft.unitSingular.trim() || 'stamp';
  const many = draft.unitPlural.trim() || 'stamps';

  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
  const earn = (changes: Partial<LoyaltyEarnRule>) =>
    setDraft((current) => ({ ...current, earnRule: { ...current.earnRule, ...changes } }));
  const reward = (changes: Partial<LoyaltyRewardRule>) =>
    setDraft((current) => ({ ...current, rewardRule: { ...current.rewardRule, ...changes } }));
  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));

  const save = useMutation({
    mutationFn: () => {
      const { id, ...input } = draft;
      return id ? updateLoyaltyProgram(id, input) : createLoyaltyProgram(input);
    },
    onSuccess: async (result) => {
      const next = toDraft(result);
      setDraft(next);
      setSaved(next);
      setOpen(null);
      toast('success', result.status === 'active' ? 'Saved — the programme is live.' : 'Programme saved.');
      // A new programme moves to its own address once the list knows it.
      await qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('loyalty-programmes') });
      if (!draft.id) onCreated(result.id);
    },
    onError: (error) => toast('error', error.message || 'The programme wasn’t saved. Try again.'),
  });

  const categoryRows = (categoriesQuery.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    hint: `${category.itemCount} ${category.itemCount === 1 ? 'item' : 'items'}`,
  }));
  const itemRows = (itemsQuery.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    hint: `${symbol}${Number(item.price).toFixed(2)}`,
  }));
  const pick = (ids: string[], map: Map<string, string>) => ids.map((id) => map.get(id) ?? '').filter(Boolean);
  const groupNames = new Map((groupsQuery.data ?? []).map((group) => [group.id, group.name]));
  const locationNames = new Map((locationsQuery.data ?? []).map((location) => [location.id, location.name]));

  const earnOnValue =
    draft.earnRule.scope === 'all_items'
      ? 'Every item'
      : draft.earnRule.scope === 'categories'
        ? sentenceList(pick(draft.earnRule.categoryIds, names.categories), 'Choose sections')
        : sentenceList(pick(draft.earnRule.menuItemIds, names.items), 'Choose items');
  const spendOnValue =
    draft.rewardRule.kind === 'free_modifier'
      ? sentenceList(pick(draft.rewardRule.modifierGroupIds, groupNames), 'Choose modifier groups')
      : sentenceList(
          [...pick(draft.rewardRule.categoryIds, names.categories), ...pick(draft.rewardRule.menuItemIds, names.items)],
          'Any item',
        );
  const rewardValue =
    draft.rewardRule.kind === 'percentage_off'
      ? `${draft.rewardRule.discountPercent ?? 25}% off`
      : draft.rewardRule.kind === 'free_modifier'
        ? 'Free modifier'
        : 'Free item';
  const expiryValue =
    draft.rewardRule.validity?.type === 'days'
      ? `days:${draft.rewardRule.validity.days ?? 7}`
      : (draft.rewardRule.validity?.type ?? 'never');

  // The card as a customer would see it a third of the way through — enough stamps to read as a card in use.
  const preview: CustomerLoyaltyProgram = {
    ...draft,
    id: draft.id ?? 'preview',
    name: draft.name.trim() || 'Your programme',
    description: draft.description ?? null,
    unitSingular: one,
    unitPlural: many,
    createdAt: '',
    updatedAt: '',
    balance: Math.max(1, Math.round(draft.rewardRule.cost / 3)),
    lifetimeEarned: 0,
    lifetimeRedeemed: 0,
    canRedeem: false,
    rewards: [],
    nextRewardExpiresAt: null,
  } as CustomerLoyaltyProgram;

  const warningFor = (section: ProgrammeSection) => problem?.section === section && dirty && <RowWarning className="mt-4">{problem.message}</RowWarning>;

  return (
    <EditorShell
      eyebrow="Loyalty programme"
      title={draft.name.trim() || 'New programme'}
      icon={<ProgrammeIcon rules={draft} size={20} />}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      discardMessage="This programme has changes that haven’t been saved. Leaving now discards them."
    >
      {/* The settings body's stagger, as SettingsShell gives its tabs. */}
      <motion.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
        <SettingsTabBody
          stickyAside
          aside={
            <SettingsSection
              title="Customer sees"
              actions={<Badge variant={STATUS_BADGE[draft.status]}>{STATUS[draft.status].label}</Badge>}
            >
              {rewards && purchase ? (
                <StampCard programme={preview} />
              ) : (
                <div className="overflow-hidden rounded-xl bg-primary px-5 py-4 text-primary-foreground">
                  <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-micro text-primary-foreground/70">
                    <ProgrammeIcon rules={draft} size={13} /> {purchase ? 'Points' : 'Birthday'}
                  </p>
                  <p className="mt-1.5 truncate text-lg font-semibold">{preview.name}</p>
                </div>
              )}
              {rewards && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {validityLabel(draft.rewardRule.validity)}
                  {draft.rewardRule.maxDiscountCents !== null &&
                    ` Worth up to ${symbol}${(draft.rewardRule.maxDiscountCents / 100).toFixed(2)}.`}
                </p>
              )}
            </SettingsSection>
          }
        >
          <SettingsSection title="Programme">
            <div className="space-y-3">
              <PickerRow
                icon={Type}
                title="Name"
                value={draft.name.trim() || 'Not named yet'}
                muted={!draft.name.trim()}
                tone={!draft.name.trim() && dirty ? 'warning' : undefined}
                open={open === 'name'}
                onToggle={() => toggle('name')}
              >
                <Input
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  maxLength={80}
                  autoFocus
                  aria-label="Name"
                />
              </PickerRow>
              <PickerRow
                icon={AlignLeft}
                title="Description"
                value={draft.description?.trim() || 'None'}
                muted={!draft.description?.trim()}
                open={open === 'description'}
                onToggle={() => toggle('description')}
              >
                <textarea
                  value={draft.description ?? ''}
                  onChange={(event) => patch({ description: event.target.value })}
                  rows={2}
                  aria-label="Description"
                  className="w-full resize-none rounded-md border border-input bg-control px-3 py-2 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:outline-2 focus:outline-ring/30 sm:text-sm"
                />
              </PickerRow>
              <PickerRow
                icon={Activity}
                title="Status"
                value={STATUS[draft.status].label}
                open={open === 'status'}
                onToggle={() => toggle('status')}
              >
                <ChoiceCards
                  appearance="settings"
                  columns={3}
                  value={draft.status}
                  onChange={(status) => patch({ status })}
                  options={(['draft', 'active', 'paused'] as const).map((value) => ({ value, label: STATUS[value].label }))}
                />
                <Hint>{STATUS[draft.status].detail}</Hint>
              </PickerRow>
            </div>
            {warningFor('details')}
          </SettingsSection>

          <SettingsSection title="How customers earn">
            <div className="space-y-3">
              <PickerRow
                icon={purchase ? ShoppingBag : Calendar}
                title="When"
                value={purchase ? 'When they buy' : 'On their birthday'}
                open={open === 'when'}
                onToggle={() => toggle('when')}
              >
                <ChoiceCards
                  appearance="settings"
                  value={draft.earnRule.trigger ?? 'purchase'}
                  onChange={(trigger) => earn({ trigger })}
                  options={[
                    { value: 'purchase', label: 'When they buy' },
                    { value: 'birthday', label: 'On their birthday' },
                  ]}
                />
              </PickerRow>
              <PickerRow
                icon={mode === 'points' ? Coins : Coffee}
                title="What they collect"
                value={mode === 'rewards' ? 'A reward card' : mode === 'points' ? 'Points' : 'Points and a reward card'}
                open={open === 'collect'}
                onToggle={() => toggle('collect')}
              >
                <ChoiceCards
                  appearance="settings"
                  columns={3}
                  value={mode}
                  onChange={(benefitMode) => earn({ benefitMode })}
                  options={[
                    { value: 'rewards', label: 'A reward card' },
                    { value: 'points', label: 'Points' },
                    { value: 'both', label: 'Both' },
                  ]}
                />
                <Hint>
                  {mode === 'rewards'
                    ? `${capitalise(many)} add up to a reward.`
                    : mode === 'points'
                      ? 'Points go on their balance. There’s no reward card.'
                      : `Each item adds points and fills the ${one} card.`}
                </Hint>
              </PickerRow>
              {rewards && (
                <PickerRow
                  icon={Tag}
                  title="Called"
                  value={`${one} / ${many}`}
                  tone={!draft.unitSingular.trim() || !draft.unitPlural.trim() ? 'warning' : undefined}
                  open={open === 'units'}
                  onToggle={() => toggle('units')}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={draft.unitSingular}
                      onChange={(event) => patch({ unitSingular: event.target.value })}
                      placeholder="stamp"
                      maxLength={30}
                      aria-label="One"
                    />
                    <Input
                      value={draft.unitPlural}
                      onChange={(event) => patch({ unitPlural: event.target.value })}
                      placeholder="stamps"
                      maxLength={30}
                      aria-label="More than one"
                    />
                  </div>
                  <Hint>What the till and the card call one, and more than one.</Hint>
                </PickerRow>
              )}
              {purchase && (
                <PickerRow
                  icon={Plus}
                  title="Per item"
                  value={
                    mode === 'points'
                      ? countOf(draft.earnRule.unitsPerItem, 'point', 'points')
                      : countOf(draft.earnRule.unitsPerItem, one, many)
                  }
                  open={open === 'perItem'}
                  onToggle={() => toggle('perItem')}
                >
                  <NumberStepper
                    label="Per item"
                    value={draft.earnRule.unitsPerItem}
                    min={1}
                    max={100}
                    unit={mode === 'points' ? 'points' : many}
                    onChange={(unitsPerItem) => earn({ unitsPerItem })}
                  />
                  {mode === 'both' && <Hint>The same number of points and {many}.</Hint>}
                </PickerRow>
              )}
              {purchase && (
                <PickerRow
                  icon={LayoutGrid}
                  title="Earned on"
                  value={earnOnValue}
                  tone={problem?.section === 'earn' && draft.earnRule.scope !== 'all_items' && dirty ? 'warning' : undefined}
                  open={open === 'earnOn'}
                  onToggle={() => toggle('earnOn')}
                >
                  <div className="space-y-3">
                    <ChoiceCards
                      appearance="settings"
                      columns={3}
                      value={draft.earnRule.scope}
                      onChange={(scope) => earn({ scope })}
                      options={[
                        { value: 'all_items', label: 'Every item' },
                        { value: 'categories', label: 'Sections' },
                        { value: 'menu_items', label: 'Items' },
                      ]}
                    />
                    {draft.earnRule.scope === 'categories' && (
                      <Checklist
                        label="Sections that earn"
                        rows={categoryRows}
                        selected={draft.earnRule.categoryIds}
                        onChange={(categoryIds) => earn({ categoryIds })}
                        empty="No menu sections yet."
                      />
                    )}
                    {draft.earnRule.scope === 'menu_items' && (
                      <Checklist
                        label="Items that earn"
                        rows={itemRows}
                        selected={draft.earnRule.menuItemIds}
                        onChange={(menuItemIds) => earn({ menuItemIds })}
                        empty="No menu items yet."
                      />
                    )}
                  </div>
                </PickerRow>
              )}
            </div>
            {warningFor('earn')}
          </SettingsSection>

          {rewards && (
            <SettingsSection title="Reward">
              <div className="space-y-3">
                <PickerRow icon={Gift} title="Reward" value={rewardValue} open={open === 'reward'} onToggle={() => toggle('reward')}>
                  <div className="space-y-3">
                    <ChoiceCards
                      appearance="settings"
                      columns={3}
                      value={draft.rewardRule.kind}
                      onChange={(kind) =>
                        reward({ kind, discountPercent: kind === 'percentage_off' ? (draft.rewardRule.discountPercent ?? 25) : null })
                      }
                      options={[
                        { value: 'free_item', label: 'Free item' },
                        { value: 'free_modifier', label: 'Free modifier' },
                        { value: 'percentage_off', label: '% off' },
                      ]}
                    />
                    {draft.rewardRule.kind === 'percentage_off' && (
                      <Slider
                        label="Off"
                        aria-label="Discount percentage"
                        min={1}
                        max={100}
                        step={1}
                        value={draft.rewardRule.discountPercent ?? 25}
                        onValueChange={(discountPercent) => reward({ discountPercent })}
                        formatValue={(percent) => `${percent}%`}
                      />
                    )}
                  </div>
                </PickerRow>
                {/* A birthday reward is given, not bought — there is nothing to collect towards. */}
                {purchase && (
                  <PickerRow
                    icon={Award}
                    title="Needed"
                    value={countOf(draft.rewardRule.cost, one, many)}
                    open={open === 'cost'}
                    onToggle={() => toggle('cost')}
                  >
                    <NumberStepper
                      label="Needed"
                      value={draft.rewardRule.cost}
                      min={1}
                      max={10000}
                      unit={many}
                      onChange={(cost) => reward({ cost })}
                    />
                    <Hint>How many {many} it takes to earn one reward.</Hint>
                  </PickerRow>
                )}
                <PickerRow
                  icon={TicketPercent}
                  title="Spent on"
                  value={spendOnValue}
                  tone={problem?.section === 'reward' && draft.rewardRule.kind === 'free_modifier' && dirty ? 'warning' : undefined}
                  open={open === 'spendOn'}
                  onToggle={() => toggle('spendOn')}
                >
                  {draft.rewardRule.kind === 'free_modifier' ? (
                    <Checklist
                      label="Modifier groups it covers"
                      rows={(groupsQuery.data ?? []).map((group) => ({ id: group.id, name: group.name }))}
                      selected={draft.rewardRule.modifierGroupIds}
                      onChange={(modifierGroupIds) => reward({ modifierGroupIds })}
                      empty="No modifier groups yet."
                    />
                  ) : (
                    <div className="space-y-3">
                      <Checklist
                        label="Sections"
                        rows={categoryRows}
                        selected={draft.rewardRule.categoryIds}
                        onChange={(categoryIds) => reward({ categoryIds })}
                        empty="No menu sections yet."
                      />
                      <Checklist
                        label="Items"
                        rows={itemRows}
                        selected={draft.rewardRule.menuItemIds}
                        onChange={(menuItemIds) => reward({ menuItemIds })}
                        empty="No menu items yet."
                      />
                      <Hint>Leave both empty for any item. With both, an item must be in each.</Hint>
                    </div>
                  )}
                </PickerRow>
                <PickerRow
                  icon={Wallet}
                  title="Worth up to"
                  value={
                    draft.rewardRule.maxDiscountCents === null
                      ? 'No limit'
                      : `${symbol}${(draft.rewardRule.maxDiscountCents / 100).toFixed(2)}`
                  }
                  muted={draft.rewardRule.maxDiscountCents === null}
                  open={open === 'cap'}
                  onToggle={() => toggle('cap')}
                >
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.rewardRule.maxDiscountCents === null ? '' : (draft.rewardRule.maxDiscountCents / 100).toFixed(2)}
                    placeholder="No limit"
                    aria-label="Worth up to"
                    leftIcon={<span className="text-sm">{symbol}</span>}
                    onChange={(event) =>
                      reward({
                        maxDiscountCents: event.target.value === '' ? null : Math.round(Math.max(0, Number(event.target.value)) * 100),
                      })
                    }
                    className="tabular-nums"
                  />
                  <Hint>Caps what one reward takes off a bill.</Hint>
                </PickerRow>
                <PickerRow
                  icon={Clock}
                  title="Expires"
                  value={expiryShort(draft.rewardRule.validity)}
                  tone={problem?.section === 'reward' && draft.rewardRule.validity?.type === 'date' && dirty ? 'warning' : undefined}
                  open={open === 'expires'}
                  onToggle={() => toggle('expires')}
                >
                  <div className="space-y-3">
                    <ChoiceCards
                      appearance="settings"
                      columns={3}
                      value={expiryValue}
                      onChange={(value) =>
                        reward({
                          validity: value.startsWith('days:')
                            ? { type: 'days', days: Number(value.slice(5)) }
                            : value === 'date'
                              ? { type: 'date', date: draft.rewardRule.validity?.date ?? '' }
                              : { type: value as 'never' | 'end_of_year' },
                        })
                      }
                      options={[
                        { value: 'never', label: 'Never' },
                        { value: 'days:7', label: '7 days' },
                        { value: 'days:30', label: '30 days' },
                        { value: 'end_of_year', label: 'Year end' },
                        { value: 'date', label: 'A date' },
                      ]}
                    />
                    {draft.rewardRule.validity?.type === 'date' && (
                      <DatePicker
                        value={draft.rewardRule.validity.date ?? ''}
                        onValueChange={(date) => reward({ validity: { type: 'date', date } })}
                        aria-label="Expiry date"
                        required
                      />
                    )}
                  </div>
                </PickerRow>
              </div>
              {warningFor('reward')}
            </SettingsSection>
          )}

          <SettingsSection title="Locations">
            <div className="space-y-3">
              <InfoRow icon={MapPin} title="All locations">
                <Switch
                  label="All locations"
                  checked={draft.locationIds === null}
                  onChange={(all) => patch({ locationIds: all ? null : [] })}
                />
              </InfoRow>
              {draft.locationIds !== null && (
                <Checklist
                  label={sentenceList(pick(draft.locationIds, locationNames), 'Choose locations')}
                  rows={(locationsQuery.data ?? []).map((location) => ({
                    id: location.id,
                    name: location.name,
                    hint: location.isActive ? undefined : 'Inactive',
                  }))}
                  selected={draft.locationIds}
                  onChange={(locationIds) => patch({ locationIds })}
                  empty="No locations yet."
                />
              )}
            </div>
            {warningFor('locations')}
          </SettingsSection>

          <SaveBar
            dirty={dirty}
            saving={save.isPending}
            onSave={() => save.mutate()}
            onDiscard={() => (saved ? setDraft(saved) : onClose())}
            disabled={Boolean(problem)}
            saveLabel={draft.id ? 'Save changes' : 'Create programme'}
          />
        </SettingsTabBody>
      </motion.div>
    </EditorShell>
  );
}

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

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
    <fieldset className="min-w-0">
      <legend className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>
        {label}
        {selected.length > 0 && <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{selected.length} chosen</span>}
      </legend>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length ? (
          <div className="max-h-64 divide-y divide-border overflow-auto">
            {rows.map((row) => {
              const checked = selectedSet.has(row.id);
              return (
                <label
                  key={row.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-band/40',
                    checked && 'bg-primary/4',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(checked ? selected.filter((id) => id !== row.id) : [...selected, row.id])}
                    className="size-4 shrink-0 rounded accent-primary"
                  />
                  <span className={cn('min-w-0 flex-1 truncate text-sm', checked ? 'font-semibold text-foreground' : 'text-foreground')}>
                    {row.name}
                  </span>
                  {row.hint && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{row.hint}</span>}
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
