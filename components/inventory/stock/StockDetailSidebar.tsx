'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownUp,
  Boxes,
  CalendarClock,
  CalendarDays,
  Gauge,
  Package,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { type StockMovement, getStockItemMovements } from '@/lib/api/inventory.service';
import { getLossLog } from '@/lib/api/loss.service';
import type { LossRecord } from '@/lib/api/loss.service';
import { cn } from '@/lib/utils/cn';

import {
  REASON_LABELS,
  STATUS_BAR,
  STATUS_LABEL,
  STATUS_VARIANT,
  type StockRow,
  daysColor,
  fmtQty,
  formatDate,
  normaliseArray,
  parseLossNotes,
  stockPct,
  timeAgo,
} from './shared';

const WIDTH = 'w-100 max-w-full';

// ── Small labelled stat used in the forecast block ────────────────────────────

function MiniStat({ label, value, valueClass, icon: Icon }: { label: string; value: string; valueClass?: string; icon: typeof Gauge }) {
  return (
    <div className="rounded-xl bg-surface-offset px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon size={12} />
        <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{label}</span>
      </div>
      <p className={cn('text-base font-semibold text-foreground tabular-nums leading-none', valueClass)}>{value}</p>
    </div>
  );
}

export function StockDetailSidebar({
  item,
  tenantId,
  onClose,
  onAdjust,
  onEditThreshold,
  onToggleAvailable,
  onRemove,
  onRestock,
  onLogLoss,
  onEditItem,
}: {
  item: StockRow | null;
  tenantId: string | null;
  onClose: () => void;
  onAdjust: (i: StockRow) => void;
  onEditThreshold: (i: StockRow) => void;
  onToggleAvailable: (i: StockRow) => void;
  onRemove: (i: StockRow) => void;
  onRestock: (i: StockRow) => void;
  onLogLoss: (i: StockRow) => void;
  onEditItem: (i: StockRow) => void;
}) {
  const { data: rawLosses, isLoading: lossesLoading } = useQuery({
    queryKey: ['loss-log', 'item', item?.stockItemId, item?.locationId],
    queryFn: () => getLossLog({ tenantId: tenantId!, stockItemId: item!.stockItemId, locationId: item!.locationId, limit: 8 }),
    enabled: !!item && !!tenantId,
  });
  const losses = normaliseArray<LossRecord>(rawLosses);

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['stock-movements', item?.stockItemId],
    queryFn: () => getStockItemMovements(item!.stockItemId, { limit: 8 }),
    enabled: !!item,
  });
  const movements = movementsData?.data ?? [];

  if (!item) {
    return (
      <div className={cn(WIDTH, 'shrink-0 border-l border-border bg-card flex items-center justify-center px-6')}>
        <EmptyState
          icon={Boxes}
          title="Select an item"
          description="Pick a row to see its stock level, demand forecast and loss history — and to adjust stock, edit thresholds or request a restock."
        />
      </div>
    );
  }

  const { qty, threshold, status, forecast } = item;
  const pct = stockPct(qty, threshold);
  const unit = item.stockItem?.unit ?? '';

  return (
    <div className={cn(WIDTH, 'shrink-0 border-l border-border bg-card flex flex-col overflow-hidden')}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Stock Item</p>
            <p className="text-lg font-semibold text-foreground leading-snug truncate">{item.stockItem?.name ?? '—'}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
              {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 mt-0.5">
            <X size={14} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-5 space-y-6">
          {/* Stock level */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Stock Level</p>
              <span className="text-xs text-muted-foreground">{Math.round(pct)}% of threshold</span>
            </div>
            <div className="h-2 rounded-full bg-border overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', STATUS_BAR[status])} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-baseline justify-between mt-2.5">
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{fmtQty(qty)}</p>
                <p className="text-xs text-muted-foreground">{unit} current</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-muted-foreground tabular-nums">{fmtQty(threshold)}</p>
                <p className="text-xs text-muted-foreground">threshold</p>
              </div>
            </div>
          </section>

          {/* Demand forecast */}
          <section>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Demand Forecast</p>
            {forecast ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat
                    label="Days left"
                    icon={Gauge}
                    value={`${Math.round(forecast.daysOfStockRemaining)}d`}
                    valueClass={daysColor(forecast.daysOfStockRemaining)}
                  />
                  <MiniStat label="Avg use / day" icon={TrendingDown} value={`${fmtQty(forecast.avgDailyConsumption)} ${unit}`} />
                  <MiniStat
                    label="Est. stockout"
                    icon={CalendarClock}
                    value={forecast.predictedStockoutDate ? formatDate(forecast.predictedStockoutDate) : '—'}
                  />
                  <MiniStat label="Suggested reorder" icon={PackagePlus} value={`${fmtQty(forecast.recommendedReorderQuantity)} ${unit}`} />
                </div>
                {forecast.recommendedReorderQuantity > 0 && (
                  <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => onRestock(item)}>
                    <PackagePlus size={13} /> Request {fmtQty(forecast.recommendedReorderQuantity)} {unit}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground rounded-xl bg-surface-offset px-3 py-3">
                Not enough usage data to forecast yet. Once this item is sold or consumed, its demand trend will appear here.
              </p>
            )}
          </section>

          {/* Loss history */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Loss History</p>
            </div>
            {lossesLoading ? (
              <div className="bg-surface-offset rounded-xl overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 border-b border-border last:border-0 animate-pulse" />
                ))}
              </div>
            ) : losses.length === 0 ? (
              <div className="bg-surface-offset rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground">No losses recorded for this item yet</p>
              </div>
            ) : (
              <div className="bg-surface-offset rounded-xl divide-y divide-border overflow-hidden">
                {losses.map((l) => (
                  <SidebarLossRow key={l.id} loss={l} unit={unit} />
                ))}
              </div>
            )}
          </section>

          {/* Recent activity */}
          <section>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Recent Activity</p>
            {movementsLoading ? (
              <div className="bg-surface-offset rounded-xl overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 border-b border-border last:border-0 animate-pulse" />
                ))}
              </div>
            ) : movements.length === 0 ? (
              <div className="bg-surface-offset rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground">No stock movements recorded yet</p>
              </div>
            ) : (
              <div className="bg-surface-offset rounded-xl divide-y divide-border overflow-hidden">
                {movements.map((m) => (
                  <MovementRow key={m.id} movement={m} unit={unit} />
                ))}
              </div>
            )}
          </section>

          {/* Details */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Details</p>
              <button
                onClick={() => onEditItem(item)}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover transition-colors"
              >
                <Pencil size={11} /> Edit item
              </button>
            </div>
            <InfoGroup>
              <InfoRow icon={Package} label="Item ID" value={`#${item.stockItemId.slice(0, 8).toUpperCase()}`} copyable />
              <InfoRow icon={Boxes} label="Available" value={item.isAvailable ? 'Yes' : 'No'} />
              {item.stockItem?.createdAt && <InfoRow icon={CalendarDays} label="Created" value={formatDate(item.stockItem.createdAt)} />}
            </InfoGroup>
          </section>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
        <div className="flex gap-2">
          <Button className="flex-1 gap-1.5" onClick={() => onAdjust(item)}>
            <ArrowDownUp size={13} /> Adjust Stock
          </Button>
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => onEditThreshold(item)}>
            <Pencil size={13} /> Threshold
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => onRestock(item)}>
            <PackagePlus size={13} /> Restock
          </Button>
          <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => onLogLoss(item)}>
            <PackageMinus size={13} /> Log Loss
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 text-xs" onClick={() => onToggleAvailable(item)}>
            {item.isAvailable ? 'Mark unavailable' : 'Mark available'}
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-xs text-destructive border-destructive/30 hover:bg-destructive hover:text-white hover:border-destructive"
            onClick={() => onRemove(item)}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── A single stock movement in the sidebar ────────────────────────────────────

