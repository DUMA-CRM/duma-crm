'use client';

import { ArrowLeftRight, Ban, History, type IconComponent, Loader2, PackageMinus, RotateCcw, Trash2 } from '@/components/icons';
import { fmtQty } from '@/components/inventory/stock/shared';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

/**
 * "Remove from this location", told the way the API does it: `DELETE
 * /location-stock/:id` refuses while anything is on hand (409) and otherwise
 * archives — the row is marked unavailable, nothing is deleted. So with stock
 * left the drawer offers the ways to clear it instead of a button that fails.
 */
export function RemoveItemDrawer({
  name,
  unit,
  onHand,
  locationName,
  pending,
  canLogWaste,
  canTransfer,
  onLogWaste,
  onTransfer,
  onConfirm,
  onClose,
}: {
  name: string;
  unit: string;
  onHand: number;
  locationName?: string;
  pending: boolean;
  canLogWaste: boolean;
  canTransfer: boolean;
  onLogWaste: () => void;
  onTransfer: () => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const blocked = onHand > 0;
  const here = locationName ?? 'this location';
  const rows: { icon: IconComponent; title: string; detail: string; tone: 'stop' | 'keep' }[] = [
    { icon: Ban, title: `Stops being stocked at ${here}`, detail: `${name} is marked unavailable here — it leaves ordering, recipes and the suggested order.`, tone: 'stop' },
    { icon: History, title: 'History is kept', detail: 'Movements, losses, transfers and stocktakes stay on record. Other locations aren’t affected.', tone: 'keep' },
    { icon: RotateCcw, title: 'Bring it back any time', detail: 'Switch “Available here” back on from the item’s Overview.', tone: 'keep' },
  ];

  return (
    <Drawer
      title={`Remove from ${here}`}
      description="Stops tracking it here. Nothing is deleted."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={pending}>
            {blocked ? 'Close' : 'Keep it'}
          </Button>
          {!blocked && (
            <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              Remove from {here}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {blocked && (
          <div className="rounded-lg border border-measured/35 bg-measured/6 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">
              {fmtQty(onHand)} {unit} still on hand
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Stock that’s still counted can’t be removed. Log what’s left as waste, or transfer it to another location, then come back.
            </p>
            {(canLogWaste || canTransfer) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {canLogWaste && (
                  <Button variant="outline" size="sm" onClick={onLogWaste}>
                    <PackageMinus aria-hidden="true" /> Log waste
                  </Button>
                )}
                {canTransfer && (
                  <Button variant="outline" size="sm" onClick={onTransfer}>
                    <ArrowLeftRight aria-hidden="true" /> Transfer
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{blocked ? 'Once it’s empty, removing it' : 'What happens'}</h3>
          <ul className={cn('overflow-hidden rounded-lg border border-rule/60 bg-card', blocked && 'opacity-70')}>
            {rows.map(({ icon: Icon, title, detail, tone }) => (
              <li key={title} className="flex items-start gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                <span
                  className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', tone === 'stop' ? 'bg-exception/8 text-exception' : 'bg-primary/8 text-primary')}
                  aria-hidden="true"
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{title}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Drawer>
  );
}
