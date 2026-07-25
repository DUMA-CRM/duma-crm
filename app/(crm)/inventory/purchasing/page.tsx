'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, ClipboardList, MapPin, Plus, ShoppingCart, Truck } from 'lucide-react';
import { useState } from 'react';

import { RestockApprovals } from '@/components/inventory/RestockApprovals';
import { RestockRequestForm } from '@/components/inventory/RestockRequestForm';
import { PageLayout } from '@/components/layout/PageLayout';
import { type PurchaseOrderDraft, PurchaseOrdersPanel } from '@/components/purchasing/PurchaseOrdersPanel';
import { SuppliersPanel } from '@/components/purchasing/SuppliersPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';

import { getPurchaseOrders, getSuppliers } from '@/lib/api/purchasing.service';
import { getRestockRequests } from '@/lib/api/restock.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type View = 'demand' | 'orders' | 'suppliers';

const TABS = [
  { value: 'demand' as const, label: 'Restock demand' },
  { value: 'orders' as const, label: 'Purchase orders' },
  { value: 'suppliers' as const, label: 'Suppliers' },
];

const FLOW = [
  { icon: ClipboardList, label: 'Request', hint: 'Capture stock demand' },
  { icon: ShoppingCart, label: 'Order', hint: 'Choose a supplier' },
  { icon: Truck, label: 'Receive', hint: 'Record the delivery' },
];

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'warning' | 'primary' | 'success' }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-offset px-3.5 py-3">
      <p
        className={cn(
          'text-xl font-bold tabular-nums text-foreground',
          tone === 'warning' && 'text-warning',
          tone === 'primary' && 'text-primary',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

export default function PurchasingPage() {
  const [view, setView] = useState<View>('demand');
  const [createOpen, setCreateOpen] = useState(false);
  const [poDraft, setPoDraft] = useState<PurchaseOrderDraft | null>(null);
  const { tenantId, locationId } = useWorkspaceStore();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers(true),
    enabled: !!tenantId,
  });

  const summaryQueries = useQueries({
    queries: [
      {
        queryKey: ['restock-requests', 'workspace-summary', 'pending'],
        queryFn: () => getRestockRequests({ status: 'pending', limit: 1 }),
        enabled: !!tenantId,
      },
      {
        queryKey: ['restock-requests', 'workspace-summary', 'approved'],
        queryFn: () => getRestockRequests({ status: 'approved', limit: 1 }),
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
  const approvedDemand = summaryQueries[1].data?.total ?? 0;
  const awaitingDelivery = (summaryQueries[2].data?.total ?? 0) + (summaryQueries[3].data?.total ?? 0);
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive).length;
  const purchaseOrderLocationId = locationId ?? poDraft?.locationId ?? null;

  function changeView(nextView: View) {
    setView(nextView);
    setCreateOpen(false);
    setPoDraft(null);
  }

  function openCreate() {
    setPoDraft(null);
    setCreateOpen(true);
  }

  const actionLabel = view === 'demand' ? 'New request' : view === 'orders' ? 'New purchase order' : 'New supplier';

  return (
    <PageLayout
      eyebrow="Inventory"
      title="Purchasing"
      fullHeight
      headerBorder
      headerSlot={
        tenantId ? (
          <Button onClick={openCreate} disabled={view === 'orders' && !locationId}>
            <Plus size={15} />
            {actionLabel}
          </Button>
        ) : null
      }
    >
      {!tenantId ? (
        <EmptyState icon={Building2} title="No workspace selected" description="Select a workspace to manage purchasing." />
      ) : (
        <div className="space-y-5 pb-8">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)] lg:p-5">
              <div>
                <p className="text-sm font-semibold text-foreground">One workflow from stock request to delivery</p>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Review demand, turn approved items into supplier purchase orders, then receive the delivery back into inventory.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {FLOW.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.label} className="contents">
                        <div className="flex min-w-[9rem] items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">{step.label}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{step.hint}</p>
                          </div>
                        </div>
                        {index < FLOW.length - 1 && <ArrowRight size={14} className="hidden shrink-0 text-muted-foreground sm:block" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Metric label="Needs review" value={pendingDemand} tone={pendingDemand > 0 ? 'warning' : undefined} />
                <Metric label="Ready to order" value={approvedDemand} tone={approvedDemand > 0 ? 'primary' : undefined} />
                <Metric label="Awaiting delivery" value={awaitingDelivery} tone={awaitingDelivery > 0 ? 'primary' : undefined} />
                <Metric label="Active suppliers" value={activeSuppliers} tone={activeSuppliers > 0 ? 'success' : undefined} />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl options={TABS} value={view} onChange={changeView} />
            <p className="hidden text-xs text-muted-foreground md:block">
              {view === 'demand'
                ? 'Approve requests before creating a purchase order.'
                : view === 'orders'
                  ? 'Open an order to submit it or receive a delivery.'
                  : 'Supplier records are shared across all locations.'}
            </p>
          </div>

          {view === 'demand' ? (
            <RestockApprovals
              onCreatePurchaseOrder={(request) => {
                setPoDraft({
                  locationId: request.locationId,
                  restockRequestId: request.id,
                  notes: `Created from restock request ${request.id.slice(0, 8)}`,
                  lines: [
                    {
                      stockItemId: request.stockItemId,
                      quantity: String(request.requestedQty),
                      unitCost: request.stockItem?.costPerUnit ?? '',
                    },
                  ],
                });
                setView('orders');
                setCreateOpen(true);
              }}
            />
          ) : view === 'suppliers' ? (
            <SuppliersPanel suppliers={suppliers} createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
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
              createOpen={createOpen}
              onCreateOpenChange={setCreateOpen}
              draft={poDraft}
              onManageSuppliers={() => {
                setView('suppliers');
                setCreateOpen(true);
              }}
            />
          )}

          {view === 'demand' && createOpen && (
            <Modal title="New Restock Request" onClose={() => setCreateOpen(false)} className="max-w-3xl">
              <RestockRequestForm />
            </Modal>
          )}
        </div>
      )}
    </PageLayout>
  );
}
