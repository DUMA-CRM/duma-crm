'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { RecordPrivacyRequest } from '@/components/compliance/RecordPrivacyRequest';
import {
  STATUS,
  WORKING_STATUSES,
  channelLabel,
  requestStatus,
  requestType,
  subjectHref,
  subjectName,
} from '@/components/compliance/privacyCopy';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Plus,
  ShieldCheck,
  Timer,
} from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type PrivacyRequest,
  type PrivacyRequestStatus,
  completePrivacyRequest,
  getPrivacyRequests,
  privacyExportUrl,
  updatePrivacyRequest,
} from '@/lib/modules/compliance/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { type DeadlineTone, isClosedRequest, requestDeadline, sortQueue, summariseQueue } from '@/lib/utils/privacy-deadline';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/**
 * Privacy requests: recording them, working them, and closing them.
 *
 * Serves two surfaces from one component — a single person's history on their
 * record, and the whole workspace's queue on the Compliance page — because the
 * work is identical and only the scope differs. On the queue the deadline is
 * the headline: each request says how many days it has left, in words, with a
 * bar for how much of the month is used.
 */

/** Typed verbatim to confirm an erasure. Deliberately not the person's name:
 *  that is on screen and could be copied without reading anything. */
const ERASE_PHRASE = 'ERASE';

const TEXTAREA =
  'w-full rounded-md border border-input bg-control p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30';

const TONE_TEXT: Record<DeadlineTone, string> = {
  done: 'text-muted-foreground',
  calm: 'text-muted-foreground',
  soon: 'text-measured',
  today: 'text-exception',
  overdue: 'text-exception',
};
const TONE_BAR: Record<DeadlineTone, string> = {
  done: 'bg-muted-foreground/40',
  calm: 'bg-primary',
  soon: 'bg-measured',
  today: 'bg-exception',
  overdue: 'bg-exception',
};

type View = 'open' | 'closed';

