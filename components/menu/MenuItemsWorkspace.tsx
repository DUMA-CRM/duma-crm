'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ChefHat, CircleDollarSign, Plus, Search, SlidersHorizontal, UtensilsCrossed } from '@/components/icons';
import { MenuSectionTabs } from '@/components/menu/MenuSectionTabs';
import { MenuSetupChecklist } from '@/components/menu/MenuSetupChecklist';
import { AvailabilityToggle, categoryLabel, categoryTone, selectClass } from '@/components/menu/shared';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { getMenuCategories, getMenuItems, updateMenuItem } from '@/lib/api/menu.service';
import { type MenuItemCost, useMenuItemCosts } from '@/lib/hooks/useMenuItemCosts';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/dashboard';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuCategory, MenuItem } from '@/types/menu';

/**
 * Three ways of reading the same menu. The screen serves setup, daily ops and
 * margin work, and those want different columns — so the columns follow the
 * task rather than every job sharing one compromise table.
 */
const VIEWS = [
  { value: 'build', label: 'Build', icon: ChefHat },
  { value: 'operate', label: 'Operate', icon: SlidersHorizontal },
  { value: 'profit', label: 'Profit', icon: CircleDollarSign },
] as const;

type View = (typeof VIEWS)[number]['value'];

const isView = (value: string | null): value is View => VIEWS.some((v) => v.value === value);

/** What still needs doing to an item, for the Build view. */
function setupGaps(item: MenuItem, cost: MenuItemCost | undefined): string[] {
  const gaps: string[] = [];
  if (!cost?.hasRecipe) gaps.push('no recipe');
  else if (!cost.costComplete) gaps.push('ingredient costs missing');
  if (!item.imageUrl) gaps.push('no image');
  return gaps;
}

function MarginCell({ cost }: { cost: MenuItemCost | undefined }) {
  if (!cost || cost.loading) return <span className="text-muted-foreground">…</span>;
  // An uncosted item shows nothing rather than a flattering 100%.
  if (!cost.hasRecipe) return <span className="text-label font-medium text-muted-foreground">No recipe</span>;
  if (!cost.costComplete) return <span className="text-label font-medium text-warning">Cost incomplete</span>;

  const { margin, marginPct } = cost.costing!;
  return (
    <span className={cn('font-semibold tabular-nums', margin >= 0 ? 'text-success' : 'text-destructive')}>
      {formatMoney(margin, 2)} <span className="font-normal text-muted-foreground">({marginPct.toFixed(0)}%)</span>
    </span>
  );
}

/**
 * The menu items list. A full-width list page that navigates to a full-page
 * record — the same shape as Customers and Inventory, which is the only
 * list-to-detail pattern this product uses.
 */
