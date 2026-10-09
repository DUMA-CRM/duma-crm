'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { DateTimeField } from '@/components/cms/DateTimeField';
import { ActionRow, ActionRows, FieldRow, InfoRow, InfoRows, RowTile, SectionInfo } from '@/components/cms/rows';
import { copyText } from '@/components/cms/shared';
import {
  Archive,
  Calendar,
  Download,
  Hash,
  MapPin,
  Monitor,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TicketPercent,
  Type,
  Users,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { LoadingState } from '@/components/shared/Skeleton';
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
import { cn } from '@/lib/utils/cn';
import {
  CHANNEL_LABELS,
  type PromotionChannel,
  type PromotionDraft,
  type PromotionKind,
  STANDING_LABELS,
  codesCsv,
  draftFromPromotion,
  draftToFields,
  emptyPromotionDraft,
  normaliseCode,
  promotionConditions,
  promotionDraftProblems,
  promotionStanding,
  usageLabel,
} from '@/lib/utils/promotions';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { STANDING_BADGE } from './PromotionsList';

const KINDS: { value: PromotionKind; label: string }[] = [
  { value: 'percentage', label: '% off' },
  { value: 'fixed_amount', label: 'Amount off' },
  { value: 'free_item', label: 'Free item' },
];
const CHANNEL_OPTIONS = (Object.keys(CHANNEL_LABELS) as PromotionChannel[]).map((value) => ({ value, label: CHANNEL_LABELS[value] }));

/** Sections rise in one after another, as in the Content editors. */
const STAGGER = { shown: { transition: { staggerChildren: 0.06 } } };

/**
 * One promotion, full page, in the Content editors' shape: the rule in the
 * main column (offer, conditions, limits, dates), and beside it what it reads
 * as, its codes, its uses and its actions. New promotions get their first code
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
        <LoadingState label="Loading the promotion" />
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
  const symbol = useCurrencySymbol();
  const isNew = promotion === null;
  const initial = useMemo(() => (promotion ? draftFromPromotion(promotion) : emptyPromotionDraft()), [promotion]);
  const [draft, setDraft] = useState<PromotionDraft>(initial);
  const [showProblems, setShowProblems] = useState(false);
  const [archiving, setArchiving] = useState(false);
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
    if (Object.keys(problems).length) {
      setShowProblems(true);
      toast('error', Object.values(problems)[0]!);
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

  return (
    <EditorShell
      eyebrow="Promotion"
      title={draft.name.trim() || (isNew ? 'New promotion' : 'Promotion')}
      icon={<TicketPercent size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      meta={
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {standing && <Badge variant={STANDING_BADGE[standing]}>{STANDING_LABELS[standing]}</Badge>}
          {promotion && <span className="tabular-nums">{usageLabel(promotion)}</span>}
          {(dirty || isNew) && editable && (
            <span className="inline-flex items-center gap-1 font-medium text-measured">
              <span className="size-1.5 rounded-full bg-measured" aria-hidden="true" />
              {isNew ? 'Not created yet' : 'Unsaved changes'}
            </span>
          )}
        </span>
      }
      actions={
        editable && (dirty || isNew) ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="h-9" disabled={save.isPending} onClick={isNew ? onClose : () => setDraft(initial)}>
              Discard
            </Button>
            <Tooltip side="top" align="end" label={`${isNew ? 'Create' : 'Save'} (${saveShortcut})`}>
              <Button className="h-9" disabled={save.isPending} onClick={attemptSave}>
                {save.isPending ? 'Saving…' : isNew ? 'Create promotion' : 'Save'}
              </Button>
            </Tooltip>
          </div>
        ) : undefined
      }
    >
      <motion.div initial="hidden" animate="shown" variants={STAGGER}>
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
              {promotion && editable && (
                <SettingsSection bodyClassName="py-3">
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
                      <ActionRow icon={Archive} label="Archive" danger disabled={setStatus.isPending} onClick={() => setArchiving(true)} />
                    )}
                  </ActionRows>
                </SettingsSection>
              )}
            </>
          }
        >
          {promotion?.status === 'archived' && (
            <p className="rounded-lg border border-rule/60 bg-band/60 px-4 py-3 text-sm text-muted-foreground">
              This promotion is archived: its codes no longer work and it can’t be edited. Restore it to use it again.
            </p>
          )}

          <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
            <SettingsSection title="Offer" description="What it takes off, and of what.">
              <div className="space-y-5">
                <FieldRow icon={Type} title="Name" htmlFor="promotion-name" note="Shown on receipts">
                  <Input
                    id="promotion-name"
                    value={draft.name}
                    onChange={(event) => patch({ name: event.target.value })}
                    placeholder="Summer 10% off"
                    error={problemOf('name')}
                    autoFocus={isNew}
                  />
                </FieldRow>
                {isNew && (
                  <FieldRow icon={Hash} title="Code" htmlFor="promotion-code" note="What customers type">
                    <Input
                      id="promotion-code"
                      value={draft.code}
                      onChange={(event) => patch({ code: normaliseCode(event.target.value) })}
                      placeholder="SUMMER10"
                      className="font-mono uppercase"
                      error={problemOf('code')}
                      hint="Letters, numbers and dashes. More codes — or a batch of single-use ones — can be added once it’s created."
                    />
                  </FieldRow>
                )}
                <FieldRow icon={TicketPercent} title="Type">
                  <SegmentedControl
                    options={KINDS}
                    value={draft.kind}
                    onChange={(kind) => patch({ kind })}
                    ariaLabel="Promotion type"
                    className="w-full [&>button]:flex-1"
                  />
                </FieldRow>
                {draft.kind !== 'free_item' && (
                  <div className={cn('grid gap-3', draft.kind === 'percentage' && 'sm:grid-cols-2')}>
                    <Input
                      label={draft.kind === 'percentage' ? 'Percentage off' : 'Amount off'}
                      inputMode="decimal"
                      value={draft.value}
                      onChange={(event) => patch({ value: event.target.value })}
                      placeholder={draft.kind === 'percentage' ? '10' : '5.00'}
                      leftIcon={draft.kind === 'fixed_amount' ? <span className="text-sm text-muted-foreground">{symbol}</span> : undefined}
                      rightIcon={draft.kind === 'percentage' ? <span className="text-sm text-muted-foreground">%</span> : undefined}
                      error={problemOf('value')}
                    />
                    {draft.kind === 'percentage' && (
                      <Input
                        label="Up to (optional)"
                        inputMode="decimal"
                        value={draft.maxDiscount}
                        onChange={(event) => patch({ maxDiscount: event.target.value })}
                        placeholder="No cap"
                        leftIcon={<span className="text-sm text-muted-foreground">{symbol}</span>}
                        error={problemOf('maxDiscount')}
                      />
                    )}
                  </div>
                )}
                {draft.kind !== 'free_item' && (
                  <FieldRow icon={ShoppingBag} title="Applies to">
                    <SegmentedControl
                      options={[
                        { value: 'order' as const, label: 'Whole order' },
                        { value: 'items' as const, label: 'Some items' },
                      ]}
                      value={draft.appliesTo}
                      onChange={(appliesTo) => patch({ appliesTo })}
                      ariaLabel="Applies to"
                      className="w-full [&>button]:flex-1"
                    />
                  </FieldRow>
                )}
                {(draft.kind === 'free_item' || draft.appliesTo === 'items') && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {draft.kind === 'free_item'
                        ? 'Which items can be free — the cheapest one in the order is.'
                        : 'Which items it takes off. Anything in a chosen category counts.'}
                    </p>
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
                    {problemOf('menuItemIds') && <p className="text-xs text-destructive">{problemOf('menuItemIds')}</p>}
                  </div>
                )}
              </div>
            </SettingsSection>

            <SettingsSection title="Conditions" description="When an order qualifies.">
              <div className="space-y-5">
                <FieldRow icon={ShoppingBag} title="Minimum spend" htmlFor="promotion-min" note="On the whole basket">
                  <Input
                    id="promotion-min"
                    inputMode="decimal"
                    value={draft.minSubtotal}
                    onChange={(event) => patch({ minSubtotal: event.target.value })}
                    placeholder="None"
                    leftIcon={<span className="text-sm text-muted-foreground">{symbol}</span>}
                    error={problemOf('minSubtotal')}
                  />
                </FieldRow>
                <ScopeRow
                  icon={MapPin}
                  title="Locations"
                  everyLabel="Every location"
                  value={draft.locationIds}
                  onChange={(locationIds) => patch({ locationIds })}
                  options={locationOptions}
                  error={problemOf('locationIds')}
                />
                <ScopeRow
                  icon={Monitor}
                  title="Where it can be used"
                  everyLabel="Everywhere"
                  value={draft.channels}
                  onChange={(channels) => patch({ channels: channels as PromotionChannel[] | null })}
                  options={CHANNEL_OPTIONS}
                  error={problemOf('channels')}
                />
              </div>
            </SettingsSection>

            <SettingsSection
              title="Limits"
              description="How often it can be used."
              footnote="Once per customer and first order only need a customer on the sale — the till asks for one when the code is entered."
            >
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Total uses"
                    inputMode="numeric"
                    value={draft.maxRedemptions}
                    onChange={(event) => patch({ maxRedemptions: event.target.value.replace(/\D/g, '') })}
                    placeholder="Unlimited"
                    error={problemOf('maxRedemptions')}
                  />
                  <Input
                    label="Uses per customer"
                    inputMode="numeric"
                    value={draft.maxRedemptionsPerCustomer}
                    onChange={(event) => patch({ maxRedemptionsPerCustomer: event.target.value.replace(/\D/g, '') })}
                    placeholder="Unlimited"
                    error={problemOf('maxRedemptionsPerCustomer')}
                  />
                </div>
                <SwitchRow
                  icon={Users}
                  title="First order only"
                  description="For a customer who has never ordered before."
                  checked={draft.firstOrderOnly}
                  onChange={(firstOrderOnly) => patch({ firstOrderOnly })}
                />
                <SwitchRow
                  icon={Sparkles}
                  title="Works with loyalty rewards"
                  description="Off: an order can use the code or a loyalty reward, not both."
                  checked={draft.combinesWithLoyalty}
                  onChange={(combinesWithLoyalty) => patch({ combinesWithLoyalty })}
                />
              </div>
            </SettingsSection>

            <SettingsSection title="When" description="Leave both empty to run until you pause or archive it.">
              <div className="grid gap-3 sm:grid-cols-2">
                <DateTimeField label="Starts" value={draft.startsAt} onChange={(startsAt) => patch({ startsAt })} />
                <DateTimeField label="Ends" value={draft.endsAt} onChange={(endsAt) => patch({ endsAt })} error={problemOf('endsAt')} />
              </div>
              {isNew && (
                <div className="mt-5">
                  <SwitchRow
                    icon={Calendar}
                    title="Live as soon as it’s created"
                    description="Off: it starts paused, and you make it live from here."
                    checked={draft.status === 'active'}
                    onChange={(live) => patch({ status: live ? 'active' : 'paused' })}
                  />
                </div>
              )}
            </SettingsSection>
          </fieldset>
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
  const amount =
    fields.kind === 'free_item'
      ? 'A free item'
      : fields.kind === 'percentage'
        ? `${fields.value ?? '…'}% off${fields.maxDiscount ? ` (up to ${symbol}${Number(fields.maxDiscount).toFixed(2)})` : ''}`
        : `${symbol}${fields.value ? Number(fields.value).toFixed(2) : '…'} off`;
  const scope = fields.kind === 'free_item' || fields.appliesTo === 'items' ? ' selected items' : ' the whole order';
  return fields.kind === 'free_item' ? amount : `${amount}${scope}`;
}

/** A tile-led row with a switch on the right and a sentence under its title. */
function SwitchRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentProps<typeof RowTile>['icon'];
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <RowTile icon={icon} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch label={title} checked={checked} onChange={onChange} />
    </div>
  );
}

