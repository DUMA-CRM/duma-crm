'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Receipt } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type ExpenseClaim, cancelExpenseClaim, getMyExpenseClaims } from '@/lib/api/people-ops.service';
import { toast } from '@/stores/toastStore';

import { PanelHeading } from './PanelHeading';
import { fmt, money, statusVariant } from './shared';

/** Money you have spent on work that your employer owes back. Claiming is a header action. */
export function ExpensesPanel() {
  const qc = useQueryClient();
  const { data: claims = [], isLoading } = useQuery({ queryKey: ['expense-claims-me'], queryFn: () => getMyExpenseClaims(), retry: false });
  const cancel = useMutation({
    mutationFn: cancelExpenseClaim,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-claims-me'] });
      toast('success', 'Claim withdrawn.');
    },
    onError: (e) => toast('error', (e as Error).message),
  });

  const owed = claims.filter((claim) => claim.status === 'approved').reduce((sum, claim) => sum + (Number(claim.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <PanelHeading title="Expenses" />

      {owed > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">{money(owed)}</span> approved and awaiting payment.
        </p>
      )}

      {isLoading ? null : claims.length === 0 ? (
        <div className="rounded-md border border-rule bg-card shadow-sm">
          <EmptyState
            icon={Receipt}
            title="No expense claims"
            description="Claim travel, equipment or anything else you have paid for yourself. Keep the receipt — your manager may ask for it."
          />
        </div>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card shadow-sm">
          {claims.map((claim) => (
            <ExpenseRow key={claim.id} claim={claim} onCancel={() => cancel.mutate(claim.id)} cancelling={cancel.isPending} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ExpenseRow({ claim, onCancel, cancelling }: { claim: ExpenseClaim; onCancel: () => void; cancelling: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{claim.description}</p>
          <Badge variant={statusVariant(claim.status)}>{claim.status}</Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {fmt(claim.createdAt)}
          {claim.category ? ` · ${claim.category}` : ''}
        </p>
        {claim.reviewNotes && <p className="mt-0.5 text-xs text-muted-foreground">Reviewed: {claim.reviewNotes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-sm font-medium tabular-nums text-foreground">{money(claim.amount, claim.currency)}</span>
        {claim.status === 'pending' && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={cancelling}>
            Withdraw
          </Button>
        )}
      </div>
    </li>
  );
}
