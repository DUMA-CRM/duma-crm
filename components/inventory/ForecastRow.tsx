'use client';

import { CalendarX, MapPin, Package, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { type InventoryForecast } from '@/lib/api/inventory.service';
import { cn } from '@/lib/utils/cn';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysColor(days: number): string {
  if (days <= 0) return 'text-destructive';
  if (days <= 7) return 'text-destructive';
  if (days <= 14) return 'text-warning';
  if (days <= 30) return 'text-amber-500';
  return 'text-success';
}

function daysBarColor(days: number): string {
  if (days <= 7) return 'bg-destructive';
  if (days <= 14) return 'bg-warning';
  if (days <= 30) return 'bg-amber-400';
  return 'bg-success';
}

function daysBarWidth(days: number, max: number): number {
  if (max <= 0) return 100;
  return Math.min((days / max) * 100, 100);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ForecastRow({
  item,
  maxDays,
}: {
  item: InventoryForecast;
  maxDays: number;
}) {
  const days = Math.round(item.daysOfStockRemaining);
  const pct = daysBarWidth(days, maxDays);
  const qty = parseFloat(item.currentQuantity);

  const statusLabel = item.isCritical ? 'Critical' : item.isLow ? 'Low' : 'Healthy';
  const statusVariant: 'destructive' | 'warning' | 'success' = item.isCritical
    ? 'destructive'
    : item.isLow
      ? 'warning'
      : 'success';

  return (
    <div className="grid grid-cols-[2fr_1.2fr_0.7fr_1fr_1fr_1.6fr_1.2fr_1.1fr_0.9fr] gap-4 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface-offset/30 transition-colors">
      {/* Item */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
          item.isCritical ? 'bg-destructive/10' : item.isLow ? 'bg-warning/10' : 'bg-primary/10',
        )}>
          <Package size={13} className={
            item.isCritical ? 'text-destructive' : item.isLow ? 'text-warning' : 'text-primary'
          } />
        </div>
        <span className="text-sm font-medium text-foreground truncate">{item.stockItemName}</span>
      </div>

      {/* Location */}
      <div className="flex items-center gap-1.5 min-w-0">
        <MapPin size={12} className="shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground truncate">
          {item.location?.name ?? item.locationName ?? '—'}
        </span>
      </div>

      {/* Unit */}
      <div className="flex items-center">
        <span className="text-xs text-muted-foreground bg-surface-offset px-2 py-0.5 rounded-full">{item.unit}</span>
      </div>

      {/* Current stock */}
      <div className="flex items-center">
        <span className="text-sm tabular-nums text-foreground font-medium">{qty % 1 === 0 ? qty : qty.toFixed(1)}</span>
      </div>

      {/* Daily usage */}
      <div className="flex items-center gap-1.5">
        {item.avgDailyConsumption > 0
          ? <TrendingDown size={12} className="text-muted-foreground shrink-0" />
          : <TrendingUp size={12} className="text-muted-foreground shrink-0" />
        }
        <span className="text-sm tabular-nums text-muted-foreground">
          {item.avgDailyConsumption > 0 ? item.avgDailyConsumption.toFixed(1) : '—'}
          {item.avgDailyConsumption > 0 && <span className="text-xs ml-0.5">/ day</span>}
        </span>
      </div>

      {/* Days remaining */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', daysBarColor(days))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={cn('text-sm font-semibold tabular-nums w-8 text-right shrink-0', daysColor(days))}>
          {days <= 0 ? '0' : days}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">days</span>
      </div>

      {/* Stockout date */}
      <div className="flex items-center gap-1.5">
        {item.predictedStockoutDate && (
          <CalendarX size={12} className={cn('shrink-0', item.isCritical ? 'text-destructive' : 'text-muted-foreground')} />
        )}
        <span className={cn('text-sm', item.isCritical ? 'text-destructive font-medium' : 'text-muted-foreground')}>
          {formatDate(item.predictedStockoutDate)}
        </span>
      </div>

      {/* Reorder qty */}
      <div className="flex items-center">
        <span className="text-sm tabular-nums text-foreground">
          {item.recommendedReorderQuantity > 0 ? item.recommendedReorderQuantity : '—'}
          {item.recommendedReorderQuantity > 0 && (
            <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
          )}
        </span>
      </div>

      {/* Status */}
      <div className="flex items-center">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>
    </div>
  );
}
