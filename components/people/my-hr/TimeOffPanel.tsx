'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type LeaveEntitlement, type LeaveRequest, cancelLeaveRequest } from '@/lib/api/people-ops.service';
import { toast } from '@/stores/toastStore';

import { PanelHeading } from './PanelHeading';
import { fmt, statusVariant } from './shared';

/** Your allowance, and every request you have made against it. */
export function TimeOffPanel({ requests, entitlements }: { requests: LeaveRequest[]; entitlements: LeaveEntitlement[] }) {
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: cancelLeaveRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests-me'] });
      qc.invalidateQueries({ queryKey: ['leave-entitlements-me'] });
      toast('success', 'Leave request cancelled.');
    },
    onError: (e) => toast('error', (e as Error).message),
  });

  return (
    <div className="space-y-4">
      <PanelHeading title="Time off" />

      {entitlements.length > 0 && (
        <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card shadow-sm">
          {entitlements.map((item) => {
            const total = Number(item.totalDays);
            const used = Number(item.usedDays);
            const remaining = Math.round((total - used) * 100) / 100;
            const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
            return (
              <li key={item.id} className="px-4 py-3 md:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {item.leaveType.name}
                    {!item.leaveType.isPaid && <span className="ml-2 text-xs font-normal text-muted-foreground">Unpaid</span>}
                  </p>
                  <p className="font-mono text-sm tabular-nums text-foreground">
                    <span className="font-semibold">{remaining}</span>
                    <span className="text-muted-foreground"> of {total} days left</span>
                  </p>
                </div>
                {total > 0 && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-band" role="presentation">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="overflow-hidden rounded-md border border-rule bg-card shadow-sm">
        <div className="border-b border-rule px-4 py-3 md:px-5">
          <h3 className="text-sm font-semibold text-foreground">Your requests</h3>
        </div>
        {requests.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground md:px-5">
            No requests yet. Use &ldquo;Request time off&rdquo; at the top of the page to book time away.
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{request.leaveType.name}</p>
                    <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {fmt(request.startDate)} – {fmt(request.endDate)} · {request.totalDays} days
                  </p>
                  {request.reviewNotes && <p className="mt-0.5 text-xs text-muted-foreground">HR: {request.reviewNotes}</p>}
                </div>
                {request.status === 'pending' && (
                  <Button variant="ghost" size="sm" onClick={() => cancel.mutate(request.id)} disabled={cancel.isPending}>
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
