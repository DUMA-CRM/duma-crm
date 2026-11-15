'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
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
import { Modal } from '@/components/customers/CustomerDialogs';
import { AlertTriangle, CheckCircle2, ClipboardList, Download, Plus, ShieldCheck, Timer } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { DetailRow, Facts } from '@/components/shared/DetailRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/label';
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
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { type DeadlineTone, isClosedRequest, requestDeadline, sortQueue, summariseQueue } from '@/lib/utils/privacy-deadline';
import { useAuthStore } from '@/stores/authStore';

/**
 * Privacy requests: recording them, working them, and closing them.
 *
 * Serves three surfaces from one component — the whole workspace's queue on
 * the Compliance page, and one person's requests on a customer's record (in a
 * drawer, `chrome="drawer"`) or a staff record (a titled list in a column) —
 * because the work is identical and only the scope differs.
 *
 * Every request is one row in one list, soonest deadline first, so overdue
 * work leads. The row says how long is left in words, tinted by urgency; a
 * click opens the request in place — what they asked, the dates, the outcome,
 * and the actions — as an API key opens on the Developers page.
 */

/** Typed verbatim to confirm an erasure. Deliberately not the person's name:
 *  that is on screen and could be copied without reading anything. */
const ERASE_PHRASE = 'ERASE';

const TEXTAREA =
  'w-full rounded-md border border-input bg-control p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30';

/** The statutory rule the list can't show — kept under every list of requests. */
const MONTH_RULE = 'Access, correction and erasure requests under data-protection law — each must be answered within a month.';

/** The row's tile: urgency first, so an overdue request is red before it is read. */
const TONE_TILE: Record<DeadlineTone, Tone> = {
  done: 'muted',
  calm: 'primary',
  soon: 'warning',
  today: 'exception',
  overdue: 'exception',
};
/** The row's value — the deadline in words — inked the same way. */
const TONE_VALUE: Partial<Record<DeadlineTone, 'warning' | 'exception'>> = {
  soon: 'warning',
  today: 'exception',
  overdue: 'exception',
};
const TONE_BAR: Record<DeadlineTone, string> = {
  done: 'bg-muted-foreground/40',
  calm: 'bg-primary',
  soon: 'bg-measured',
  today: 'bg-exception',
  overdue: 'bg-exception',
};

const CARD = 'rounded-lg border border-border bg-card shadow-sm';

type View = 'open' | 'closed';

export function PrivacyRequestsPanel({
  customerId,
  employeeUserId,
  tenantId,
  chrome = 'section',
}: {
  customerId?: string;
  employeeUserId?: string;
  tenantId?: string;
  /** `drawer` drops the heading — the drawer that holds the panel already names it. */
  chrome?: 'section' | 'drawer';
}) {
  const qc = useQueryClient();
  const scoped = Boolean(customerId || employeeUserId);
  const [view, setView] = useState<View>('open');
  const [recording, setRecording] = useState(false);
  const [completing, setCompleting] = useState<PrivacyRequest | null>(null);
  const [declining, setDeclining] = useState<PrivacyRequest | null>(null);
  // The one opened row, if any; a tap on it closes it.
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
    <ListSkeleton rows={scoped ? 2 : 3} label="Loading privacy requests" />
  ) : requests.isError ? (
    <div className={CARD}>
      <ErrorState title="Privacy requests couldn’t be loaded" onRetry={() => void requests.refetch()} />
    </div>
  ) : shown.length === 0 ? (
    <div className={CARD}>
      <EmptyState
        compact
        icon={scoped ? ShieldCheck : view === 'open' ? CheckCircle2 : ClipboardList}
        kind={!scoped && view === 'open' ? 'done' : 'start'}
        title={scoped ? 'No privacy requests' : view === 'open' ? 'Nothing waiting' : 'No closed requests yet'}
        description={
          scoped
            ? 'Record one if they ask for their data or to be deleted.'
            : view === 'open'
              ? 'New requests appear here with their deadline.'
              : 'Completed and declined requests stay here as your record that each was handled.'
        }
      />
    </div>
  ) : (
    <ListRowGroup>
      {shown.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          scoped={scoped}
          now={now}
          open={expanded === request.id}
          onToggle={() => setExpanded((current) => (current === request.id ? null : request.id))}
          canWrite={canWrite}
          canExport={canExport}
          moving={move.isPending && move.variables?.request.id === request.id}
          onMove={(status) => move.mutate({ request, status })}
          onComplete={() => setCompleting(request)}
          onDecline={() => setDeclining(request)}
        />
      ))}
    </ListRowGroup>
  );

  const record = canWrite && (
    <Button variant={scoped ? 'outline' : 'default'} size="sm" onClick={() => setRecording(true)}>
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

  if (scoped && chrome === 'drawer') {
    // Inside a drawer titled "Privacy requests": no second heading, the button over the list.
    return (
      <div className="space-y-2">
        {record && <div className="flex justify-end">{record}</div>}
        {list}
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">{MONTH_RULE}</p>
        {dialogs}
      </div>
    );
  }

  if (scoped) {
    // On a record's column: a titled list, like every other block beside it.
    return (
      <RecordGroup id="privacy-requests" title="Privacy requests" actions={record || undefined} footnote={MONTH_RULE}>
        {list}
        {dialogs}
      </RecordGroup>
    );
  }

  return (
    <motion.div
      className="flex flex-col gap-5"
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

      {/* The whole queue is one list — no card around it, no card per request. */}
      <RecordGroup
        id="privacy-requests"
        title="Privacy requests"
        footnote={MONTH_RULE}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
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
        }
      >
        {list}
      </RecordGroup>
      {dialogs}
    </motion.div>
  );
}

