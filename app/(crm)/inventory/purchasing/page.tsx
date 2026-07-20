'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { PurchaseOrdersPanel } from '@/components/purchasing/PurchaseOrdersPanel';
import { SuppliersPanel } from '@/components/purchasing/SuppliersPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

import { getSuppliers } from '@/lib/api/purchasing.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Tab = 'orders' | 'suppliers';

const TABS = [
  { value: 'orders' as const, label: 'Purchase Orders' },
  { value: 'suppliers' as const, label: 'Suppliers' },
];

export default function PurchasingPage() {
  const [tab, setTab] = useState<Tab>('orders');
  const [createOpen, setCreateOpen] = useState(false);
  const { tenantId, locationId } = useWorkspaceStore();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers(true),
    enabled: !!tenantId,
  });

  return (
    <PageLayout
      eyebrow="Operations"
      title="Purchasing"
      fullHeight
      headerBorder={false}
      headerSlot={
        <div className="flex items-center justify-between gap-3">
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
          {tenantId && (
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} />
              {tab === 'orders' ? 'New PO' : 'New Supplier'}
            </button>
          )}
        </div>
      }
    >
      {!tenantId ? (
        <EmptyState icon={Building2} title="No workspace selected" description="Select a workspace to manage purchasing." />
      ) : tab === 'suppliers' ? (
        <SuppliersPanel suppliers={suppliers} createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      ) : !locationId ? (
        <EmptyState icon={MapPin} title="No location selected" description="Select a location from the header to see its purchase orders." />
      ) : (
        <PurchaseOrdersPanel suppliers={suppliers} locationId={locationId} createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      )}
    </PageLayout>
  );
}
