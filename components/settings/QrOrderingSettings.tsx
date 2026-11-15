'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MediaPicker } from '@/components/cms/MediaPicker';
import { RowWarning } from '@/components/cms/rows';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  type IconComponent,
  ImageIcon,
  ImagePlus,
  Link2,
  MapPin,
  Pause,
  QrCode,
  RefreshCw,
  StickyNote,
  Store,
  Timer,
  Trash2,
  Type,
  Users,
} from '@/components/icons';
import { PhoneFrame } from '@/components/settings/PhoneFrame';
import { QrMenuList } from '@/components/settings/QrMenuList';
import { SECTION_RISE, SettingsSection as Section } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { relativeTime } from '@/components/settings/connectors/shared';
import { ChangeRow, SaveBar, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { PublicQrCodeCard } from '@/components/shared/PublicQrCodeCard';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone } from '@/components/shared/Skeleton';
import { SectionSkeleton, TilesSkeleton } from '@/components/shared/TileSkeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { ActionButton, useDoneBeat } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { absoluteMediaUrl, proxiedImage } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { getMenuCategories, getMenuItems } from '@/lib/modules/catalog/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import {
  type QrOrderingContent,
  type SaveQrOrderingConfig,
  getQrOrderingConfig,
  publishQrOrderingConfig,
  saveQrOrderingConfig,
} from '@/lib/modules/qr-ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { mediaImagePath } from '@/lib/utils/image-src';
import { QR_PREVIEW_MESSAGE, QR_PREVIEW_READY, type QrPreviewDraft } from '@/lib/utils/qr-preview';
import { minutesLabel } from '@/lib/utils/reservations';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const EMPTY_CONTENT: QrOrderingContent = {
  schemaVersion: 1,
  welcomeMessage: '',
  collectionInstructions: '',
  coverImageUrl: null,
  featuredItemIds: [],
  categoryOrder: [],
};

type Row = 'qr' | 'minimum' | 'readyIn' | 'interval' | 'perSlot' | 'ahead' | 'cover' | 'headline' | 'collect';

interface Draft {
  isEnabled: boolean;
  isPaused: boolean;
  cardEnabled: boolean;
  cashEnabled: boolean;
  minimumOrderAmount: string;
  minimumNoticeMinutes: string;
  slotIntervalMinutes: string;
  maxOrdersPerSlot: string;
  bookingHorizonDays: string;
  content: QrOrderingContent;
  visibility: Record<string, boolean>;
}

/**
 * QR ordering for one location: whether guests can order, how they pay, when
 * they can collect, what the welcome page says and which items show. Edited as
 * a draft — saved, then published to guests. Laid out like Settings → Trading:
 * each rule a row whose Change opens its control, the menu as a list, the
 * guest page's status, QR code and live preview alongside.
 */
