'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, MapPin, Package, TrendingDown } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { getInventoryForecast, getLowStockAlerts } from '@/lib/api/inventory.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function AlertsSidebar() {
  const { locationId } = useWorkspaceStore();

  const { data: alerts = [] } = useQuery({
    queryKey: ['low-stock-alerts', locationId],
    queryFn: () => getLowStockAlerts(locationId ?? undefined),
    enabled: !!locationId,
    refetchInterval: 60_000,
  });

  const { data: forecast = [] } = useQuery({
    queryKey: ['inventory-forecast', locationId],
    queryFn: () => getInventoryForecast(locationId ?? undefined),
    enabled: !!locationId,
  });

  const critical = forecast.filter((f) => f.isCritical);
  const warning = forecast.filter((f) => f.isLow && !f.isCritical);

  return (
    <div className="w-100 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Status</p>
            <p className="font-semibold text-foreground">Alerts & Forecast</p>
          </div>
          {alerts.length > 0 && (
            <span className="flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-destructive text-white text-xs font-bold">
              {alerts.length}
            </span>
          )}
        </div>
      </div>

      {!locationId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <MapPin size={28} className="text-muted-foreground opacity-40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Select a location to see alerts and forecast.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4 flex flex-col gap-5">
            {/* Low stock alerts */}
            <section>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Low Stock</p>
              {alerts.length === 0 ? (
                <p className="text-xs text-muted-foreground">All stock levels are healthy.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center gap-3 px-3 py-2.5 bg-destructive/5 border border-destructive/20 rounded-xl"
                    >
                      <AlertTriangle size={14} className="text-destructive shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{alert.stockItem?.name ?? alert.stockItemId}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.quantity} {alert.stockItem?.unit} · threshold {alert.lowThreshold}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Forecast */}
            {forecast.length > 0 && (
              <section>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Forecast</p>
                <div className="flex flex-col gap-1.5">
                  {[...critical, ...warning].map((item) => (
                    <div
                      key={item.locationStockId}
                      className={cn(
                        'px-3 py-2.5 rounded-xl border',
                        item.isCritical ? 'bg-destructive/5 border-destructive/20' : 'bg-warning/5 border-warning/20',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground truncate">{item.stockItemName}</p>
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0',
                            item.isCritical ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning',
                          )}
                        >
                          {item.isCritical ? 'Critical' : 'Low'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TrendingDown size={11} aria-hidden="true" />
                          {item.daysOfStockRemaining} days left
                        </span>
                        <span>
                          {item.currentQuantity} {item.unit}
                        </span>
                      </div>
                      {item.predictedStockoutDate && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Stockout {new Date(item.predictedStockoutDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {' · '}reorder {item.recommendedReorderQuantity} {item.unit}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Healthy items count */}
                  {forecast.length - critical.length - warning.length > 0 && (
                    <p className="text-xs text-muted-foreground px-1 pt-1">
                      +{forecast.length - critical.length - warning.length} items with sufficient stock
                    </p>
                  )}
                </div>
              </section>
            )}

            {forecast.length === 0 && alerts.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Package size={28} className="text-muted-foreground opacity-40" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">No data yet. Add stock to see forecasts.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
