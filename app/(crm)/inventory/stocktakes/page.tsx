'use client';

import { MapPin } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { StocktakePanel } from '@/components/stocktakes/StocktakePanel';

import { useWorkspaceStore } from '@/stores/workspaceStore';

export default function StocktakesPage() {
  const { locationId } = useWorkspaceStore();

  return (
    <PageLayout
      eyebrow="Operations"
      title="Stocktakes"
      fullHeight
      headerBorder={false}
    >
      {!locationId ? (
        <EmptyState icon={MapPin} title="No location selected" description="Select a location from the header to count its stock." />
      ) : <StocktakePanel locationId={locationId} />}
    </PageLayout>
  );
}