export function PrivacyRequestsPanel({
  customerId,
  employeeUserId,
  tenantId,
  className,
}: {
  customerId?: string;
  employeeUserId?: string;
  tenantId?: string;
  /** For the scoped panel only — e.g. to flow it in a record's columns. */
  className?: string;
}) {
  const qc = useQueryClient();
  const scoped = Boolean(customerId || employeeUserId);
  const [view, setView] = useState<View>('open');
  const [recording, setRecording] = useState(false);
  const [completing, setCompleting] = useState<PrivacyRequest | null>(null);
  const [declining, setDeclining] = useState<PrivacyRequest | null>(null);
  // The one unfolded row on a record, if any.
  const [expanded, setExpanded] = useState<string | null>(null);

  // A minute is fine-grained enough for "due today".
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const capabilities = useAuthStore((state) => state.capabilities);
  // The API is the boundary; these only keep an auditor from being offered
  // buttons that would come back 403.
  const canWrite = hasCapability(capabilities, 'privacy:write');
  const canExport = hasCapability(capabilities, 'privacy:export');

  const requests = useQuery({
    queryKey: moduleQueryKeys.compliance.key('privacy-requests', tenantId, customerId, employeeUserId),
    queryFn: () => getPrivacyRequests({ tenantId, customerId, employeeUserId }),
    enabled: Boolean(tenantId || customerId || employeeUserId),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.compliance.key('privacy-requests') });
    if (customerId) {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer', customerId) });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-timeline', customerId) });
    }
  };

  const move = useMutation({
    mutationFn: ({ request, status }: { request: PrivacyRequest; status: Exclude<PrivacyRequestStatus, 'completed' | 'declined'> }) =>
      updatePrivacyRequest(request.id, { status }),
    onSuccess: refresh,
    onError: (error) => toast('error', error.message || 'The request wasn’t updated. Try again.'),
  });

  const all = useMemo(() => sortQueue(requests.data ?? []), [requests.data]);
  const summary = useMemo(() => summariseQueue(all, now), [all, now]);
  const open = all.filter((request) => !isClosedRequest(request));
  const closed = all.filter(isClosedRequest);
  const shown = scoped ? all : view === 'open' ? open : closed;

  const list = requests.isPending ? (
    <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading privacy requests">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-lg border border-rule/60 bg-field px-4 py-4" aria-hidden="true">
          <div className="flex items-start gap-3">
            <Bone className="size-10 shrink-0" />
            <span className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              <Bone className={cn('h-3.5', item % 2 ? 'w-36' : 'w-48')} />
              <Bone className="h-3 w-64 max-w-full" />
            </span>
            <Bone className="h-5 w-20 shrink-0 rounded-sm" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Bone className="h-3 w-28" />
            <Bone className="h-3 w-20" />
          </div>
          <Bone className="mt-1.5 h-1.5 rounded-full" />
        </div>
      ))}
    </div>
  ) : requests.isError ? (
    <ErrorState title="Privacy requests couldn’t be loaded" onRetry={() => void requests.refetch()} />
  ) : shown.length === 0 ? (
    <EmptyState
      icon={scoped ? ShieldCheck : view === 'open' ? CheckCircle2 : ClipboardList}
      kind={!scoped && view === 'open' ? 'done' : 'start'}
      className="flex-1"
      action={scoped && canWrite ? { label: 'Record request', icon: Plus, onClick: () => setRecording(true) } : undefined}
      title={scoped ? 'No privacy requests' : view === 'open' ? 'Nothing waiting' : 'No closed requests yet'}
      description={
        scoped
          ? 'If they ask for their data, or ask to be deleted, record it here so the clock and the trail both start.'
          : view === 'open'
            ? 'Every request has been answered. New ones appear here with their deadline.'
            : 'Completed and declined requests are kept here as your record that each was handled.'
      }
    />
  ) : (
    <div className="space-y-2">
      {shown.map((request, index) => (
        <RequestCard
          key={request.id}
          index={index}
          request={request}
          scoped={scoped}
          now={now}
          canWrite={canWrite}
          canExport={canExport}
          moving={move.isPending && move.variables?.request.id === request.id}
          onMove={(status) => move.mutate({ request, status })}
          onComplete={() => setCompleting(request)}
          onDecline={() => setDeclining(request)}
        />
      ))}
    </div>
  );

  const record = canWrite && (
    <Button variant={scoped ? 'outline' : 'default'} size={scoped ? 'sm' : 'default'} onClick={() => setRecording(true)}>
      <Plus data-icon="inline-start" />
      Record request
    </Button>
  );

  const dialogs = (
    <>
      {recording && (
        <RecordPrivacyRequest
          tenantId={tenantId}
          fixedSubject={
            customerId
              ? { kind: 'customer', id: customerId, name: '' }
              : employeeUserId
                ? { kind: 'employee', id: employeeUserId, name: '' }
                : undefined
          }
          onClose={() => setRecording(false)}
        />
      )}
      {completing && <CompleteRequest request={completing} onClose={() => setCompleting(null)} onDone={refresh} />}
      {declining && <DeclineRequest request={declining} onClose={() => setDeclining(null)} onDone={refresh} />}
    </>
  );

  if (scoped) {
    // On a record: a heading and a list of audit-log rows, like every other
    // block beside it. A row unfolds to the full request — deadline, actions,
    // outcome — the way an audit group unfolds to its entries.
    return (
      <motion.section variants={SECTION_RISE} className={cn('scroll-mt-6', className)} aria-labelledby="privacy-requests-title">
        <div className="mb-3 flex min-h-8 items-center gap-3">
          <h2 id="privacy-requests-title" className="flex-1 text-base font-semibold tracking-title text-foreground">
            Privacy requests
          </h2>
          {record}
        </div>
        {requests.isPending ? (
          <ListSkeleton rows={2} label="Loading privacy requests" />
        ) : requests.isError ? (
          <ErrorState title="Privacy requests couldn’t be loaded" onRetry={() => void requests.refetch()} />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {all.length === 0 ? (
              <li className="flex items-center gap-3 px-3.5 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground">
                  <ShieldCheck size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-muted-foreground">None so far</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Record one here if they ask for their data or to be deleted.
                  </span>
                </span>
              </li>
            ) : (
              all.map((request, index) => (
                <ScopedRequestRow
                  key={request.id}
                  request={request}
                  now={now}
                  open={expanded === request.id}
                  onToggle={() => setExpanded((current) => (current === request.id ? null : request.id))}
                >
                  <RequestCard
                    embedded
                    index={index}
                    request={request}
                    scoped
                    now={now}
                    canWrite={canWrite}
                    canExport={canExport}
                    moving={move.isPending && move.variables?.request.id === request.id}
                    onMove={(status) => move.mutate({ request, status })}
                    onComplete={() => setCompleting(request)}
                    onDecline={() => setDeclining(request)}
                  />
                </ScopedRequestRow>
              ))
            )}
          </ul>
        )}
        <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
          Access, correction and erasure requests under data-protection law — each must be answered within a month.
        </p>
        {dialogs}
      </motion.section>
    );
  }

  return (
    <motion.div
      className="flex flex-1 flex-col gap-5"
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      aria-label="Privacy requests"
    >
      {/* While loading, the tiles are skeletons: a "0 overdue" before the data
          arrives would read as a statement about the law, not a wait. */}
      {requests.isPending ? (
        <FactsSkeleton count={4} surface="card" label="Loading request counts" className="gap-2 sm:grid-cols-2 xl:grid-cols-4" />
      ) : (
        <motion.dl variants={SECTION_RISE} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Fact surface="card" icon={ClipboardList} label="Open" value={summary.open} />
          <Fact surface="card" icon={Timer} label="Due this week" value={summary.dueSoon} />
          <Fact
            surface="card"
            icon={AlertTriangle}
            label="Overdue"
            value={<span className={cn(summary.overdue > 0 && 'text-exception')}>{summary.overdue}</span>}
          />
          <Fact surface="card" icon={CheckCircle2} label="Closed in 30 days" value={summary.closedRecently} />
        </motion.dl>
      )}

      {/* No card around the queue: the requests are cards already, and a
          second border around them only boxes in the page. */}
      <motion.section variants={SECTION_RISE} className="flex flex-1 flex-col gap-4">
        {/* The segment names the view, so no heading repeats it. */}
        <header className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            <SegmentedControl
              options={[
                { value: 'open', label: `Open · ${open.length}` },
                { value: 'closed', label: `Closed · ${closed.length}` },
              ]}
              value={view}
              onChange={setView}
              ariaLabel="Show open or closed requests"
            />
            {record}
          </div>
        </header>
        {list}
      </motion.section>
      {dialogs}
    </motion.div>
  );
}

