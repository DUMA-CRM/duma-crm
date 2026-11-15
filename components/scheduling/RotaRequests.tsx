'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ArrowLeftRight, CalendarCheck, CalendarDays, Check, type IconComponent, Send, UserMinus } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Modal } from '@/components/shared/Modal';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import {
  type ShiftRequest,
  type ShiftRequestStatus,
  acceptShiftRequest,
  cancelShiftRequest,
  createShiftRequest,
  declineShiftRequest,
  getMyShiftRequests,
  getRotaPlanner,
} from '@/lib/api/rota.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type ScheduledShift, acknowledgeScheduledShift, getMyOpenShifts } from '@/lib/modules/workforce/client';
import { toast } from '@/lib/toast';
import { acknowledgeMarker, formatDuration, mondayOf, plannedMinutes } from '@/lib/utils/my-rota';
import { formatInstant, workspaceDateKey } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

// ── Keys and invalidation ─────────────────────────────────────────────────────

export const myRequestsKey = moduleQueryKeys.workforce.key('rota-requests-my');
export const myOpenShiftsKey = moduleQueryKeys.workforce.key('rota-open-my');

/** Everything a self-service rota write can change: my week, my upcoming shifts, my requests, open shifts. */
function useInvalidateMyRota() {
  const qc = useQueryClient();
  return () => {
    for (const resource of ['my-rota', 'my-rota-day', 'my-rota-upcoming', 'rota-requests-my', 'rota-open-my', 'rota-requests'] as const)
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key(resource) });
  };
}

const fmtDay = (iso: string) => formatInstant(iso, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });
const fmtSpan = (shift: { startsAt: string; endsAt: string }) =>
  `${fmtDay(shift.startsAt)} · ${fmtTime(shift.startsAt)}–${fmtTime(shift.endsAt)}`;
const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message) || fallback;

const FLAT = 'border-b-0';

// ── New or changed shifts to confirm ──────────────────────────────────────────

/**
 * Published shifts you haven't confirmed, each with "Got it" — and one button
 * for the lot when there are several. Only shown while there is something to
 * confirm: it is a notice, not a list you browse.
 */
export function ShiftsToAcknowledge({ shifts, onOpen }: { shifts: ScheduledShift[]; onOpen: (shift: ScheduledShift) => void }) {
  const invalidate = useInvalidateMyRota();
  const pending = useMemo(
    () => shifts.filter((shift) => acknowledgeMarker(shift)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [shifts],
  );
  const acknowledge = useMutation({
    mutationFn: async (ids: string[]) => {
      // One at a time: there is no bulk endpoint, and a failure part-way must still refresh what did land.
      for (const id of ids) await acknowledgeScheduledShift(id);
    },
    onSettled: invalidate,
    onError: (error) => toast('error', errorMessage(error, 'That shift wasn’t confirmed. Try again.')),
  });

  if (pending.length === 0) return null;
  return (
    <RecordGroup
      id="my-rota-new"
      title={pending.length === 1 ? 'New on your rota' : `${pending.length} new on your rota`}
      actions={
        pending.length > 1 && (
          <Button
            variant="outline"
            className="h-9"
            disabled={acknowledge.isPending}
            onClick={() => acknowledge.mutate(pending.map((shift) => shift.id))}
          >
            <Check size={14} aria-hidden="true" /> Acknowledge all
          </Button>
        )
      }
    >
      <ListRowGroup>
        {pending.map((shift) => {
          const marker = acknowledgeMarker(shift);
          return (
            <ListRow
              key={shift.id}
              className={FLAT}
              icon={CalendarCheck}
              tone="info"
              title={fmtSpan(shift)}
              titleExtra={
                <span className="shrink-0 rounded-sm bg-reference/10 px-1.5 py-0.5 text-micro font-semibold text-reference">
                  {marker === 'changed' ? 'Changed' : 'New'}
                </span>
              }
              meta={[shift.location?.name, shift.position?.name ?? shift.role].filter(Boolean).join(' · ') || undefined}
              onClick={() => onOpen(shift)}
              chevron={false}
              control={
                <Button size="sm" variant="outline" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate([shift.id])}>
                  Got it
                </Button>
              }
            />
          );
        })}
      </ListRowGroup>
    </RecordGroup>
  );
}

// ── Open shifts I can pick up ─────────────────────────────────────────────────