export function MenuItemsWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MenuCategory>('all');

  // View lives in the URL so a Profit view can be linked to, and so switching
  // views is an ordinary Back away.
  const viewParam = searchParams.get('view');
  const view: View = isView(viewParam) ? viewParam : 'operate';
  const setView = (next: View) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'operate') params.delete('view');
    else params.set('view', next);
    router.replace(`/menu/items${params.size ? `?${params}` : ''}`, { scroll: false });
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items', tenantId],
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories', tenantId],
    queryFn: () => getMenuCategories(tenantId!),
    enabled: Boolean(tenantId),
  });
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (categoryFilter === 'all' || i.categoryId === categoryFilter || i.category === categoryFilter) &&
        (!q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)),
    );
  }, [items, search, categoryFilter]);

  // Only Build and Profit read costs, and each is a request per item — so the
  // view that never shows them doesn't pay for them.
  const costs = useMenuItemCosts(view === 'operate' ? [] : filtered);

  const availability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => updateMenuItem(id, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
    onError: (err) => toast('error', err.message || 'Availability wasn’t updated. Try again.'),
  });

  const columns: DataTableColumn<MenuItem>[] = [
    {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.imageUrl} alt="" className="size-9 shrink-0 rounded-sm bg-muted object-cover" />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted">
              <UtensilsCrossed size={15} className="text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
            {row.description && <p className="truncate text-xs text-muted-foreground">{row.description}</p>}
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      visibility: 'md',
      cell: ({ row }) => (
        <span
          className={cn(
            'inline-flex items-center rounded-sm px-2.5 py-1 text-label font-semibold uppercase tracking-label',
            categoryTone(row.category, row.categoryId ? categoryById.get(row.categoryId) : undefined),
          )}
        >
          {categoryLabel(row.category, row.categoryId ? categoryById.get(row.categoryId) : undefined)}
        </span>
      ),
    },
    {
      id: 'price',
      header: 'Price',
      align: 'right',
      width: 'fit',
      cell: ({ row }) => <span className="font-semibold tabular-nums text-foreground">{formatMoney(Number(row.price) || 0, 2)}</span>,
    },
    ...(view === 'profit'
      ? ([
          {
            id: 'cost',
            header: 'Cost',
            align: 'right',
            width: 'fit',
            cell: ({ row }) => {
              const cost = costs.get(row.id);
              return <span className="tabular-nums text-muted-foreground">{cost?.costComplete ? formatMoney(cost.costing!.cogs, 2) : '—'}</span>;
            },
          },
          {
            id: 'margin',
            header: 'Margin',
            align: 'right',
            width: 'fit',
            cell: ({ row }) => <MarginCell cost={costs.get(row.id)} />,
          },
        ] satisfies DataTableColumn<MenuItem>[])
      : []),
    ...(view === 'build'
      ? ([
          {
            id: 'setup',
            header: 'Setup',
            cell: ({ row }) => {
              const gaps = setupGaps(row, costs.get(row.id));
              return gaps.length === 0 ? (
                <span className="text-label font-semibold text-success">Ready</span>
              ) : (
                <span className="text-label text-warning">{gaps.join(' · ')}</span>
              );
            },
          },
        ] satisfies DataTableColumn<MenuItem>[])
      : []),
    ...(view === 'operate'
      ? ([
          {
            id: 'status',
            header: 'Status',
            width: 'fit',
            cell: ({ row }) => (
              // Stop the row's navigation: this control acts in place.
              <span onClick={(e) => e.stopPropagation()} role="presentation">
                <AvailabilityToggle
                  on={row.isAvailable}
                  pending={availability.isPending && availability.variables?.id === row.id}
                  onToggle={() => availability.mutate({ id: row.id, isAvailable: !row.isAvailable })}
                />
              </span>
            ),
          },
        ] satisfies DataTableColumn<MenuItem>[])
      : []),
  ];

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
      ) : (
        <div className="flex flex-col gap-4">
          {items.length === 0 && !isLoading && <MenuSetupChecklist />}

          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl options={VIEWS} value={view} onChange={setView} ariaLabel="What to show for each item" />
              <div className="max-w-xs flex-1">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search size={14} />}
                  placeholder="Search items…"
                  aria-label="Search menu items"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value as 'all' | MenuCategory)}
                options={[
                  { value: 'all', label: 'All categories' },
                  ...categories.map((category) => ({ value: category.id, label: category.name })),
                ]}
                ariaLabel="Filter by category"
                className={cn(selectClass, 'w-auto')}
              />
            </div>
          )}

          {(items.length > 0 || isLoading) && (
            <DataTable
              data={filtered}
              columns={columns}
              getRowKey={(row) => row.id}
              isLoading={isLoading}
              onRowClick={({ row }) => router.push(`/menu/items/${row.id}`)}
              rowAriaLabel={({ row }) => `Open ${row.name}`}
              stickyHeader
              aria-label="Menu items"
              emptyState={<EmptyState icon={Search} title="No matching items" description="Try a different search or category filter." />}
              footer={
                <p className="text-xs text-muted-foreground">
                  {filtered.length !== items.length && `${filtered.length} of `}
                  {items.length} {items.length === 1 ? 'item' : 'items'} · {items.filter((i) => i.isAvailable).length} available
                </p>
              }
            />
          )}
        </div>
      )}
    </EditorShell>
  );
}