/**
 * One request as a row: its type, who (on the queue) or when (on a record),
 * where it's up to, and on the right how long is left — in words, tinted by
 * urgency. Opened, it shows what they asked, the dates and outcome, and the
 * actions.
 */
function RequestRow({
  request,
  scoped,
  now,
  open,
  onToggle,
  canWrite,
  canExport,
  moving,
  onMove,
  onComplete,
  onDecline,
}: {
  request: PrivacyRequest;
  scoped: boolean;
  now: number;
  open: boolean;
  onToggle: () => void;
  canWrite: boolean;
  canExport: boolean;
  moving: boolean;
  onMove: (status: Exclude<PrivacyRequestStatus, 'completed' | 'declined'>) => void;
  onComplete: () => void;
  onDecline: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const kind = requestType(request.type);
  const closed = isClosedRequest(request);
  const deadline = requestDeadline(request, now);
  const status = requestStatus(request.status);
  const name = subjectName(request);
  const href = subjectHref(request);
  const staff = request.subjectType === 'employee';
  const exportable = canExport && (request.type === 'access' || request.type === 'portability');
  const closedOn = request.completedAt ? formatDate(request.completedAt) : null;

  const who = name ? `${name}${staff ? ' (staff)' : ''}` : 'Unknown person';
  const meta = scoped
    ? closed
      ? `Received ${formatDate(request.receivedAt)}`
      : `Received ${formatDate(request.receivedAt)} · ${status.label}`
    : closed
      ? [who, closedOn].filter(Boolean).join(' · ')
      : `${who} · ${status.label}`;

  return (
    <DetailRow
      icon={kind.icon}
      tone={TONE_TILE[deadline.tone]}
      title={kind.label}
      meta={meta}
      value={closed ? status.label : deadline.label}
      valueTone={closed ? undefined : TONE_VALUE[deadline.tone]}
      quiet={closed}
      muted={closed}
      open={open}
      onToggle={onToggle}
    >
      {request.details && (
        <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">“{request.details}”</blockquote>
      )}

      <Facts
        rows={[
          ['Asked for', kind.legal],
          !scoped && [
            'Person',
            href ? (
              <Link
                key="person"
                href={href}
                className="font-medium underline decoration-border underline-offset-2 hover:decoration-foreground"
              >
                {who}
              </Link>
            ) : (
              who
            ),
          ],
          ['Received', `${formatDate(request.receivedAt)} · ${channelLabel(request.requestChannel)}`],
          !closed && ['Due', formatDate(request.dueAt)],
          closed && request.resolutionNotes && [request.status === 'declined' ? 'Why declined' : 'Outcome', request.resolutionNotes],
          closed && closedOn && [request.status === 'declined' ? 'Declined' : 'Completed', closedOn],
        ]}
      />

      {!closed && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-band"
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
      )}

      {!closed && (canWrite || exportable) && (
        <div className="flex flex-wrap items-center gap-2">
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
    </DetailRow>
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
        <FieldLabel htmlFor="privacy-decline-reason">Why are you declining it?</FieldLabel>
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
          <FieldLabel htmlFor="privacy-resolution">What did you do?</FieldLabel>
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
            <FieldLabel htmlFor="erasure-confirm">
              Type <span className="font-mono text-destructive">{ERASE_PHRASE}</span> to confirm
            </FieldLabel>
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
