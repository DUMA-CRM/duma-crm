'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ArrowLeftRight, Box, History, LayoutDashboard, MapPin, Package, PackageMinus, PackagePlus } from '@/components/icons';
import { ContainersSection } from '@/components/inventory/item/ContainersSection';
import { ItemOverview } from '@/components/inventory/item/ItemOverview';
import { LedgerSection } from '@/components/inventory/item/LedgerSection';
import { LossesSection } from '@/components/inventory/item/LossesSection';
import { RemoveItemDrawer } from '@/components/inventory/item/RemoveItemDrawer';
import { EditStockItemDrawer, EditThresholdDrawer, LogLossDrawer, RestockDrawer } from '@/components/inventory/stock/StockDrawers';
import { getStatus, normaliseArray } from '@/components/inventory/stock/shared';
import { StockItemThumb } from '@/components/inventory/item/StockItemPhoto';
import { ItemTransfersSection, TransferStockDrawer } from '@/components/inventory/transfers/TransferStock';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { serverCache } from '@/lib/api/cache-policy';
import { hasCapability } from '@/lib/auth/capabilities';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import {
  type InventoryForecast,
  type InventoryOverviewRow,
  type LocationStock,
  getInventoryForecast,
  getInventoryOverview,
  getLocationStock,
  getStockItem,
  getStockUnits,
  removeLocationStock,
  updateLocationStock,
} from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type ItemSection = 'overview' | 'containers' | 'ledger' | 'losses' | 'transfers';

const ITEM_SECTIONS: SectionTab<ItemSection>[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'containers', label: 'Containers', icon: Box },
  { value: 'ledger', label: 'Ledger', icon: History },
  { value: 'losses', label: 'Losses', icon: PackageMinus },
  { value: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
];

