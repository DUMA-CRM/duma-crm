'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { EyeOff, Search, Star, UtensilsCrossed } from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/dashboard';
import { MAX_FEATURED, groupQrMenu, toggleFeatured } from '@/lib/utils/qr-menu';
import type { MenuCategoryRecord, MenuItem } from '@/types/menu';

/**
 * What goes on the QR menu, laid out the way guests will browse it: by
 * category, in menu order, with the photo they'll see. Each item has one
 * switch; a star puts it first in its category with a "Featured" badge.
 * Items guests can't get anyway — sold out, or in a category switched off in
 * Products — say so, so a switch that's on but does nothing isn't a mystery.
 */
export function QrMenuList({
  items,
  categories,
  visibility,
  featuredItemIds,
  categoryOrder,
  onVisibilityChange,
  onFeaturedChange,
}: {
  items: MenuItem[];
  categories: MenuCategoryRecord[];
  visibility: Record<string, boolean>;
  featuredItemIds: string[];
  categoryOrder: string[];
  onVisibilityChange: (visibility: Record<string, boolean>) => void;
  onFeaturedChange: (featuredItemIds: string[]) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState('');

  const isShown = (item: MenuItem) => visibility[item.id] !== false;
  const query = search.trim().toLowerCase();
  const matches = (item: MenuItem) => !query || item.name.toLowerCase().includes(query);

  const groups = groupQrMenu(items, categories, { categoryOrder, featuredItemIds })
    .map((group) => ({ ...group, all: group.items, items: group.items.filter(matches) }))
    .filter((group) => group.items.length > 0);
  const featured = new Set(featuredItemIds);
  const featureFull = featuredItemIds.length >= MAX_FEATURED;
  const setMany = (targets: MenuItem[], visible: boolean) =>
    onVisibilityChange({ ...visibility, ...Object.fromEntries(targets.map((item) => [item.id, visible])) });

  return (
    <div>
      <div className="mb-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search the menu…"
          aria-label="Search the menu"
          leftIcon={<Search size={14} aria-hidden="true" />}
        />
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-rule/60 px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing matches “{search}”.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const groupShown = group.all.filter(isShown).length;
            return (
              <section key={group.id} aria-labelledby={`qr-menu-${group.id}`}>
                {/* Right padding matches the rows, so this switch sits in the same column as theirs. */}
                <header className="mb-2 flex items-center gap-2.5 pl-1 pr-[15px]">
                  <h3 id={`qr-menu-${group.id}`} className="text-base font-semibold text-foreground">
                    {group.name}
                  </h3>
                  {!group.reachesGuests && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-band px-1.5 py-0.5 text-micro font-medium text-muted-foreground">
                      <EyeOff size={11} aria-hidden="true" /> Off in Menu
                    </span>
                  )}
                  <label className="ml-auto flex cursor-pointer items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">{groupShown}</span> of {group.all.length} shown
                    </span>
                    <Switch
                      checked={groupShown === group.all.length}
                      onChange={(next) => setMany(group.all, next)}
                      label={groupShown === group.all.length ? `Hide everything in ${group.name}` : `Show everything in ${group.name}`}
                    />
                  </label>
                </header>
                <ul className="grid gap-2">
                  <AnimatePresence initial={false}>
                    {group.items.map((item) => {
                      const shown = isShown(item);
                      const star = featured.has(item.id);
                      const reaches = group.reachesGuests && item.isAvailable;
                      return (
                        <motion.li
                          key={item.id}
                          layout={reduceMotion ? false : 'position'}
                          initial={reduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border p-2 pr-3.5 transition-colors',
                            shown ? 'border-rule/50 bg-background/60' : 'border-dashed border-rule/60 bg-transparent',
                          )}
                        >
                          <ItemPhoto item={item} dimmed={!shown} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className={cn('truncate text-sm font-semibold', shown ? 'text-foreground' : 'text-muted-foreground')}>
                                {item.name}
                              </span>
                              {star && shown && (
                                <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-micro font-semibold text-primary">
                                  Featured
                                </span>
                              )}
                              {!item.isAvailable && (
                                <span className="shrink-0 rounded-sm bg-warning-highlight px-1.5 py-0.5 text-micro font-semibold text-stock">
                                  Sold out
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {shown && !reaches
                                ? item.isAvailable
                                  ? 'Guests won’t see it until the category is back on.'
                                  : 'Guests will see it once it’s back in stock.'
                                : item.description || ' '}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                            {formatMoney(Number(item.price), 2)}
                          </span>
                          <button
                            type="button"
                            aria-pressed={star}
                            aria-label={star ? `Stop featuring ${item.name}` : `Feature ${item.name}`}
                            title={
                              star
                                ? 'Featured — shown first with a Featured badge'
                                : featureFull
                                  ? `Up to ${MAX_FEATURED} items can be featured`
                                  : 'Feature — show first with a Featured badge'
                            }
                            disabled={!star && (featureFull || !shown)}
                            onClick={() => onFeaturedChange(toggleFeatured(featuredItemIds, item.id))}
                            className={cn(
                              'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-30',
                              star ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-band hover:text-foreground',
                            )}
                          >
                            <Star size={16} aria-hidden="true" />
                          </button>
                          <Switch
                            checked={shown}
                            onChange={(next) => onVisibilityChange({ ...visibility, [item.id]: next })}
                            label={`Show ${item.name} on the QR menu`}
                          />
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The photo guests see, or a quiet placeholder so rows line up without one. */
function ItemPhoto({ item, dimmed }: { item: MenuItem; dimmed: boolean }) {
  const [failed, setFailed] = useState(false);
  const photo = item.imageUrl && !failed ? item.imageUrl : null;
  return (
    <span
      className={cn(
        'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-band text-muted-foreground transition-opacity',
        dimmed && 'opacity-50 grayscale',
      )}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- menu photos live on arbitrary hosts
        <img src={photo} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <UtensilsCrossed size={18} aria-hidden="true" />
      )}
    </span>
  );
}
