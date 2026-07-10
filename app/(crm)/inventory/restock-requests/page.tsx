'use client';

import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { RestockApprovals } from '@/components/inventory/RestockApprovals';
import { RestockRequestForm } from '@/components/inventory/RestockRequestForm';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

type View = 'new' | 'all';

const VIEW_TABS = [
  { value: 'new' as const, label: 'New Request' },
  { value: 'all' as const, label: 'All Requests' },
];

export default function RestockPage() {
  const [view, setView] = useState<View>('new');

  return (
    <PageLayout
      eyebrow="Operations"
      title="Restock"
      headerBorder={true}
      fullHeight
      headerSlot={<SegmentedControl options={VIEW_TABS} value={view} onChange={setView} />}
    >
      {view === 'new' ? <RestockRequestForm /> : <RestockApprovals />}
    </PageLayout>
  );
}
