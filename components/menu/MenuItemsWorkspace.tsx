'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ChefHat, CircleDollarSign, Plus, Search, UtensilsCrossed, X } from '@/components/icons';
import { MenuSectionTabs } from '@/components/menu/MenuSectionTabs';
import { MenuSetupChecklist } from '@/components/menu/MenuSetupChecklist';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { NeedsAttention } from '@/components/shared/NeedsAttention';
import { Pill } from '@/components/shared/Pill';
import { Bone, RowSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { type MenuItemCost, useMenuItemCosts } from '@/lib/hooks/useMenuItemCosts';
import { getMenuCategories, getMenuItems, updateMenuItem } from '@/lib/modules/catalog/client';
import { getRecipeGaps } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/dashboard';
import { filterMenuItems, groupByCategory, setupGaps } from '@/lib/utils/menu-list';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuCategory, MenuItem } from '@/types/menu';

/**
 * The menu items list in the settings vocabulary: what needs a recipe first,
 * then a search and category, then items under their category as audit rows —
 * one row carrying what used to be three views: setup gaps, margin, price and
 * whether it's on the menu. Each opens the full item record.
 */
export function MenuItemsWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canReadRecipes = hasCapability(capabilities, 'recipes:read');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MenuCategory>('all');

  const itemsQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: categories = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId!),
    enabled: Boolean(tenantId),
  });
  // Moved here from the Inventory stock tab: a menu item without a recipe is a
  // menu problem — its sales take no stock off and its allergen answer is incomplete.
  const gaps = useQuery({
    queryKey: moduleQueryKeys.inventory.key('menu-item-recipe-gaps', tenantId),
    queryFn: () => getRecipeGaps(tenantId!),
    enabled: !!tenantId && canReadRecipes,
  });

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const filtered = useMemo(() => filterMenuItems(items, search, categoryFilter), [items, search, categoryFilter]);
  const groups = groupByCategory(filtered, categories);

  // A request per item (cached, and shared with the item page) — fine for a café
  // menu, and the price of showing margin on every row.
  const costs = useMenuItemCosts(filtered);

  const availability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => updateMenuItem(id, { isAvailable }),
    onSuccess: (_, { isAvailable }) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-items') });
      toast('success', isAvailable ? 'Back on the menu.' : 'Taken off the menu — it won’t show at the till.');
    },
    onError: (err) => toast('error', err.message || 'Availability wasn’t updated. Try again.'),
  });

  return (
    <EditorShell
      title="Menu"
      icon={<UtensilsCrossed size={20} aria-hidden="true" />}
      subheader={<MenuSectionTabs />}
      actions={
        tenantId ? (
          <Button className="gap-1.5" onClick={() => router.push('/menu/items/new')} aria-label="New menu item">
            <Plus size={15} aria-hidden="true" />
            <span className="hidden md:inline">New item</span>
          </Button>
        ) : undefined
      }
    >
      {!tenantId ? (
        <EmptyState icon={UtensilsCrossed} title="No workspace selected" description="Choose a workspace to manage its menu." />
      ) : itemsQuery.isError ? (
        <ErrorState title="Couldn’t load the menu" onRetry={() => void itemsQuery.refetch()} />
      ) : itemsQuery.isPending ? (
        // The search and category row, then a category: its label and the card of items.
        <div role="status" aria-busy="true" aria-label="Loading the menu" className="space-y-5">
          <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
            <Bone className="h-9 min-w-56 flex-1 lg:max-w-xs" />
            <Bone className="h-9 w-48" />
          </div>
          <div>
            <Bone className="mb-2 h-3 w-24" />
            <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              {Array.from({ length: 5 }, (_, index) => (
                <RowSkeleton key={index} index={index} />
              ))}
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <MenuSetupChecklist />
      ) : (
        <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
          {canReadRecipes && (
            <RecipeGaps
              gaps={gaps.data}
              images={new Map(items.map((i) => [i.id, i.imageUrl ?? null]))}
              error={gaps.isError}
              onRetry={() => void gaps.refetch()}
            />
          )}

          <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1 lg:max-w-xs">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={14} />}
                placeholder="Find an item"
                aria-label="Find an item"
                className="border-rule"
                rightAction={
                  search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  ) : undefined
                }
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as 'all' | MenuCategory)}
              options={[
                { value: 'all', label: 'All categories' },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
              ariaLabel="Category"
              className="w-48"
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length !== items.length && `${filtered.length} of `}
              {items.length} {items.length === 1 ? 'item' : 'items'} · {items.filter((i) => i.isAvailable).length} on the menu
            </span>
          </motion.div>

          {groups.length > 0 && (
            <div className="-mb-3 hidden items-center gap-3 px-3.5 text-label uppercase text-muted-foreground sm:flex" aria-hidden="true">
              <span className="flex-1" />
              <span className="w-32 text-right">Margin</span>
              <span className="w-20 text-right">Price</span>
              <span className="w-24 text-right">On the menu</span>
            </div>
          )}

          {groups.length === 0 ? (
            <motion.div variants={SECTION_RISE}>
              <EmptyState
                icon={Search}
                kind="search"
                title="Nothing matches"
                description="Try another search or category."
                action={{
                  label: 'Clear filters',
                  onClick: () => {
                    setSearch('');
                    setCategoryFilter('all');
                  },
                }}
              />
            </motion.div>
          ) : (
            groups.map((group) => {
              return (
                <motion.section key={group.id} variants={SECTION_RISE} aria-label={group.name}>
                  <h2 className="mb-2 text-label uppercase text-muted-foreground">{group.name}</h2>
                  <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                    {group.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        cost={costs.get(item.id)}
                        togglePending={availability.isPending && availability.variables?.id === item.id}
                        onToggle={(isAvailable) => availability.mutate({ id: item.id, isAvailable })}
                      />
                    ))}
                  </ul>
                </motion.section>
              );
            })
          )}
        </motion.div>
      )}
    </EditorShell>
  );
}

