'use client';

import { usePathname, useRouter } from 'next/navigation';

import { LayoutGrid, SlidersHorizontal, UtensilsCrossed } from '@/components/icons';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';

type Section = 'items' | 'categories' | 'modifiers';

const TABS: SectionTab<Section>[] = [
  { value: 'items', label: 'Menu items', icon: UtensilsCrossed },
  { value: 'categories', label: 'Categories', icon: LayoutGrid },
  { value: 'modifiers', label: 'Modifiers', icon: SlidersHorizontal },
];

/**
 * Items / Modifiers switch for the two menu list pages.
 *
 * They are separate routes rather than local state, so the browser's Back
 * button works and a tab can be linked to. Each list page owns its own
 * EditorShell — the same shape as Customers and Inventory — so this is passed
 * as that shell's `subheader` rather than living in a shared layout.
 */
export function MenuSectionTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const section: Section = pathname.startsWith('/menu/modifiers') ? 'modifiers' : pathname.startsWith('/menu/categories') ? 'categories' : 'items';

  return <SectionTabs tabs={TABS} value={section} onChange={(value) => router.push(`/menu/${value}`)} ariaLabel="Menu sections" />;
}