export function QrOrderingSettings() {
  const qc = useQueryClient();
  const { tenantId, locationId } = useWorkspaceStore();
  const [draftState, setDraftState] = useState<{ locationId: string; value: Draft } | null>(null);
  // One row open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<Row | null>(null);
  // The draft as it was when the open row opened, so its Cancel can put the field back.
  const [before, setBefore] = useState<Draft | null>(null);
  const capabilities = useAuthStore((state) => state.capabilities);
  const canEdit = hasCapability(capabilities, 'qr-ordering:write');
  const formatMoney = useFormatMoney();
  // Media is offered for the cover photo only with Content on and the right to read it.
  const { contentEnabled } = useCatalogWords();
  const mediaAvailable = contentEnabled && hasCapability(capabilities, 'cms:read');
  const [pickingCover, setPickingCover] = useState(false);
  const [linkingCover, setLinkingCover] = useState(false);

  const locations = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: Boolean(tenantId),
  });
  const items = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId!),
    enabled: Boolean(tenantId),
  });
  const categories = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId!),
    enabled: Boolean(tenantId),
  });
  const config = useQuery({
    queryKey: moduleQueryKeys.qrOrdering.key('configuration', locationId),
    queryFn: () => getQrOrderingConfig(locationId!),
    enabled: Boolean(locationId),
  });
  const location = locations.data?.find((row) => row.id === locationId);

  const explicit = new Map(config.data?.itemVisibility.map((row) => [row.menuItemId, row.draftVisible]) ?? []);
  const initialDraft: Draft = {
    isEnabled: config.data?.isEnabled ?? false,
    isPaused: config.data?.isPaused ?? false,
    cardEnabled: config.data?.cardEnabled ?? true,
    cashEnabled: config.data?.cashEnabled ?? false,
    minimumOrderAmount: config.data?.minimumOrderAmount ?? '0.00',
    minimumNoticeMinutes: String(config.data?.minimumNoticeMinutes ?? 20),
    slotIntervalMinutes: String(config.data?.slotIntervalMinutes ?? 15),
    maxOrdersPerSlot: String(config.data?.maxOrdersPerSlot ?? 5),
    bookingHorizonDays: String(config.data?.bookingHorizonDays ?? 7),
    content: config.data?.draftContent ?? { ...EMPTY_CONTENT, categoryOrder: categories.data?.map((row) => row.id) ?? [] },
    visibility: Object.fromEntries((items.data ?? []).map((item) => [item.id, explicit.get(item.id) ?? true])),
  };
  const draft = draftState?.locationId === locationId ? draftState.value : initialDraft;
  const patch = (value: Partial<Draft>) => setDraftState({ locationId: locationId!, value: { ...draft, ...value } });

  const save = useMutation({
    mutationFn: () => {
      if (!locationId) throw new Error('Choose a location first.');
      const payload: SaveQrOrderingConfig = {
        isEnabled: draft.isEnabled,
        isPaused: draft.isPaused,
        cardEnabled: draft.cardEnabled,
        cashEnabled: draft.cashEnabled,
        minimumOrderAmount: Number(draft.minimumOrderAmount),
        minimumNoticeMinutes: Number(draft.minimumNoticeMinutes),
        slotIntervalMinutes: Number(draft.slotIntervalMinutes),
        maxOrdersPerSlot: Number(draft.maxOrdersPerSlot),
        bookingHorizonDays: Number(draft.bookingHorizonDays),
        content: draft.content,
        itemVisibility: Object.entries(draft.visibility).map(([menuItemId, visible]) => ({ menuItemId, visible })),
      };
      return saveQrOrderingConfig(locationId, payload);
    },
    onSuccess: (saved) => {
      qc.setQueryData(moduleQueryKeys.qrOrdering.key('configuration', locationId), saved);
      toast('success', 'QR ordering draft saved.');
    },
    onError: (error) => toast('error', error.message || 'QR ordering settings were not saved.'),
  });
  const [justPublished, flashPublished] = useDoneBeat(1800);
  const publish = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return publishQrOrderingConfig(locationId!);
    },
    onSuccess: (published) => {
      qc.setQueryData(moduleQueryKeys.qrOrdering.key('configuration', locationId), published);
      toast('success', 'QR menu published.');
    },
    onError: (error) => toast('error', error.message || 'The QR menu was not published.'),
  });

  const publicUrl =
    config.data?.publicToken && typeof window !== 'undefined' ? `${window.location.origin}/order/${config.data.publicToken}` : null;
  const paymentsValid = draft.cardEnabled || draft.cashEnabled;
  const dirty = draftState?.locationId === locationId && JSON.stringify(draftState.value) !== JSON.stringify(initialDraft);

  if (!tenantId || !locationId) {
    return <EmptyState icon={MapPin} title="Choose a location" description="QR ordering is configured separately for each location." />;
  }
  if (config.isPending) return <QrOrderingSkeleton />;
  if (config.isError) {
    return <ErrorState title="Couldn’t load QR ordering" onRetry={() => void config.refetch()} />;
  }

  const live = draft.isEnabled && !draft.isPaused;
  // Publishing pushes page content and item visibility; the on/off switches apply on save.
  const saved = config.data;
  const unpublished =
    dirty ||
    !saved?.publishedAt ||
    JSON.stringify(saved.draftContent) !== JSON.stringify(saved.publishedContent) ||
    saved.itemVisibility.some((row) => row.draftVisible !== row.publishedVisible);
  const published = relativeTime(config.data?.publishedAt);
  const allItems = items.data ?? [];
  const content = (value: Partial<QrOrderingContent>) => patch({ content: { ...draft.content, ...value } });
  const status = draft.isEnabled ? (draft.isPaused ? 'Paused' : 'Live') : 'Off';
  const statusBadge = <Badge variant={live ? 'success' : draft.isEnabled ? 'warning' : 'muted'}>{status}</Badge>;
  const minimum = Number(draft.minimumOrderAmount);

  /** Cancel on an open row: that field goes back to what it was when the row opened. */
  const restore = (row: Row, was: Draft) => {
    if (row === 'minimum') patch({ minimumOrderAmount: was.minimumOrderAmount });
    else if (row === 'readyIn') patch({ minimumNoticeMinutes: was.minimumNoticeMinutes });
    else if (row === 'interval') patch({ slotIntervalMinutes: was.slotIntervalMinutes });
    else if (row === 'perSlot') patch({ maxOrdersPerSlot: was.maxOrdersPerSlot });
    else if (row === 'ahead') patch({ bookingHorizonDays: was.bookingHorizonDays });
    else if (row === 'cover') content({ coverImageUrl: was.content.coverImageUrl });
    else if (row === 'headline') content({ welcomeMessage: was.content.welcomeMessage });
    else if (row === 'collect') content({ collectionInstructions: was.content.collectionInstructions });
  };
  const toggle = (row: Row) => {
    if (open === row) {
      if (before) restore(row, before);
      setOpen(null);
      return;
    }
    setBefore(draft);
    setOpen(row);
  };
  /** An on/off rule: its state as the value, the switch at the right edge. */
  const switchRow = (
    key: 'isEnabled' | 'isPaused' | 'cardEnabled' | 'cashEnabled',
    icon: IconComponent,
    label: string,
    on: React.ReactNode,
    off: string,
    switchLabel: string,
    disabled = false,
  ) => (
    <ChangeRow
      icon={icon}
      label={label}
      value={draft[key] ? on : <ValueMissing>{off}</ValueMissing>}
      trailing={
        <Switch checked={draft[key]} onChange={(next) => patch({ [key]: next })} label={switchLabel} disabled={!canEdit || disabled} />
      }
    />
  );
  /** A number rule: its value on the row, the stepper underneath. */
  const numberRow = (
    row: Row,
    key: 'minimumNoticeMinutes' | 'slotIntervalMinutes' | 'maxOrdersPerSlot' | 'bookingHorizonDays',
    icon: IconComponent,
    label: string,
    shown: string,
    min: number,
    max: number,
    step: number,
    unit: string,
    hint?: string,
  ) => (
    <ChangeRow icon={icon} label={label} value={shown} open={open === row} onToggle={() => toggle(row)}>
      <NumberStepper
        label={label}
        value={Number(draft[key])}
        min={min}
        max={max}
        step={step}
        unit={unit}
        onChange={(next) => patch({ [key]: String(next) })}
      />
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </ChangeRow>
  );
  /** A written line: what it says now, or a quiet "None". */
  const written = (text: string) => (text.trim() ? <span className="truncate">{text.trim()}</span> : <ValueMissing>None</ValueMissing>);
  const publishButton = (
    <ActionButton
      type="button"
      className="h-9"
      onClick={() => publish.mutate(undefined, { onSuccess: flashPublished })}
      variant={unpublished || justPublished ? 'default' : 'outline'}
      disabled={!unpublished || !paymentsValid || save.isPending}
      pending={publish.isPending}
      pendingLabel="Publishing…"
      done={justPublished}
      doneLabel="Live for guests"
      icon={<CheckCircle2 aria-hidden="true" />}
      title={
        !unpublished
          ? 'Guests already see the latest version'
          : dirty
            ? 'Saves your changes, then publishes them'
            : 'Show your latest changes to guests'
      }
    >
      {unpublished ? 'Publish' : 'Published'}
    </ActionButton>
  );

  return (
    <SettingsTabBody
      narrowAside
      stickyAside
      // The rail holds only what the settings produce: the guest page as a phone shows it.
      aside={config.data?.publicToken && <PhonePreview path={`/order/${config.data.publicToken}`} locationId={locationId!} draft={draft} />}
    >
      {/* Two stacked columns, not paired rows: a short card never leaves a gap beside a tall one. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Ordering">
            <fieldset disabled={!canEdit} className="min-w-0">
              {switchRow('isEnabled', QrCode, 'Orders', 'Taken', 'Off', 'Take orders')}
              {switchRow(
                'isPaused',
                Pause,
                'Pause',
                <>
                  Paused
                  <ValueAside>· browsing only</ValueAside>
                </>,
                'Not paused',
                'Pause new orders',
                !draft.isEnabled,
              )}
              {switchRow('cardEnabled', CreditCard, 'Card payments', 'Accepted', 'Off', 'Card payments')}
              {switchRow(
                'cashEnabled',
                Banknote,
                'Cash at the counter',
                <>
                  Accepted
                  <ValueAside>· ASAP orders only</ValueAside>
                </>,
                'Off',
                'Cash at the counter',
              )}
              <ChangeRow
                icon={Coins}
                label="Minimum order"
                value={minimum > 0 ? formatMoney(minimum, 2) : <ValueMissing>None</ValueMissing>}
                open={open === 'minimum'}
                onToggle={() => toggle('minimum')}
              >
                <Input
                  aria-label="Minimum order"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={draft.minimumOrderAmount}
                  onChange={(event) => patch({ minimumOrderAmount: event.target.value })}
                  onBlur={() => patch({ minimumOrderAmount: (Math.max(0, Number(draft.minimumOrderAmount)) || 0).toFixed(2) })}
                  hint="Leave at 0 for no minimum."
                  autoFocus
                />
              </ChangeRow>
            </fieldset>
            {!paymentsValid && (
              <RowWarning className="mt-4">Guests can’t check out with no way to pay — turn on card payments or cash.</RowWarning>
            )}
          </Section>
          <Section title="Guest page" actions={statusBadge}>
            <div>
              <ChangeRow icon={MapPin} label="Location" value={<span className="truncate">{location?.name ?? 'This location'}</span>} />
              <ChangeRow
                icon={CheckCircle2}
                label="Published"
                value={
                  published ? (
                    <>
                      <span className="truncate">{published}</span>
                      {unpublished && <ValueAside>· changes not live</ValueAside>}
                    </>
                  ) : (
                    <ValueMissing>Not yet</ValueMissing>
                  )
                }
              />
              {/* Folded away until needed, so the preview below gets the room. */}
              <ChangeRow
                icon={QrCode}
                label="QR code and link"
                value={publicUrl ? 'Ready to print' : <ValueMissing>After you save</ValueMissing>}
                trailing={
                  publicUrl && (
                    <Button
                      variant={open === 'qr' ? 'ghost' : 'outline'}
                      size="sm"
                      onClick={() => toggle('qr')}
                      aria-expanded={open === 'qr'}
                    >
                      {open === 'qr' ? 'Hide' : 'Show'}
                    </Button>
                  )
                }
              />
              {publicUrl && open === 'qr' && (
                <div className="pt-4">
                  <PublicQrCodeCard url={publicUrl} locationName={location?.name ?? 'this location'} purpose="guest page" actions="rows" />
                </div>
              )}
            </div>
            {/* While there are unsaved edits, Publish rides in the SaveBar instead. */}
            {canEdit && !dirty && <div className="mt-4 [&>button]:w-full">{publishButton}</div>}
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Pickup times">
            <fieldset disabled={!canEdit} className="min-w-0">
              {numberRow(
                'readyIn',
                'minimumNoticeMinutes',
                Timer,
                'Ready in',
                minutesLabel(Number(draft.minimumNoticeMinutes), 'Straight away'),
                0,
                1440,
                5,
                'min',
              )}
              {numberRow(
                'interval',
                'slotIntervalMinutes',
                Clock,
                'A pickup every',
                minutesLabel(Number(draft.slotIntervalMinutes)),
                5,
                120,
                5,
                'min',
              )}
              {numberRow(
                'perSlot',
                'maxOrdersPerSlot',
                Users,
                'Orders per pickup',
                `${draft.maxOrdersPerSlot} ${Number(draft.maxOrdersPerSlot) === 1 ? 'order' : 'orders'}`,
                1,
                100,
                1,
                'orders',
                'Once full, guests pick the next one.',
              )}
              {numberRow(
                'ahead',
                'bookingHorizonDays',
                CalendarDays,
                'Book ahead',
                `${draft.bookingHorizonDays} ${Number(draft.bookingHorizonDays) === 1 ? 'day' : 'days'}`,
                1,
                30,
                1,
                'days',
              )}
            </fieldset>
          </Section>
          <Section title="Welcome page">
            <fieldset disabled={!canEdit} className="min-w-0">
              <ChangeRow
                icon={ImagePlus}
                label="Cover photo"
                value={draft.content.coverImageUrl ? 'Added' : <ValueMissing>None</ValueMissing>}
                open={open === 'cover'}
                onToggle={() => toggle('cover')}
              >
                {draft.content.coverImageUrl && (
                  <div className="relative mb-3 aspect-[3/1] overflow-hidden rounded-lg border border-border bg-band">
                    {/* The owner supplies this URL, so Next Image cannot allow-list its host. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={proxiedImage(draft.content.coverImageUrl) ?? undefined} alt="" className="size-full object-cover" />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="absolute right-3 top-3"
                      onClick={() => content({ coverImageUrl: null })}
                      aria-label="Remove cover photo"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                )}
                {/* Media first — choose a photo already in Content, or upload one there; a link is the fallback. */}
                {mediaAvailable && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setPickingCover(true)}>
                      <ImageIcon aria-hidden="true" />
                      {draft.content.coverImageUrl ? 'Replace' : 'Choose or upload'}
                    </Button>
                    {!linkingCover && (
                      <Button type="button" variant="ghost" onClick={() => setLinkingCover(true)}>
                        <Link2 aria-hidden="true" />
                        Use a link
                      </Button>
                    )}
                  </div>
                )}
                {(!mediaAvailable || linkingCover) && (
                  <Input
                    type="url"
                    aria-label="Cover photo link"
                    value={draft.content.coverImageUrl ?? ''}
                    onChange={(event) => content({ coverImageUrl: event.target.value || null })}
                    placeholder="https://…/photo.jpg"
                    className={mediaAvailable ? 'mt-2' : undefined}
                    autoFocus
                  />
                )}
              </ChangeRow>
              <ChangeRow
                icon={Type}
                label="Headline"
                value={written(draft.content.welcomeMessage)}
                open={open === 'headline'}
                onToggle={() => toggle('headline')}
              >
                <Input
                  aria-label="Headline"
                  value={draft.content.welcomeMessage}
                  maxLength={160}
                  onChange={(event) => content({ welcomeMessage: event.target.value })}
                  placeholder="Order ahead, skip the queue"
                  autoFocus
                />
                <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">{draft.content.welcomeMessage.length}/160</p>
              </ChangeRow>
              <ChangeRow
                icon={StickyNote}
                label="How to collect"
                value={written(draft.content.collectionInstructions)}
                open={open === 'collect'}
                onToggle={() => toggle('collect')}
              >
                <textarea
                  aria-label="How to collect"
                  rows={3}
                  maxLength={500}
                  value={draft.content.collectionInstructions}
                  onChange={(event) => content({ collectionInstructions: event.target.value })}
                  autoFocus
                  placeholder="Collect from the pickup shelf by the window."
                  className="w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30 disabled:opacity-60"
                />
                <p className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
                  <span>Also shown on the order confirmation.</span>
                  <span className="tabular-nums">{draft.content.collectionInstructions.length}/500</span>
                </p>
              </ChangeRow>
            </fieldset>
          </Section>
        </div>
      </div>

      <RecordGroup id="qr-menu" title="Menu">
        {items.isPending ? (
          <TilesSkeleton
            count={4}
            label="Loading menu"
            className="grid gap-2"
            tile="size-10"
            trailing="h-4 w-12"
            tileClassName="p-2 pr-3.5"
          />
        ) : items.isError ? (
          <ErrorState title="Couldn’t load the menu" onRetry={() => void items.refetch()} />
        ) : allItems.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Nothing on the menu yet"
            description="Add products first — they appear here to show or hide."
            compact
          />
        ) : (
          <fieldset disabled={!canEdit} className="min-w-0">
            <QrMenuList
              items={allItems}
              categories={categories.data ?? []}
              visibility={draft.visibility}
              featuredItemIds={draft.content.featuredItemIds}
              categoryOrder={draft.content.categoryOrder}
              onVisibilityChange={(visibility) => patch({ visibility })}
              onFeaturedChange={(featuredItemIds) => content({ featuredItemIds })}
            />
          </fieldset>
        )}
      </RecordGroup>

      {pickingCover && (
        <MediaPicker
          multiple={false}
          groups={['image']}
          onClose={() => setPickingCover(false)}
          onPick={(_ids, assets) => {
            setPickingCover(false);
            const asset = assets[0];
            // Absolute, as the API requires a full URL; shown through `/be` by `proxiedImage`.
            if (asset) content({ coverImageUrl: absoluteMediaUrl(mediaImagePath(asset)) });
          }}
        />
      )}

      {canEdit && (
        <SaveBar
          dirty={dirty}
          saving={save.isPending && !publish.isPending}
          saveLabel="Save draft"
          disabled={!paymentsValid || publish.isPending}
          message={paymentsValid ? 'Saved drafts aren’t shown to guests until you publish' : 'Turn on at least one way to pay'}
          onSave={() => save.mutate()}
          onDiscard={() => {
            setDraftState(null);
            setOpen(null);
          }}
          extra={publishButton}
        />
      )}
    </SettingsTabBody>
  );
}

