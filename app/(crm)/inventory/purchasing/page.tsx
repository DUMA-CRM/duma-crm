'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, ClipboardList, FileEdit, MapPin, PackageCheck, Plus, ShoppingCart, Truck, Users } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

import { RestockApprovals } from '@/components/inventory/RestockApprovals';
import { RestockRequestForm } from '@/components/inventory/RestockRequestForm';
import { type PurchaseOrderDraft, PurchaseOrdersPanel } from '@/components/purchasing/PurchaseOrdersPanel';
import { SuppliersPanel } from '@/components/purchasing/SuppliersPanel';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { SectionTabs, type SectionTab } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import { type PurchaseOrderStatus, getPurchaseOrders, getSuppliers } from '@/lib/api/purchasing.service';
import { type RestockRequest, type RestockStatus, getRestockRequests } from '@/lib/api/restock.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type View = 'demand' | 'orders' | 'suppliers';

/** Where a pipeline card sends you: a tab plus the filter that shows exactly its count. */
interface Step {
  key: string;
  icon: typeof ClipboardList;
  label: string;
  hint: string;
  value: number;
  tone: 'warning' | 'primary' | 'info';
  view: View;
  demandStatus?: RestockStatus;
  poStatus?: 'all' | PurchaseOrderStatus;
}

const TONE_VALUE: Record<Step['tone'], string> = {
  warning: 'text-warning',
  primary: 'text-primary',
  info: 'text-info',
};

