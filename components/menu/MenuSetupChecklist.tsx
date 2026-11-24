'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Check, Package, SlidersHorizontal, UtensilsCrossed } from '@/components/icons';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Button } from '@/components/ui/button';

import { getModifiers } from '@/lib/modules/catalog/client';
import { getStockItems } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The Overview on a workspace with no menu items.
 *
 * A bare "No menu items yet" told a new user nothing about the order the pieces
 * go in, and the order matters: ingredients must exist before a recipe can
 * reference them, and modifiers before an item can offer them.
 *
 * One list of rows rather than a grid of cards — these are sequential steps,
 * not parallel objects. Each step reads its own state from real data, so it cannot claim something is
 * done when it is not.
 */
export function MenuSetupChecklist() {
  const { tenantId } = useWorkspaceStore();

  const { data: stockItems = [] } = useQuery({ queryKey: moduleQueryKeys.inventory.key('stock-items'), queryFn: getStockItems });
  const { data: modifiers = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifiers', tenantId),
    queryFn: () => getModifiers(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const steps = [
    {
      icon: Package,
      title: 'Add your ingredients',
      body: 'Beans, milk, cups — their costs make margins real.',
      done: stockItems.length > 0,
      doneLabel: `${stockItems.length} stock ${stockItems.length === 1 ? 'item' : 'items'}`,
      href: '/inventory',
      cta: 'Open inventory',
    },
    {
      icon: SlidersHorizontal,
      title: 'Create your modifiers',
      body: 'Sizes, milks, syrups — build once, attach to any item.',
      done: modifiers.length > 0,
      doneLabel: `${modifiers.length} ${modifiers.length === 1 ? 'modifier' : 'modifiers'}`,
      href: '/menu/modifiers?new=1',
      cta: 'New modifier',
    },
    {
      icon: UtensilsCrossed,
      title: 'Add your first menu item',
      body: 'Name and price it, then add modifiers and a recipe.',
      done: false,
      doneLabel: '',
      href: '/menu/items/new',
      cta: 'New menu item',
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;

  return (
    <RecordGroup
      id="menu-setup"
      title="Build your menu"
      actions={
        <span className="text-xs tabular-nums text-muted-foreground">
          {remaining} of {steps.length} to do
        </span>
      }
      footnote="Each step needs the one before it."
    >
      <ListRowGroup aria-label="Build your menu">
        {steps.map((step) => (
          <ListRow
            key={step.title}
            // State reads as a mark and a colour, never colour alone.
            icon={step.done ? Check : step.icon}
            tone={step.done ? 'success' : 'muted'}
            iconLabel={step.done ? 'Done' : undefined}
            title={step.title}
            meta={step.body}
            trailing={step.done ? <span className="hidden text-xs text-momentum sm:inline">{step.doneLabel}</span> : undefined}
            control={
              <Button asChild size="sm" variant={step.done ? 'ghost' : 'outline'}>
                <Link href={step.href}>{step.cta}</Link>
              </Button>
            }
          />
        ))}
      </ListRowGroup>
    </RecordGroup>
  );
}
