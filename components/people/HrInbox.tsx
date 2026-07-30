'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, Loader2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { getManagedLeaveRequests, reviewLeaveRequest } from '@/lib/api/people-ops.service';
import { toast } from '@/stores/toastStore';

const fmtDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Leave requests awaiting a decision — a tab of the staff workspace. */
export function LeaveInbox({ status, setStatus }: { status: string; setStatus: (value: string) => void }) {
  const { data: requests = [], isLoading: loading } = useQuery({
    queryKey: ['leave-managed', status],
    queryFn: () => getManagedLeaveRequests(status),
  });

  const qc = useQueryClient();
  const review = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'approved' | 'declined' }) => reviewLeaveRequest(id, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-managed'] });
      toast('success', 'Leave request updated.');
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <Clock3 className="mx-auto mb-3" />
            <p className="font-medium text-foreground">Inbox clear</p>
            <p className="text-sm">No {status} leave requests.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <div key={r.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{r.employee?.name ?? r.employee?.email ?? 'Employee'}</p>
                    <Badge variant="muted">{r.leaveType.name}</Badge>
                  </div>
                  <p className="text-sm mt-1">
                    {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.totalDays} contracted working days{r.notes ? ` · ${r.notes}` : ''}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={() => review.mutate({ id: r.id, next: 'declined' })}>
                      <X />
                      Decline
                    </Button>
                    <Button onClick={() => review.mutate({ id: r.id, next: 'approved' })}>
                      <Check />
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