/** "Every …" as a switch; off, a pick-list of the ones it's limited to. */
function ScopeRow({
  icon,
  title,
  everyLabel,
  value,
  onChange,
  options,
  error,
}: {
  icon: React.ComponentProps<typeof RowTile>['icon'];
  title: string;
  everyLabel: string;
  value: string[] | null;
  onChange: (value: string[] | null) => void;
  options: { value: string; label: string }[];
  error?: string | undefined;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <RowTile icon={icon} />
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {everyLabel}
          <Switch label={everyLabel} checked={value === null} onChange={(every) => onChange(every ? null : [])} />
        </label>
      </div>
      {value !== null && (
        <div className="mt-2">
          <MultiSelect value={value} onChange={onChange} options={options} placeholder="Choose…" ariaLabel={title} />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
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
          <p className="text-xs text-muted-foreground">Loading uses…</p>
        ) : uses.isError ? (
          <button type="button" className="text-xs font-medium text-destructive underline" onClick={() => void uses.refetch()}>
            Couldn’t load the uses — try again
          </button>
        ) : total === 0 ? (
          <p className="text-xs text-muted-foreground">No one has used it yet.</p>
        ) : (
          <div className="border-t border-rule/40 pt-3">
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
          <ul className="space-y-2">
            {shown.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
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
          <div className="flex gap-2 border-t border-rule/40 pt-3">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setAdding('code')}>
              <Plus aria-hidden="true" /> Add a code
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setAdding('batch')}>
              <Sparkles aria-hidden="true" /> Single-use batch
            </Button>
          </div>
        )}
        {editable && adding === 'code' && (
          <form
            className="space-y-2 border-t border-rule/40 pt-3"
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
            className="space-y-2 border-t border-rule/40 pt-3"
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