export function OpenShifts() {
  const invalidate = useInvalidateMyRota();
  const query = useQuery({ queryKey: myOpenShiftsKey, queryFn: getMyOpenShifts });
  const claim = useMutation({
    mutationFn: (shiftId: string) => createShiftRequest({ kind: 'claim', scheduledShiftId: shiftId }),
    onSuccess: () => toast('success', 'Requested. Your manager will confirm it.'),
    onError: (error) => toast('error', errorMessage(error, 'That shift wasn’t requested. Try again.')),
    onSettled: invalidate,
  });
  const cancel = useMutation({
    mutationFn: cancelShiftRequest,
    onError: (error) => toast('error', errorMessage(error, 'The request wasn’t cancelled. Try again.')),
    onSettled: invalidate,
  });
  const busy = claim.isPending || cancel.isPending;
  const shifts = [...(query.data ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <RecordGroup id="my-rota-open" title="Open shifts">
      {query.isPending ? (
        <ListSkeleton rows={2} label="Loading open shifts" />
      ) : query.isError ? (
        <ListRowGroup>
          <li>
            <ErrorState className="py-8" title="Open shifts couldn’t be loaded" onRetry={() => void query.refetch()} />
          </li>
        </ListRowGroup>
      ) : shifts.length === 0 ? (
        <ListRowGroup>
          <li>
            <EmptyState compact kind="done" icon={CalendarDays} title="No open shifts" description="Any you can pick up show here." />
          </li>
        </ListRowGroup>
      ) : (
        <ListRowGroup>
          {shifts.map((shift) => (
            <ListRow
              key={shift.id}
              className={FLAT}
              icon={CalendarDays}
              title={fmtSpan(shift)}
              meta={[formatDuration(plannedMinutes(shift)), shift.location?.name, shift.position?.name ?? shift.role]
                .filter(Boolean)
                .join(' · ')}
              control={
                shift.myRequestId ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Requested</span>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => cancel.mutate(shift.myRequestId!)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => claim.mutate(shift.id)}>
                    Request
                  </Button>
                )
              }
            />
          ))}
        </ListRowGroup>
      )}
    </RecordGroup>
  );
}

// ── My requests ───────────────────────────────────────────────────────────────

const OPEN_STATUSES: ShiftRequestStatus[] = ['pending', 'accepted'];

function requestCopy(request: ShiftRequest, me: string | undefined): { icon: IconComponent; title: string; status: string } {
  const mine = request.requester.userId === me;
  const target = request.targetUser?.name ?? 'a colleague';
  const closed: Partial<Record<ShiftRequestStatus, string>> = { approved: 'Approved', declined: 'Declined', cancelled: 'Cancelled' };
  if (request.kind === 'claim') return { icon: Send, title: 'Pick up', status: closed[request.status] ?? 'Waiting for your manager' };
  if (request.kind === 'drop') return { icon: UserMinus, title: 'Give up', status: closed[request.status] ?? 'Waiting for your manager' };
  return {
    icon: ArrowLeftRight,
    title: mine ? `Swap with ${target}` : `${request.requester.name} wants to swap`,
    status:
      closed[request.status] ??
      (request.status === 'accepted' ? 'Waiting for your manager' : mine ? `Waiting for ${target}` : 'Waiting for you'),
  };
}

export function MyShiftRequests() {
  const me = useAuthStore((s) => s.user?.id);
  const invalidate = useInvalidateMyRota();
  const query = useQuery({ queryKey: myRequestsKey, queryFn: getMyShiftRequests });
  const act = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: 'accept' | 'decline' | 'cancel' }) =>
      verb === 'accept' ? acceptShiftRequest(id) : verb === 'decline' ? declineShiftRequest(id) : cancelShiftRequest(id),
    onError: (error) => toast('error', errorMessage(error, 'That request wasn’t updated. Try again.')),
    onSettled: invalidate,
  });
  // Open ones first, then the most recent of the settled ones — a record, not an archive.
  const requests = useMemo(() => {
    const all = [...(query.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const open = all.filter((r) => OPEN_STATUSES.includes(r.status));
    return [...open, ...all.filter((r) => !OPEN_STATUSES.includes(r.status)).slice(0, Math.max(0, 8 - open.length))];
  }, [query.data]);

  return (
    <RecordGroup id="my-rota-requests" title="Requests">
      {query.isPending ? (
        <ListSkeleton rows={2} label="Loading your requests" />
      ) : query.isError ? (
        <ListRowGroup>
          <li>
            <ErrorState className="py-8" title="Your requests couldn’t be loaded" onRetry={() => void query.refetch()} />
          </li>
        </ListRowGroup>
      ) : requests.length === 0 ? (
        <ListRowGroup>
          <li>
            <EmptyState
              compact
              kind="done"
              icon={ArrowLeftRight}
              title="No requests"
              description="Swaps and shifts you give up show here."
            />
          </li>
        </ListRowGroup>
      ) : (
        <ListRowGroup>
          {requests.map((request) => {
            const copy = requestCopy(request, me);
            const open = OPEN_STATUSES.includes(request.status);
            const answerable = request.kind === 'swap' && request.status === 'pending' && request.targetUser?.userId === me;
            const cancellable = open && request.requester.userId === me;
            return (
              <ListRow
                key={request.id}
                className={FLAT}
                icon={copy.icon}
                tone={open ? 'primary' : 'muted'}
                muted={!open}
                title={copy.title}
                meta={`${fmtSpan(request.shift)}${request.targetShift ? ` ⇄ ${fmtSpan(request.targetShift)}` : ''} · ${copy.status}`}
                control={
                  answerable ? (
                    <span className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: request.id, verb: 'decline' })}
                      >
                        Decline
                      </Button>
                      <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: request.id, verb: 'accept' })}>
                        Accept
                      </Button>
                    </span>
                  ) : cancellable ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: request.id, verb: 'cancel' })}
                    >
                      Cancel
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
        </ListRowGroup>
      )}
    </RecordGroup>
  );
}

