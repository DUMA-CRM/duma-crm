'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { MediaPicker } from '@/components/cms/MediaPicker';
import { InfoRow, InfoRows, PickerRow } from '@/components/cms/rows';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  type IconComponent,
  ImageIcon,
  ImagePlus,
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
import { SettingsSection as Section } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { relativeTime } from '@/components/settings/connectors/shared';
import { SaveBar, Switch } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { PublicQrCodeCard } from '@/components/shared/PublicQrCodeCard';
import { Bone } from '@/components/shared/Skeleton';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
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
import { cn } from '@/lib/utils/cn';
import { mediaImagePath } from '@/lib/utils/image-src';
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
 * a draft — saved, then published to guests. Laid out like the other rules
 * tabs: the rules in the main column, the guest page's status, QR code and a
 * live preview alongside.
 */
export function QrOrderingSettings() {
  const qc = useQueryClient();
  const { tenantId, locationId } = useWorkspaceStore();
  const [draftState, setDraftState] = useState<{ locationId: string; value: Draft } | null>(null);
  // One row open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<Row | null>(null);
  const capabilities = useAuthStore((state) => state.capabilities);
  const canEdit = hasCapability(capabilities, 'qr-ordering:write');
  const formatMoney = useFormatMoney();
  // Media is offered for the cover photo only with Content on and the right to read it.
  const { contentEnabled } = useCatalogWords();
  const mediaAvailable = contentEnabled && hasCapability(capabilities, 'cms:read');
  const [pickingCover, setPickingCover] = useState(false);

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
      toast('success', 'QR menu published.', { critical: true });
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
  if (config.isPending) return <Bone className="h-96 w-full rounded-lg" />;
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

  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  const switchRow = (
    key: 'isEnabled' | 'isPaused' | 'cardEnabled' | 'cashEnabled',
    icon: IconComponent,
    title: string,
    disabled = false,
  ) => (
    <InfoRow icon={icon} title={title}>
      <Switch checked={draft[key]} onChange={(next) => patch({ [key]: next })} label={title} disabled={!canEdit || disabled} />
    </InfoRow>
  );
  /** A number rule: its value on the row, the stepper (and why it matters) underneath. */
  const numberRow = (
    row: Row,
    key: 'minimumNoticeMinutes' | 'slotIntervalMinutes' | 'maxOrdersPerSlot' | 'bookingHorizonDays',
    icon: IconComponent,
    title: string,
    shown: string,
    hint: string,
    min: number,
    max: number,
    step: number,
    unit: string,
  ) => (
    <PickerRow icon={icon} title={title} value={shown} open={open === row} onToggle={() => toggle(row)}>
      <NumberStepper
        label={title}
        value={Number(draft[key])}
        min={min}
        max={max}
        step={step}
        unit={unit}
        onChange={(next) => patch({ [key]: String(next) })}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </PickerRow>
  );
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
      aside={
        <>
          <Section title="Guest page" actions={statusBadge}>
            <InfoRows>
              <InfoRow icon={MapPin} title="Location">
                <span className="truncate text-sm font-semibold text-foreground">{location?.name ?? 'This location'}</span>
              </InfoRow>
              <InfoRow icon={CheckCircle2} title="Menu published">
                <span className={cn('text-sm', published ? 'font-semibold text-foreground' : 'text-muted-foreground/70')}>
                  {published ?? 'Not yet'}
                </span>
              </InfoRow>
              {/* Folded away until needed, so the preview below gets the room. */}
              {publicUrl ? (
                <PickerRow icon={QrCode} title="QR code and link" value="Show" open={open === 'qr'} onToggle={() => toggle('qr')}>
                  <PublicQrCodeCard url={publicUrl} locationName={location?.name ?? 'this location'} purpose="guest page" actions="rows" />
                  <p className="mt-1.5 text-xs text-muted-foreground">Print it for tables and the counter, or share the link.</p>
                </PickerRow>
              ) : (
                <InfoRow icon={QrCode} title="QR code and link">
                  <span className="text-sm text-muted-foreground/70">After you save</span>
                </InfoRow>
              )}
            </InfoRows>
            {published && unpublished && (
              <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">You have changes guests can’t see yet.</p>
            )}
            {/* While there are unsaved edits, Publish rides in the SaveBar instead. */}
            {canEdit && !dirty && <div className="mt-4 [&>button]:w-full">{publishButton}</div>}
          </Section>
          {config.data?.publicToken && (
            <PhonePreview
              path={`/order/${config.data.publicToken}`}
              version={config.data.publishedAt ?? 'unpublished'}
              behind={dirty || !config.data.publishedAt}
            />
          )}
        </>
      }
    >
      <Section title="Ordering">
        <fieldset disabled={!canEdit} className="min-w-0 space-y-3">
          {switchRow('isEnabled', QrCode, 'Take orders')}
          {switchRow('isPaused', Pause, 'Pause new orders', !draft.isEnabled)}
          {switchRow('cardEnabled', CreditCard, 'Card payments')}
          {switchRow('cashEnabled', Banknote, 'Cash at the counter')}
          <PickerRow
            icon={Coins}
            title="Minimum order"
            value={minimum > 0 ? formatMoney(minimum, 2) : 'None'}
            muted={!(minimum > 0)}
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
              autoFocus
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Baskets under this can’t check out. Leave at 0 for no minimum.</p>
          </PickerRow>
        </fieldset>
        {draft.isEnabled && draft.isPaused && (
          <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
            Paused — guests can browse, but checkout is closed.
          </p>
        )}
        {!paymentsValid && <Warning>Guests can’t check out with no way to pay — turn on card payments or cash.</Warning>}
        {draft.cashEnabled && (
          <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
            Cash is paid on collection, so it’s offered on ASAP orders only.
          </p>
        )}
      </Section>

      <Section title="Pickup times">
        <fieldset disabled={!canEdit} className="min-w-0 space-y-3">
          {numberRow(
            'readyIn',
            'minimumNoticeMinutes',
            Timer,
            'Ready in',
            minutesLabel(Number(draft.minimumNoticeMinutes), 'Straight away'),
            'How long you need to make an order.',
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
            'How far apart pickup times are.',
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
            'Once full, guests pick the next one.',
            1,
            100,
            1,
            'orders',
          )}
          {numberRow(
            'ahead',
            'bookingHorizonDays',
            CalendarDays,
            'Book ahead',
            `${draft.bookingHorizonDays} ${Number(draft.bookingHorizonDays) === 1 ? 'day' : 'days'}`,
            'How far ahead guests can order.',
            1,
            30,
            1,
            'days',
          )}
        </fieldset>
      </Section>

      <Section title="Welcome page">
        <fieldset disabled={!canEdit} className="min-w-0 space-y-3">
          <PickerRow
            icon={ImagePlus}
            title="Cover photo"
            value={draft.content.coverImageUrl ? 'Added' : 'None'}
            muted={!draft.content.coverImageUrl}
            open={open === 'cover'}
            onToggle={() => toggle('cover')}
          >
            {draft.content.coverImageUrl && (
              <div className="relative mb-3 aspect-[3/1] overflow-hidden rounded-lg border border-rule/50 bg-band">
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
            {/* One line: paste a link, or pick from Media when Content is on. */}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  type="url"
                  aria-label="Cover photo link"
                  value={draft.content.coverImageUrl ?? ''}
                  onChange={(event) => content({ coverImageUrl: event.target.value || null })}
                  placeholder={mediaAvailable ? 'Paste a link, or choose from Media' : 'https://…/photo.jpg'}
                  autoFocus
                />
              </div>
              {mediaAvailable && (
                <Button type="button" variant="outline" className="h-9 shrink-0" onClick={() => setPickingCover(true)}>
                  <ImageIcon aria-hidden="true" />
                  Media
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">A wide photo — your counter, a signature drink. Shown across the top.</p>
          </PickerRow>
          <PickerRow
            icon={Type}
            title="Headline"
            value={draft.content.welcomeMessage.trim() || 'None'}
            muted={!draft.content.welcomeMessage.trim()}
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
            <p className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
              <span>The first thing guests read.</span>
              <span className="tabular-nums">{draft.content.welcomeMessage.length}/160</span>
            </p>
          </PickerRow>
          <PickerRow
            icon={StickyNote}
            title="How to collect"
            value={draft.content.collectionInstructions.trim() || 'None'}
            muted={!draft.content.collectionInstructions.trim()}
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
              className="w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-measured focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-measured disabled:opacity-60"
            />
            <p className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Shown under the headline and on the order confirmation.</span>
              <span className="tabular-nums">{draft.content.collectionInstructions.length}/500</span>
            </p>
          </PickerRow>
        </fieldset>
      </Section>

      <Section title="Menu">
        {items.isPending ? (
          <TilesSkeleton
            count={4}
            label="Loading menu"
            className="grid gap-2"
            tile="size-12"
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
      </Section>

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

/** Something that stops guests ordering, with what to do about it. */
function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// The guest page is laid out for a phone this wide; the frame scales it down to fit.
const FRAME_WIDTH = 340;

/**
 * The real guest page, not a mock-up: the public /order page in an iframe,
 * scaled into a phone frame. It shows what guests see — the published menu —
 * so it reloads whenever a publish lands, and says so while there is unpublished work.
 */
function PhonePreview({ path, version, behind }: { path: string; version: string; behind: boolean }) {
  const [reloads, setReloads] = useState(0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-2">
        <p className="text-label uppercase text-muted-foreground">Live guest page</p>
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
            key={`${version}-${reloads}`}
            src={path}
            title="Guest ordering page preview"
            loading="lazy"
            className="border-0 bg-background"
            style={{ width: viewport.width, height: viewport.height }}
          />
        )}
      </PhoneFrame>
      {behind && (
        <p className="mx-auto mt-3 max-w-[21rem] text-center text-xs text-muted-foreground">
          This is what guests see now. Publish to show your latest changes here.
        </p>
      )}
    </div>
  );
}