export function InventoryItemDetailPage({ stockItemId }: { stockItemId: string }) {
  const router = useRouter();
  const { tenantId, locationId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const { location: currentLocation } = useCurrentWorkspace();
  const [section, setSection] = useState<ItemSection>('overview');

  // Dialog flags — every action the old detail sidebar owned now lives here.
  const [editThreshold, setEditThreshold] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const capabilities = useAuthStore((state) => state.capabilities);
  const can = {
    restock: hasCapability(capabilities, 'restock:write'),
    loss: hasCapability(capabilities, 'loss:write'),
    transfer: hasCapability(capabilities, 'stock.transfers:write'),
    par: hasCapability(capabilities, 'stock.locations:write'),
    edit: hasCapability(capabilities, 'stock:write'),
    containers: hasCapability(capabilities, 'inventory:write'),
  };

  const {
    data: item,
    isLoading: itemLoading,
    isError: itemError,
    refetch: refetchItem,
  } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stock-item', stockItemId),
    queryFn: () => getStockItem(stockItemId),
  });
  // Every container, not just active ones: the Containers tab filters on the page
  // so expired containers still holding stock stay visible and countable.
  const {
    data: units = [],
    isLoading: unitsLoading,
    isError: unitsError,
    refetch: refetchUnits,
  } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stock-units', locationId, stockItemId, { showInactive: true }),
    queryFn: () => getStockUnits({ locationId: locationId ?? undefined, stockItemId, activeOnly: false }),
    enabled: !!locationId,
  });
  // The per-location row carries the reorder threshold, availability flag and the
  // id every stock action is keyed by — the list page used to hand it over.
  const { data: rawStock } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('location-stock', locationId),
    queryFn: () => getLocationStock(locationId!),
    enabled: !!locationId,
  });
  const { data: rawOverview } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('inventory-overview', locationId),
    queryFn: () => getInventoryOverview(locationId!),
    enabled: !!locationId,
  });
  const { data: rawForecast } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('inventory-forecast', locationId),
    queryFn: () => getInventoryForecast(locationId!),
    ...serverCache('inventoryForecast'),
    enabled: !!locationId,
  });

  const stock = useMemo(
    () => normaliseArray<LocationStock>(rawStock).find((s) => s.stockItemId === stockItemId) ?? null,
    [rawStock, stockItemId],
  );
  const overview = useMemo(
    () => normaliseArray<InventoryOverviewRow>(rawOverview).find((row) => row.stockItemId === stockItemId) ?? null,
    [rawOverview, stockItemId],
  );
  const forecast = useMemo(
    () => (stock ? normaliseArray<InventoryForecast>(rawForecast).find((f) => f.locationStockId === stock.id) : undefined),
    [rawForecast, stock],
  );

  const active = units.filter((unit) => unit.status === 'AVAILABLE' || unit.status === 'IN_USE');
  // Prefer the server's rollup; fall back to summing the containers we hold.
  const onHand = overview ? Number(overview.totalOnHand) : active.reduce((sum, unit) => sum + Number(unit.remainingQuantity), 0);
  const activeUnitCount = overview?.activeUnitCount ?? active.length;
  const earliestExpiry =
    overview?.earliestExpiryDate ??
    active
      .map((unit) => unit.expiryDate)
      .filter((value): value is string => !!value)
      .sort()[0];
  const threshold = stock ? parseFloat(stock.lowThreshold) : overview ? parseFloat(overview.reorderLevel) : 0;
  // Status is derived from the rolled-up on-hand figure, not the row's own cached quantity.
  const status = stock ? getStatus({ ...stock, quantity: String(onHand) }) : null;
  const unit = item?.unit ?? '';

  function invalidateStock() {
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-units', locationId, stockItemId) });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-movements', stockItemId) });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-overview', locationId) });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock', locationId) });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-forecast', locationId) });
  }

  const toggleAvailable = useMutation({
    mutationFn: () => updateLocationStock(stock!.id, { isAvailable: !stock!.isAvailable }),
    onSuccess: () => {
      invalidateStock();
      toast('success', 'Availability updated.');
    },
    onError: () => toast('error', 'Availability wasn’t updated. Try again.'),
  });

  // The API archives rather than deletes (it marks the row unavailable), so the
  // item stays reachable — staying on its page shows the new state.
  const removeItem = useMutation({
    mutationFn: () => removeLocationStock(stock!.id),
    onSuccess: () => {
      setRemoveOpen(false);
      invalidateStock();
      toast('success', `Removed from ${currentLocation?.name ?? 'this location'} — marked unavailable.`);
    },
    onError: (error) =>
      toast('error', error instanceof Error && error.message ? error.message : 'The item wasn’t removed from this location. Try again.'),
  });

  return (
    <EditorShell
      eyebrow="Inventory item"
      title={item?.name ?? (itemLoading ? 'Loading…' : 'Inventory item')}
      // The item's photo when it has one, in the badge's place and size.
      leading={item?.imageUrl ? <StockItemThumb imageUrl={item.imageUrl} className="size-9 rounded-md" /> : undefined}
      icon={<Package size={20} aria-hidden="true" />}
      onClose={() => router.push('/inventory')}
      actions={
        stock && (
          <>
            {can.transfer && (
              <Button variant="outline" className="h-9 gap-1.5" onClick={() => setTransferOpen(true)}>
                <ArrowLeftRight size={15} />
                <span className="hidden md:inline">Transfer</span>
              </Button>
            )}
            {can.loss && (
              <Button variant="outline" className="h-9 gap-1.5" onClick={() => setLossOpen(true)}>
                <PackageMinus size={15} />
                <span className="hidden md:inline">Log waste</span>
              </Button>
            )}
            {can.restock && (
              <Button className="h-9 gap-1.5" onClick={() => setRestockOpen(true)}>
                <PackagePlus size={15} />
                <span className="hidden md:inline">Restock</span>
              </Button>
            )}
          </>
        )
      }
      subheader={<SectionTabs tabs={ITEM_SECTIONS} value={section} onChange={setSection} ariaLabel="Inventory item sections" />}
    >
      {/* A flex column, so a section's loading or empty state can fill the page and centre. */}
      <div className="flex flex-1 flex-col space-y-4">
        {!locationId && (
          <div className="flex items-start gap-3 rounded-lg border border-rule/60 bg-card px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-measured/10 text-measured" aria-hidden="true">
              <MapPin size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Choose a location</p>
              <p className="text-xs text-muted-foreground">
                Stock level, containers and actions are per location — pick one in the sidebar.
              </p>
            </div>
          </div>
        )}

        {section === 'overview' &&
          (item ? (
            <ItemOverview
              item={item}
              stock={stock}
              status={status}
              onHand={onHand}
              activeUnitCount={activeUnitCount}
              earliestExpiry={earliestExpiry}
              threshold={threshold}
              forecast={forecast}
              can={can}
              hasLocation={!!locationId}
              togglePending={toggleAvailable.isPending}
              onRestock={() => setRestockOpen(true)}
              onEditThreshold={() => setEditThreshold(true)}
              onEditItem={() => setEditItemOpen(true)}
              onToggleAvailable={() => toggleAvailable.mutate()}
              onRemove={() => setRemoveOpen(true)}
              onOpenContainers={() => setSection('containers')}
            />
          ) : itemError ? (
            <ErrorState title="Couldn’t load this item" onRetry={() => void refetchItem()} />
          ) : (
            <LoadingState label="Loading the item" className="flex-1" />
          ))}

        {section === 'containers' && item && (
          <ContainersSection
            item={item}
            locationId={locationId}
            units={units}
            loading={unitsLoading}
            error={unitsError}
            onRetry={() => void refetchUnits()}
            canWrite={can.containers}
            onChanged={invalidateStock}
          />
        )}

        {section === 'ledger' && <LedgerSection stockItemId={stockItemId} locationId={locationId} unit={unit} />}

        {section === 'losses' && (
          <LossesSection
            stockItemId={stockItemId}
            locationId={locationId}
            tenantId={tenantId ?? null}
            unit={unit}
            cost={item?.costPerUnit != null && item.costPerUnit !== '' ? Number(item.costPerUnit) : null}
            canLog={can.loss && !!stock}
            onLogWaste={() => setLossOpen(true)}
          />
        )}

        {section === 'transfers' && locationId && (
          <ItemTransfersSection
            stockItemId={stockItemId}
            locationId={locationId}
            unit={unit}
            canWrite={can.transfer}
            onNewTransfer={stock && Number(stock.quantity) > 0 ? () => setTransferOpen(true) : undefined}
          />
        )}
      </div>

      {/* Drawers */}
      {editThreshold && stock && <EditThresholdDrawer item={stock} onClose={() => setEditThreshold(false)} onSuccess={invalidateStock} />}
      {restockOpen && stock && (
        <RestockDrawer
          item={stock}
          suggested={forecast?.recommendedReorderQuantity}
          onClose={() => setRestockOpen(false)}
          onSuccess={() => undefined}
        />
      )}
      {lossOpen && stock && (
        <LogLossDrawer
          defaultLocationId={stock.locationId}
          defaultStockItemId={stockItemId}
          onClose={() => setLossOpen(false)}
          onSuccess={invalidateStock}
        />
      )}
      {editItemOpen && item && (
        <EditStockItemDrawer
          item={item}
          onClose={() => setEditItemOpen(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-item', stockItemId) });
            void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-items') });
            invalidateStock();
          }}
        />
      )}
      {transferOpen && tenantId && locationId && (
        <TransferStockDrawer
          tenantId={tenantId}
          locationId={locationId}
          initialStockItemId={stockItemId}
          onClose={() => setTransferOpen(false)}
        />
      )}
      {removeOpen && stock && (
        <RemoveItemDrawer
          name={item?.name ?? 'This item'}
          unit={unit}
          onHand={onHand}
          locationName={currentLocation?.name}
          pending={removeItem.isPending}
          canLogWaste={can.loss}
          canTransfer={can.transfer}
          onLogWaste={() => {
            setRemoveOpen(false);
            setLossOpen(true);
          }}
          onTransfer={() => {
            setRemoveOpen(false);
            setTransferOpen(true);
          }}
          onConfirm={() => removeItem.mutate()}
          onClose={() => setRemoveOpen(false)}
        />
      )}
    </EditorShell>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────
