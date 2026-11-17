'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ChefHat, CircleDollarSign, ImageIcon, Plus, Search, Tag, UploadCloud, UtensilsCrossed, X } from '@/components/icons';
import { CatalogImportDialog } from '@/components/menu/CatalogImportDialog';
import { MenuSectionTabs, MenuShellIcon } from '@/components/menu/MenuSectionTabs';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Pill } from '@/components/shared/Pill';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { proxiedImage } from '@/lib/api/client';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { type MenuItemCost, useMenuItemCosts } from '@/lib/hooks/useMenuItemCosts';
import { getMenuCategories, getMenuItems, updateMenuItem } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import {
  type MenuShow,
  type ShowCost,
  countMenuShow,
  filterMenuItems,
  groupByCategory,
  inMenuShow,
  menuShows,
  parseMenuShow,
  setupGaps,
} from '@/lib/utils/menu-list';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuCategory, MenuItem } from '@/types/menu';

/**
 * The menu items list, like Promotions: a search with the Category and Show
 * selects and the count, then items under their section in menu order — each
 * row its setup gaps, margin, price and the on-the-menu switch. `?show=` (the
 * Overview's figures link here) picks the Show filter on arrival.
 */
export function MenuItemsWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { tenantId } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const words = useCatalogWords();
  const kitchen = words.tools.kitchen;
  const [categoryFilter, setCategoryFilter] = useState<'all' | MenuCategory>('all');
  // Read once: the workspace's vocabulary can arrive after the first render, so a
  // kitchen-only value is checked against it when used, not here.
  const [showChoice, setShow] = useState<string>(() => searchParams.get('show') ?? 'all');
  const show = parseMenuShow(showChoice, kitchen);

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
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const filtered = useMemo(() => filterMenuItems(items, search, categoryFilter), [items, search, categoryFilter]);

  // A request per item (cached, and shared with the item page) — fine for a café
  // menu, and the price of showing margin on every row.
  // Margins come from recipes — a shop's products have none, so nothing is costed.
  const costs = useMenuItemCosts(kitchen ? filtered : []);
  const showCosts = useMemo(
    () => new Map<string, ShowCost>([...costs].map(([id, cost]) => [id, { ...cost, marginPct: cost.costing?.marginPct ?? null }])),
    [costs],
  );
  const shown = filtered.filter((item) => inMenuShow(item, showCosts.get(item.id), show));
  const groups = groupByCategory(shown, categories);

  const filtersActive = Boolean(search.trim()) || categoryFilter !== 'all' || show !== 'all';
  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setShow('all');
  };
  const showLabel: Record<MenuShow, string> = {
    all: `All ${words.items}`,
    on: words.available,
    off: kitchen ? 'Off the menu' : 'Not for sale',
    'not-costed': 'Not costed',
    loss: 'At a loss',
    'no-photo': 'No photo',
  };

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
      title={words.section}
      icon={<MenuShellIcon />}
      subheader={<MenuSectionTabs />}
      actions={
        tenantId ? (
          <div className="flex items-center gap-2">
            {/* A whole catalogue — sizes and stock — from a sheet or a Shopify export. */}
            <Button variant="outline" onClick={() => setImporting(true)} aria-label="Import products">
              <UploadCloud size={15} aria-hidden="true" />
              <span className="hidden md:inline">Import</span>
            </Button>
            <Button onClick={() => router.push('/menu/items/new')} aria-label={words.newItem}>
              <Plus size={15} aria-hidden="true" />
              <span className="hidden md:inline">{words.newItem}</span>
            </Button>
          </div>
        ) : undefined
      }
    >
      {importing && tenantId && <CatalogImportDialog tenantId={tenantId} onClose={() => setImporting(false)} />}
      {!tenantId ? (
        <EmptyState icon={UtensilsCrossed} title="No workspace selected" description="Choose a workspace to manage its menu." />
      ) : itemsQuery.isError ? (
        <ErrorState className="flex-1" title="Couldn’t load the menu" onRetry={() => void itemsQuery.refetch()} />
      ) : itemsQuery.isPending ? (
        // The toolbar, then a section: its title and the card of items.
        <div aria-busy="true" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
            <Bone className="h-9 min-w-56 flex-1" />
            <Bone className="h-9 w-40" />
            <Bone className="h-9 w-40" />
          </div>
          <div>
            <Bone className="mb-3 ml-1 h-4 w-24" />
            <ListSkeleton rows={5} label={`Loading ${words.section.toLowerCase()}`} />
          </div>
        </div>
      ) : items.length === 0 ? (
        // The step-by-step setup lives on the Overview; this list just offers the first item.
        <EmptyState
          className="flex-1"
          icon={kitchen ? UtensilsCrossed : Tag}
          title={`No ${words.items} yet`}
          description={
            kitchen
              ? 'Name it and price it, then add modifiers and a recipe from the same screen.'
              : 'Add products one by one, or import your catalogue from a sheet — your own or a Shopify export.'
          }
          action={{ label: words.newItem, href: '/menu/items/new', icon: Plus }}
        />
      ) : (
        <motion.div
          className="flex flex-col gap-5"
          initial={reduceMotion ? false : 'hidden'}
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.05 } } }}
        >
          <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={14} aria-hidden="true" />}
                placeholder="Name or description…"
                aria-label={`Find a ${words.item}`}
                rightAction={
                  search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as 'all' | MenuCategory)}
              options={[
                { value: 'all', label: kitchen ? 'All sections' : 'All categories' },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
              ariaLabel={kitchen ? 'Section' : 'Category'}
              className="w-40"
            />
            <Select
              value={show}
              onValueChange={setShow}
              options={menuShows(kitchen).map((value) => ({
                value,
                label: value === 'all' ? showLabel.all : `${showLabel[value]} · ${countMenuShow(filtered, showCosts, value)}`,
              }))}
              ariaLabel="Show"
              className="w-40"
            />
            <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {filtersActive ? `${shown.length} of ${items.length}` : `${items.length} ${items.length === 1 ? words.item : words.items}`}
            </span>
          </motion.div>

          {groups.length === 0 ? (
            <motion.div variants={SECTION_RISE}>
              <EmptyState
                icon={Search}
                kind="search"
                title="Nothing matches"
                description="Try a different search or filter."
                action={{ label: 'Clear filters', onClick: clearFilters }}
              />
            </motion.div>
          ) : (
            groups.map((group) => (
              <RecordGroup key={group.id} id={`menu-items-${group.id}`} title={group.name}>
                <ListRowGroup aria-label={group.name}>
                  {group.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      cost={costs.get(item.id)}
                      kitchen={kitchen}
                      availableLabel={words.available}
                      togglePending={availability.isPending && availability.variables?.id === item.id}
                      onToggle={(isAvailable) => availability.mutate({ id: item.id, isAvailable })}
                    />
                  ))}
                </ListRowGroup>
              </RecordGroup>
            ))
          )}
        </motion.div>
      )}
    </EditorShell>
  );
}

