'use client';

import { useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { MenuItemsTab } from '@/components/menu/MenuItemsTab';
import { ModifiersSidebar } from '@/components/menu/ModifiersSidebar';
import { LocationPricingTab } from '@/components/menu/LocationPricingTab';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

const TABS = [
  { value: 'items', label: 'Items' },
  { value: 'location-pricing', label: 'Location Pricing' },
] as const;

type Tab = (typeof TABS)[number]['value'];

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>('items');

  return (
    <PageLayout
      eyebrow="Catalogue"
      title="Menu"
      headerBorder={false}
      headerSlot={<SegmentedControl options={TABS} value={tab} onChange={setTab} />}
      sidebar={tab === 'items' ? <ModifiersSidebar /> : undefined}
      fullHeight={tab === 'location-pricing'}
    >
      {tab === 'items' && <MenuItemsTab />}
      {tab === 'location-pricing' && <LocationPricingTab />}
    </PageLayout>
  );
}
