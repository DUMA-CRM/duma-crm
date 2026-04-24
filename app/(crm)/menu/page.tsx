'use client';

import { PageLayout } from '@/components/layout/PageLayout';
import { MenuItemsTab } from '@/components/menu/MenuItemsTab';
import { ModifiersSidebar } from '@/components/menu/ModifiersSidebar';

export default function MenuPage() {
  return (
    <PageLayout eyebrow="Catalogue" title="Menu" headerBorder={false} sidebar={<ModifiersSidebar />} fullHeight={true}>
      <MenuItemsTab />
    </PageLayout>
  );
}
