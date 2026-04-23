import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

import { PANEL_TIER_CONFIG } from '@/lib/constants/customers';
import { Customer } from '@/types/customers';

export function LoyaltyProgress({ customer }: { customer: Customer }) {
  const tier = PANEL_TIER_CONFIG[customer.tier];
  return (
    <div className="bg-background rounded-2xl p-4 border border-border">
      <div className="flex items-center justify-between mb-1">
        <Label>Loyalty</Label>
        <Badge variant={tier.variant}>{tier.label}</Badge>
      </div>
      <div className="flex items-end justify-between mt-2 mb-3">
        <p className="text-2xl font-bold text-foreground tabular-nums">
          {customer.pointsBalance.toLocaleString()}
          <span className="text-sm font-normal text-muted-foreground ml-1">pts</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {tier.ptsToNext} to {tier.nextTier}
        </p>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-r from-amber-600 to-amber-400 transition-all duration-500"
          style={{ width: `${tier.progressPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{tier.progressFrom}</span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{tier.progressTo}</span>
      </div>
    </div>
  );
}