// ── Swap or give up one of my shifts ──────────────────────────────────────────

const isoWeekStart = (iso: string) => {
  const monday = mondayOf(new Date(`${workspaceDateKey(iso)}T00:00:00`));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
};

/**
 * Ask to swap a shift with a colleague, or to give it up. The colleague list
 * comes from the week planner (`scheduling:read`): frontline staff hold no
 * capability that lists their colleagues, so for them this is give-up only and
 * the manager finds cover.
 */
export function ShiftRequestDialog({
  shift,
  initialKind,
  onClose,
}: {
  shift: ScheduledShift;
  initialKind: 'swap' | 'drop';
  onClose: () => void;
}) {
  const me = useAuthStore((s) => s.user?.id);
  const capabilities = useAuthStore((s) => s.capabilities);
  const canSwap = hasCapability(capabilities, 'scheduling:read');
  const invalidate = useInvalidateMyRota();
  const [kind, setKind] = useState<'swap' | 'drop'>(canSwap ? initialKind : 'drop');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetShiftId, setTargetShiftId] = useState('');
  const [note, setNote] = useState('');
  // When the dialog opened: their shifts that have started by then aren't offered.
  const [openedAt] = useState(() => Date.now());

  const weekStart = isoWeekStart(shift.startsAt);
  const planner = useQuery({
    queryKey: moduleQueryKeys.workforce.key('rota-planner', shift.locationId, weekStart),
    queryFn: () => getRotaPlanner(shift.locationId, weekStart),
    enabled: canSwap && kind === 'swap',
  });
  const colleagues = (planner.data?.staff ?? []).filter((person) => person.userId !== me).sort((a, b) => a.name.localeCompare(b.name));
  const theirShifts = (planner.data?.shifts ?? []).filter(
    (s) => s.userId === targetUserId && s.status === 'published' && Date.parse(s.startsAt) > openedAt,
  );

  const send = useMutation({
    mutationFn: () =>
      createShiftRequest({
        kind,
        scheduledShiftId: shift.id,
        ...(kind === 'swap' ? { targetUserId, ...(targetShiftId ? { targetShiftId } : {}) } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      toast('success', kind === 'swap' ? 'Swap requested.' : 'Sent to your manager.');
      onClose();
    },
    onError: (error) => toast('error', errorMessage(error, 'The request wasn’t sent. Try again.')),
    onSettled: invalidate,
  });

  return (
    <Modal
      title={kind === 'swap' ? 'Swap shift' : 'Give up shift'}
      description={fmtSpan(shift)}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={send.isPending || (kind === 'swap' && !targetUserId)} onClick={() => send.mutate()}>
            {kind === 'swap' ? 'Ask to swap' : 'Ask to give up'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {canSwap ? (
          <SegmentedControl
            options={[
              { value: 'swap', label: 'Swap', icon: ArrowLeftRight },
              { value: 'drop', label: 'Give up', icon: UserMinus },
            ]}
            value={kind}
            onChange={setKind}
            ariaLabel="Swap or give up"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Your manager approves it and finds cover. You’re on it until then.</p>
        )}

        {kind === 'swap' &&
          (planner.isPending ? (
            <ListSkeleton rows={1} framed={false} label="Loading colleagues" />
          ) : planner.isError ? (
            <ErrorState className="py-4" title="Colleagues couldn’t be loaded" onRetry={() => void planner.refetch()} />
          ) : (
            <>
              <div>
                <FieldLabel as="span" className="mb-1.5">
                  Colleague
                </FieldLabel>
                <Select
                  ariaLabel="Colleague"
                  value={targetUserId}
                  onValueChange={(value) => {
                    setTargetUserId(value);
                    setTargetShiftId('');
                  }}
                  placeholder={colleagues.length ? 'Choose someone' : 'Nobody else works here'}
                  options={colleagues.map((person) => ({ value: person.userId, label: person.name }))}
                />
              </div>
              {targetUserId && (
                <div>
                  <FieldLabel as="span" className="mb-1.5">
                    Their shift
                  </FieldLabel>
                  <Select
                    ariaLabel="Their shift"
                    value={targetShiftId}
                    onValueChange={setTargetShiftId}
                    options={[
                      { value: '', label: 'None — they just take mine' },
                      ...theirShifts.map((s) => ({ value: s.id, label: fmtSpan(s) })),
                    ]}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">They accept it first, then your manager approves.</p>
            </>
          ))}

        <Input label="Note" value={note} maxLength={500} placeholder="Optional" onChange={(event) => setNote(event.target.value)} />
      </div>
    </Modal>
  );
}
