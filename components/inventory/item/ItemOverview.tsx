'use client';

import { motion } from 'motion/react';
import { useState } from 'react';

import {
  AlertTriangle,
  Barcode,
  Box,
  Boxes,
  CalendarClock,
  CalendarDays,
  Candy,
  CircleDot,
  Clock,
  Coins,
  Droplet,
  Droplets,
  Egg,
  Flame,
  FlaskConical,
  Gauge,
  type IconComponent,
  Info as InfoIcon,
  Leaf,
  Package,
  PackagePlus,
  Pencil,
  Sprout,
  Tag,
  Timer,
  Trash2,
  TrendingDown,
  TriangleAlert,
  Wheat,
} from '@/components/icons';
import { STATUS_LABEL, STATUS_TONE, type StockStatus, categoryMeta, fmtQty, formatDate } from '@/components/inventory/stock/shared';
import { CopyButton, RecordBlock, RecordList, RecordListRow } from '@/components/people/record/shared';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Fact, SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { Pill } from '@/components/shared/Pill';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import {
  type InventoryForecast,
  type LocationStock,
  NUTRITION_FIELDS,
  type NutritionBasis,
  type StockItem,
} from '@/lib/modules/inventory/client';
import { cn } from '@/lib/utils/cn';
import { type ItemAttentionSeverity, type ItemAttentionTarget, daysUntil, expiryLabel, itemAttention } from '@/lib/utils/stock-item';

const BASIS_LABEL: Record<NutritionBasis, string> = { per_100g: 'Per 100 g', per_100ml: 'Per 100 ml', per_piece: 'Per piece' };

const NUTRITION_ICONS: Record<string, IconComponent> = {
  kcal: Flame,
  fat: Droplet,
  saturates: Droplets,
  carbs: Wheat,
  sugars: Candy,
  fibre: Sprout,
  protein: Egg,
  salt: CircleDot,
};

/** A glyph beside each allergen's name — the word stays, it's the compliance record. */
const ALLERGEN_ICONS: Partial<Record<string, IconComponent>> = {
  gluten: Wheat,
  eggs: Egg,
  milk: Droplet,
  nuts: Sprout,
  peanuts: Sprout,
  celery: Leaf,
  lupin: Leaf,
  soya: Sprout,
  sesame: CircleDot,
  mustard: Flame,
  sulphites: FlaskConical,
};

const SEVERITY_TILE: Record<ItemAttentionSeverity, string> = {
  blocking: 'bg-exception/8 text-exception',
  attention: 'bg-measured/10 text-measured',
  info: 'bg-primary/8 text-primary',
};
const SEVERITY_ICON: Record<ItemAttentionSeverity, IconComponent> = { blocking: AlertTriangle, attention: Clock, info: InfoIcon };

export interface ItemOverviewCan {
  restock: boolean;
  /** `stock.locations:write` — par, availability, remove. */
  par: boolean;
  /** `stock:write` — the catalogue record. */
  edit: boolean;
}

/**
 * The item's front page in the settings vocabulary: what needs someone, a
 * profile panel with four facts and the stock bar, then the reference — stock
 * at this location in the main column; the catalogue record, nutrition and the
 * location switches beside it. Each fact is said once.
 */