export default function PurchasingPage() {
  const [view, setView] = useState<View>('demand');
  const [demandStatus, setDemandStatus] = useState<RestockStatus>('pending');
  const [poStatus, setPoStatus] = useState<'all' | PurchaseOrderStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [poDraft, setPoDraft] = useState<PurchaseOrderDraft | null>(null);
  const { tenantId, locationId } = useWorkspaceStore();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers(true),
    enabled: !!tenantId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
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
      {
        queryKey: ['purchase-orders', 'workspace-summary', locationId, 'draft'],
        queryFn: () => getPurchaseOrders({ locationId: locationId!, status: 'draft', limit: 1 }),
        enabled: !!locationId,
      },
    ],
  });

  const pendingDemand = summaryQueries[0].data?.total ?? 0;
  const approvedDemand = summaryQueries[1].data?.total ?? 0;
  const submittedOrders = summaryQueries[2].data?.total ?? 0;
  const partDelivered = summaryQueries[3].data?.total ?? 0;
  const draftOrders = summaryQueries[4].data?.total ?? 0;
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive).length;
  const purchaseOrderLocationId = locationId ?? poDraft?.locationId ?? null;
  const locationName = locations.find((location) => location.id === locationId)?.name ?? null;

  // Request → order → delivery, with the live count at each stage. Every card is a
  // link into the list that holds exactly those records.
  const steps = useMemo<Step[]>(() => {
    const flow: Step[] = [
      {
        key: 'review',
        icon: ClipboardList,
        label: 'Needs review',
        hint: 'Requests awaiting a decision',
        value: pendingDemand,
        tone: 'warning',
        view: 'demand',
        demandStatus: 'pending',
      },
      {
        key: 'order',
        icon: ShoppingCart,
        label: 'Ready to order',
        hint: 'Approved, not yet on a PO',
        value: approvedDemand,
        tone: 'primary',
        view: 'demand',
        demandStatus: 'approved',
      },
    ];
    // Written but never sent — easy to forget, so it earns a slot while it exists.
    if (draftOrders > 0) {
      flow.push({
        key: 'draft',
        icon: FileEdit,
        label: 'Draft POs',
        hint: 'Created but not sent to the supplier',
        value: draftOrders,
        tone: 'warning',
        view: 'orders',
        poStatus: 'draft',
      });
    }
    flow.push({
      key: 'transit',
      icon: Truck,
      label: 'Out with suppliers',
      hint: 'Submitted, awaiting delivery',
      value: submittedOrders,
      tone: 'info',
      view: 'orders',
      poStatus: 'submitted',
    });
    // An exception state, not a stage — only worth space when something is stuck.
    if (partDelivered > 0) {
      flow.push({
        key: 'part',
        icon: PackageCheck,
        label: 'Part delivered',
        hint: 'Some lines still outstanding',
        value: partDelivered,
        tone: 'warning',
        view: 'orders',
        poStatus: 'partially_received',
      });
    }
    return flow;
  }, [pendingDemand, approvedDemand, draftOrders, submittedOrders, partDelivered]);

  const tabs = useMemo<SectionTab<View>[]>(
    () => [
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
    ],
    [pendingDemand, submittedOrders, partDelivered, activeSuppliers],
  );

  function changeView(nextView: View) {
    setView(nextView);
    setCreateOpen(false);
    setPoDraft(null);
  }

  function goToStep(step: Step) {
    setCreateOpen(false);
    setPoDraft(null);
    setView(step.view);
    if (step.demandStatus) setDemandStatus(step.demandStatus);
    if (step.poStatus) setPoStatus(step.poStatus);
  }

  const isCurrentStep = (step: Step) =>
    step.view === view &&
    (step.demandStatus ? step.demandStatus === demandStatus : true) &&
    (step.poStatus ? step.poStatus === poStatus : true);

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
    setView('orders');
    setCreateOpen(true);
  }

  const actionLabel = view === 'demand' ? 'New request' : view === 'orders' ? 'New purchase order' : 'New supplier';

  return (
    <EditorShell
      eyebrow="Inventory"
      title="Purchasing"
      icon={<ShoppingCart size={20} aria-hidden="true" />}
      meta={
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin size={12} aria-hidden="true" />
          {locationName ?? 'No location selected'}
          {view === 'suppliers' && <span className="text-muted-foreground/70">· suppliers are shared across locations</span>}
        </span>
      }
      actions={
        tenantId ? (
          <Button
            className="h-10 gap-1.5"
            onClick={() => {
              setPoDraft(null);
              setCreateOpen(true);
            }}
            disabled={view === 'orders' && !purchaseOrderLocationId}
            title={view === 'orders' && !purchaseOrderLocationId ? 'Select a location first' : undefined}
          >
            <Plus size={15} />
            <span className="hidden md:inline">{actionLabel}</span>
          </Button>
        ) : undefined
      }
      subheader={tenantId ? <SectionTabs tabs={tabs} value={view} onChange={changeView} ariaLabel="Purchasing sections" /> : undefined}
    >
      {!tenantId ? (
        <EmptyState icon={Building2} title="No workspace selected" description="Select a workspace to manage purchasing." />
      ) : (
        <div className="space-y-5">
          {/* Pipeline — one quiet line: the count at each stage, and a way into it */}
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-xl border border-border bg-card px-2 py-1.5 text-xs">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const current = isCurrentStep(step);
              return (
                <Fragment key={step.key}>
                  <button
                    type="button"
                    onClick={() => goToStep(step)}
                    title={step.hint}
                    aria-current={current ? 'true' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface-offset',
                      current && 'bg-surface-offset',
                    )}
                  >
                    <Icon
                      size={13}
                      aria-hidden="true"
                      className={step.value > 0 ? TONE_VALUE[step.tone] : 'text-muted-foreground/60'}
                    />
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className={cn('font-bold tabular-nums', step.value > 0 ? TONE_VALUE[step.tone] : 'text-muted-foreground')}>
                      {step.value}
                    </span>
                  </button>
                  {index < steps.length - 1 && (
                    <ArrowRight size={12} className="shrink-0 text-muted-foreground/40" aria-hidden="true" />
                  )}
                </Fragment>
              );
            })}
          </div>

          {view === 'demand' ? (
            <RestockApprovals
              status={demandStatus}
              onStatusChange={setDemandStatus}
              onCreatePurchaseOrder={(request) => draftFromRequests([request])}
              onCreatePurchaseOrderBatch={draftFromRequests}
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
              status={poStatus}
              onStatusChange={setPoStatus}
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
              <RestockRequestForm
                onSubmitted={() => {
                  // Close and land on the list the new request just joined.
                  setCreateOpen(false);
                  setDemandStatus('pending');
                }}
              />
            </Modal>
          )}
        </div>
      )}
    </EditorShell>
  );
}
