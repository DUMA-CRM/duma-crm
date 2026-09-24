'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import QRCode from 'react-qr-code';

import { Banknote, CheckCircle2, CreditCard, Eye, Loader2, MapPin, QrCode, Store } from '@/components/icons';
import { SettingsSection as Section } from '@/components/settings/SettingsSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { getMenuCategories, getMenuItems } from '@/lib/modules/catalog/client';
import {
  type QrOrderingContent,
  type SaveQrOrderingConfig,
  getQrOrderingConfig,
  publishQrOrderingConfig,
  saveQrOrderingConfig,
} from '@/lib/modules/ordering/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/dashboard';
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

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 transition-colors',
        checked ? 'border-primary bg-primary' : 'border-rule bg-muted',
      )}
    >
      <span className={cn('size-4 rounded-full bg-white shadow-sm transition-transform', checked && 'translate-x-4')} />
    </button>
  );
}

export function QrOrderingSettings() {
  const qc = useQueryClient();
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
    queryKey: moduleQueryKeys.ordering.key('qr-ordering', locationId),
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
      qc.setQueryData(moduleQueryKeys.ordering.key('qr-ordering', locationId), saved);
      toast('success', 'QR ordering draft saved.');
    },
    onError: (error) => toast('error', error.message || 'QR ordering settings were not saved.'),
  });
  const publish = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return publishQrOrderingConfig(locationId!);
    },
    onSuccess: (published) => {
      qc.setQueryData(moduleQueryKeys.ordering.key('qr-ordering', locationId), published);
      toast('success', 'QR menu published.');
    },
    onError: (error) => toast('error', error.message || 'The QR menu was not published.'),
  });

  const visibleItems = (items.data ?? []).filter((item) => draft.visibility[item.id] !== false);
  const publicUrl =
    config.data?.publicToken && typeof window !== 'undefined' ? `${window.location.origin}/order/${config.data.publicToken}` : null;
  const paymentsValid = draft.cardEnabled || draft.cashEnabled;

  if (!tenantId || !locationId) {
    return <EmptyState icon={MapPin} title="Choose a location" description="QR ordering is configured separately for each location." />;
  }
  if (config.isPending) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Section
          title="Ordering channel"
          description={`Control whether customers can order from the QR menu for ${location?.name ?? 'this location'}. Operational switches take effect as soon as you save.`}
          actions={
            <Badge variant={draft.isEnabled && !draft.isPaused ? 'success' : 'muted'}>
              {draft.isEnabled ? (draft.isPaused ? 'Paused' : 'Open') : 'Off'}
            </Badge>
          }
        >
          <div className="divide-y divide-rule/45">
            <label className="flex items-start justify-between gap-4 pb-4">
              <span>
                <span className="block text-sm font-medium">Enable QR ordering</span>
                <span className="mt-1 block text-xs text-muted-foreground">The public page stays unavailable until this is on.</span>
              </span>
              <Toggle checked={draft.isEnabled} onChange={(isEnabled) => patch({ isEnabled })} label="Enable QR ordering" />
            </label>
            <label className="flex items-start justify-between gap-4 pt-4">
              <span>
                <span className="block text-sm font-medium">Pause new orders</span>
                <span className="mt-1 block text-xs text-muted-foreground">Customers can browse, but checkout is stopped.</span>
              </span>
              <Toggle checked={draft.isPaused} onChange={(isPaused) => patch({ isPaused })} label="Pause QR orders" />
            </label>
          </div>
        </Section>

        <Section title="Page content" description="Presentation changes stay in draft until you publish them.">
          <div className="grid gap-4">
            <Input
              label="Welcome message"
              value={draft.content.welcomeMessage}
              maxLength={160}
              onChange={(event) => patch({ content: { ...draft.content, welcomeMessage: event.target.value } })}
              placeholder="Order ahead and collect at the counter"
            />
            <div>
              <label htmlFor="qr-collection-instructions" className="mb-1.5 block text-label uppercase text-muted-foreground">
                Collection instructions
              </label>
              <textarea
                id="qr-collection-instructions"
                rows={3}
                maxLength={500}
                value={draft.content.collectionInstructions}
                onChange={(event) => patch({ content: { ...draft.content, collectionInstructions: event.target.value } })}
                className="w-full resize-y rounded-md border border-input bg-field px-3 py-2 text-sm outline-none focus:border-measured focus:outline-2 focus:outline-measured"
                placeholder="Collect from the pickup shelf when your order is ready."
              />
            </div>
            <Input
              label="Cover image URL"
              type="url"
              value={draft.content.coverImageUrl ?? ''}
              onChange={(event) => patch({ content: { ...draft.content, coverImageUrl: event.target.value || null } })}
              placeholder="https://…"
            />
          </div>
        </Section>

        <Section
          title="Payment and scheduling"
          description="Cash orders remain ASAP-only and require payment at the counter before entering KDS."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-md border border-rule/65 bg-field p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="text-muted-foreground" />
                Stripe card
              </span>
              <Toggle checked={draft.cardEnabled} onChange={(cardEnabled) => patch({ cardEnabled })} label="Accept Stripe card" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-rule/65 bg-field p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Banknote className="text-muted-foreground" />
                Cash at counter
              </span>
              <Toggle checked={draft.cashEnabled} onChange={(cashEnabled) => patch({ cashEnabled })} label="Accept cash at counter" />
            </label>
            <Input
              label="Minimum order"
              type="number"
              min="0"
              step="0.01"
              value={draft.minimumOrderAmount}
              onChange={(event) => patch({ minimumOrderAmount: event.target.value })}
            />
            <Input
              label="Minimum notice (minutes)"
              type="number"
              min="0"
              max="1440"
              value={draft.minimumNoticeMinutes}
              onChange={(event) => patch({ minimumNoticeMinutes: event.target.value })}
            />
            <Input
              label="Slot interval (minutes)"
              type="number"
              min="5"
              max="120"
              value={draft.slotIntervalMinutes}
              onChange={(event) => patch({ slotIntervalMinutes: event.target.value })}
            />
            <Input
              label="Orders per slot"
              type="number"
              min="1"
              max="100"
              value={draft.maxOrdersPerSlot}
              onChange={(event) => patch({ maxOrdersPerSlot: event.target.value })}
            />
            <Input
              label="Booking horizon (days)"
              type="number"
              min="1"
              max="30"
              value={draft.bookingHorizonDays}
              onChange={(event) => patch({ bookingHorizonDays: event.target.value })}
            />
          </div>
        </Section>

        <Section
          title="Menu visibility"
          description="Items inherit the shared menu price, description, image and modifiers. This switch controls only the QR channel."
        >
          <div className="max-h-80 divide-y divide-rule/45 overflow-y-auto">
            {(items.data ?? []).map((item) => (
              <label key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{formatMoney(Number(item.price), 2)}</span>
                </span>
                <Toggle
                  checked={draft.visibility[item.id] !== false}
                  onChange={(visible) => patch({ visibility: { ...draft.visibility, [item.id]: visible } })}
                  label={`Show ${item.name} on QR menu`}
                />
              </label>
            ))}
          </div>
        </Section>

        <div className="flex flex-wrap justify-end gap-2">
          {!paymentsValid && (
            <p className="mr-auto self-center text-xs font-medium text-destructive">Enable at least one payment method.</p>
          )}
          <Button variant="outline" onClick={() => save.mutate()} disabled={!paymentsValid || save.isPending || publish.isPending}>
            {save.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          <Button onClick={() => publish.mutate()} disabled={!paymentsValid || save.isPending || publish.isPending}>
            {publish.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Publish QR menu
          </Button>
        </div>
      </div>

      <aside className="xl:sticky xl:top-4">
        {publicUrl && (
          <div className="mb-4 rounded-lg border border-rule bg-card p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-md bg-white p-2">
                <QRCode value={publicUrl} size={92} aria-label={`QR code for ${location?.name ?? 'this location'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Location QR code</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{publicUrl}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigator.clipboard.writeText(publicUrl).then(() => toast('success', 'QR ordering link copied.'))}
                >
                  Copy link
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-rule/55 bg-band/55 px-4 py-3">
            <span className="text-sm font-semibold">Mobile preview</span>
            <Badge variant="muted">Draft</Badge>
          </div>
          <div className="bg-background p-3">
            <div className="mx-auto min-h-[36rem] max-w-sm overflow-hidden rounded-lg border border-rule bg-card">
              {draft.content.coverImageUrl ? (
                // The manager supplies this URL at runtime, so Next Image cannot
                // know or allow-list its host during the build.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.content.coverImageUrl} alt="" className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-28 items-center justify-center bg-band text-muted-foreground">
                  <QrCode size={34} />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Store />
                  </div>
                  <div>
                    <p className="font-semibold">{location?.name ?? 'Location'}</p>
                    <p className="text-xs text-muted-foreground">{location?.address}</p>
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{draft.content.welcomeMessage || 'Order for collection'}</h3>
                {draft.content.collectionInstructions && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{draft.content.collectionInstructions}</p>
                )}
                <div className="mt-5 space-y-4">
                  {(categories.data ?? [])
                    .filter((category) => category.isActive)
                    .slice(0, 3)
                    .map((category) => {
                      const categoryItems = visibleItems.filter((item) => item.categoryId === category.id).slice(0, 2);
                      if (!categoryItems.length) return null;
                      return (
                        <section key={category.id}>
                          <h4 className="text-label font-semibold uppercase text-muted-foreground">{category.name}</h4>
                          <div className="mt-2 divide-y divide-rule/45 border-y border-rule/45">
                            {categoryItems.map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                                <div>
                                  <p className="text-sm font-medium">{item.name}</p>
                                  <p className="line-clamp-1 text-xs text-muted-foreground">
                                    {item.description || 'Customise and add to basket'}
                                  </p>
                                </div>
                                <span className="shrink-0 text-sm font-semibold">{formatMoney(Number(item.price), 2)}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-rule/45 px-4 py-2 text-xs text-muted-foreground">
            <Eye size={13} />
            {visibleItems.length} items visible
          </div>
        </div>
      </aside>
    </div>
  );
}