const MOVEMENT_LABELS: Record<string, string> = {
  deduction: 'Sale / deduction',
  restock: 'Restock',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
  waste: 'Waste',
};

function MovementRow({ movement, unit }: { movement: StockMovement; unit: string }) {
  const label = MOVEMENT_LABELS[movement.type] ?? movement.type;
  const isPositive = movement.delta > 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', isPositive ? 'bg-success/10' : 'bg-destructive/10')}
      >
        {isPositive ? <TrendingUp size={13} className="text-success" /> : <TrendingDown size={13} className="text-destructive" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {movement.notes && (
          <p className="text-[11px] text-muted-foreground truncate" title={movement.notes}>
            {movement.notes}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-xs font-bold tabular-nums', isPositive ? 'text-success' : 'text-destructive')}>
          {isPositive ? '+' : ''}
          {movement.delta} {unit}
        </p>
        <p className="text-[11px] text-muted-foreground">{timeAgo(movement.createdAt)}</p>
      </div>
    </div>
  );
}

// ── A single loss entry in the sidebar ────────────────────────────────────────

function SidebarLossRow({ loss, unit }: { loss: LossRecord; unit: string }) {
  const { reason, notes } = parseLossNotes(loss.notes);
  const displayReason = (reason ?? loss.type) as keyof typeof REASON_LABELS;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-destructive/10">
        <TrendingDown size={13} className="text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{REASON_LABELS[displayReason] ?? displayReason}</p>
        {notes && (
          <p className="text-[11px] text-muted-foreground truncate" title={notes}>
            {notes}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-bold tabular-nums text-destructive">
          -{fmtQty(Math.abs(loss.quantity))} {unit}
        </p>
        <p className="text-[11px] text-muted-foreground">{timeAgo(loss.createdAt)}</p>
      </div>
    </div>
  );
}
