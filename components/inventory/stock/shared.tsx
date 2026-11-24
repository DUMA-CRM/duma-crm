import { AlertTriangle, Coffee, EyeOff, type IconComponent, Package, ShoppingBag, Wheat, XCircle } from '@/components/icons';
import { MiniBar } from '@/components/shared/MiniBar';
import type { Tone } from '@/components/shared/tone';

import type { LocationStock } from '@/lib/modules/inventory/client';
import type { LossReason } from '@/lib/modules/inventory/client';
import { cn } from '@/lib/utils/cn';
import { formatDate as formatAppDate } from '@/lib/utils/date';

// ── Stock status ────────────────────────────────────────────────────────────

export type StockStatus = 'ok' | 'low' | 'critical' | 'out' | 'unavailable';

export function getStatus(item: LocationStock): StockStatus {
  if (!item.isAvailable) return 'unavailable';
  const qty = parseFloat(item.quantity);
  const threshold = parseFloat(item.lowThreshold);
  if (qty <= 0) return 'out';
  if (threshold <= 0) return 'ok';
  if (qty <= threshold * 0.5) return 'critical';
  if (qty <= threshold) return 'low';
  return 'ok';
}

/** Format a numeric quantity: whole numbers as-is, otherwise 1 decimal. */
export function fmtQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'Healthy',
  low: 'Low',
  critical: 'Critical',
  out: 'Out of stock',
  unavailable: 'Unavailable',
};

/** The shared tone each stock status is drawn in — tile, bar and dot alike. */
export const STATUS_TONE: Record<StockStatus, Tone> = {
  ok: 'success',
  low: 'warning',
  critical: 'exception',
  out: 'exception',
  unavailable: 'muted',
};

// ── Category ────────────────────────────────────────────────────────────────

/** What a stock category is called and drawn as — one map for the list, the item page and the drawers. */
export const CATEGORY_META: Record<string, { label: string; icon: IconComponent }> = {
  FOOD: { label: 'Food', icon: Wheat },
  BEVERAGE: { label: 'Drinks', icon: Coffee },
  SUPPLY: { label: 'Supplies', icon: Package },
  MERCH: { label: 'Retail', icon: ShoppingBag },
};

export function categoryMeta(category: string | null | undefined): { label: string; icon: IconComponent } {
  if (!category) return { label: 'Uncategorised', icon: Package };
  return CATEGORY_META[category] ?? { label: category, icon: Package };
}

/**
 * A stock row's tile glyph: the category while it is healthy, the trouble once
 * it isn't — so the tile itself says "low", "out" or "hidden" without a chip.
 */
export function statusGlyph(status: StockStatus, category: string | null | undefined): { icon: IconComponent; label: string } {
  if (status === 'low' || status === 'critical') return { icon: AlertTriangle, label: STATUS_LABEL[status] };
  if (status === 'out') return { icon: XCircle, label: STATUS_LABEL.out };
  if (status === 'unavailable') return { icon: EyeOff, label: STATUS_LABEL.unavailable };
  const meta = categoryMeta(category);
  return { icon: meta.icon, label: meta.label };
}

/** On hand against par as a thin bar, the par as a tick; dashed when no par is set. */
export function ParMeter({
  qty,
  par,
  unit,
  status,
  className,
}: {
  qty: number;
  par: number;
  unit: string;
  status: StockStatus;
  className?: string;
}) {
  const hasPar = par > 0;
  return (
    <MiniBar
      value={qty}
      target={hasPar ? par : null}
      tone={STATUS_TONE[status]}
      unset={!hasPar}
      label={hasPar ? `${fmtQty(qty)} ${unit} on hand, par ${fmtQty(par)}` : `${fmtQty(qty)} ${unit} on hand, no par set`}
      className={className}
    />
  );
}

// Canonical loss reasons recorded against physical stock units.
export const REASON_LABELS: Record<LossReason, string> = {
  waste: 'Waste',
  theft: 'Theft',
  damage: 'Damage',
  expiry: 'Expiry',
  other: 'Other',
};

// ── Misc ──────────────────────────────────────────────────────────────────────

export const selectClass = cn(
  'w-full h-9 bg-control border border-input rounded-sm px-3 pr-8 text-sm text-foreground',
  'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150 appearance-none cursor-pointer',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

export function normaliseArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { data?: T[] };
  if (Array.isArray(r.data)) return r.data;
  return Object.values(raw as object) as T[];
}

export function formatDate(dateStr: string): string {
  return formatAppDate(dateStr);
}

