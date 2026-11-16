'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useMemo } from 'react';

import {
  ChefHat,
  CircleDollarSign,
  type IconComponent,
  ImageIcon,
  Layers3,
  LayoutDashboard,
  LayoutGrid,
  Tag,
  TrendingDown,
  UtensilsCrossed,
} from '@/components/icons';
import { MenuSectionTabs } from '@/components/menu/MenuSectionTabs';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Pill } from '@/components/shared/Pill';
import { Bone, RowSkeleton } from '@/components/shared/Skeleton';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import { proxiedImage } from '@/lib/api/client';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { useMenuItemCosts } from '@/lib/hooks/useMenuItemCosts';
import { getMenuCategories, getMenuItems, getModifierGroups, getModifiers, updateMenuItem } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { type AttentionEntry, type OverviewCost, averageMargin, lowestMargins, menuAttention } from '@/lib/utils/menu-overview';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuItem } from '@/types/menu';

/*
 * The menu's landing page, as Square's and Toast's item libraries open on a
 * summary: how much is on the menu, what needs fixing (losses first), where it
 * makes the least, and what's switched off. Every figure links to the tab that
 * fixes it — this page edits nothing but the on/off switch.
 */
export function MenuOverview() {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const words = useCatalogWords();
  const kitchen = words.tools.kitchen;

  const itemsQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const categoriesQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId!),
    enabled: Boolean(tenantId),
  });
  const groupsQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifier-groups', tenantId),
    queryFn: () => getModifierGroups(tenantId ?? undefined),
    enabled: Boolean(tenantId) && kitchen,
  });
  const modifiersQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifiers', tenantId),
    queryFn: () => getModifiers(tenantId ?? undefined),
    enabled: Boolean(tenantId) && kitchen,
  });

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  // The same cached recipe requests the Items tab makes — opening it next is instant.
  const fullCosts = useMenuItemCosts(kitchen ? items : []);
  const costs = useMemo(
    () => new Map<string, OverviewCost>([...fullCosts].map(([id, cost]) => [id, { ...cost, marginPct: cost.costing?.marginPct ?? null }])),
    [fullCosts],
  );
  const costing = kitchen && items.some((item) => fullCosts.get(item.id)?.loading ?? true);

  const sections = (categoriesQuery.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    isActive: category.isActive,
    itemCount: items.filter((item) => item.categoryId === category.id).length,
  }));
  const modifiers = modifiersQuery.data ?? [];
  const groups = (groupsQuery.data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    optionCount: modifiers.filter((modifier) => modifier.groupId === group.id).length,
  }));

  const attention = menuAttention({
    items,
    costs,
    sections: categoriesQuery.isSuccess ? sections : [],
    groups: groupsQuery.isSuccess && modifiersQuery.isSuccess ? groups : [],
    kitchen,
  });
  const average = averageMargin(items, costs);
  const lowest = lowestMargins(items, costs);
  const off = items.filter((item) => !item.isAvailable).sort((a, b) => a.name.localeCompare(b.name));
  const images = new Map(items.map((item) => [item.id, proxiedImage(item.imageUrl)]));

  const availability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => updateMenuItem(id, { isAvailable }),
    onSuccess: (_, { isAvailable }) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-items') });
      toast('success', isAvailable ? 'Back on the menu.' : 'Taken off the menu — it won’t show at the till.');
    },
    onError: (err) => toast('error', err.message || 'Availability wasn’t updated. Try again.'),
  });

  return (
    <EditorShell title={words.section} icon={<LayoutDashboard size={20} aria-hidden="true" />} subheader={<MenuSectionTabs />}>
      {!tenantId ? (
        <EmptyState icon={UtensilsCrossed} title="No workspace selected" description="Choose a workspace to see its menu." />
      ) : itemsQuery.isError ? (
        <ErrorState title="Couldn’t load the menu" onRetry={() => void itemsQuery.refetch()} />
      ) : itemsQuery.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading the overview" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <Bone key={index} className="h-24 rounded-lg" />
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <RowSkeleton key={index} index={index} />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={kitchen ? UtensilsCrossed : Tag}
          kind="start"
          title={`No ${words.items} yet`}
          description={`Add your first ${words.item}, or import a whole catalogue from the ${kitchen ? 'Items' : 'Products'} tab.`}
          action={{ label: words.newItem, href: '/menu/items/new' }}
        />
      ) : (
        <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
          <motion.div variants={SECTION_RISE}>
            <StatCardGrid columns={kitchen ? 4 : 3}>
              <StatCard
                size="sm"
                icon={kitchen ? UtensilsCrossed : Tag}
                label={words.available}
                value={items.length - off.length}
                unit={`of ${items.length}`}
                href="/menu/items"
              />
              <StatCard
                size="sm"
                icon={LayoutGrid}
                accent="info"
                label={kitchen ? 'Sections' : 'Categories'}
                value={categoriesQuery.isError ? '—' : sections.length}
                error={categoriesQuery.isError}
                loading={categoriesQuery.isPending}
                caption={sections.some((s) => !s.isActive) ? `${sections.filter((s) => !s.isActive).length} hidden` : undefined}
                href="/menu/categories"
              />
              {kitchen ? (
                <>
                  <StatCard
                    size="sm"
                    icon={Layers3}
                    accent="purple"
                    label="Modifier groups"
                    value={groups.length}
                    caption={`${modifiers.length} ${modifiers.length === 1 ? 'modifier' : 'modifiers'}`}
                    loading={groupsQuery.isPending || modifiersQuery.isPending}
                    error={groupsQuery.isError || modifiersQuery.isError}
                    href="/menu/modifiers"
                  />
                  <StatCard
                    size="sm"
                    icon={CircleDollarSign}
                    accent="success"
                    label="Average margin"
                    value={average ? `${average.pct.toFixed(0)}%` : '—'}
                    caption={
                      average
                        ? `across ${average.costed} costed ${average.costed === 1 ? words.item : words.items}`
                        : 'Nothing is costed yet'
                    }
                    loading={costing}
                  />
                </>
              ) : (
                <StatCard
                  size="sm"
                  icon={ImageIcon}
                  accent="warning"
                  label="Without a photo"
                  value={items.filter((item) => !item.imageUrl).length}
                  href="/menu/items"
                />
              )}
            </StatCardGrid>
          </motion.div>

          {/* Only when there's something to fix — a healthy menu goes straight to the lists. */}
          <NeedsAttention
            label="What needs fixing on the menu"
            items={attention.map((entry) => attentionRow(entry, words.items, images))}
          />

          {/* A kitchen's margins and what's off the menu; a shop gets neither — the Available card already counts what isn't for sale. */}
          {kitchen && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Lowest margins" note="After VAT">
                {costing ? (
                  [0, 1, 2].map((index) => <RowSkeleton key={index} index={index} />)
                ) : lowest.length === 0 ? (
                  <PanelEmpty>Add recipes with ingredient costs to see margins here.</PanelEmpty>
                ) : (
                  lowest.map(({ item }) => {
                    const costingRow = fullCosts.get(item.id)?.costing;
                    return (
                      <ItemLink key={item.id} item={item} image={images.get(item.id)} href={`/menu/items/${item.id}?tab=recipe`}>
                        {costingRow && <MarginPill margin={costingRow.margin} pct={costingRow.marginPct} />}
                      </ItemLink>
                    );
                  })
                )}
              </Panel>
              {/* No count: the first stat card already says how many are on the menu. */}
              <Panel title="Off the menu">
                {off.length === 0 ? (
                  <PanelEmpty>Everything is on the menu.</PanelEmpty>
                ) : (
                  off.map((item) => (
                    <ItemLink key={item.id} item={item} image={images.get(item.id)} href={`/menu/items/${item.id}`}>
                      <span className="relative z-10 inline-flex">
                        <Switch
                          label={`${item.name} — ${words.available.toLowerCase()}`}
                          checked={false}
                          disabled={availability.isPending && availability.variables?.id === item.id}
                          onChange={(isAvailable) => availability.mutate({ id: item.id, isAvailable })}
                        />
                      </span>
                    </ItemLink>
                  ))
                )}
              </Panel>
            </div>
          )}
        </motion.div>
      )}
    </EditorShell>
  );
}

