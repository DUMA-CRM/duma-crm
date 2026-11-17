'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import {
  ChefHat,
  CircleDollarSign,
  EyeOff,
  type IconComponent,
  ImageIcon,
  Layers3,
  LayoutGrid,
  Tag,
  TrendingDown,
  UtensilsCrossed,
} from '@/components/icons';
import { CatalogImportDialog } from '@/components/menu/CatalogImportDialog';
import { MenuSectionTabs, MenuShellIcon } from '@/components/menu/MenuSectionTabs';
import { MenuSetupChecklist } from '@/components/menu/MenuSetupChecklist';
import { ShopSetupChecklist } from '@/components/menu/ShopSetupChecklist';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Pill } from '@/components/shared/Pill';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import { proxiedImage } from '@/lib/api/client';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { useMenuItemCosts } from '@/lib/hooks/useMenuItemCosts';
import { getMenuCategories, getMenuItems, getModifierGroups, getModifiers } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { countMenuShow } from '@/lib/utils/menu-list';
import { type AttentionEntry, type OverviewCost, averageMargin, lowestMargins, menuAttention } from '@/lib/utils/menu-overview';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/*
 * The menu's landing page — what no other tab shows: how to build a menu from
 * nothing (the setup steps), then, once there is one, four figures someone
 * acts on (each opens the Items list filtered to those rows), what needs
 * fixing across items, sections and modifier groups, and where it makes the
 * least. It edits nothing.
 */
