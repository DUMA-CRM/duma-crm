import { TIER_THRESHOLDS } from '@/lib/constants/customers';
import { Customer, Tier } from '@/types/customers';

const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold', 'vip'];

/**
 * The threshold band the balance actually falls in.
 *
 * Deliberately derived from the points, NOT from `customer.tier`: the API assigns
 * the tier on its own basis, so a balance can sit outside its band (a gold member
 * who has spent their points down, a bronze member sitting on a big balance) and
 * plotting it against that band pegs the bar at 0% or 100%.
 */
function bandFor(points: number) {
  const tier = [...TIER_ORDER].reverse().find((candidate) => points >= TIER_THRESHOLDS[candidate].from) ?? 'bronze';
  return TIER_THRESHOLDS[tier];
}

/**
 * Points balance and progress to the next reward threshold. Chrome-less: the
 * caller owns the card it sits in, along with the heading and tier badge.
 */
export function LoyaltyProgress({ customer }: { customer: Customer }) {
  const pts = Number(customer.pointsBalance) || 0;
  const band = bandFor(pts);
  const span = band.to - band.from;
  const progressPct = span > 0 ? Math.min(100, Math.max(0, Math.round(((pts - band.from) / span) * 100))) : 100;
  const ptsToNext = Math.max(0, band.to - pts);

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {pts.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-muted-foreground">pts</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {ptsToNext > 0 ? `${ptsToNext.toLocaleString()} to ${band.nextTier}` : `${band.nextTier} reached`}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-linear-to-r from-amber-600 to-amber-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{band.fromLabel}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{band.nextTier}</span>
      </div>
    </div>
  );
}
