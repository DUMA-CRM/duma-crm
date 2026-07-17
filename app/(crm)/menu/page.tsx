'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { MenuItemsPanel } from '@/components/menu/MenuItemsPanel';
import { ModifiersPanel } from '@/components/menu/ModifiersPanel';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Tab = 'items' | 'modifiers';

const TABS = [
  { value: 'items' as const, label: 'Menu Items' },
  { value: 'modifiers' as const, label: 'Modifiers' },
];

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>('items');
  const [createOpen, setCreateOpen] = useState(false);
  const { tenantId } = useWorkspaceStore();

  return (
    <PageLayout
      eyebrow="Catalogue"
      title="Menu"
      fullHeight
      headerBorder={false}
			className="pb-4 md:pb-8"
      headerSlot={
        <div className="flex items-center justify-between gap-3">
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
          {tenantId && (
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} />
              {tab === 'items' ? 'New Item' : 'New Modifier'}
            </button>
          )}
        </div>
      }
    >
      {tab === 'items' ? (
        <MenuItemsPanel createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      ) : (
        <ModifiersPanel createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      )}
    </PageLayout>
  );
}
