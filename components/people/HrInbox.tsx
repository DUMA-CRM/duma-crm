'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Check, CircleHelp, Clock3, Loader2, X } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { type LeaveRequest, getManagedLeaveRequests, reviewLeaveRequest } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { formatDate } from '@/lib/utils/date';
import { daysBetween } from '@/lib/utils/staff-overview';
import { toast } from '@/stores/toastStore';

const fmtDate = (value: string) => formatDate(value);

/** How long this has sat undecided — the thing the reviewer cannot see from a date range. */
function WaitingFor({ request }: { request: LeaveRequest }) {
  if (request.status !== 'pending') return null;
  const days = daysBetween(request.createdAt, new Date());
  if (days < 1) return <Badge variant="muted">Raised today</Badge>;
  return <Badge variant={days >= 5 ? 'destructive' : 'warning'}>Waiting {days} days</Badge>;
}

/** Leave requests awaiting a decision — a tab of the staff workspace. */
export function LeaveInbox({ status, setStatus }: { status: string; setStatus: (value: string) => void }) {
  const {
    data: requests = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: moduleQueryKeys.people.key('leave-managed', status),
    queryFn: () => getManagedLeaveRequests(status),
  });

  const qc = useQueryClient();
  const review = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'approved' | 'declined' }) => reviewLeaveRequest(id, next),
    onSuccess: () => {
      // Both the inbox and the tab badge read these keys; the overview shares
      // the pending one. No optimistic update — this spends an entitlement.
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('leave-managed') });
      toast('success', 'Leave request updated.');
    },
    onError: (e) => toast('error', (e as Error).message),
  });

  /** Which row is mid-flight, so only its buttons lock. */
  const deciding = review.isPending ? review.variables?.id : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Leave requests</h2>
          <p className="text-sm text-muted-foreground">Review requests against contracted working days and available balance.</p>
        </div>
        <Select
          value={status}
          onValueChange={setStatus}
          options={['pending', 'approved', 'declined', 'cancelled'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
          ariaLabel="Leave status"
          className="w-36"
        />
      </div>
      <div className="overflow-hidden rounded-sm border border-rule bg-card shadow-sm">
        {isLoading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          // Previously this fell through to "Inbox clear", telling a reviewer
          // that nobody was waiting on them when the read had simply failed.
          <ErrorState
            icon={CircleHelp}
            title="Leave requests couldn’t be loaded"
            description="This is not an empty inbox — nothing could be read, so there may be requests waiting."
            onRetry={() => void refetch()}
          />
        ) : requests.length === 0 ? (
          <EmptyState icon={Clock3} title="Inbox clear" description={`No ${status} leave requests.`} />
        ) : (
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{r.employee?.name ?? r.employee?.email ?? 'Employee'}</p>
                    <Badge variant="muted">{r.leaveType.name}</Badge>
                    <WaitingFor request={r} />
                  </div>
                  <p className="mt-1 text-sm">
                    {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.totalDays} contracted working days{r.notes ? ` · ${r.notes}` : ''}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="destructive" disabled={!!deciding} onClick={() => review.mutate({ id: r.id, next: 'declined' })}>
                      {deciding === r.id ? <Loader2 className="animate-spin" /> : <X />}
                      Decline
                    </Button>
                    <Button disabled={!!deciding} onClick={() => review.mutate({ id: r.id, next: 'approved' })}>
                      {deciding === r.id ? <Loader2 className="animate-spin" /> : <Check />}
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
