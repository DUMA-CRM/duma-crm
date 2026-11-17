'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { DateTimeField } from '@/components/cms/DateTimeField';
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
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ChangeRow, SaveBar, Switch, ValueMissing } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
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

/** The fields each row edits — what its Cancel puts back. */
const FIELDS_OF: Record<Row, (keyof PromotionDraft)[]> = {
  name: ['name'],
  code: ['code'],
  kind: ['kind'],
  value: ['value'],
  maxDiscount: ['maxDiscount'],
  appliesTo: ['appliesTo'],
  items: ['categoryIds', 'menuItemIds'],
  minSubtotal: ['minSubtotal'],
  locations: ['locationIds'],
  channels: ['channels'],
  maxRedemptions: ['maxRedemptions'],
  perCustomer: ['maxRedemptionsPerCustomer'],
  startsAt: ['startsAt'],
  endsAt: ['endsAt'],
};

/**
 * One promotion, full page, in the Settings → Account layout: the rule as a
 * bento of Offer · How often | Who qualifies · When, each value a row whose
 * Change opens its control; its codes and uses as lists under it; the receipt
 * line it prints as a live preview in the rail. New promotions get their first
 * code here; more come from Codes once it exists.
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
        <EditorSkeleton />
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
  const formatMoney = useFormatMoney();
  const isNew = promotion === null;
  const initial = useMemo(() => (promotion ? draftFromPromotion(promotion) : emptyPromotionDraft()), [promotion]);
  const [draft, setDraft] = useState<PromotionDraft>(initial);
  const [showProblems, setShowProblems] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // One row open at a time. A new promotion starts on its name.
  const [open, setOpen] = useState<Row | null>(isNew ? 'name' : null);
  // The draft as it was when the open row opened, so its Cancel can put that row back.
  const [before, setBefore] = useState<PromotionDraft>(initial);
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

  const openRow = (row: Row | null) => {
    setBefore(draft);
    setOpen(row);
  };
  const attemptSave = () => {
    const fields = Object.keys(problems) as (keyof PromotionDraft)[];
    if (fields.length) {
      setShowProblems(true);
      // Open the first row with a problem, so the fix is under the eye.
      openRow(ROW_OF[fields[0]!] ?? null);
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

  /** Change opens a row; Cancel closes it and puts its fields back as they were when it opened. */
  const toggle = (row: Row) => {
    if (open === row) {
      patch(Object.fromEntries(FIELDS_OF[row].map((field) => [field, before[field]])) as Partial<PromotionDraft>);
      setOpen(null);
      return;
    }
    openRow(row);
  };
  const onToggle = (row: Row) => (readOnly ? undefined : () => toggle(row));
  /** Enter in a row's field closes it, keeping what was typed. */
  const closeOnEnter = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      setOpen(null);
    }
  };
  /** The row's tile: red for a problem the save found, amber for something required still empty. */
  const toneOf = (field: keyof PromotionDraft, required = false) =>
    problemOf(field) ? ('danger' as const) : required && !String(draft[field]).trim() ? ('warning' as const) : undefined;
  const shown = (text: string, missing: boolean) =>
    missing ? <ValueMissing>{text}</ValueMissing> : <span className="truncate">{text}</span>;
  const textRow = (
    row: Row,
    field: 'name' | 'code' | 'value' | 'maxDiscount' | 'minSubtotal' | 'maxRedemptions' | 'maxRedemptionsPerCustomer',
    icon: IconComponent,
    label: string,
    value: string,
    missing: boolean,
    control: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & { clean?: (raw: string) => string },
    required = false,
  ) => {
    const { clean, ...input } = control;
    return (
      <ChangeRow
        icon={icon}
        label={label}
        value={shown(value, missing)}
        tone={toneOf(field, required)}
        open={open === row}
        onToggle={onToggle(row)}
      >
        <Input
          aria-label={label}
          value={draft[field]}
          onChange={(event) => patch({ [field]: clean ? clean(event.target.value) : event.target.value })}
          onKeyDown={closeOnEnter}
          error={problemOf(field)}
          autoFocus
          {...input}
        />
      </ChangeRow>
    );
  };
  const currency = <span className="text-sm text-muted-foreground">{symbol}</span>;
  const digitsOnly = (raw: string) => raw.replace(/\D/g, '');

  const offer = (
    <RecordGroup
      card
      id="promotion-offer"
      title="Offer"
      footnote={
        promotion?.status === 'archived'
          ? 'Archived: its codes no longer work and it can’t be edited. Restore it to use it again.'
          : draft.kind === 'free_delivery'
            ? 'Takes the delivery fee off a website order. The till has no delivery, so the code can’t be used there.'
            : undefined
      }
    >
      <fieldset disabled={readOnly} className="min-w-0">
        {textRow(
          'name',
          'name',
          Type,
          'Name',
          draft.name.trim() || 'Not named',
          !draft.name.trim(),
          { placeholder: 'Summer 10% off' },
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
              hint: 'More codes, or a batch of single-use ones, can be added once it’s created.',
            },
            true,
          )}
        <ChangeRow icon={TicketPercent} label="Type" value={KIND_LABELS[draft.kind]} open={open === 'kind'} onToggle={onToggle('kind')}>
          <ChoiceCards<PromotionKind> value={draft.kind} onChange={(kind) => patch({ kind })} options={KINDS} appearance="settings" />
        </ChangeRow>
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
          <ChangeRow
            icon={ShoppingBag}
            label="Applies to"
            value={draft.appliesTo === 'order' ? 'Whole order' : 'Some items'}
            open={open === 'appliesTo'}
            onToggle={onToggle('appliesTo')}
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
          </ChangeRow>
        )}
        {needsItems && (
          <ChangeRow
            icon={ListChecks}
            label={draft.kind === 'free_item' ? 'Items that can be free' : 'Which items'}
            value={shown(itemsChosenLabel(draft.categoryIds, draft.menuItemIds), !draft.categoryIds.length && !draft.menuItemIds.length)}
            tone={problemOf('menuItemIds') ? 'danger' : !draft.categoryIds.length && !draft.menuItemIds.length ? 'warning' : undefined}
            open={open === 'items'}
            onToggle={onToggle('items')}
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
            <Hint error={problemOf('menuItemIds')}>
              {draft.kind === 'free_item' ? 'The cheapest one in the order is free.' : 'Anything in a chosen category counts.'}
            </Hint>
          </ChangeRow>
        )}
      </fieldset>
    </RecordGroup>
  );

  const whoQualifies = (
    <RecordGroup
      card
      id="promotion-who-qualifies"
      title="Who qualifies"
      footnote={draft.combinesWithLoyalty ? undefined : 'An order can use the code or a loyalty reward, not both.'}
    >
      <fieldset disabled={readOnly} className="min-w-0">
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
          label="Locations"
          everyLabel="Every location"
          value={draft.locationIds}
          onChange={(locationIds) => patch({ locationIds })}
          options={locationOptions}
          error={problemOf('locationIds')}
          open={open === 'locations'}
          onToggle={onToggle('locations')}
        />
        <ScopeRow
          icon={Monitor}
          label="Where it can be used"
          everyLabel="Everywhere"
          value={draft.channels}
          onChange={(channels) => patch({ channels: channels as PromotionChannel[] | null })}
          options={CHANNEL_OPTIONS}
          error={problemOf('channels')}
          open={open === 'channels'}
          onToggle={onToggle('channels')}
        />
        <ChangeRow
          icon={Users}
          label="First order"
          value={draft.firstOrderOnly ? 'Only a customer’s first order' : <ValueMissing>Any order</ValueMissing>}
          trailing={
            <Switch label="First order only" checked={draft.firstOrderOnly} onChange={(firstOrderOnly) => patch({ firstOrderOnly })} />
          }
        />
        <ChangeRow
          icon={Sparkles}
          label="Loyalty rewards"
          value={draft.combinesWithLoyalty ? 'Works with them' : <ValueMissing>Not with a reward</ValueMissing>}
          trailing={
            <Switch
              label="Works with loyalty rewards"
              checked={draft.combinesWithLoyalty}
              onChange={(combinesWithLoyalty) => patch({ combinesWithLoyalty })}
            />
          }
        />
      </fieldset>
    </RecordGroup>
  );

  const needsCustomer = draft.firstOrderOnly || Boolean(draft.maxRedemptionsPerCustomer.trim());
  const howOften = (
    <RecordGroup
      card
      id="promotion-how-often"
      title="How often"
      footnote={
        needsCustomer
          ? 'Per-customer limits and first order only need a customer on the sale — the till asks for one when the code is entered.'
          : undefined
      }
    >
      <fieldset disabled={readOnly} className="min-w-0">
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
            hint: 'Across every code and customer. Two tills can’t both take the last one.',
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
    </RecordGroup>
  );

  const when = (
    <RecordGroup card id="promotion-when" title="When">
      <fieldset disabled={readOnly} className="min-w-0">
        <ChangeRow
          icon={Calendar}
          label="Starts"
          value={shown(formatDateTime(draft.startsAt, 'Straight away'), !draft.startsAt)}
          open={open === 'startsAt'}
          onToggle={onToggle('startsAt')}
        >
          <DateTimeField
            label="Starts"
            value={draft.startsAt}
            onChange={(startsAt) => patch({ startsAt })}
            hint="Leave empty to start as soon as it’s live."
          />
        </ChangeRow>
        <ChangeRow
          icon={CalendarClock}
          label="Ends"
          value={shown(formatDateTime(draft.endsAt, 'Until you stop it'), !draft.endsAt)}
          tone={problemOf('endsAt') ? 'danger' : undefined}
          open={open === 'endsAt'}
          onToggle={onToggle('endsAt')}
        >
          <DateTimeField
            label="Ends"
            value={draft.endsAt}
            onChange={(endsAt) => patch({ endsAt })}
            error={problemOf('endsAt')}
            hint="Leave empty to run until you pause or archive it."
          />
        </ChangeRow>
        {isNew && (
          <ChangeRow
            icon={Play}
            label="Once created"
            value={draft.status === 'active' ? 'Live straight away' : <ValueMissing>Paused until you make it live</ValueMissing>}
            trailing={
              <Switch
                label="Live as soon as it’s created"
                checked={draft.status === 'active'}
                onChange={(live) => patch({ status: live ? 'active' : 'paused' })}
              />
            }
          />
        )}
      </fieldset>
    </RecordGroup>
  );

  const statusActions =
    editable && promotion ? (
      <>
        {promotion.status === 'active' && (
          <Button variant="outline" className="h-9 gap-1.5" disabled={setStatus.isPending} onClick={() => setStatus.mutate('paused')}>
            <Pause size={15} aria-hidden="true" />
            Pause
          </Button>
        )}
        {promotion.status === 'paused' && (
          <Button variant="outline" className="h-9 gap-1.5" disabled={setStatus.isPending} onClick={() => setStatus.mutate('active')}>
            <Play size={15} aria-hidden="true" />
            Make live
          </Button>
        )}
        {promotion.status === 'archived' ? (
          <Button variant="outline" className="h-9 gap-1.5" disabled={setStatus.isPending} onClick={() => setStatus.mutate('paused')}>
            <RotateCcw size={15} aria-hidden="true" />
            Restore, paused
          </Button>
        ) : (
          <Button variant="outline" className="h-9 gap-1.5" disabled={setStatus.isPending} onClick={() => setArchiving(true)}>
            <Archive size={15} aria-hidden="true" />
            Archive
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <EditorShell
      eyebrow="Promotion"
      title={draft.name.trim() || (isNew ? 'New promotion' : 'Promotion')}
      icon={<TicketPercent size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      actions={statusActions}
      meta={
        promotion ? (
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {standing && <Badge variant={STANDING_BADGE[standing]}>{STANDING_LABELS[standing]}</Badge>}
            <span className="tabular-nums">
              {usageLabel(promotion)} · {formatMoney(Number(promotion.discountTotal), 2)} given
            </span>
          </span>
        ) : undefined
      }
    >
      <motion.div
        className="w-full"
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
      >
        <SettingsTabBody>
          {/* Two stacked columns, not paired rows: a short card never leaves a gap beside a tall one. */}
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-5">
              {offer}
              {howOften}
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              {whoQualifies}
              {when}
            </div>
          </div>

          {promotion && (
            <CodesSection promotion={promotion} editable={editable && promotion.status !== 'archived'} onChanged={invalidate} />
          )}
          {promotion && <UsageSection promotion={promotion} />}

          {editable && (
            <SaveBar
              dirty={dirty || isNew}
              saving={save.isPending}
              saveLabel={isNew ? 'Create promotion' : 'Save changes'}
              message={`${isNew ? 'Not created yet' : 'Unsaved changes'} · ${saveShortcut} ${isNew ? 'creates' : 'saves'}`}
              onSave={attemptSave}
              onDiscard={
                isNew
                  ? onClose
                  : () => {
                      setDraft(initial);
                      setOpen(null);
                    }
              }
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

/** The line under an open row's control: why it matters, or what's wrong with it. */
function Hint({ error, children }: { error?: string | undefined; children: React.ReactNode }) {
  return <p className={cn('mt-1.5 text-xs', error ? 'text-exception' : 'text-muted-foreground')}>{error ?? children}</p>;
}

/** The editor without its words: the four sections as two columns, the receipt beside them. */
function EditorSkeleton() {
  const section = (rows: number) => (
    <div className="space-y-2">
      <Bone className="h-4 w-24" />
      <div className="space-y-5 rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Bone className="size-10 shrink-0" />
            <span className="min-w-0 flex-1 space-y-1.5">
              <Bone className="h-2.5 w-20" />
              <Bone className="h-3.5 w-40 max-w-full" />
            </span>
            <Bone className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div role="status" aria-label="Loading promotion">
      <SettingsTabBody>
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-5">
            {section(4)}
            {section(2)}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {section(5)}
            {section(2)}
          </div>
        </div>
      </SettingsTabBody>
    </div>
  );
}

/** Locations or channels: the row says which; open, "Every …" as a switch and, off, a pick-list. */
function ScopeRow({
  icon,
  label,
  everyLabel,
  value,
  onChange,
  options,
  error,
  open,
  onToggle,
}: {
  icon: IconComponent;
  label: string;
  everyLabel: string;
  value: string[] | null;
  onChange: (value: string[] | null) => void;
  options: { value: string; label: string }[];
  error?: string | undefined;
  open: boolean;
  onToggle: (() => void) | undefined;
}) {
  return (
    <ChangeRow
      icon={icon}
      label={label}
      value={
        value === null ? (
          everyLabel
        ) : value.length === 0 ? (
          <ValueMissing>None chosen</ValueMissing>
        ) : (
          <span className="truncate">{scopeLabel(value, options, everyLabel)}</span>
        )
      }
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
          <MultiSelect value={value} onChange={onChange} options={options} placeholder="Choose…" ariaLabel={label} />
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-exception">{error}</p>}
    </ChangeRow>
  );
}

/** Every use, newest first, paged as the API pages them. */
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
  const listed = uses.isSuccess && total > 0;
  return (
    <RecordGroup
      id="promotion-usage"
      title="Usage"
      card={!uses.isPending && !listed}
      footnote="Cancelled and fully refunded orders give their use back — they stay listed, marked returned."
    >
      {uses.isPending ? (
        <ListSkeleton rows={3} label="Loading uses" />
      ) : uses.isError ? (
        <ErrorState className="py-6" title="Couldn’t load the uses" description="" onRetry={() => void uses.refetch()} />
      ) : total === 0 ? (
        <EmptyState compact icon={Users} title="No uses yet" description="Each use appears here, with who and when." />
      ) : (
        <>
          <ListRowGroup aria-label="Uses">
            {uses.data.data.map((use) => (
              <ListRow
                key={use.id}
                icon={UserRound}
                muted={use.status === 'reversed'}
                title={use.customerName ?? 'Walk-in'}
                meta={
                  <>
                    <span className="font-mono">{use.code}</span> · <RelativeTime iso={use.createdAt} />
                    {use.status === 'reversed' && ' · returned'}
                  </>
                }
                trailing={
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      use.status === 'reversed' ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}
                  >
                    −{formatMoney(Number(use.amount), 2)}
                  </span>
                }
              />
            ))}
          </ListRowGroup>
          {pages > 1 && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
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
        </>
      )}
    </RecordGroup>
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
  const codeValid = /^[A-Z0-9-]{3,50}$/.test(normaliseCode(code));

  return (
    <RecordGroup
      id="promotion-codes"
      title="Codes"
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          {promotion.codes.length > 1 && (
            <Button variant="outline" size="sm" onClick={download} aria-label="Download every code as a CSV">
              <Download aria-hidden="true" />
              CSV
            </Button>
          )}
          {editable && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAdding('code')} aria-pressed={adding === 'code'}>
                <Plus aria-hidden="true" />
                Add code
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAdding('batch')} aria-pressed={adding === 'batch'}>
                <Sparkles aria-hidden="true" />
                Single-use batch
              </Button>
            </>
          )}
        </div>
      }
      footnote={
        promotion.codes.length > shown.length ? (
          <>
            And {promotion.codes.length - shown.length} more —{' '}
            <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={download}>
              download them all
            </button>
            .
          </>
        ) : undefined
      }
    >
      <ListRowGroup aria-label="Codes">
        {editable && adding === 'code' && (
          <li className="border-b border-border px-3.5 py-3 last:border-b-0">
            <form
              className="flex flex-wrap items-start gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (codeValid) add.mutate();
              }}
            >
              <div className="min-w-48 flex-1">
                <Input
                  aria-label="New code"
                  value={code}
                  onChange={(event) => setCode(normaliseCode(event.target.value))}
                  placeholder="AUTUMN15"
                  className="font-mono uppercase"
                  autoFocus
                />
              </div>
              <Button type="button" variant="ghost" onClick={() => setAdding(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={add.isPending || !codeValid}>
                {add.isPending ? 'Adding…' : 'Add code'}
              </Button>
            </form>
          </li>
        )}
        {editable && adding === 'batch' && (
          <li className="border-b border-border px-3.5 py-3 last:border-b-0">
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (batchValid) add.mutate();
              }}
            >
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
              <p className="text-xs text-muted-foreground">Random codes that each work once — for vouchers, flyers or a mailing list.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAdding(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={add.isPending || !batchValid}>
                  {add.isPending ? 'Generating…' : `Generate ${batchValid ? count : ''}`}
                </Button>
              </div>
            </form>
          </li>
        )}
        {promotion.codes.length === 0 && adding === null && (
          <li className="px-3.5 py-4 text-sm text-muted-foreground">No codes yet — add one so it can be used.</li>
        )}
        {shown.map((item) => (
          <ListRow
            key={item.id}
            icon={Hash}
            muted={!item.isActive}
            title={<span className="font-mono">{item.code}</span>}
            meta={
              <>
                {item.maxRedemptions === 1
                  ? item.redemptionCount
                    ? 'Used'
                    : 'Single use'
                  : `${item.redemptionCount} ${item.redemptionCount === 1 ? 'use' : 'uses'}${item.maxRedemptions ? ` of ${item.maxRedemptions}` : ''}`}
                {!item.isActive && ' · switched off'}
              </>
            }
            control={
              <span className="flex items-center gap-1.5">
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
            }
          />
        ))}
      </ListRowGroup>
    </RecordGroup>
  );
}