/** One item: thumbnail, name and what's missing; margin and price; the on/off switch; Recipe or Photos on hover. */
function ItemRow({
  item,
  cost,
  kitchen,
  availableLabel,
  togglePending,
  onToggle,
}: {
  item: MenuItem;
  cost?: MenuItemCost;
  /** Recipes and margins apply — off for a shop's products. */
  kitchen: boolean;
  availableLabel: string;
  togglePending: boolean;
  onToggle: (isAvailable: boolean) => void;
}) {
  const formatMoney = useFormatMoney();
  // Only what's missing — a complete item says nothing extra. A missing image is
  // already the placeholder thumbnail, so it isn't said twice.
  const gaps = (kitchen && cost && !cost.loading ? setupGaps(item, cost) : []).filter((gap) => gap !== 'No image');
  const image = proxiedImage(item.imageUrl);

  return (
    <ListRow
      href={`/menu/items/${item.id}`}
      muted={!item.isAvailable}
      leading={
        image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className={cn('size-9 shrink-0 rounded-md bg-band object-cover', !item.isAvailable && 'opacity-50 grayscale')}
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground" aria-hidden="true">
            {kitchen ? <UtensilsCrossed size={16} /> : <Tag size={16} />}
          </span>
        )
      }
      title={item.name}
      titleExtra={gaps.map((gap) => (
        <IconTag
          key={gap}
          icon={gap === 'No recipe' ? ChefHat : CircleDollarSign}
          label={gap}
          tone="warning"
          className="hidden md:inline-flex"
        />
      ))}
      meta={item.description || undefined}
      trailing={
        <>
          {kitchen && <Margin cost={cost} />}
          <span className="w-20 text-right text-sm font-semibold tabular-nums text-foreground">
            {formatMoney(Number(item.price) || 0, 2)}
          </span>
        </>
      }
      control={
        <Switch
          label={`${item.name} — ${availableLabel.toLowerCase()}`}
          checked={item.isAvailable}
          disabled={togglePending}
          onChange={onToggle}
        />
      }
      actions={
        <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
          {kitchen ? (
            <Link href={`/menu/items/${item.id}?tab=recipe`} aria-label={`Recipe for ${item.name}`} title="Recipe">
              <ChefHat aria-hidden="true" />
            </Link>
          ) : (
            <Link href={`/menu/items/${item.id}?tab=photos`} aria-label={`Photos of ${item.name}`} title="Photos">
              <ImageIcon aria-hidden="true" />
            </Link>
          )}
        </Button>
      }
    />
  );
}

/** Margin and cost, or why there's none — an uncosted item never shows a flattering 100%.
    The chip's tone uses the same line the recipe screen does: in the red is a loss. */
function Margin({ cost }: { cost?: MenuItemCost }) {
  const formatMoney = useFormatMoney();
  if (!cost || cost.loading) return <Bone className="hidden h-8 w-32 rounded-sm sm:block" />;
  if (!cost.costComplete)
    return (
      <span className="hidden w-32 text-right sm:block">
        <span className="block text-sm text-muted-foreground">—</span>
        <span className="block text-xs text-muted-foreground">{cost.hasRecipe ? 'costs missing' : 'not costed'}</span>
      </span>
    );
  const { cogs, margin, marginPct } = cost.costing!;
  return (
    <span className="hidden w-32 flex-col items-end gap-0.5 tabular-nums sm:flex">
      <Pill tone={margin >= 0 ? 'success' : 'exception'} className="tabular-nums">
        {formatMoney(margin, 2)} · {marginPct.toFixed(0)}%
      </Pill>
      <span className="block text-xs text-muted-foreground">cost {formatMoney(cogs, 2)}</span>
    </span>
  );
}
