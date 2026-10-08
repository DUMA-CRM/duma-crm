'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ChefHat, ImageIcon, Languages, Layers, UtensilsCrossed } from '@/components/icons';
import { DeleteMenuItemButton } from '@/components/menu/DeleteMenuItemButton';
import { MenuItemForm } from '@/components/menu/MenuItemForm';
import { ProductLanguages } from '@/components/menu/ProductLanguages';
import { ProductPhotos } from '@/components/menu/ProductPhotos';
import { RecipeEditor } from '@/components/menu/RecipeEditorPage';
import { VariantsEditor } from '@/components/menu/VariantsEditor';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { LoadingState } from '@/components/shared/Skeleton';
import { ActionButton, useDoneBeat } from '@/components/ui/action-button';

import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { getMenuItems } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const MENU_ITEM_FORM_ID = 'menu-item-detail-form';

type Tab = 'details' | 'sizes' | 'photos' | 'languages' | 'recipe';

const DETAIL_TABS: SectionTab<Tab>[] = [
  { value: 'details', label: 'Details', icon: UtensilsCrossed },
  // Retail: sizes and colours, each with its own SKU, price and stock; and the photos a shop shows.
  { value: 'sizes', label: 'Sizes & stock', icon: Layers },
  { value: 'photos', label: 'Photos', icon: ImageIcon },
  // Text in each language the website speaks, and prices in other currencies — a shop selling abroad.
  { value: 'languages', label: 'Languages & prices', icon: Languages },
  { value: 'recipe', label: 'Recipe & cost', icon: ChefHat },
];
const TAB_VALUES = DETAIL_TABS.map((entry) => entry.value);

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
  // `?tab=recipe` opens straight on the recipe — the Products page's "Add recipe" links here.
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab') as Tab | null;
  const [chosenTab, setTab] = useState<Tab>(requested && TAB_VALUES.includes(requested) && menuItemId ? requested : 'details');
  const [pending, setPending] = useState(false);
  const [justSaved, flashSaved] = useDoneBeat();
  const [dirty, setDirty] = useState(false);
  const words = useCatalogWords();
  // Only the tools this catalogue uses: a shop's product has no recipe, a café's item no sizes.
  const tabs = DETAIL_TABS.filter((entry) =>
    entry.value === 'sizes' || entry.value === 'photos' || entry.value === 'languages'
      ? words.tools.retail
      : entry.value === 'recipe'
        ? words.tools.kitchen
        : true,
  );
  const tab: Tab = tabs.some((entry) => entry.value === chosenTab) ? chosenTab : 'details';

  const { data: items = [], isLoading } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const item = menuItemId ? items.find((i) => i.id === menuItemId) : undefined;

  if (!tenantId) return null;

  if (menuItemId && !item) {
    return (
      <EditorShell title={words.Item} onClose={() => router.push('/menu/items')}>
        {isLoading ? (
          <LoadingState label={`Loading the ${words.item}`} className="flex-1" />
        ) : (
          <EmptyState
            icon={UtensilsCrossed}
            kind="gone"
            title={`This ${words.item} no longer exists`}
            description="It may have been deleted from another device."
          />
        )}
      </EditorShell>
    );
  }

  return (
    <EditorShell
      eyebrow={item ? words.Item : undefined}
      title={item ? item.name : `New ${words.item}`}
      icon={<UtensilsCrossed size={20} aria-hidden="true" />}
      onClose={() => router.push('/menu/items')}
      dirty={dirty && !pending}
      discardMessage={`This ${words.item} has changes that have not been saved. Leaving now discards them.`}
      // A brand-new item has no id yet, so there is nothing for a recipe to
      // attach to — the tab appears once it has been created.
      subheader={
        item && tabs.length > 1 ? <SectionTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel={`${words.Item} sections`} /> : undefined
      }
      actions={
        <>
          {item && <DeleteMenuItemButton item={item} onDeleted={() => router.push('/menu/items')} />}
          {/* Only the details form is a <form>; the recipe tab saves itself. */}
          {tab === 'details' && (
            <ActionButton type="submit" form={MENU_ITEM_FORM_ID} pending={pending} done={justSaved} className="h-9 min-w-36 px-5">
              {item ? 'Save changes' : `Create ${words.item}`}
            </ActionButton>
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
          // A product's next step is its sizes; a menu item's, its details and modifiers.
          onCreated={(created) =>
            router.replace(`/menu/items/${created.id}${words.tools.retail && !words.tools.kitchen ? '?tab=sizes' : ''}`)
          }
          onOpenTab={setTab}
          onSaved={flashSaved}
        />
      ) : tab === 'sizes' ? (
        <VariantsEditor menuItemId={item.id} productName={item.name} productPrice={item.price} tenantId={tenantId} />
      ) : tab === 'photos' ? (
        <ProductPhotos menuItemId={item.id} productName={item.name} tenantId={tenantId} />
      ) : tab === 'languages' ? (
        <ProductLanguages menuItemId={item.id} tenantId={tenantId} />
      ) : (
        <RecipeEditor menuItemId={item.id} price={item.price} vatRate={item.vatRate} />
      )}
    </EditorShell>
  );
}