const ATTENTION: Record<AttentionEntry['kind'], { icon: IconComponent; fix: string }> = {
  loss: { icon: TrendingDown, fix: 'Check recipe' },
  'no-recipe': { icon: ChefHat, fix: 'Add recipe' },
  'costs-missing': { icon: CircleDollarSign, fix: 'Open recipe' },
  'no-photo': { icon: ImageIcon, fix: 'Add photos' },
  'empty-section': { icon: LayoutGrid, fix: 'Open sections' },
  'empty-group': { icon: Layers3, fix: 'Add modifier' },
};

function attentionRow(entry: AttentionEntry, itemsWord: string, images: Map<string, string | null>): NeedsAttentionItem {
  const { icon, fix } = ATTENTION[entry.kind];
  const recipe = `/menu/items/${entry.id}?tab=recipe`;
  const [title, detail, href] =
    entry.kind === 'loss'
      ? [`${entry.name} sells at a loss`, 'Its ingredients cost more than it takes after VAT.', recipe]
      : entry.kind === 'no-recipe'
        ? [`${entry.name} has no recipe`, 'Its sales can’t take stock off or give a complete allergen answer.', recipe]
        : entry.kind === 'costs-missing'
          ? [`${entry.name} — ingredient costs missing`, 'Its margin can’t be worked out until every ingredient has a cost.', recipe]
          : entry.kind === 'no-photo'
            ? [`${entry.name} has no photo`, 'Shoppers see a placeholder.', `/menu/items/${entry.id}?tab=photos`]
            : entry.kind === 'empty-section'
              ? [`${entry.name} has no ${itemsWord}`, 'It shows as an empty heading — fill it or hide it.', '/menu/categories']
              : [`${entry.name} has no modifiers`, 'Items using it offer nothing to choose.', `/menu/modifiers?new=1&group=${entry.id}`];
  const isItem = entry.kind !== 'empty-section' && entry.kind !== 'empty-group';
  return {
    key: entry.key,
    tone: entry.tone,
    icon,
    image: isItem ? images.get(entry.id) : undefined,
    title,
    detail,
    fix: { label: fix, href },
  };
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <motion.section variants={SECTION_RISE} aria-label={title} className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-title text-heading">{title}</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      <ul className="overflow-hidden rounded-lg border border-border bg-card">{children}</ul>
    </motion.section>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <li className="px-4 py-6 text-center text-sm text-muted-foreground">{children}</li>;
}

/** An item as a row that opens it — the link stretches over the row; `children` (a pill, a switch) sits on the right. */
function ItemLink({ item, image, href, children }: { item: MenuItem; image?: string | null; href: string; children: React.ReactNode }) {
  return (
    <li className="relative flex items-center gap-3 border-b border-border px-3.5 py-2.5 transition-colors last:border-b-0 hover:bg-band/40 has-[a:focus-visible]:bg-band/40">
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-3 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="size-9 shrink-0 rounded-md bg-band object-cover" />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground" aria-hidden="true">
            <UtensilsCrossed size={16} />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{item.name}</span>
      </Link>
      {children}
    </li>
  );
}

function MarginPill({ margin, pct }: { margin: number; pct: number }) {
  const formatMoney = useFormatMoney();
  return (
    <Pill tone={margin >= 0 ? 'success' : 'exception'} className="shrink-0 tabular-nums">
      {formatMoney(margin, 2)} · {pct.toFixed(0)}%
    </Pill>
  );
}