export function MenuOverview() {
  const { tenantId } = useWorkspaceStore();
  const reduceMotion = useReducedMotion();
  const words = useCatalogWords();
  const kitchen = words.tools.kitchen;
  const [importing, setImporting] = useState(false);

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
  const images = new Map(items.map((item) => [item.id, proxiedImage(item.imageUrl)]));
  // The same rule the Items list's Show filter uses, so a figure matches the rows its link opens.
  const count = (show: Parameters<typeof countMenuShow>[2]) => countMenuShow(items, costs, show);
  const off = count('off');
  const hiddenSections = sections.filter((section) => !section.isActive).length;

  return (
    <EditorShell title={words.section} icon={<MenuShellIcon />} subheader={<MenuSectionTabs />}>
      {importing && tenantId && <CatalogImportDialog tenantId={tenantId} onClose={() => setImporting(false)} />}
      {!tenantId ? (
        <EmptyState icon={UtensilsCrossed} title="No workspace selected" description="Choose a workspace to see its menu." />
      ) : itemsQuery.isError ? (
        <ErrorState className="flex-1" title="Couldn’t load the menu" onRetry={() => void itemsQuery.refetch()} />
      ) : itemsQuery.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-5">
          <FactsSkeleton count={4} label="Loading the overview" className="gap-3 sm:grid-cols-2 xl:grid-cols-4" />
          <ListSkeleton rows={3} label="Loading what needs fixing" />
        </div>
      ) : (
        <motion.div
          className="flex flex-col gap-5"
          initial={reduceMotion ? false : 'hidden'}
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
        >
          {items.length === 0 ? (
            // A new workspace: the steps, in the order they depend on each other.
            kitchen ? (
              <MenuSetupChecklist />
            ) : (
              <ShopSetupChecklist onImport={() => setImporting(true)} />
            )
          ) : (
            <>
              <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {kitchen ? (
                  <>
                    <Fact
                      surface="page"
                      icon={EyeOff}
                      label="Off the menu"
                      value={off}
                      hint={`of ${items.length} ${items.length === 1 ? words.item : words.items}`}
                      href={off > 0 ? '/menu/items?show=off' : undefined}
                    />
                    <CostFact
                      icon={ChefHat}
                      label="Not costed"
                      value={count('not-costed')}
                      costing={costing}
                      tone="warning"
                      hint={(n) => (n > 0 ? 'No recipe, or costs missing' : 'Every item costed')}
                      href="/menu/items?show=not-costed"
                    />
                    <CostFact
                      icon={TrendingDown}
                      label="At a loss"
                      value={count('loss')}
                      costing={costing}
                      tone="danger"
                      hint={(n) => (n > 0 ? 'Costs more than it takes after VAT' : 'None after VAT')}
                      href="/menu/items?show=loss"
                    />
                    <Fact
                      surface="page"
                      icon={CircleDollarSign}
                      label="Average margin"
                      value={costing ? <Bone className="mt-1 h-5 w-14" /> : average ? `${average.pct.toFixed(0)}%` : '—'}
                      hint={
                        costing
                          ? 'Costing…'
                          : average
                            ? `After VAT · ${average.costed} costed ${average.costed === 1 ? words.item : words.items}`
                            : 'Nothing is costed yet'
                      }
                    />
                  </>
                ) : (
                  <>
                    <Fact
                      surface="page"
                      icon={Tag}
                      label={words.available}
                      value={items.length - off}
                      hint={`of ${items.length} ${items.length === 1 ? words.item : words.items}`}
                      href="/menu/items?show=on"
                    />
                    <Fact
                      surface="page"
                      icon={EyeOff}
                      label="Not for sale"
                      value={off}
                      href={off > 0 ? '/menu/items?show=off' : undefined}
                    />
                    <Fact
                      surface="page"
                      icon={ImageIcon}
                      label="No photo"
                      value={count('no-photo')}
                      tone={count('no-photo') > 0 ? 'warning' : 'default'}
                      hint={count('no-photo') > 0 ? 'Shoppers see a placeholder' : 'Every product has one'}
                      href={count('no-photo') > 0 ? '/menu/items?show=no-photo' : undefined}
                    />
                    <Fact
                      surface="page"
                      icon={LayoutGrid}
                      label="Hidden categories"
                      value={
                        categoriesQuery.isPending ? <Bone className="mt-1 h-5 w-10" /> : categoriesQuery.isError ? '—' : hiddenSections
                      }
                      hint={categoriesQuery.isError ? 'Couldn’t load categories' : `of ${sections.length}`}
                      href="/menu/categories"
                    />
                  </>
                )}
              </motion.dl>

              {/* Only when there's something to fix — a healthy menu goes straight to the lists. */}
              <NeedsAttention
                label="What needs fixing on the menu"
                items={attention.map((entry) => attentionRow(entry, words.items, images))}
              />

              {/* Margins come from recipes, so a shop has none. */}
              {kitchen && (
                <RecordGroup id="menu-lowest-margins" title="Lowest margins" footnote="After VAT, for what’s on the menu.">
                  {costing ? (
                    <ListSkeleton rows={3} label="Costing the menu" />
                  ) : lowest.length === 0 ? (
                    <EmptyState
                      compact
                      icon={CircleDollarSign}
                      title="No margins yet"
                      description="Add recipes with ingredient costs to see them here."
                    />
                  ) : (
                    <ListRowGroup aria-label="Lowest margins">
                      {lowest.map(({ item }) => {
                        const row = fullCosts.get(item.id)?.costing;
                        const image = images.get(item.id);
                        return (
                          <ListRow
                            key={item.id}
                            href={`/menu/items/${item.id}?tab=recipe`}
                            leading={
                              image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={image} alt="" className="size-9 shrink-0 rounded-md bg-band object-cover" />
                              ) : undefined
                            }
                            icon={UtensilsCrossed}
                            tone="muted"
                            title={item.name}
                            trailing={row && <MarginPill margin={row.margin} pct={row.marginPct} cogs={row.cogs} />}
                          />
                        );
                      })}
                    </ListRowGroup>
                  )}
                </RecordGroup>
              )}
            </>
          )}
        </motion.div>
      )}
    </EditorShell>
  );
}

/** A count that waits for the recipes: a bone while costing, then a link to the matching rows only when there are any. */
function CostFact({
  icon,
  label,
  value,
  costing,
  tone,
  hint,
  href,
}: {
  icon: IconComponent;
  label: string;
  value: number;
  costing: boolean;
  tone: 'warning' | 'danger';
  hint: (value: number) => string;
  href: string;
}) {
  return (
    <Fact
      surface="page"
      icon={icon}
      label={label}
      value={costing ? <Bone className="mt-1 h-5 w-10" /> : value}
      hint={costing ? 'Costing…' : hint(value)}
      tone={!costing && value > 0 ? tone : 'default'}
      href={!costing && value > 0 ? href : undefined}
    />
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

function MarginPill({ margin, pct, cogs }: { margin: number; pct: number; cogs: number }) {
  const formatMoney = useFormatMoney();
  return (
    <span className="flex flex-col items-end gap-0.5 tabular-nums">
      <Pill tone={margin >= 0 ? 'success' : 'exception'} className="tabular-nums">
        {formatMoney(margin, 2)} · {pct.toFixed(0)}%
      </Pill>
      <span className="text-xs text-muted-foreground">cost {formatMoney(cogs, 2)}</span>
    </span>
  );
}
