'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Boxes, Building2, ClipboardCheck, ClipboardList, MapPin, Package, Plus, Truck, Users } from '@/components/icons';
import { RestockApprovals } from '@/components/inventory/RestockApprovals';
import { RestockRequestForm } from '@/components/inventory/RestockRequestForm';
import { StockOverview } from '@/components/inventory/StockOverview';
import { type PurchaseOrderDraft, PurchaseOrdersPanel } from '@/components/purchasing/PurchaseOrdersPanel';
import { SuppliersPanel } from '@/components/purchasing/SuppliersPanel';
import { Drawer } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { StartStocktakeButton, StocktakePanel } from '@/components/stocktakes/StocktakePanel';
import { Button } from '@/components/ui/button';

import { type PurchaseOrderStatus, getPurchaseOrders, getSuppliers } from '@/lib/api/purchasing.service';
import { type RestockRequest, type RestockStatus, getRestockRequests } from '@/lib/api/restock.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** Everything inventory: what's on the shelf, what's on order, and counting it. */
type Tab = 'stock' | 'demand' | 'orders' | 'suppliers' | 'stocktakes';

const TAB_VALUES: Tab[] = ['stock', 'demand', 'orders', 'suppliers', 'stocktakes'];

/** The header button each tab offers. Stocktakes brings its own (`StartStocktakeButton`). */
const ACTION_LABEL: Partial<Record<Tab, string>> = {
  stock: 'Add item',
  demand: 'New request',
  orders: 'New purchase order',
  suppliers: 'New supplier',
};

/**
 * One page for the whole inventory area — stock, purchasing and stocktakes as
 * tabs rather than sibling routes, so the sidebar carries a single entry. The
 * open tab lives in the query string (`?tab=orders`), keeping links shareable
 * and the browser's back button meaningful.
 */
