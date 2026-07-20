'use client';

import { MapPin } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { BatchesPanel } from '@/components/stocktakes/BatchesPanel';
import { StocktakePanel } from '@/components/stocktakes/StocktakePanel';

import { useWorkspaceStore } from '@/stores/workspaceStore';

type Tab = 'stocktakes' | 'batches';

const TABS = [
  { value: 'stocktakes' as const, label: 'Stocktakes' },
  { value: 'batches' as const, label: 'Expiry Batches' },
];

export default function StocktakesPage() {
  const [tab, setTab] = useState<Tab>('stocktakes');
  const { locationId } = useWorkspaceStore();

  return (
    <PageLayout
      eyebrow="Operations"
      title="Stocktakes"
      fullHeight
      headerBorder={false}
      headerSlot={<SegmentedControl options={TABS} value={tab} onChange={setTab} />}
    >
      {!locationId ? (
        <EmptyState icon={MapPin} title="No location selected" description="Select a location from the header to count its stock." />
      ) : tab === 'stocktakes' ? (
        <StocktakePanel locationId={locationId} />
      ) : (
        <BatchesPanel locationId={locationId} />
      )}
    </PageLayout>
  );
}
