'use client';

import { useMemo, useState } from 'react';

import { Plus, SlidersHorizontal, UtensilsCrossed } from '@/components/icons';
import { MenuItemEditorPage, MenuItemsPanel, type RecipeTarget } from '@/components/menu/MenuItemsPanel';
import { ModifierEditorPage, ModifiersPanel } from '@/components/menu/ModifiersPanel';
import { RecipeEditorPage } from '@/components/menu/RecipeEditorPage';
import { EditorShell } from '@/components/shared/EditorShell';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuItem, Modifier } from '@/types/menu';

type Tab = 'items' | 'modifiers';

// What the in-page editor is showing. `item`/`modifier` undefined = create mode.
type Editing = { kind: 'item'; item?: MenuItem } | { kind: 'modifier'; modifier?: Modifier };

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>('items');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [recipe, setRecipe] = useState<RecipeTarget | null>(null);
  const { tenantId } = useWorkspaceStore();

  const tabs = useMemo<SectionTab<Tab>[]>(
    () => [
      { value: 'items', label: 'Menu items', icon: UtensilsCrossed },
      { value: 'modifiers', label: 'Modifiers', icon: SlidersHorizontal },
    ],
    [],
  );

  // The editors render as in-page content (replacing the list) so the app sidebar
  // + header stay visible. Recipe takes precedence over the item editor; since
  // `editing` is retained, closing the recipe returns to the same item's editor.
  // Each editor brings its own EditorShell — one shell at a time, never nested.
  if (recipe) {
    return (
      <RecipeEditorPage menuItemId={recipe.menuItemId} itemName={recipe.itemName} price={recipe.price} onClose={() => setRecipe(null)} />
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
    <EditorShell
      eyebrow="Catalogue"
      title="Menu"
      icon={<UtensilsCrossed size={20} aria-hidden="true" />}
      actions={
        tenantId ? (
          <Button className="h-9 gap-1.5" onClick={() => setEditing(tab === 'items' ? { kind: 'item' } : { kind: 'modifier' })}>
            <Plus size={15} />
            <span className="hidden md:inline">{tab === 'items' ? 'New item' : 'New modifier'}</span>
            <span className="md:hidden">New</span>
          </Button>
        ) : undefined
      }
      subheader={<SectionTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Menu sections" />}
      // Both panels are full-height with their own scrolling table.
      flush
    >
      <div className="min-h-0 flex-1 overflow-hidden px-3 py-4 md:px-6 md:py-6">
        {tab === 'items' ? (
          <MenuItemsPanel onEdit={(item) => setEditing({ kind: 'item', item })} />
        ) : (
          <ModifiersPanel onEdit={(modifier) => setEditing({ kind: 'modifier', modifier })} />
        )}
      </div>
    </EditorShell>
  );
}