/** The sections of rows and the guest page beside them, without their words. */
function QrOrderingSkeleton() {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex items-center gap-3">
        <Bone className="size-10 shrink-0" />
        <span className="min-w-0 flex-1 space-y-1.5">
          <Bone className="h-2.5 w-20" />
          <Bone className="h-3.5 w-44 max-w-full" />
        </span>
        <Bone className="h-8 w-20 shrink-0" />
      </div>
    ));
  return (
    <div role="status" aria-label="Loading QR ordering">
      <SettingsTabBody narrowAside aside={<Bone className="mx-auto h-[34rem] w-full max-w-xs rounded-[2rem]" />}>
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <SectionSkeleton>{rows(5)}</SectionSkeleton>
          <SectionSkeleton>{rows(4)}</SectionSkeleton>
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <SectionSkeleton>{rows(3)}</SectionSkeleton>
          <SectionSkeleton>{rows(3)}</SectionSkeleton>
        </div>
      </SettingsTabBody>
    </div>
  );
}

// The guest page is laid out for a phone this wide; the frame scales it down to fit.
const FRAME_WIDTH = 340;

/**
 * The real guest page, not a mock-up: the public /order page in an iframe,
 * scaled into a phone frame. It shows what guests see — the published menu —
 * so it reloads whenever a publish lands, and says so while there is unpublished work.
 */
