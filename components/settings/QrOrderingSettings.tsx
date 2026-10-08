'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import QRCode from 'react-qr-code';

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  MapPin,
  Pause,
  QrCode,
  RefreshCw,
  Store,
  Timer,
  Trash2,
  Users,
} from '@/components/icons';
import { PhoneFrame } from '@/components/settings/PhoneFrame';
import { QrMenuList } from '@/components/settings/QrMenuList';
import { SettingsSection as Section } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { relativeTime } from '@/components/settings/connectors/shared';
import { StepperCard, Switch, ToggleCard } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { SectionSkeleton, TileSkeleton, TilesSkeleton } from '@/components/shared/TileSkeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { ActionButton, useDoneBeat } from '@/components/ui/action-button';
import { CopyGlyph } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const EMPTY_CONTENT: QrOrderingContent = {
  schemaVersion: 1,
  welcomeMessage: '',
  collectionInstructions: '',
  coverImageUrl: null,
  featuredItemIds: [],
  categoryOrder: [],
};

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

export function QrOrderingSettings() {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const { tenantId, locationId } = useWorkspaceStore();
  const [draftState, setDraftState] = useState<{ locationId: string; value: Draft } | null>(null);

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
  if (config.isPending) {
    return (
      // The page's shape: the live headline, then the settings beside the QR code.
      <div role="status" aria-busy="true" aria-label="Loading QR ordering" className="flex flex-col gap-6">
        <div className="flex items-center gap-4" aria-hidden="true">
          <Bone className="size-14 shrink-0 rounded-xl" />
          <span className="min-w-0 flex-1 space-y-2">
            <Bone className="h-6 w-72 max-w-full" />
            <Bone className="h-3.5 w-44" />
          </span>
          <Bone className="hidden h-11 w-28 sm:block" />
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <SectionSkeleton>
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <TileSkeleton key={index} index={index} />
                ))}
              </div>
            </SectionSkeleton>
            <SectionSkeleton fields={2} />
          </div>
          <SectionSkeleton>
            <Bone className="mx-auto aspect-square w-48" />
          </SectionSkeleton>
        </div>
      </div>
    );
  }
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

  return (
    <div className="flex flex-col gap-6">
      {/* The one thing to know: are guests ordering from this location right now. */}
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-xl',
            live ? 'bg-primary/8 text-primary' : 'bg-band text-muted-foreground',
          )}
        >
          <QrCode size={26} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold tracking-headline text-foreground">
            QR ordering is {draft.isEnabled ? (draft.isPaused ? 'paused' : 'live') : 'off'} at {location?.name ?? 'this location'}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span
              className={cn('size-1.5 rounded-full', live ? 'bg-success' : draft.isEnabled ? 'bg-stock' : 'bg-muted-foreground/60')}
              aria-hidden="true"
            />
            {published ? `Menu published ${published}${unpublished ? ' · changes not published yet' : ''}` : 'Menu not published yet'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-3 text-sm font-semibold text-foreground">
            Take orders
            <Switch checked={draft.isEnabled} onChange={(isEnabled) => patch({ isEnabled })} label="Take QR orders" />
          </label>
          {/* Saving lives up here, and only while there is something to save. */}
          <AnimatePresence initial={false}>
            {dirty && (
              <motion.div
                key="save"
                className="flex items-center gap-1"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="h-11 px-3 text-muted-foreground"
                  onClick={() => setDraftState(null)}
                  disabled={save.isPending || publish.isPending}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-11 px-4"
                  onClick={() => save.mutate()}
                  disabled={!paymentsValid || save.isPending || publish.isPending}
                  title={paymentsValid ? 'Save without showing guests yet' : 'Turn on at least one way to pay'}
                >
                  {save.isPending && !publish.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Save draft
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <ActionButton
            type="button"
            size="lg"
            className="h-11 min-w-36 px-5"
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
        </div>
      </div>

      <SettingsTabBody
        stickyAside
        aside={
          <>
            {publicUrl && <QrCodeCard url={publicUrl} locationName={location?.name ?? 'this location'} />}
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
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleCard
              icon={CreditCard}
              title="Card payments"
              description="Guests pay on their phone."
              checked={draft.cardEnabled}
              onChange={(cardEnabled) => patch({ cardEnabled })}
            />
            <ToggleCard
              icon={Banknote}
              title="Cash at the counter"
              description="Paid on collection — ASAP orders only."
              checked={draft.cashEnabled}
              onChange={(cashEnabled) => patch({ cashEnabled })}
            />
            <ToggleCard
              icon={Pause}
              title="Pause new orders"
              description={draft.isEnabled ? 'Guests can browse; checkout is closed.' : 'Turn on Take orders first.'}
              tone="warning"
              checked={draft.isPaused}
              disabled={!draft.isEnabled}
              onChange={(isPaused) => patch({ isPaused })}
            />
            <MinimumOrderCard value={draft.minimumOrderAmount} onChange={(minimumOrderAmount) => patch({ minimumOrderAmount })} />
          </div>
          {!paymentsValid && <p className="mt-3 text-sm font-medium text-exception">Turn on at least one way to pay.</p>}
        </Section>

        <Section title="Welcome page">
          <WelcomeFields content={draft.content} onChange={content} />
        </Section>

        <Section title="Pickup times">
          <div className="grid gap-2 sm:grid-cols-2">
            <StepperCard
              icon={Timer}
              title="Ready in"
              description={
                Number(draft.minimumNoticeMinutes) > 0 ? 'How long you need to make an order.' : 'Orders can be collected straight away.'
              }
              control="duration"
              min={0}
              max={1440}
              step={5}
              value={Number(draft.minimumNoticeMinutes)}
              onChange={(value) => patch({ minimumNoticeMinutes: String(value) })}
            />
            <StepperCard
              icon={Clock}
              title="A pickup every"
              description="How far apart pickup times are."
              control="wheel"
              unit="min"
              min={5}
              max={120}
              step={5}
              value={Number(draft.slotIntervalMinutes)}
              onChange={(value) => patch({ slotIntervalMinutes: String(value) })}
            />
            <StepperCard
              icon={Users}
              title="Orders per pickup"
              description="Once full, guests pick the next one."
              min={1}
              max={100}
              value={Number(draft.maxOrdersPerSlot)}
              onChange={(value) => patch({ maxOrdersPerSlot: String(value) })}
            />
            <StepperCard
              icon={CalendarDays}
              title="Book ahead"
              description="How far ahead guests can order."
              control="wheel"
              unit={Number(draft.bookingHorizonDays) === 1 ? 'day' : 'days'}
              min={1}
              max={30}
              value={Number(draft.bookingHorizonDays)}
              onChange={(value) => patch({ bookingHorizonDays: String(value) })}
            />
          </div>
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
            <QrMenuList
              items={allItems}
              categories={categories.data ?? []}
              visibility={draft.visibility}
              featuredItemIds={draft.content.featuredItemIds}
              categoryOrder={draft.content.categoryOrder}
              onVisibilityChange={(visibility) => patch({ visibility })}
              onFeaturedChange={(featuredItemIds) => content({ featuredItemIds })}
            />
          )}
        </Section>
      </SettingsTabBody>
    </div>
  );
}

/**
 * The rule the Ordering tiles can't express as a switch: a floor on the basket.
 * Zero means no minimum, which is what most places want.
 */
function MinimumOrderCard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const formatMoney = useFormatMoney();
  const amount = Number(value);
  const set = amount > 0;
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors',
        set ? 'border-rule/50 bg-background/60' : 'border-dashed border-rule/60 bg-transparent',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-md transition-colors',
          set ? 'bg-primary/8 text-primary' : 'bg-band text-muted-foreground',
        )}
      >
        <Coins size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-semibold', set ? 'text-foreground' : 'text-muted-foreground')}>Minimum order</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {set ? `Baskets under ${formatMoney(amount, 2)} can't check out.` : 'No minimum — leave at 0.'}
        </span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        aria-label="Minimum order"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange((Math.max(0, Number(value)) || 0).toFixed(2))}
        className="h-9 w-20 shrink-0 rounded-md border border-rule/60 bg-field px-2 text-right font-mono text-sm font-semibold tabular-nums text-foreground outline-none [appearance:textfield] focus-visible:border-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}

/**
 * What a guest reads first: a cover photo, a headline and how to collect.
 * Counters sit on the fields because the phone screen, not the database, is
 * the real limit.
 */
function WelcomeFields({ content, onChange }: { content: QrOrderingContent; onChange: (value: Partial<QrOrderingContent>) => void }) {
  const [editingImage, setEditingImage] = useState(false);
  const image = content.coverImageUrl;
  const counter = (value: string, max: number) => `${value.length}/${max}`;

  return (
    <div className="grid gap-5">
      {/* Cover photo: shown as it will look, not as a bare link. */}
      <div>
        <p className="mb-1.5 text-label uppercase text-muted-foreground">Cover photo</p>
        {image && !editingImage ? (
          <div className="group relative aspect-[3/1] overflow-hidden rounded-lg border border-rule/50 bg-band">
            {/* The owner supplies this URL, so Next Image cannot allow-list its host. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="size-full object-cover" />
            <div className="absolute right-3 top-3 flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setEditingImage(true)}>
                Change
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onChange({ coverImageUrl: null })}
                aria-label="Remove cover photo"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : editingImage || image ? (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                type="url"
                autoFocus
                aria-label="Cover photo link"
                value={image ?? ''}
                onChange={(event) => onChange({ coverImageUrl: event.target.value || null })}
                placeholder="https://…/photo.jpg"
                hint="Paste a link to a wide photo — your counter, a signature drink."
              />
            </div>
            <Button type="button" variant="outline" className="mb-6" onClick={() => setEditingImage(false)}>
              Done
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingImage(true)}
            className="flex h-24 w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed border-rule/70 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ImagePlus size={22} aria-hidden="true" />
            <span className="text-left">
              <span className="block text-sm font-semibold">Add a cover photo</span>
              <span className="block text-xs">Optional — shown across the top of the page</span>
            </span>
          </button>
        )}
      </div>

      <Input
        label="Headline"
        value={content.welcomeMessage}
        maxLength={160}
        onChange={(event) => onChange({ welcomeMessage: event.target.value })}
        placeholder="Order ahead, skip the queue"
        hint={`The first thing guests read · ${counter(content.welcomeMessage, 160)}`}
      />

      <div>
        <label htmlFor="qr-collection-instructions" className="mb-1.5 block text-label uppercase text-muted-foreground">
          How to collect
        </label>
        <textarea
          id="qr-collection-instructions"
          rows={2}
          maxLength={500}
          value={content.collectionInstructions}
          onChange={(event) => onChange({ collectionInstructions: event.target.value })}
          className="w-full resize-none rounded-md border border-input bg-control px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          placeholder="Collect from the pickup shelf by the window."
        />
        <p className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>Shown under the headline and on the order confirmation.</span>
          <span className="tabular-nums">{counter(content.collectionInstructions, 500)}</span>
        </p>
      </div>
    </div>
  );
}

// The guest page is laid out for a phone this wide; the frame scales it down to fit.
const FRAME_WIDTH = 340;

/**
 * The code itself, kept small: guests scan a printed copy, not this screen.
 * What the owner needs here is the file to print and the link to share.
 */
function QrCodeCard({ url, locationName }: { url: string; locationName: string }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  function copy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  // Redraws the on-screen SVG at print size, so the download stays sharp on a table card.
  function download() {
    const svg = codeRef.current?.querySelector('svg');
    if (!svg) return;
    const size = 1024;
    const margin = 64;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size + margin * 2;
      canvas.height = size + margin * 2;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, margin, margin, size, size);
      const link = document.createElement('a');
      link.download = `qr-${
        locationName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'menu'
      }.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  }

  return (
    // The buttons stretch to the code's height, so the pair reads as one block.
    <section aria-label="Your QR code" className="mx-auto flex w-fit max-w-full items-stretch gap-2">
      <div ref={codeRef} className="shrink-0 rounded-lg border border-rule/50 bg-white p-3">
        <QRCode value={url} size={208} aria-label={`QR code for ${locationName}`} />
      </div>
      <div className="flex w-[4.5rem] flex-col gap-2 [&>*]:h-auto [&>*]:flex-1 [&_svg]:size-5">
        <Button type="button" variant="outline" onClick={copy} aria-label={copied ? 'Link copied' : 'Copy link'} title="Copy link">
          <CopyGlyph copied={copied} size={16} className="text-primary" />
        </Button>
        <Button type="button" variant="outline" onClick={download} aria-label="Download QR code" title="Download to print">
          <Download aria-hidden="true" />
        </Button>
        <Button asChild variant="outline">
          <a href={url} target="_blank" rel="noreferrer" aria-label="Open the guest page" title="Open the guest page">
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>
  );
}

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
