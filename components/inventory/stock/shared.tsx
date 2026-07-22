import type { InventoryCategory, InventoryForecast, LocationStock } from '@/lib/api/inventory.service';
import type { LossCreateReason, LossReason } from '@/lib/api/loss.service';
import { cn } from '@/lib/utils/cn';

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

export function stockPct(qty: number, threshold: number): number {
  if (threshold <= 0) return qty > 0 ? 100 : 0;
  return Math.min((qty / threshold) * 100, 100);
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

export const STATUS_VARIANT: Record<StockStatus, 'success' | 'amber' | 'destructive' | 'muted'> = {
  ok: 'success',
  low: 'amber',
  critical: 'destructive',
  out: 'destructive',
  unavailable: 'muted',
};

export const STATUS_BAR: Record<StockStatus, string> = {
  ok: 'bg-success',
  low: 'bg-amber-400',
  critical: 'bg-destructive',
  out: 'bg-destructive',
  unavailable: 'bg-border',
};

export const STATUS_ICON_BG: Record<StockStatus, string> = {
  ok: 'bg-primary/10',
  low: 'bg-amber-400/10',
  critical: 'bg-destructive/10',
  out: 'bg-destructive/10',
  unavailable: 'bg-border/50',
};

export const STATUS_ICON_FG: Record<StockStatus, string> = {
  ok: 'text-primary',
  low: 'text-amber-500',
  critical: 'text-destructive',
  out: 'text-destructive',
  unavailable: 'text-muted-foreground',
};

/** Colour for a "days of stock remaining" figure. */
export function daysColor(days: number): string {
  if (days <= 3) return 'text-destructive';
  if (days <= 7) return 'text-amber-500';
  return 'text-foreground';
}

// ── An enriched row: location stock joined with its forecast ──────────────────

export type StockRow = LocationStock & {
  status: StockStatus;
  qty: number;
  threshold: number;
  forecast?: InventoryForecast;
  category?: InventoryCategory;
  activeUnitCount?: number;
  earliestExpiryDate?: string | null;
  needsReorder?: boolean;
};

// ── Loss reasons ──────────────────────────────────────────────────────────────
// The server stores the note as "<reason>: <user notes>", so we parse that back
// out for display. We do NOT build that string on the way in — the API composes
// it from the `reason` field itself.

export function parseLossNotes(raw: string | null): { reason: string | null; notes: string | null } {
  if (!raw) return { reason: null, notes: null };
  const colonIdx = raw.indexOf(':');
  if (colonIdx === -1) return { reason: null, notes: raw.trim() || null };
  const reason = raw.slice(0, colonIdx).trim().toLowerCase();
  const notes = raw.slice(colonIdx + 1).trim() || null;
  return { reason, notes };
}

// Canonical loss reasons recorded against physical stock units.
export const REASON_LABELS: Record<LossReason, string> = {
  waste: 'Waste',
  theft: 'Theft',
  damage: 'Damage',
  expiry: 'Expiry',
  other: 'Other',
};

// Only the reasons the API accepts on create.
export const REASON_OPTIONS: { value: LossCreateReason; label: string }[] = [
  { value: 'expiry', label: 'Expiry' },
  { value: 'damage', label: 'Damage' },
  { value: 'theft', label: 'Theft' },
  { value: 'other', label: 'Other' },
];

export function reasonVariant(type: string): 'warning' | 'destructive' | 'muted' | 'amber' {
  if (type === 'theft') return 'destructive';
  if (type === 'expiry') return 'warning';
  if (type === 'damage') return 'amber';
  return 'muted';
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export const selectClass = cn(
  'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 pr-8 text-sm text-foreground',
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
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
