import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

import { PANEL_TIER_CONFIG, TIER_THRESHOLDS } from '@/lib/constants/customers';
import { Customer } from '@/types/customers';

export function LoyaltyProgress({ customer }: { customer: Customer }) {
  const tier = PANEL_TIER_CONFIG[customer.tier];
  const thresh = TIER_THRESHOLDS[customer.tier];
  const pts = customer.pointsBalance;
  const progressPct = Math.min(100, Math.max(0, Math.round(((pts - thresh.from) / (thresh.to - thresh.from)) * 100)));
  const ptsToNext = Math.max(0, thresh.to - pts);

  return (
    <div className="bg-background rounded-2xl p-4 border border-border">
      <div className="flex items-center justify-between mb-1">
        <Label>Loyalty</Label>
        <Badge variant={tier.variant}>{tier.label}</Badge>
      </div>
      <div className="flex items-end justify-between mt-2 mb-3">
        <p className="text-2xl font-bold text-foreground tabular-nums">
          {pts.toLocaleString()}
          <span className="text-sm font-normal text-muted-foreground ml-1">pts</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {ptsToNext > 0 ? `${ptsToNext.toLocaleString()} to ${thresh.nextTier}` : `${thresh.nextTier} reached`}
        </p>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-r from-amber-600 to-amber-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{thresh.fromLabel}</span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{thresh.nextTier}</span>
      </div>
    </div>
  );
}
