'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Check, Package, SlidersHorizontal, UtensilsCrossed } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { getStockItems } from '@/lib/api/inventory.service';
import { getModifiers } from '@/lib/api/menu.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Shown in place of the empty table on a workspace with no menu items.
 *
 * A bare "No menu items yet" told a new user nothing about the order the pieces
 * go in, and the order matters: ingredients must exist before a recipe can
 * reference them, and modifiers before an item can offer them.
 *
 * Built as a ruled ledger rather than a grid of cards — the system reserves
 * card grids for genuinely parallel objects, and these are sequential steps.
 * Each step reads its own state from real data, so it cannot claim something is
 * done when it is not.
 */
export function MenuSetupChecklist() {
  const { tenantId } = useWorkspaceStore();

  const { data: stockItems = [] } = useQuery({ queryKey: ['stock-items'], queryFn: getStockItems });
  const { data: modifiers = [] } = useQuery({
    queryKey: ['modifiers', tenantId],
    queryFn: () => getModifiers(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const steps = [
    {
      icon: Package,
      title: 'Add your ingredients',
      body: 'Beans, milk, cups. Costs entered here are what make margins real.',
      done: stockItems.length > 0,
      doneLabel: `${stockItems.length} stock ${stockItems.length === 1 ? 'item' : 'items'}`,
      href: '/inventory',
      cta: 'Open inventory',
    },
    {
      icon: SlidersHorizontal,
      title: 'Create your modifiers',
      body: 'Sizes, milks, syrups. Build one once and attach it to as many items as you like.',
      done: modifiers.length > 0,
      doneLabel: `${modifiers.length} ${modifiers.length === 1 ? 'modifier' : 'modifiers'}`,
      href: '/menu/modifiers/new',
      cta: 'New modifier',
    },
    {
      icon: UtensilsCrossed,
      title: 'Add your first menu item',
      body: 'Name it, price it, then attach modifiers and a recipe from the same screen.',
      done: false,
      doneLabel: '',
      href: '/menu/items/new',
      cta: 'New menu item',
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;

  return (
    <section className="overflow-hidden rounded-sm border border-rule bg-card shadow-sm">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3 md:px-5">
        <h2 className="text-sm font-semibold text-foreground">Build your menu</h2>
        <p className="text-label text-muted-foreground">
          {remaining} of {steps.length} still to do · each step needs the one before it
        </p>
      </div>

      <ol>
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="flex items-center gap-3 border-b border-rule/60 px-4 py-3 transition-colors last:border-0 hover:bg-band md:px-5"
            >
              {/* State reads as a mark and a colour, never colour alone. */}
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-sm',
                  step.done ? 'bg-success/6 text-success' : 'bg-band text-muted-foreground',
                )}
              >
                {step.done ? <Check size={13} aria-hidden="true" /> : <Icon size={13} aria-hidden="true" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </div>

              {step.done && <span className="hidden shrink-0 text-label text-success sm:block">{step.doneLabel}</span>}

              <Button asChild size="sm" variant={step.done ? 'ghost' : 'outline'} className="shrink-0">
                <Link href={step.href}>{step.cta}</Link>
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
