'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ChefHat, Loader2, UtensilsCrossed } from '@/components/icons';
import { MenuItemForm } from '@/components/menu/MenuItemForm';
import { RecipeEditor } from '@/components/menu/RecipeEditorPage';
import { DeleteMenuItemButton } from '@/components/menu/DeleteMenuItemButton';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import { getMenuItems } from '@/lib/api/menu.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const MENU_ITEM_FORM_ID = 'menu-item-detail-form';

type Tab = 'details' | 'recipe';

const DETAIL_TABS: SectionTab<Tab>[] = [
  { value: 'details', label: 'Details', icon: UtensilsCrossed },
  { value: 'recipe', label: 'Recipe & cost', icon: ChefHat },
];

/**
 * A menu item's record: a full page reached from the list, with a back button —
 * the same shape as a customer or an inventory item. It owns its own
 * EditorShell, and the list route owns a separate one.
 *
 * Recipe is a tab here rather than a separate screen. It used to be a fourth
 * level of nesting — list, then item editor, then recipe page, then a modal on
 * top of that — which meant leaving the item to price it.
 */
export function MenuItemDetail({ menuItemId }: { menuItemId?: string }) {
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const [tab, setTab] = useState<Tab>('details');
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items', tenantId],
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const item = menuItemId ? items.find((i) => i.id === menuItemId) : undefined;

  if (!tenantId) return null;

  if (menuItemId && !item) {
    return (
      <EditorShell title="Menu item" onClose={() => router.push('/menu/items')}>
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <EmptyState
            icon={UtensilsCrossed}
            title="This menu item no longer exists"
            description="It may have been deleted from another device."
          />
        )}
      </EditorShell>
    );
  }

  return (
    <EditorShell
      eyebrow={item ? 'Menu item' : undefined}
      title={item ? item.name : 'New menu item'}
      icon={<UtensilsCrossed size={20} aria-hidden="true" />}
      onClose={() => router.push('/menu/items')}
      dirty={dirty && !pending}
      discardMessage="This menu item has changes that have not been saved. Leaving now discards them."
      // A brand-new item has no id yet, so there is nothing for a recipe to
      // attach to — the tab appears once it has been created.
      subheader={item ? <SectionTabs tabs={DETAIL_TABS} value={tab} onChange={setTab} ariaLabel="Menu item sections" /> : undefined}
      actions={
        <>
          {item && <DeleteMenuItemButton item={item} onDeleted={() => router.push('/menu/items')} />}
          {/* Only the details form is a <form>; the recipe tab saves itself. */}
          {tab === 'details' && (
            <Button type="submit" form={MENU_ITEM_FORM_ID} disabled={pending} className="h-9 gap-2 px-5">
              {pending && <Loader2 size={15} className="animate-spin" />}
              {pending ? 'Saving…' : item ? 'Update' : 'Create'}
            </Button>
          )}
        </>
      }
    >
      {tab === 'details' || !item ? (
        <MenuItemForm
          tenantId={tenantId}
          item={item}
          formId={MENU_ITEM_FORM_ID}
          onPendingChange={setPending}
          onDirtyChange={setDirty}
          // Creating navigates to the new item's own URL, so the address bar
          // and the Back button both stay honest.
          onCreated={(created) => router.replace(`/menu/items/${created.id}`)}
          onSaved={() => undefined}
          onOpenRecipe={() => setTab('recipe')}
        />
      ) : (
        <RecipeEditor menuItemId={item.id} price={item.price} vatRate={item.vatRate} />
      )}
    </EditorShell>
  );
}
