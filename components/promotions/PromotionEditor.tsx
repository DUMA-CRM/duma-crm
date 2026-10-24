'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { DateTimeField } from '@/components/cms/DateTimeField';
import { ActionRow, ActionRows, InfoRow, InfoRows, PickerRow, RowTile, SectionInfo } from '@/components/cms/rows';
import { copyText } from '@/components/cms/shared';
import {
  Archive,
  Calendar,
  CalendarClock,
  Coins,
  Download,
  Hash,
  type IconComponent,
  ListChecks,
  MapPin,
  Monitor,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Tag,
  TicketPercent,
  Type,
  UserRound,
  Users,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { useCurrencySymbol, useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { CopyButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';

import { getMenuCategories, getMenuItems } from '@/lib/api/menu.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { hasCapability } from '@/lib/auth/capabilities';
import {
  type PromotionCode,
  type PromotionDetail,
  addPromotionCode,
  createPromotion,
  generatePromotionCodes,
  getPromotion,
  getPromotionRedemptions,
  setPromotionCodeActive,
  updatePromotion,
} from '@/lib/modules/promotions/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/date';
import {
  CHANNEL_LABELS,
  KIND_LABELS,
  type PromotionChannel,
  type PromotionDraft,
  type PromotionKind,
  STANDING_LABELS,
  codesCsv,
  draftFromPromotion,
  draftToFields,
  emptyPromotionDraft,
  itemsChosenLabel,
  moneyLabel,
  normaliseCode,
  offerAmountLabel,
  perCustomerLabel,
  promotionConditions,
  promotionDraftProblems,
  promotionStanding,
  scopeLabel,
  usageLabel,
  usesLimitLabel,
} from '@/lib/utils/promotions';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { STANDING_BADGE } from './PromotionsList';

const KINDS = (Object.keys(KIND_LABELS) as PromotionKind[]).map((value) => ({ value, label: KIND_LABELS[value] }));
const CHANNEL_OPTIONS = (Object.keys(CHANNEL_LABELS) as PromotionChannel[]).map((value) => ({ value, label: CHANNEL_LABELS[value] }));

type Row =
  | 'name'
  | 'code'
  | 'kind'
  | 'value'
  | 'maxDiscount'
  | 'appliesTo'
  | 'items'
  | 'minSubtotal'
  | 'locations'
  | 'channels'
  | 'maxRedemptions'
  | 'perCustomer'
  | 'startsAt'
  | 'endsAt';

/** The row that holds each field, so a failed save can open the first one with a problem. */
const ROW_OF: Partial<Record<keyof PromotionDraft, Row>> = {
  name: 'name',
  code: 'code',
  value: 'value',
  maxDiscount: 'maxDiscount',
  menuItemIds: 'items',
  minSubtotal: 'minSubtotal',
  locationIds: 'locations',
  channels: 'channels',
  maxRedemptions: 'maxRedemptions',
  maxRedemptionsPerCustomer: 'perCustomer',
  endsAt: 'endsAt',
};

/**
 * One promotion, full page, laid out like Booking rules: the rule in the main
 * column (offer, conditions, limits, dates), each one a row that says what
 * it's set to and opens its control on a tap; beside it what it reads as, its
 * uses, its codes and where it stands. New promotions get their first code
 * here; more come from the Codes card once it exists.
 */
export function PromotionEditor({
  promotionId,
  onClose,
  onCreated,
}: {
  promotionId: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const capabilities = useAuthStore((state) => state.capabilities);
  const editable = hasCapability(capabilities, 'promotions:write');
  const query = useQuery({
    queryKey: moduleQueryKeys.promotions.key('detail', promotionId, tenantId),
    queryFn: () => getPromotion(promotionId!, tenantId),
    enabled: Boolean(promotionId && tenantId),
  });

  if (promotionId && query.isPending)
    return (
      <EditorShell title="Loading promotion" onClose={onClose} icon={<TicketPercent size={20} aria-hidden="true" />}>
        <Bone className="h-96 w-full rounded-lg" />
      </EditorShell>
    );
  if (promotionId && (query.isError || !query.data))
    return (
      <EditorShell title="Promotion not found" onClose={onClose} icon={<TicketPercent size={20} aria-hidden="true" />}>
        <EmptyState
          className="flex-1"
          icon={TicketPercent}
          kind="gone"
          title="This promotion couldn’t be loaded"
          description="It may belong to another workspace, or the connection dropped."
          action={{ label: 'Try again', onClick: () => void query.refetch() }}
        />
      </EditorShell>
    );

  return (
    <PromotionForm
      // A save replaces the record; the key keeps the form in step with it.
      key={query.data?.updatedAt ?? 'new'}
      promotion={query.data ?? null}
      editable={editable}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function PromotionForm({
  promotion,
  editable,
  onClose,
  onCreated,
}: {
  promotion: PromotionDetail | null;
  editable: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const symbol = useCurrencySymbol();
  const isNew = promotion === null;
  const initial = useMemo(() => (promotion ? draftFromPromotion(promotion) : emptyPromotionDraft()), [promotion]);
  const [draft, setDraft] = useState<PromotionDraft>(initial);
  const [showProblems, setShowProblems] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // One rule open at a time; a tap on the open one closes it. A new promotion starts on its name.
  const [open, setOpen] = useState<Row | null>(isNew ? 'name' : null);
  const patch = (next: Partial<PromotionDraft>) => setDraft((current) => ({ ...current, ...next }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const problems = promotionDraftProblems(draft, isNew);
  const problemOf = (field: keyof PromotionDraft) => (showProblems ? problems[field] : undefined);

  const items = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId),
    enabled: Boolean(tenantId),
  });
  const categories = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId),
    enabled: Boolean(tenantId),
  });
  const locations = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: Boolean(tenantId),
  });
  const itemOptions = (items.data ?? []).map((item) => ({ value: item.id, label: item.name }));
  const categoryOptions = (categories.data ?? []).map((category) => ({ value: category.id, label: category.name }));
  const locationOptions = (locations.data ?? []).map((location) => ({ value: location.id, label: location.name }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.promotions.all });

  const save = useMutation({
    mutationFn: async () => {
      const fields = draftToFields(draft);
      if (isNew) return createPromotion({ ...fields, code: normaliseCode(draft.code) }, tenantId);
      return updatePromotion(promotion.id, fields, tenantId);
    },
    onSuccess: async (saved) => {
      await invalidate();
      toast('success', isNew ? 'Promotion created — it’s ready at the till.' : 'Promotion saved.');
      if (isNew) onCreated(saved.id);
    },
    onError: (error) => toast('error', error.message),
  });
  const setStatus = useMutation({
    mutationFn: (status: PromotionDraft['status']) => updatePromotion(promotion!.id, { status }, tenantId),
    onSuccess: async (saved) => {
      await invalidate();
      setArchiving(false);
      toast(
        'success',
        saved.status === 'archived' ? 'Promotion archived.' : saved.status === 'paused' ? 'Promotion paused.' : 'Promotion is live again.',
      );
    },
    onError: (error) => toast('error', error.message),
  });

  const attemptSave = () => {
    const fields = Object.keys(problems) as (keyof PromotionDraft)[];
    if (fields.length) {
      setShowProblems(true);
      // Open the first row with a problem, so the fix is under the eye.
      setOpen(ROW_OF[fields[0]!] ?? null);
      toast('error', problems[fields[0]!]!);
      return;
    }
    save.mutate();
  };

  // ⌘S / Ctrl+S saves, as in the Content editors.
  const saveShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘S' : 'Ctrl+S';
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (editable && (dirty || isNew) && !save.isPending) attemptSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const standing = promotion ? promotionStanding(promotion) : null;
  const fields = draftToFields(draft);
  const readOnly = !editable || promotion?.status === 'archived';
  const amountOff = draft.kind === 'percentage' || draft.kind === 'fixed_amount';
  const needsItems = draft.kind === 'free_item' || (amountOff && draft.appliesTo === 'items');

  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  /** The row's tile: red for a problem the save found, amber for something required still empty. */
  const toneOf = (field: keyof PromotionDraft, required = false) =>
    problemOf(field) ? ('danger' as const) : required && !String(draft[field]).trim() ? ('warning' as const) : undefined;
  const textRow = (
    row: Row,
    field: 'name' | 'code' | 'value' | 'maxDiscount' | 'minSubtotal' | 'maxRedemptions' | 'maxRedemptionsPerCustomer',
    icon: IconComponent,
    title: string,
    shown: string,
    muted: boolean,
    control: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & { clean?: (raw: string) => string },
    required = false,
  ) => {
    const { clean, ...input } = control;
    return (
      <PickerRow
        icon={icon}
        title={title}
        value={shown}
        muted={muted}
        tone={toneOf(field, required)}
        open={open === row}
        onToggle={() => toggle(row)}
      >
        <Input
          aria-label={title}
          value={draft[field]}
          onChange={(event) => patch({ [field]: clean ? clean(event.target.value) : event.target.value })}
          error={problemOf(field)}
          autoFocus
          {...input}
        />
      </PickerRow>
    );
  };
  const currency = <span className="text-sm text-muted-foreground">{symbol}</span>;
  const digitsOnly = (raw: string) => raw.replace(/\D/g, '');

  return (
    <EditorShell
      eyebrow="Promotion"
      title={draft.name.trim() || (isNew ? 'New promotion' : 'Promotion')}
      icon={<TicketPercent size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      meta={
        promotion ? (
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {standing && <Badge variant={STANDING_BADGE[standing]}>{STANDING_LABELS[standing]}</Badge>}
            <span className="tabular-nums">{usageLabel(promotion)}</span>
          </span>
        ) : undefined
      }
    >
      <motion.div
        className="w-full"
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      >
        <SettingsTabBody
          narrowAside
          aside={
            <>
              <SettingsSection title="Reads as">
                <div className="flex items-start gap-3">
                  <RowTile icon={Sparkles} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {isNew ? normaliseCode(draft.code) || 'YOURCODE' : (promotion?.codes[0]?.code ?? 'No code yet')}
                      <span className="font-normal text-muted-foreground"> · {offerSentence(fields, symbol)}</span>
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {promotionConditions(fields, symbol).map((condition) => (
                        <li
                          key={condition}
                          className="rounded-sm border border-rule/55 bg-control px-1.5 py-0.5 text-micro font-medium text-muted-foreground"
                        >
                          {condition}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </SettingsSection>
              {promotion && <UsageSection promotion={promotion} />}
              {promotion && (
                <CodesSection promotion={promotion} editable={editable && promotion.status !== 'archived'} onChanged={invalidate} />
              )}
              {promotion && standing && (
                <SettingsSection title="Status" actions={<Badge variant={STANDING_BADGE[standing]}>{STANDING_LABELS[standing]}</Badge>}>
                  <div className="space-y-3">
                    {promotion.status === 'archived' && (
                      <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                        Its codes no longer work and it can’t be edited. Restore it to use it again.
                      </p>
                    )}
                    {editable && (
                      <ActionRows>
                        {promotion.status === 'active' && (
                          <ActionRow
                            icon={Pause}
                            label="Pause — stop it being used"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate('paused')}
                          />
                        )}
                        {promotion.status === 'paused' && (
                          <ActionRow
                            icon={Play}
                            label="Make it live again"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate('active')}
                          />
                        )}
                        {promotion.status === 'archived' ? (
                          <ActionRow
                            icon={RotateCcw}
                            label="Restore, paused"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate('paused')}
                          />
                        ) : (
                          <ActionRow
                            icon={Archive}
                            label="Archive"
                            danger
                            disabled={setStatus.isPending}
                            onClick={() => setArchiving(true)}
                          />
                        )}
                      </ActionRows>
                    )}
                  </div>
                </SettingsSection>
              )}
            </>
          }
        >
          <SettingsSection title="Offer">
            <fieldset disabled={readOnly} className="min-w-0 space-y-3">
              {textRow(
                'name',
                'name',
                Type,
                'Name',
                draft.name.trim() || 'Not named',
                !draft.name.trim(),
                {
                  placeholder: 'Summer 10% off',
                  hint: 'Shown on receipts.',
                },
                true,
              )}
              {isNew &&
                textRow(
                  'code',
                  'code',
                  Hash,
                  'Code',
                  normaliseCode(draft.code) || 'Not set',
                  !draft.code.trim(),
                  {
                    placeholder: 'SUMMER10',
                    className: 'font-mono uppercase',
                    clean: normaliseCode,
                    hint: 'What customers type. More codes, or a batch of single-use ones, can be added once it’s created.',
                  },
                  true,
                )}
              <PickerRow
                icon={TicketPercent}
                title="Type"
                value={KIND_LABELS[draft.kind]}
                open={open === 'kind'}
                onToggle={() => toggle('kind')}
              >
                <ChoiceCards<PromotionKind> value={draft.kind} onChange={(kind) => patch({ kind })} options={KINDS} appearance="settings" />
              </PickerRow>
              {amountOff &&
                textRow(
                  'value',
                  'value',
                  draft.kind === 'percentage' ? Tag : Coins,
                  draft.kind === 'percentage' ? 'Percentage off' : 'Amount off',
                  offerAmountLabel(draft, symbol),
                  !draft.value.trim(),
                  {
                    inputMode: 'decimal',
                    placeholder: draft.kind === 'percentage' ? '10' : '5.00',
                    leftIcon: draft.kind === 'fixed_amount' ? currency : undefined,
                    rightIcon: draft.kind === 'percentage' ? <span className="text-sm text-muted-foreground">%</span> : undefined,
                    hint: draft.kind === 'percentage' ? 'Up to 100.' : 'Never more than the order itself.',
                  },
                  true,
                )}
              {draft.kind === 'percentage' &&
                textRow(
                  'maxDiscount',
                  'maxDiscount',
                  Coins,
                  'Most it takes off',
                  moneyLabel(draft.maxDiscount, symbol, 'No cap'),
                  !draft.maxDiscount.trim(),
                  {
                    inputMode: 'decimal',
                    placeholder: 'No cap',
                    leftIcon: currency,
                    hint: 'Caps the percentage on a big order. Leave empty for no cap.',
                  },
                )}
              {amountOff && (
                <PickerRow
                  icon={ShoppingBag}
                  title="Applies to"
                  value={draft.appliesTo === 'order' ? 'Whole order' : 'Some items'}
                  open={open === 'appliesTo'}
                  onToggle={() => toggle('appliesTo')}
                >
                  <ChoiceCards<PromotionDraft['appliesTo']>
                    value={draft.appliesTo}
                    onChange={(appliesTo) => patch({ appliesTo })}
                    options={[
                      { value: 'order', label: 'Whole order' },
                      { value: 'items', label: 'Some items' },
                    ]}
                    appearance="settings"
                  />
                </PickerRow>
              )}
              {needsItems && (
                <PickerRow
                  icon={ListChecks}
                  title={draft.kind === 'free_item' ? 'Items that can be free' : 'Which items'}
                  value={itemsChosenLabel(draft.categoryIds, draft.menuItemIds)}
                  muted={!draft.categoryIds.length && !draft.menuItemIds.length && !problemOf('menuItemIds')}
                  tone={
                    problemOf('menuItemIds') ? 'danger' : !draft.categoryIds.length && !draft.menuItemIds.length ? 'warning' : undefined
                  }
                  open={open === 'items'}
                  onToggle={() => toggle('items')}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MultiSelect
                      value={draft.categoryIds}
                      onChange={(categoryIds) => patch({ categoryIds })}
                      options={categoryOptions}
                      placeholder="No categories"
                      ariaLabel="Categories"
                    />
                    <MultiSelect
                      value={draft.menuItemIds}
                      onChange={(menuItemIds) => patch({ menuItemIds })}
                      options={itemOptions}
                      placeholder="No single items"
                      ariaLabel="Items"
                    />
                  </div>
                  <p className={cn('mt-1.5 text-xs', problemOf('menuItemIds') ? 'text-exception' : 'text-muted-foreground')}>
                    {problemOf('menuItemIds') ??
                      (draft.kind === 'free_item' ? 'The cheapest one in the order is free.' : 'Anything in a chosen category counts.')}
                  </p>
                </PickerRow>
              )}
            </fieldset>
            {draft.kind === 'free_delivery' && (
              <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                Takes the delivery fee off a website order. The till has no delivery, so the code can’t be used there.
              </p>
            )}
          </SettingsSection>

          <SettingsSection title="Who qualifies">
            <fieldset disabled={readOnly} className="min-w-0 space-y-3">
              {textRow(
                'minSubtotal',
                'minSubtotal',
                ShoppingBag,
                'Minimum spend',
                moneyLabel(draft.minSubtotal, symbol),
                !draft.minSubtotal.trim(),
                {
                  inputMode: 'decimal',
                  placeholder: 'None',
                  leftIcon: currency,
                  hint: 'Counted on the whole basket.',
                },
              )}
              <ScopeRow
                icon={MapPin}
                title="Locations"
                everyLabel="Every location"
                value={draft.locationIds}
                onChange={(locationIds) => patch({ locationIds })}
                options={locationOptions}
                error={problemOf('locationIds')}
                open={open === 'locations'}
                onToggle={() => toggle('locations')}
              />
              <ScopeRow
                icon={Monitor}
                title="Where it can be used"
                everyLabel="Everywhere"
                value={draft.channels}
                onChange={(channels) => patch({ channels: channels as PromotionChannel[] | null })}
                options={CHANNEL_OPTIONS}
                error={problemOf('channels')}
                open={open === 'channels'}
                onToggle={() => toggle('channels')}
              />
              <InfoRow icon={Users} title="First order only">
                <Switch label="First order only" checked={draft.firstOrderOnly} onChange={(firstOrderOnly) => patch({ firstOrderOnly })} />
              </InfoRow>
              <InfoRow icon={Sparkles} title="Works with loyalty rewards">
                <Switch
                  label="Works with loyalty rewards"
                  checked={draft.combinesWithLoyalty}
                  onChange={(combinesWithLoyalty) => patch({ combinesWithLoyalty })}
                />
              </InfoRow>
            </fieldset>
            {!draft.combinesWithLoyalty && (
              <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                An order can use the code or a loyalty reward, not both.
              </p>
            )}
          </SettingsSection>

          <SettingsSection title="How often">
            <fieldset disabled={readOnly} className="min-w-0 space-y-3">
              {textRow(
                'maxRedemptions',
                'maxRedemptions',
                Repeat,
                'Total uses',
                usesLimitLabel(draft.maxRedemptions),
                !draft.maxRedemptions.trim(),
                {
                  inputMode: 'numeric',
                  placeholder: 'Unlimited',
                  clean: digitsOnly,
                  hint: 'Across every code and customer. Leave empty for no limit.',
                },
              )}
              {textRow(
                'perCustomer',
                'maxRedemptionsPerCustomer',
                UserRound,
                'Uses per customer',
                perCustomerLabel(draft.maxRedemptionsPerCustomer),
                !draft.maxRedemptionsPerCustomer.trim(),
                {
                  inputMode: 'numeric',
                  placeholder: 'Unlimited',
                  clean: digitsOnly,
                  hint: 'Leave empty for no limit.',
                },
              )}
            </fieldset>
            {(draft.firstOrderOnly || draft.maxRedemptionsPerCustomer.trim()) && (
              <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                Per-customer limits and first order only need a customer on the sale — the till asks for one when the code is entered.
              </p>
            )}
          </SettingsSection>

          <SettingsSection title="When">
            <fieldset disabled={readOnly} className="min-w-0 space-y-3">
              <PickerRow
                icon={Calendar}
                title="Starts"
                value={formatDateTime(draft.startsAt, 'Straight away')}
                muted={!draft.startsAt}
                open={open === 'startsAt'}
                onToggle={() => toggle('startsAt')}
              >
                <DateTimeField
                  label="Starts"
                  value={draft.startsAt}
                  onChange={(startsAt) => patch({ startsAt })}
                  hint="Leave empty to start as soon as it’s live."
                />
              </PickerRow>
              <PickerRow
                icon={CalendarClock}
                title="Ends"
                value={formatDateTime(draft.endsAt, 'Until you stop it')}
                muted={!draft.endsAt}
                tone={problemOf('endsAt') ? 'danger' : undefined}
                open={open === 'endsAt'}
                onToggle={() => toggle('endsAt')}
              >
                <DateTimeField
                  label="Ends"
                  value={draft.endsAt}
                  onChange={(endsAt) => patch({ endsAt })}
                  error={problemOf('endsAt')}
                  hint="Leave empty to run until you pause or archive it."
                />
              </PickerRow>
              {isNew && (
                <InfoRow icon={Play} title="Live as soon as it’s created">
                  <Switch
                    label="Live as soon as it’s created"
                    checked={draft.status === 'active'}
                    onChange={(live) => patch({ status: live ? 'active' : 'paused' })}
                  />
                </InfoRow>
              )}
            </fieldset>
          </SettingsSection>

          {editable && (
            <SaveBar
              dirty={dirty || isNew}
              saving={save.isPending}
              saveLabel={isNew ? 'Create promotion' : 'Save changes'}
              message={`${isNew ? 'Not created yet' : 'Unsaved changes'} · ${saveShortcut} ${isNew ? 'creates' : 'saves'}`}
              onSave={attemptSave}
              onDiscard={isNew ? onClose : () => setDraft(initial)}
            />
          )}
        </SettingsTabBody>
      </motion.div>

      {archiving && promotion && (
        <ConfirmModal
          title="Archive this promotion?"
          message={`Its ${promotion.codes.length === 1 ? 'code stops' : 'codes stop'} working at the till straight away. Its uses stay on record, and you can restore it later.`}
          confirmLabel="Archive"
          pendingLabel="Archiving…"
          isPending={setStatus.isPending}
          onConfirm={() => setStatus.mutate('archived')}
          onClose={() => setArchiving(false)}
        />
      )}
    </EditorShell>
  );
}

/** "10% off everything", "£5 off pastries", "A free item from coffee". */
function offerSentence(fields: ReturnType<typeof draftToFields>, symbol: string) {
  if (fields.kind === 'free_delivery') return 'Free delivery';
  const amount =
    fields.kind === 'free_item'
      ? 'A free item'
      : fields.kind === 'percentage'
        ? `${fields.value ?? '…'}% off${fields.maxDiscount ? ` (up to ${symbol}${Number(fields.maxDiscount).toFixed(2)})` : ''}`
        : `${symbol}${fields.value ? Number(fields.value).toFixed(2) : '…'} off`;
  const scope = fields.kind === 'free_item' || fields.appliesTo === 'items' ? ' selected items' : ' the whole order';
  return fields.kind === 'free_item' ? amount : `${amount}${scope}`;
}

/** Locations or channels: the row says which; open, "Every …" as a switch and, off, a pick-list. */
function ScopeRow({
  icon,
  title,
  everyLabel,
  value,
  onChange,
  options,
  error,
  open,
  onToggle,
}: {
  icon: IconComponent;
  title: string;
  everyLabel: string;
  value: string[] | null;
  onChange: (value: string[] | null) => void;
  options: { value: string; label: string }[];
  error?: string | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <PickerRow
      icon={icon}
      title={title}
      value={scopeLabel(value, options, everyLabel)}
      tone={error ? 'danger' : value?.length === 0 ? 'warning' : undefined}
      open={open}
      onToggle={onToggle}
    >
      <label className="flex items-center justify-between gap-3 text-sm text-foreground">
        {everyLabel}
        <Switch label={everyLabel} checked={value === null} onChange={(every) => onChange(every ? null : [])} />
      </label>
      {value !== null && (
        <div className="mt-2">
          <MultiSelect value={value} onChange={onChange} options={options} placeholder="Choose…" ariaLabel={title} />
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-exception">{error}</p>}
    </PickerRow>
  );
}

/** How much it has been used, and the latest uses. */
function UsageSection({ promotion }: { promotion: PromotionDetail }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const formatMoney = useFormatMoney();
  const [page, setPage] = useState(1);
  const uses = useQuery({
    queryKey: moduleQueryKeys.promotions.key('redemptions', promotion.id, page, tenantId),
    queryFn: () => getPromotionRedemptions(promotion.id, page, tenantId),
  });
  const total = uses.data?.pagination.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (uses.data?.pagination.limit ?? 50)));
  return (
    <SettingsSection
      title="Usage"
      actions={<SectionInfo label="Cancelled and fully refunded orders give their use back — they stay listed, marked returned." />}
    >
      <div className="space-y-4">
        <InfoRows>
          <InfoRow icon={Users} title="Used">
            <span className="text-sm tabular-nums text-muted-foreground">{usageLabel(promotion)}</span>
          </InfoRow>
          <InfoRow icon={TicketPercent} title="Discount given">
            <span className="text-sm tabular-nums text-muted-foreground">{formatMoney(Number(promotion.discountTotal), 2)}</span>
          </InfoRow>
        </InfoRows>
        {uses.isPending ? (
          <Bone className="h-24 w-full rounded-md" />
        ) : uses.isError ? (
          <ErrorState className="py-6" title="Couldn’t load the uses" description="" onRetry={() => void uses.refetch()} />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">No one has used it yet. Each use appears here, with who and when.</p>
        ) : (
          <div>
            <ul className="space-y-2.5">
              {uses.data.data.map((use) => (
                <li key={use.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block truncate font-medium',
                        use.status === 'reversed' ? 'text-muted-foreground line-through' : 'text-foreground',
                      )}
                    >
                      {use.customerName ?? 'Walk-in'}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className="font-mono">{use.code}</span> · <RelativeTime iso={use.createdAt} />
                      {use.status === 'reversed' && ' · returned'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">−{formatMoney(Number(use.amount), 2)}</span>
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Newer
                </Button>
                <span className="tabular-nums">
                  {page} of {pages}
                </span>
                <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
                  Older
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

/** The codes people type: copy, switch off, add one, or generate a batch of single-use ones. */
function CodesSection({
  promotion,
  editable,
  onChanged,
}: {
  promotion: PromotionDetail;
  editable: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const [adding, setAdding] = useState<'code' | 'batch' | null>(null);
  const [code, setCode] = useState('');
  const [count, setCount] = useState('50');
  const [prefix, setPrefix] = useState('');

  const add = useMutation({
    mutationFn: () =>
      adding === 'batch'
        ? generatePromotionCodes(promotion.id, { generate: Number(count), prefix: prefix.trim() || undefined, maxRedemptions: 1 }, tenantId)
        : addPromotionCode(promotion.id, { code: normaliseCode(code) }, tenantId),
    onSuccess: async (created) => {
      await onChanged();
      toast('success', created.length === 1 ? `Code ${created[0]!.code} added.` : `${created.length} single-use codes generated.`);
      setAdding(null);
      setCode('');
    },
    onError: (error) => toast('error', error.message),
  });
  const toggle = useMutation({
    mutationFn: (target: PromotionCode) => setPromotionCodeActive(promotion.id, target.id, !target.isActive, tenantId),
    onSuccess: async () => {
      await onChanged();
    },
    onError: (error) => toast('error', error.message),
  });

  const download = () => {
    const blob = new Blob([codesCsv(promotion.codes)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${promotion.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'promotion'}-codes.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const shown = promotion.codes.slice(0, 8);
  const batchValid = /^\d+$/.test(count) && Number(count) >= 1 && Number(count) <= 1000;

  return (
    <SettingsSection
      title="Codes"
      actions={
        promotion.codes.length > 1 ? (
          <Tooltip side="top" align="end" label="Download every code as a CSV">
            <Button variant="ghost" size="icon-sm" aria-label="Download codes" onClick={download}>
              <Download aria-hidden="true" />
            </Button>
          </Tooltip>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {promotion.codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No codes yet — add one so it can be used.</p>
        ) : (
          <ul className="space-y-3">
            {shown.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <RowTile icon={Hash} />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block truncate font-mono text-sm font-semibold',
                        item.isActive ? 'text-foreground' : 'text-muted-foreground line-through',
                      )}
                    >
                      {item.code}
                    </span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {item.maxRedemptions === 1
                        ? item.redemptionCount
                          ? 'Used'
                          : 'Single use'
                        : `${item.redemptionCount} ${item.redemptionCount === 1 ? 'use' : 'uses'}${item.maxRedemptions ? ` of ${item.maxRedemptions}` : ''}`}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <CopyButton
                    iconOnly
                    size="icon-sm"
                    variant="ghost"
                    label={`Copy ${item.code}`}
                    copiedLabel="Copied"
                    onCopy={async () => {
                      const copied = await copyText(item.code);
                      if (!copied) toast('error', 'Copy failed — select the code instead.');
                      return copied;
                    }}
                  />
                  {editable && (
                    <Switch
                      label={`${item.code} ${item.isActive ? 'on' : 'off'}`}
                      checked={item.isActive}
                      disabled={toggle.isPending}
                      onChange={() => toggle.mutate(item)}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {promotion.codes.length > shown.length && (
          <p className="text-xs text-muted-foreground">
            And {promotion.codes.length - shown.length} more —{' '}
            <button type="button" className="font-medium text-foreground underline" onClick={download}>
              download them all
            </button>
            .
          </p>
        )}

        {editable && adding === null && (
          <ActionRows>
            <ActionRow icon={Plus} label="Add a code" onClick={() => setAdding('code')} />
            <ActionRow icon={Sparkles} label="Generate a single-use batch" onClick={() => setAdding('batch')} />
          </ActionRows>
        )}
        {editable && adding === 'code' && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (/^[A-Z0-9-]{3,50}$/.test(normaliseCode(code))) add.mutate();
            }}
          >
            <Input
              aria-label="New code"
              value={code}
              onChange={(event) => setCode(normaliseCode(event.target.value))}
              placeholder="AUTUMN15"
              className="font-mono uppercase"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={add.isPending || !/^[A-Z0-9-]{3,50}$/.test(normaliseCode(code))}>
                {add.isPending ? 'Adding…' : 'Add code'}
              </Button>
            </div>
          </form>
        )}
        {editable && adding === 'batch' && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (batchValid) add.mutate();
            }}
          >
            <p className="text-xs text-muted-foreground">Random codes that each work once — for vouchers, flyers or a mailing list.</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="How many"
                inputMode="numeric"
                value={count}
                onChange={(event) => setCount(event.target.value.replace(/\D/g, ''))}
              />
              <Input
                label="Prefix (optional)"
                value={prefix}
                onChange={(event) => setPrefix(normaliseCode(event.target.value).slice(0, 12))}
                placeholder="VIP"
                className="font-mono uppercase"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={add.isPending || !batchValid}>
                {add.isPending ? 'Generating…' : `Generate ${batchValid ? count : ''}`}
              </Button>
            </div>
          </form>
        )}
      </div>
    </SettingsSection>
  );
}