export function ItemOverview({
  item,
  stock,
  status,
  onHand,
  activeUnitCount,
  earliestExpiry,
  threshold,
  forecast,
  can,
  hasLocation,
  togglePending,
  onRestock,
  onEditThreshold,
  onEditItem,
  onToggleAvailable,
  onRemove,
  onOpenContainers,
}: {
  item: StockItem;
  stock: LocationStock | null;
  status: StockStatus | null;
  onHand: number;
  activeUnitCount: number;
  earliestExpiry?: string | null;
  threshold: number;
  forecast?: InventoryForecast;
  can: ItemOverviewCan;
  /** False when "All locations" is picked — stock is per location, so there is none to show. */
  hasLocation: boolean;
  togglePending: boolean;
  onRestock: () => void;
  onEditThreshold: () => void;
  onEditItem: () => void;
  onToggleAvailable: () => void;
  onRemove: () => void;
  onOpenContainers: () => void;
}) {
  const money = useWorkspaceMoney();
  const { location } = useCurrentWorkspace();
  const [now] = useState(() => new Date());
  const unit = item.unit;
  const category = categoryMeta(item.category);
  const daysLeft = forecast?.daysOfStockRemaining ?? null;
  const cost = item.costPerUnit != null && item.costPerUnit !== '' ? Number(item.costPerUnit) : null;
  const expiry = expiryLabel(earliestExpiry ?? null, now);
  const expiryDays = earliestExpiry ? daysUntil(earliestExpiry, now) : null;
  // The forecast sometimes has days left but no date; the date follows from the days.
  const stockoutDate =
    forecast?.predictedStockoutDate ??
    (daysLeft != null ? new Date(now.getTime() + Math.max(0, daysLeft) * 86_400_000).toISOString() : null);

  const attention = stock
    ? itemAttention({
        isAvailable: stock.isAvailable,
        onHand,
        threshold,
        unit,
        daysLeft,
        earliestExpiry: earliestExpiry ?? null,
        cost: item.costPerUnit,
        now,
      })
    : [];
  const act: Record<ItemAttentionTarget, { label: string; run: () => void; allowed: boolean }> = {
    restock: { label: 'Restock', run: onRestock, allowed: can.restock },
    threshold: { label: 'Set par', run: onEditThreshold, allowed: can.par },
    available: { label: 'Mark available', run: onToggleAvailable, allowed: can.par },
    containers: { label: 'Containers', run: onOpenContainers, allowed: true },
  };

  const nutritionRows = item.nutrition
    ? NUTRITION_FIELDS.filter((f) => item.nutrition?.[f.key] != null).map((f) => ({ ...f, value: item.nutrition?.[f.key] as number }))
    : [];
  const allergens = item.allergens ?? [];
  // The bar's scale: twice the threshold, or the stock if there is more — so the
  // threshold marker sits mid-bar and a full shelf still fits.
  const scale = Math.max(onHand, threshold * 2, 1);

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      {attention.length > 0 && (
        <motion.section variants={SECTION_RISE} aria-label="Needs attention">
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {attention.map((entry) => {
              const Icon = SEVERITY_ICON[entry.severity];
              const action = entry.target ? act[entry.target] : null;
              return (
                <li key={entry.id} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                  <span
                    className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', SEVERITY_TILE[entry.severity])}
                    aria-hidden="true"
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{entry.title}</span>
                    <span className="block text-xs text-muted-foreground">{entry.detail}</span>
                  </span>
                  {action?.allowed && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={action.run}
                      disabled={entry.target === 'available' && togglePending}
                    >
                      {action.label}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}

      <SettingsTabBody
        aside={
          <>
            {stock && (
              <RecordBlock
                id="item-demand"
                title="Demand"
                note="From the last 30 days of use at this location."
                action={
                  can.restock &&
                  forecast &&
                  forecast.recommendedReorderQuantity > 0 && (
                    <Button size="sm" onClick={onRestock}>
                      <PackagePlus aria-hidden="true" /> Request {Math.ceil(forecast.recommendedReorderQuantity)} {unit}
                    </Button>
                  )
                }
              >
                <RecordList>
                  <RecordListRow
                    icon={TrendingDown}
                    tone="team"
                    label="Average use per day"
                    value={forecast && forecast.avgDailyConsumption > 0 ? `${fmtQty(forecast.avgDailyConsumption)} ${unit}` : undefined}
                    placeholder="Not enough usage yet"
                  />
                  <RecordListRow
                    icon={PackagePlus}
                    tone="team"
                    label="Suggested reorder"
                    value={
                      forecast && forecast.recommendedReorderQuantity > 0
                        ? `${fmtQty(forecast.recommendedReorderQuantity)} ${unit}`
                        : undefined
                    }
                    placeholder="Nothing to order"
                    detail={stock.reorderQuantity ? `usual order ${fmtQty(Number(stock.reorderQuantity))} ${unit}` : undefined}
                  />
                  <RecordListRow
                    icon={Coins}
                    tone="money"
                    label="Last cost"
                    value={cost != null ? `${money(cost)} per ${unit}` : undefined}
                    placeholder="Set by the first priced delivery"
                  />
                </RecordList>
              </RecordBlock>
            )}

            {(nutritionRows.length > 0 || allergens.length > 0) && (
              <RecordBlock id="item-nutrition" title="Nutrition" note={item.nutritionBasis ? BASIS_LABEL[item.nutritionBasis] : undefined}>
                <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                  {nutritionRows.length > 0 && (
                    // The Demand and Item rows' shape — tinted tile, bold value, muted label — two to a line.
                    <dl className="grid grid-cols-2">
                      {nutritionRows.map((f) => {
                        const Icon = NUTRITION_ICONS[f.key] ?? CircleDot;
                        return (
                          <div
                            key={f.key}
                            className="flex items-center gap-3 border-t border-rule/45 px-3.5 py-3 odd:border-r [&:nth-child(-n+2)]:border-t-0"
                          >
                            <span
                              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-momentum/8 text-momentum"
                              aria-hidden="true"
                            >
                              <Icon size={16} />
                            </span>
                            <div className="flex min-w-0 flex-col-reverse">
                              <dt className="truncate text-xs text-muted-foreground">{f.label}</dt>
                              <dd className="truncate text-sm font-semibold text-foreground">
                                {fmtQty(f.value)} {f.unit}
                              </dd>
                            </div>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                  {allergens.length > 0 ? (
                    <div className={cn('flex items-center gap-3 px-3.5 py-3', nutritionRows.length > 0 && 'border-t border-rule/45')}>
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-measured/8 text-measured"
                        aria-hidden="true"
                      >
                        <TriangleAlert size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap gap-x-3 gap-y-1">
                          {allergens.map((allergen) => {
                            const Glyph = ALLERGEN_ICONS[allergen] ?? TriangleAlert;
                            return (
                              <span
                                key={allergen}
                                className="inline-flex items-center gap-1 text-sm font-semibold capitalize text-foreground"
                              >
                                <Glyph size={13} className="text-measured" aria-hidden="true" />
                                {allergen}
                              </span>
                            );
                          })}
                        </span>
                        <span className="block text-xs text-muted-foreground">Allergens</span>
                      </span>
                    </div>
                  ) : null}
                </div>
              </RecordBlock>
            )}

            {stock && can.par && (
              <SettingsSection title={location ? `At ${location.name}` : 'At this location'}>
                <SettingRows>
                  <SettingRow
                    icon={Boxes}
                    title="Available here"
                    description="Offered for ordering and recipes at this location. Stock is kept either way."
                  >
                    <Switch label="Available here" checked={stock.isAvailable} onChange={onToggleAvailable} disabled={togglePending} />
                  </SettingRow>
                  <SettingRow
                    icon={Trash2}
                    title="Remove from this location"
                    description="Stops tracking it here once nothing is on hand. History is kept."
                  >
                    <Button variant="destructive" size="sm" onClick={onRemove}>
                      Remove
                    </Button>
                  </SettingRow>
                </SettingRows>
              </SettingsSection>
            )}
          </>
        }
      >
        <SettingsSection>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <span
              className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary shadow-sm"
              aria-hidden="true"
            >
              <category.icon size={34} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-2xl font-semibold tracking-headline text-foreground">{item.name}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {category.label} · {unit}
              </p>
              <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                {status ? (
                  <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
                ) : hasLocation ? (
                  <Pill tone="muted">Not stocked here</Pill>
                ) : null}
                {hasLocation && location && <span className="text-xs text-muted-foreground">at {location.name}</span>}
              </p>
            </div>
            {/* The catalogue record's one edit — name, unit, category, nutrition — on the card that shows it. */}
            {can.edit && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0 self-center sm:self-start"
                onClick={onEditItem}
                aria-label={`Edit ${item.name}`}
                title="Edit item"
              >
                <Pencil aria-hidden="true" />
              </Button>
            )}
          </div>

          {stock ? (
            <>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <Fact
                  icon={Package}
                  label="On hand"
                  value={`${fmtQty(onHand)} ${unit}`}
                  tone={onHand <= 0 ? 'danger' : threshold > 0 && onHand <= threshold ? 'warning' : 'default'}
                  hint={cost == null ? 'No cost yet' : onHand > 0 ? `${money(onHand * cost)} at last cost` : 'Nothing to value'}
                />
                <Fact
                  icon={Box}
                  label="Containers"
                  value={activeUnitCount}
                  hint={activeUnitCount === 1 ? 'Open or sealed' : 'Open and sealed'}
                  onSelect={onOpenContainers}
                />
                <Fact
                  icon={CalendarClock}
                  label="Earliest expiry"
                  value={expiry ?? '—'}
                  tone={expiryDays === null ? 'default' : expiryDays < 0 ? 'danger' : expiryDays <= 2 ? 'warning' : 'default'}
                  hint={earliestExpiry ? formatDate(earliestExpiry) : item.isPerishable ? 'No dated containers' : 'Doesn’t expire'}
                />
                <Fact
                  icon={Gauge}
                  label="Days left"
                  value={daysLeft != null ? `${Math.round(daysLeft)} ${Math.round(daysLeft) === 1 ? 'day' : 'days'}` : '—'}
                  tone={daysLeft == null ? 'default' : daysLeft <= 3 ? 'danger' : daysLeft <= 7 ? 'warning' : 'default'}
                  hint={stockoutDate ? `Out around ${formatDate(stockoutDate)}` : 'Not enough usage yet'}
                />
              </dl>

              {/* On hand against par: the marker is par, the fill is the shelf. */}
              <div className="mt-5">
                <div className="relative h-2 rounded-full bg-band">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      onHand <= 0 || (threshold > 0 && onHand <= threshold / 2)
                        ? 'bg-exception'
                        : threshold > 0 && onHand <= threshold
                          ? 'bg-measured'
                          : 'bg-primary',
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (onHand / scale) * 100)}%` }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                  {threshold > 0 && (
                    <span
                      className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground/60"
                      style={{ left: `${(threshold / scale) * 100}%` }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{threshold > 0 ? `Par ${fmtQty(threshold)} ${unit}` : 'No par set'}</span>
                  {can.par && (
                    <button type="button" onClick={onEditThreshold} className="font-semibold text-primary hover:underline">
                      {threshold > 0 ? 'Change' : 'Set par'}
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : hasLocation ? (
            <p className="mt-6 rounded-md bg-band/60 px-3.5 py-3 text-sm text-muted-foreground">
              Not stocked at {location?.name ?? 'this location'}, so it has no stock level, par or containers here.
            </p>
          ) : null}
        </SettingsSection>

        <RecordBlock id="item-record" label="Item">
          <RecordList>
            {item.defaultContainerQuantity ? (
              <RecordListRow
                icon={Box}
                tone="reference"
                label="Container size"
                value={`${fmtQty(Number(item.defaultContainerQuantity))} ${unit}`}
              />
            ) : null}
            <RecordListRow icon={Barcode} tone="reference" label="Barcode" value={item.barcode} placeholder="No barcode" />
            <RecordListRow
              icon={Timer}
              tone="reference"
              label="Shelf life"
              value={item.isPerishable ? (item.defaultShelfLifeDays ? `${item.defaultShelfLifeDays} days` : 'Perishable') : '—'}
            />
            <RecordListRow
              icon={Tag}
              tone="muted"
              label="Item ID"
              value={`#${item.id.slice(0, 8).toUpperCase()}`}
              trailing={<CopyButton value={item.id} label="item ID" />}
            />
            <RecordListRow icon={CalendarDays} tone="muted" label="Added" value={formatDate(item.createdAt)} />
          </RecordList>
        </RecordBlock>
      </SettingsTabBody>
    </motion.div>
  );
}