/**
 * Menu items with no recipe, folded to one line — the same shape as the stock
 * tab's "Needs attention". Hidden when every item has one.
 */
function RecipeGaps({
  gaps,
  images,
  error,
  onRetry,
}: {
  gaps?: { id: string; name: string }[];
  /** Each item's image, so a row shows the item rather than a generic icon. */
  images: Map<string, string | null>;
  error: boolean;
  onRetry: () => void;
}) {
  if (error)
    return (
      <motion.div variants={SECTION_RISE} className="flex items-center gap-3 rounded-lg border border-rule/60 bg-card px-4 py-3">
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">Recipe coverage couldn’t be checked.</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </motion.div>
    );
  if (!gaps) return null;

  // The shared card — the same one Communications' overview uses.
  return (
    <NeedsAttention
      label="Items without a recipe"
      icon={ChefHat}
      summary={`${gaps.length} ${gaps.length === 1 ? 'item needs' : 'items need'} a recipe`}
      items={gaps.map((gap) => ({
        key: gap.id,
        tone: 'measured',
        icon: ChefHat,
        image: images.get(gap.id),
        title: `${gap.name} has no recipe`,
        detail: 'Its sales can’t take stock off or give a complete allergen answer.',
        fix: { label: 'Add recipe', href: `/menu/items/${gap.id}?tab=recipe` },
      }))}
    />
  );
}

/** One item as an audit row: what it is and what's missing, then margin, price and the on/off switch. */
function ItemRow({
  item,
  cost,
  togglePending,
  onToggle,
}: {
  item: MenuItem;
  cost?: MenuItemCost;
  togglePending: boolean;
  onToggle: (isAvailable: boolean) => void;
}) {
  const gaps = cost && !cost.loading ? setupGaps(item, cost) : [];

  return (
    <li className="group flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 transition-colors last:border-b-0 hover:bg-band/40">
      <Link
        href={`/menu/items/${item.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className={cn('size-10 shrink-0 rounded-md bg-band object-cover', !item.isAvailable && 'opacity-50 grayscale')}
          />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground" aria-hidden="true">
            <UtensilsCrossed size={16} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('truncate text-sm font-semibold', item.isAvailable ? 'text-foreground' : 'text-muted-foreground')}>
              {item.name}
            </span>
            {/* Only what's missing — a complete item says nothing extra. A missing
                image is already the placeholder thumbnail, so it isn't said twice. */}
            {gaps
              .filter((gap) => gap !== 'No image')
              .map((gap) => (
                <IconTag
                  key={gap}
                  icon={gap === 'No recipe' ? ChefHat : CircleDollarSign}
                  label={gap}
                  tone="warning"
                  className="hidden md:inline-flex"
                />
              ))}
          </span>
          {item.description && <span className="block truncate text-xs text-muted-foreground">{item.description}</span>}
        </span>
      </Link>

      <Margin cost={cost} />
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
        {formatMoney(Number(item.price) || 0, 2)}
      </span>
      <span className="flex w-24 shrink-0 items-center justify-end">
        <Switch label={`${item.name} on the menu`} checked={item.isAvailable} disabled={togglePending} onChange={onToggle} />
      </span>
    </li>
  );
}

/** Margin and cost, or why there's none — an uncosted item never shows a flattering 100%.
    The chip's tone uses the same line the recipe screen does: in the red is a loss. */
function Margin({ cost }: { cost?: MenuItemCost }) {
  if (!cost || cost.loading) return <Bone className="hidden h-8 w-32 shrink-0 rounded-sm sm:block" />;
  if (!cost.costComplete)
    return (
      <span className="hidden w-32 shrink-0 text-right sm:block">
        <span className="block text-sm text-muted-foreground">—</span>
        <span className="block text-xs text-muted-foreground">{cost.hasRecipe ? 'costs missing' : 'not costed'}</span>
      </span>
    );
  const { cogs, margin, marginPct } = cost.costing!;
  return (
    <span className="hidden w-32 shrink-0 flex-col items-end gap-0.5 tabular-nums sm:flex">
      <Pill tone={margin >= 0 ? 'success' : 'exception'} className="tabular-nums">
        {formatMoney(margin, 2)} · {marginPct.toFixed(0)}%
      </Pill>
      <span className="block text-xs text-muted-foreground">cost {formatMoney(cogs, 2)}</span>
    </span>
  );
}
