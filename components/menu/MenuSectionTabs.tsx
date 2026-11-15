'use client';

import { usePathname, useRouter } from 'next/navigation';

import { LayoutDashboard, LayoutGrid, SlidersHorizontal, Tag, UtensilsCrossed } from '@/components/icons';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';

import { useCatalogWords } from '@/lib/hooks/useCatalogWords';

type Section = 'overview' | 'items' | 'categories' | 'modifiers';

const TABS: SectionTab<Section>[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'items', label: 'Items', icon: UtensilsCrossed },
  { value: 'categories', label: 'Categories', icon: LayoutGrid },
  { value: 'modifiers', label: 'Modifiers', icon: SlidersHorizontal },
];

/**
 * Overview / Items / Categories / Modifiers — the menu's pages.
 *
 * They are separate routes rather than local state, so the browser's Back
 * button works and a tab can be linked to. Each list page owns its own
 * EditorShell — the same shape as Customers and Inventory — so this is passed
 * as that shell's `subheader` rather than living in a shared layout.
 */
export function MenuSectionTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const words = useCatalogWords();
  // A shop has products and categories; modifiers (milks, syrups) are a kitchen's.
  const tabs = TABS.filter((tab) => tab.value !== 'modifiers' || words.tools.kitchen).map((tab) =>
    tab.value === 'items' && !words.tools.kitchen ? { ...tab, label: 'Products', icon: Tag } : tab,
  );
  const section: Section = pathname.startsWith('/menu/modifiers')
    ? 'modifiers'
    : pathname.startsWith('/menu/categories')
      ? 'categories'
      : pathname.startsWith('/menu/items')
        ? 'items'
        : 'overview';

  return (
    <SectionTabs
      tabs={tabs}
      value={section}
      onChange={(value) => router.push(value === 'overview' ? '/menu' : `/menu/${value}`)}
      ariaLabel={`${words.section} sections`}
      animationId="menu-section-tabs"
    />
  );
}
