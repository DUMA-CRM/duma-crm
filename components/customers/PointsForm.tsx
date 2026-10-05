'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { BalanceAdjustModal } from '@/components/customers/BalanceAdjustModal';
import { TIER_RUNGS } from '@/components/customers/LoyaltyProgress';
import { Star, TrendingDown, TrendingUp } from '@/components/icons';

import { adjustPoints } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { tierLadder } from '@/lib/utils/loyalty-tiers';
import { toast } from '@/stores/toastStore';
import type { Customer } from '@/types/customers';

/**
 * The amounts staff actually reach for. Someone correcting a missed scan or
 * making a goodwill gesture is thinking of a situation, not a number.
 */
const PRESETS = [25, 50, 100, 250, 500] as const;

/**
 * Add or remove loyalty points, through the shared adjust dialog. The preview
 * says what the change does to their place on the tier ladder — plotted from
 * the points, as the Points panel is (`tierLadder`).
 */
export function PointsForm({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}) {
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: ({ delta, reason }: { delta: number; reason: string }) => adjustPoints(customer.id, delta, reason || undefined),
    onSuccess: (updated, { delta }) => {
      // The timeline shows this adjustment, so it has to be refetched too.
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-timeline', customer.id) });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-ledger', customer.id) });
      onSaved(updated);
      onClose();
      toast('success', `Points ${delta > 0 ? 'added' : 'removed'} — balance is now ${updated.pointsBalance.toLocaleString()}.`);
    },
    onError: (error) => toast('error', error.message || 'The points balance wasn’t updated. Review the adjustment and try again.'),
  });

  const before = tierLadder(customer.pointsBalance, TIER_RUNGS);

  return (
    <BalanceAdjustModal
      title="Adjust points"
      subject={`${customer.firstName} ${customer.lastName}`}
      icon={Star}
      unit={{ singular: 'point', plural: 'points' }}
      balance={customer.pointsBalance}
      presets={PRESETS}
      reasonRequired={false}
      pending={isPending}
      onSubmit={(delta, reason) => mutate({ delta, reason })}
      onClose={onClose}
      preview={(after) => {
        const next = tierLadder(after, TIER_RUNGS);
        const moved = next.current.id !== before.current.id;
        const up = next.current.from > before.current.from;
        return (
          <p className="flex items-center gap-2 text-sm text-foreground">
            {moved ? (
              <>
                {up ? (
                  <TrendingUp size={16} className="shrink-0 text-momentum" aria-hidden="true" />
                ) : (
                  <TrendingDown size={16} className="shrink-0 text-exception" aria-hidden="true" />
                )}
                <span>
                  Balance {up ? 'reaches' : 'falls to'} <span className="font-semibold">{next.current.label}</span>
                  <span className="text-muted-foreground"> · from {before.current.label}</span>
                </span>
              </>
            ) : (
              <>
                <Star size={16} className="shrink-0 text-stock" aria-hidden="true" />
                <span>
                  Stays in <span className="font-semibold">{next.current.label}</span>
                  {next.next && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {next.next.needed.toLocaleString()} more to {next.next.label}
                    </span>
                  )}
                </span>
              </>
            )}
          </p>
        );
      }}
    />
  );
}