/** One request as an audit-log row: type tile, what was asked, when and how long is left, status. */
function ScopedRequestRow({
  request,
  now,
  open,
  onToggle,
  children,
}: {
  request: PrivacyRequest;
  now: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const kind = requestType(request.type);
  const Icon = kind.icon;
  const closed = isClosedRequest(request);
  const deadline = requestDeadline(request, now);
  const status = requestStatus(request.status);
  return (
    <li className="border-b border-rule/45 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          open ? 'bg-band/50' : 'hover:bg-band/40',
        )}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            closed
              ? 'bg-band text-muted-foreground'
              : deadline.tone === 'overdue' || request.type === 'erasure'
                ? 'bg-exception/8 text-exception'
                : 'bg-reference/8 text-reference',
          )}
        >
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{kind.label}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            Received {formatDate(request.receivedAt)}
            {!closed && (
              <>
                {' · '}
                <span className={cn('font-semibold', TONE_TEXT[deadline.tone])}>{deadline.label}</span>
              </>
            )}
          </span>
        </span>
        <Badge variant={status.tone}>{status.label}</Badge>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden bg-band/25"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function RequestCard({
  request,
  index,
  scoped,
  embedded = false,
  now,
  canWrite,
  canExport,
  moving,
  onMove,
  onComplete,
  onDecline,
}: {
  request: PrivacyRequest;
  index: number;
  scoped: boolean;
  /** Inside an unfolded record row: the row already shows the header, so only the body renders. */
  embedded?: boolean;
  now: number;
  canWrite: boolean;
  canExport: boolean;
  moving: boolean;
  onMove: (status: Exclude<PrivacyRequestStatus, 'completed' | 'declined'>) => void;
  onComplete: () => void;
  onDecline: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const kind = requestType(request.type);
  const Icon = kind.icon;
  const closed = isClosedRequest(request);
  const deadline = requestDeadline(request, now);
  const status = requestStatus(request.status);
  const name = subjectName(request);
  const href = subjectHref(request);
  const exportable = canExport && (request.type === 'access' || request.type === 'portability');

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        embedded
          ? 'px-3.5 pt-1 pb-4 pl-15'
          : cn('rounded-lg border px-4 py-4 bg-field', deadline.tone === 'overdue' ? 'border-exception/40' : 'border-rule/60'),
      )}
    >
      {!embedded && (
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-md',
              closed
                ? 'bg-band text-muted-foreground'
                : request.type === 'erasure'
                  ? 'bg-exception/8 text-exception'
                  : 'bg-primary/8 text-primary',
            )}
          >
            <Icon size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{kind.label}</span>
              {!scoped && name && (
                <>
                  <span className="text-muted-foreground"> · </span>
                  {href ? (
                    <Link href={href} className="font-medium underline decoration-rule underline-offset-2 hover:decoration-foreground">
                      {name}
                    </Link>
                  ) : (
                    <span className="font-medium">{name}</span>
                  )}
                  {request.subjectType === 'employee' && <span className="text-muted-foreground"> (staff)</span>}
                </>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {kind.legal} · Received {formatDate(request.receivedAt)} · {channelLabel(request.requestChannel)}
            </p>
          </div>
          <Badge variant={status.tone}>{status.label}</Badge>
        </div>
      )}

      {request.details && (
        <blockquote className={cn(embedded ? 'mt-0' : 'mt-3', 'border-l-2 border-rule pl-3 text-sm leading-relaxed text-muted-foreground')}>
          “{request.details}”
        </blockquote>
      )}

      {closed ? (
        request.resolutionNotes && (
          <div className="mt-3 rounded-md bg-band/60 px-3 py-2.5 text-sm text-foreground">
            <span className="font-semibold">{request.status === 'declined' ? 'Why it was declined' : 'Outcome'}:</span>{' '}
            {request.resolutionNotes}
            {request.completedAt && <span className="text-muted-foreground"> · {formatDate(request.completedAt)}</span>}
          </div>
        )
      ) : (
        <div className="mt-4">
          {/* Unfolded under a record's row, the row already says how long is left — only the date here. */}
          <div className={cn('flex items-center gap-3 text-xs', embedded ? 'justify-end' : 'justify-between')}>
            {!embedded && (
              <span className={cn('flex items-center gap-1.5 font-semibold', TONE_TEXT[deadline.tone])}>
                <CalendarClock size={13} aria-hidden="true" />
                {deadline.label}
              </span>
            )}
            <span className="text-muted-foreground">{embedded ? `Due ${formatDate(request.dueAt)}` : formatDate(request.dueAt)}</span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-band"
            role="progressbar"
            aria-label="Time used of the one-month deadline"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(deadline.used * 100)}
          >
            <motion.div
              className={cn('h-full rounded-full', TONE_BAR[deadline.tone])}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${Math.max(4, deadline.used * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      )}

      {!closed && (canWrite || exportable) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule/45 pt-3.5">
          {canWrite && (
            <Select
              value={request.status}
              onValueChange={(value) => onMove(value as (typeof WORKING_STATUSES)[number])}
              options={WORKING_STATUSES.map((value) => ({ value, label: STATUS[value].label }))}
              ariaLabel="Where this request is up to"
              disabled={moving}
              className="w-44"
            />
          )}
          {exportable && (
            <Button asChild variant="outline">
              <a href={privacyExportUrl(request.id)} download>
                <Download data-icon="inline-start" />
                Download their data
              </a>
            </Button>
          )}
          {canWrite && (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={onDecline}>
                Decline
              </Button>
              <Button onClick={onComplete}>
                <ShieldCheck data-icon="inline-start" />
                {request.type === 'erasure' ? 'Erase and complete' : 'Complete'}
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}

/** Declining still needs a reason — it's the record of why the request wasn't met. */
function DeclineRequest({ request, onClose, onDone }: { request: PrivacyRequest; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const decline = useMutation({
    mutationFn: () => updatePrivacyRequest(request.id, { status: 'declined', resolutionNotes: reason.trim() }),
    onSuccess: () => {
      onDone();
      toast('success', 'Request declined.');
      onClose();
    },
    onError: (error) => toast('error', error.message || 'The request wasn’t declined. Try again.'),
  });

  return (
    <Modal
      title="Decline this request?"
      description={`${requestType(request.type).label}${subjectName(request) ? ` · ${subjectName(request)}` : ''}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={decline.isPending} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => decline.mutate()} disabled={decline.isPending || !reason.trim()} className="flex-1">
            {decline.isPending ? 'Declining…' : 'Decline request'}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <label htmlFor="privacy-decline-reason" className="block text-sm font-semibold text-foreground">
          Why are you declining it?
        </label>
        <textarea
          id="privacy-decline-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
          rows={4}
          autoFocus
          placeholder="e.g. We couldn’t confirm their identity after two requests for ID."
          className={TEXTAREA}
        />
        <p className="text-xs text-muted-foreground">Required. You should also tell them why, and that they can complain to the ICO.</p>
      </div>
    </Modal>
  );
}

function CompleteRequest({ request, onClose, onDone }: { request: PrivacyRequest; onClose: () => void; onDone: () => void }) {
  const [resolution, setResolution] = useState('');
  const [phrase, setPhrase] = useState('');
  const capabilities = useAuthStore((state) => state.capabilities);
  const isErasure = request.type === 'erasure';
  const isEmployee = request.subjectType === 'employee';
  // Completing an erasure destroys data, so the API requires a second
  // capability on top of privacy:write. Checked here too, so the dialog
  // explains itself rather than failing after the notes have been written.
  const canErase = hasCapability(capabilities, isEmployee ? 'hr.people:delete' : 'customers:erase');

  const complete = useMutation({
    mutationFn: () => completePrivacyRequest(request.id, resolution),
    onSuccess: () => {
      onDone();
      toast('success', isErasure ? `${isEmployee ? 'Employee' : 'Customer'} data erased and request completed.` : 'Request completed.');
      onClose();
    },
    onError: (error) => toast('error', error.message || 'The request wasn’t completed. Review it and try again.'),
  });

  const blocked = !resolution.trim() || (isErasure && (!canErase || phrase.trim() !== ERASE_PHRASE));

  return (
    <Modal
      title={isErasure ? 'Erase their data and complete?' : 'Complete this request?'}
      description={`${requestType(request.type).label}${subjectName(request) ? ` · ${subjectName(request)}` : ''}`}
      onClose={onClose}
      size={isErasure ? 'lg' : 'md'}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={complete.isPending} className="flex-1">
            Cancel
          </Button>
          <Button
            variant={isErasure ? 'destructive' : 'default'}
            onClick={() => complete.mutate()}
            disabled={complete.isPending || blocked}
            className="flex-1"
          >
            {complete.isPending ? 'Completing…' : isErasure ? 'Erase and complete' : 'Complete request'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {isErasure && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/6 p-3.5 text-sm text-destructive">
            <p className="font-semibold">This permanently removes their personal data. It can’t be undone.</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
              {isEmployee ? (
                <>
                  <li>They must be inactive, and their retention review date must have passed</li>
                  <li>Identity, bank, statutory, leave, absence and contact details are removed</li>
                  <li>Their uploaded documents are deleted</li>
                </>
              ) : (
                <>
                  <li>Name, phone, email and date of birth are overwritten</li>
                  <li>Preferences, alerts and notes are cleared</li>
                  <li>Sent emails are redacted and unsent ones cancelled</li>
                </>
              )}
            </ul>
            <p className="mt-2 text-xs">
              {isEmployee
                ? 'Anonymised employment and payroll records are kept where the law still requires them.'
                : 'Orders and payments stay, linked to an anonymous record, because there’s a legal reason to keep them.'}
            </p>
          </div>
        )}

        {isErasure && !canErase && (
          <p className="rounded-lg border border-warning/25 bg-warning/6 p-3.5 text-sm text-warning" role="alert">
            You can work on this request but not complete it — erasing {isEmployee ? 'staff' : 'customer'} data needs extra permission. Ask
            the owner{isEmployee ? ' or an HR manager' : ''} to finish it.
          </p>
        )}

        <div className="space-y-2">
          <label htmlFor="privacy-resolution" className="block text-sm font-semibold text-foreground">
            What did you do?
          </label>
          <textarea
            id="privacy-resolution"
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            maxLength={2000}
            rows={4}
            autoFocus
            placeholder="How you confirmed who they are, and what you sent, changed or removed"
            className={TEXTAREA}
          />
          <p className="text-xs text-muted-foreground">Required. This is your record that the request was handled properly.</p>
        </div>

        {/* Typing the phrase is friction on purpose: the one action in the app
            that destroys data with no way back is too important for one click. */}
        {isErasure && canErase && (
          <div className="space-y-2">
            <label htmlFor="erasure-confirm" className="block text-sm font-semibold text-foreground">
              Type <span className="font-mono text-destructive">{ERASE_PHRASE}</span> to confirm
            </label>
            <input
              id="erasure-confirm"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              autoComplete="off"
              className="h-10 w-full rounded-md border border-input bg-control px-3 text-sm text-foreground outline-none focus-visible:border-exception focus-visible:outline-2 focus-visible:outline-exception/30"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
