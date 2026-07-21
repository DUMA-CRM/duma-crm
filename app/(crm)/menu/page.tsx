'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { MenuItemEditorPage, MenuItemsPanel, type RecipeTarget } from '@/components/menu/MenuItemsPanel';
import { ModifierEditorPage, ModifiersPanel } from '@/components/menu/ModifiersPanel';
import { RecipeEditorPage } from '@/components/menu/RecipeEditorPage';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuItem, Modifier } from '@/types/menu';

type Tab = 'items' | 'modifiers';

// What the in-page editor is showing. `item`/`modifier` undefined = create mode.
type Editing = { kind: 'item'; item?: MenuItem } | { kind: 'modifier'; modifier?: Modifier };

const TABS = [
  { value: 'items' as const, label: 'Menu Items' },
  { value: 'modifiers' as const, label: 'Modifiers' },
];

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>('items');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [recipe, setRecipe] = useState<RecipeTarget | null>(null);
  const { tenantId } = useWorkspaceStore();

  // The editors render as in-page content (replacing the list) so the app sidebar
  // + header stay visible. Recipe takes precedence over the item editor; since
  // `editing` is retained, closing the recipe returns to the same item's editor.
  if (recipe) {
    return (
      <RecipeEditorPage
        menuItemId={recipe.menuItemId}
        itemName={recipe.itemName}
        price={recipe.price}
        onClose={() => setRecipe(null)}
      />
    );
  }
  if (editing?.kind === 'item') {
    return (
      <MenuItemEditorPage
        item={editing.item}
        onClose={() => setEditing(null)}
        onEditItem={(item) => setEditing({ kind: 'item', item })}
        onOpenRecipe={setRecipe}
      />
    );
  }
  if (editing?.kind === 'modifier') {
    return <ModifierEditorPage modifier={editing.modifier} onClose={() => setEditing(null)} />;
  }

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
              onClick={() => setEditing(tab === 'items' ? { kind: 'item' } : { kind: 'modifier' })}
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
        <MenuItemsPanel onEdit={(item) => setEditing({ kind: 'item', item })} />
      ) : (
        <ModifiersPanel onEdit={(modifier) => setEditing({ kind: 'modifier', modifier })} />
      )}
    </PageLayout>
  );
}
