'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ArrowLeftRight, ClipboardList, TriangleAlert } from '@/components/icons';
import { invalidateRota } from '@/components/scheduling/rota-queries';
import { fmtTime } from '@/components/scheduling/shared';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { type ShiftRequest, approveShiftRequest, declineShiftRequest, getShiftRequests } from '@/lib/api/rota.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/utils/date';
import { type RuleWarning, describeWarning } from '@/lib/utils/rota-rules';

const KIND: Record<ShiftRequest['kind'], string> = { claim: 'Claim', swap: 'Swap', drop: 'Drop' };

/** Warnings from a 409, kept only when they look like rule warnings. */
function warningsOf(error: unknown): RuleWarning[] {
  if (!(error instanceof ApiError) || error.status !== 409) return [];
  return error.warnings.filter((w): w is RuleWarning => !!w && typeof w === 'object' && typeof (w as { kind?: unknown }).kind === 'string');
}

/**
 * Staff claims, swaps and drops waiting on a manager. A swap shows here once
 * the other person has accepted it. Approving re-checks the working-time rules;
 * a breach comes back as warnings, and "Approve anyway" overrides them.
 */
export function RotaRequestsDrawer({ locationId, canDecide, onClose }: { locationId: string; canDecide: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<'pending' | 'accepted'>('pending');
  const requests = useQuery({
    queryKey: moduleQueryKeys.workforce.key('rota-requests', locationId, status),
    queryFn: () => getShiftRequests({ locationId, status }),
  });

  return (
    <Drawer icon={ClipboardList} title="Shift requests" onClose={onClose}>
      <div className="space-y-4">
        <SegmentedControl
          options={[
            { value: 'pending', label: 'Waiting' },
            { value: 'accepted', label: 'Swaps agreed' },
          ]}
          value={status}
          onChange={setStatus}
          ariaLabel="Request status"
        />
        {requests.isPending ? (
          <div role="status" aria-busy="true" aria-label="Loading requests" className="space-y-2">
            {[0, 1, 2].map((index) => (
              <Bone key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : requests.isError ? (
          <ErrorState title="Requests couldn’t be loaded" onRetry={() => void requests.refetch()} />
        ) : requests.data.length === 0 ? (
          <EmptyState icon={ClipboardList} kind="done" title="Nothing waiting" compact />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border bg-card">
            {requests.data.map((request) => (
              <RequestRow key={request.id} request={request} canDecide={canDecide} />
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}

function RequestRow({ request, canDecide }: { request: ShiftRequest; canDecide: boolean }) {
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: (override: boolean) => approveShiftRequest(request.id, override),
    onSuccess: () => {
      invalidateRota(qc);
      toast('success', `${KIND[request.kind]} approved.`);
    },
  });
  const decline = useMutation({
    mutationFn: () => declineShiftRequest(request.id),
    onSuccess: () => {
      invalidateRota(qc);
      toast('success', `${KIND[request.kind]} declined.`);
    },
  });
  const warnings = warningsOf(approve.error);
  const otherError = approve.error && warnings.length === 0 ? (approve.error as Error) : (decline.error as Error | null);
  // A swap is decided once the other person has agreed; claims and drops straight away.
  const ready = request.kind === 'swap' ? request.status === 'accepted' : request.status === 'pending';
  const busy = approve.isPending || decline.isPending;
  const when = (shift: ShiftRequest['shift']) => `${formatDate(shift.startsAt)} · ${fmtTime(shift.startsAt)}–${fmtTime(shift.endsAt)}`;
  const people =
    request.kind === 'swap' && request.targetUser
      ? `${request.requester.name} ⇄ ${request.targetUser.name}`
      : request.kind === 'claim'
        ? `${request.requester.name} wants it`
        : `${request.requester.name} can’t make it`;

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-sm bg-band px-1.5 py-0.5 text-micro font-semibold text-muted-foreground uppercase">
          {KIND[request.kind]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{people}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{when(request.shift)}</p>
          {request.targetShift && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <ArrowLeftRight size={12} aria-hidden="true" /> {when(request.targetShift)}
            </p>
          )}
          {request.note && <p className="mt-1 text-sm text-foreground">“{request.note}”</p>}
        </div>
      </div>

      {warnings.length > 0 && (
        <div role="alert" className="mt-2.5 rounded-md bg-warning/10 px-3 py-2 text-xs text-foreground">
          <p className="flex items-center gap-1.5 font-semibold text-warning">
            <TriangleAlert size={13} aria-hidden="true" /> This breaks a working-time rule
          </p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((warning, index) => (
              <li key={index}>{describeWarning(warning)}</li>
            ))}
          </ul>
        </div>
      )}
      {otherError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {otherError.message}
        </p>
      )}

      {canDecide && (
        <div className="mt-2.5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => decline.mutate()} disabled={busy}>
            {decline.isPending ? 'Declining…' : 'Decline'}
          </Button>
          {warnings.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => approve.mutate(true)} disabled={busy}>
              {approve.isPending ? 'Approving…' : 'Approve anyway'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => approve.mutate(false)}
              disabled={busy || !ready}
              title={ready ? undefined : 'Waiting for the other person to agree'}
            >
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