function PhonePreview({ path, locationId, draft }: { path: string; locationId: string; draft: QrPreviewDraft }) {
  const [reloads, setReloads] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(draft);
  // The real guest page in the frame, with the unsaved draft laid over it as you edit.
  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: QR_PREVIEW_MESSAGE, draft: latest.current }, window.location.origin);
  }, []);
  useEffect(() => {
    latest.current = draft;
    send();
  }, [draft, send]);
  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === QR_PREVIEW_READY)
        send();
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [send]);

  return (
    // No card around it: the phone is the thing, so it stands on its own.
    <motion.div variants={SECTION_RISE}>
      <div className="mb-2 flex items-center justify-center gap-2">
        <p className="text-label uppercase text-muted-foreground">Preview</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setReloads((count) => count + 1)}
          aria-label="Reload preview"
          title="Reload"
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>
      <PhoneFrame width={FRAME_WIDTH}>
        {(viewport) => (
          <iframe
            ref={frame}
            key={reloads}
            src={`${path}?preview=1&location=${encodeURIComponent(locationId)}`}
            title="Guest ordering page preview"
            loading="lazy"
            className="border-0 bg-background"
            style={{ width: viewport.width, height: viewport.height }}
          />
        )}
      </PhoneFrame>
    </motion.div>
  );
}