export function InventoryWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tenantId, locationId } = useWorkspaceStore();

  const requestedTab = searchParams.get('tab');
  const tab: Tab = TAB_VALUES.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'stock';

  const [demandStatus, setDemandStatus] = useState<RestockStatus>('pending');
  const [poStatus, setPoStatus] = useState<'all' | PurchaseOrderStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [poDraft, setPoDraft] = useState<PurchaseOrderDraft | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers(true),
    enabled: !!tenantId,
  });

  // Live counts for the tab pills — one cheap `limit: 1` call per status.
  const summaryQueries = useQueries({
    queries: [
      {
        queryKey: ['restock-requests', 'workspace-summary', 'pending'],
        queryFn: () => getRestockRequests({ status: 'pending', limit: 1 }),
        enabled: !!tenantId,
      },
      {
        queryKey: ['purchase-orders', 'workspace-summary', locationId, 'submitted'],
        queryFn: () => getPurchaseOrders({ locationId: locationId!, status: 'submitted', limit: 1 }),
        enabled: !!locationId,
      },
      {
        queryKey: ['purchase-orders', 'workspace-summary', locationId, 'partially_received'],
        queryFn: () => getPurchaseOrders({ locationId: locationId!, status: 'partially_received', limit: 1 }),
        enabled: !!locationId,
      },
    ],
  });

  const pendingDemand = summaryQueries[0].data?.total ?? 0;
  const submittedOrders = summaryQueries[1].data?.total ?? 0;
  const partDelivered = summaryQueries[2].data?.total ?? 0;
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive).length;
  const purchaseOrderLocationId = locationId ?? poDraft?.locationId ?? null;

  const tabs = useMemo<SectionTab<Tab>[]>(
    () => [
      { value: 'stock', label: 'Stock', icon: Package },
      {
        value: 'demand',
        label: 'Restock demand',
        icon: ClipboardList,
        count: pendingDemand,
        countTone: 'danger',
        countLabel: `${pendingDemand} awaiting review`,
      },
      {
        value: 'orders',
        label: 'Purchase orders',
        icon: Truck,
        count: submittedOrders + partDelivered,
        countLabel: `${submittedOrders + partDelivered} awaiting delivery`,
      },
      { value: 'suppliers', label: 'Suppliers', icon: Users, count: activeSuppliers, countLabel: `${activeSuppliers} active suppliers` },
      { value: 'stocktakes', label: 'Stocktakes', icon: ClipboardCheck },
    ],
    [pendingDemand, submittedOrders, partDelivered, activeSuppliers],
  );

  /** Move to a tab, leaving any in-flight create form alone. */
  function goToTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'stock') params.delete('tab');
    else params.set('tab', next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  /** What the tab bar does: switching by hand abandons whatever was being created. */
  function selectTab(next: Tab) {
    setCreateOpen(false);
    setPoDraft(null);
    goToTab(next);
  }

  /** Turn approved restock demand into a PO draft and open the create form. */
  function draftFromRequests(requests: RestockRequest[]) {
    if (requests.length === 0) return;
    // Two requests for the same item become one line.
    const merged = new Map<string, { stockItemId: string; quantity: number; unitCost: string }>();
    for (const request of requests) {
      const existing = merged.get(request.stockItemId);
      if (existing) existing.quantity += Number(request.requestedQty);
      else
        merged.set(request.stockItemId, {
          stockItemId: request.stockItemId,
          quantity: Number(request.requestedQty),
          unitCost: request.stockItem?.costPerUnit ?? '',
        });
    }
    setPoDraft({
      locationId: requests[0].locationId,
      restockRequestIds: requests.map((request) => request.id),
      notes:
        requests.length === 1
          ? `Created from restock request ${requests[0].id.slice(0, 8)}`
          : `Created from ${requests.length} approved restock requests`,
      lines: [...merged.values()].map((line) => ({
        stockItemId: line.stockItemId,
        quantity: String(line.quantity),
        unitCost: line.unitCost,
      })),
    });
    goToTab('orders');
    setCreateOpen(true);
  }

  const actionLabel = ACTION_LABEL[tab];
  // Stock and orders are per-location; the rest only need a workspace.
  const actionBlocked = (tab === 'stock' && !locationId) || (tab === 'orders' && !purchaseOrderLocationId);

  return (
    <EditorShell
      eyebrow="Operations"
      title="Inventory"
      icon={<Package size={20} aria-hidden="true" />}
      actions={
        !tenantId ? undefined : tab === 'stocktakes' ? (
          locationId && <StartStocktakeButton locationId={locationId} />
        ) : actionLabel ? (
          <Button
            className="h-10 gap-1.5"
            onClick={() => {
              setPoDraft(null);
              setCreateOpen(true);
            }}
            disabled={actionBlocked}
            title={actionBlocked ? 'Select a location first' : undefined}
          >
            <Plus size={15} aria-hidden="true" />
            <span className="hidden md:inline">{actionLabel}</span>
          </Button>
        ) : undefined
      }
      subheader={tenantId ? <SectionTabs tabs={tabs} value={tab} onChange={selectTab} ariaLabel="Inventory sections" /> : undefined}
    >
      {!tenantId ? (
        <EmptyState icon={Building2} title="No workspace selected" description="Select a workspace to manage inventory." />
      ) : (
        <div className="space-y-5">
          {tab === 'stock' ? (
            !locationId ? (
              <EmptyState
                icon={Boxes}
                title="No location selected"
                description="Select a location from the header to view and manage its stock."
              />
            ) : (
              <StockOverview locationId={locationId} addOpen={createOpen} onAddOpenChange={setCreateOpen} />
            )
          ) : tab === 'demand' ? (
            <RestockApprovals
              status={demandStatus}
              onStatusChange={setDemandStatus}
              onCreatePurchaseOrder={(request) => draftFromRequests([request])}
              onCreatePurchaseOrderBatch={draftFromRequests}
            />
          ) : tab === 'suppliers' ? (
            <SuppliersPanel suppliers={suppliers} createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
          ) : tab === 'stocktakes' ? (
            !locationId ? (
              <EmptyState icon={MapPin} title="No location selected" description="Select a location from the header to count its stock." />
            ) : (
              <StocktakePanel locationId={locationId} />
            )
          ) : !purchaseOrderLocationId ? (
            <EmptyState
              icon={MapPin}
              title="No location selected"
              description="Select a location from the header to see its purchase orders."
            />
          ) : (
            <PurchaseOrdersPanel
              suppliers={suppliers}
              locationId={purchaseOrderLocationId}
              status={poStatus}
              onStatusChange={setPoStatus}
              createOpen={createOpen}
              onCreateOpenChange={setCreateOpen}
              draft={poDraft}
              onManageSuppliers={() => {
                goToTab('suppliers');
                setCreateOpen(true);
              }}
            />
          )}

          {tab === 'demand' && createOpen && (
            <Drawer
              title="New Restock Request"
              description="Ask for more of an item at this location — approvals pick it up from the demand queue."
              onClose={() => setCreateOpen(false)}
              className="max-w-3xl"
            >
              <RestockRequestForm
                onSubmitted={() => {
                  // Close and land on the list the new request just joined.
                  setCreateOpen(false);
                  setDemandStatus('pending');
                }}
              />
            </Drawer>
          )}
        </div>
      )}
    </EditorShell>
  );
}
