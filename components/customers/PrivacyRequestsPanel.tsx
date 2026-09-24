'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { AlertTriangle, CalendarClock, Download, Plus, ShieldCheck, UserCircle2 } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type PrivacyRequest,
  type PrivacyRequestType,
  completePrivacyRequest,
  createPrivacyRequest,
  getPrivacyRequests,
  privacyExportUrl,
  updatePrivacyRequest,
} from '@/lib/modules/compliance/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/**
 * Privacy requests: recording them, working them, and closing them.
 *
 * Serves two surfaces from one component — a single customer's history on their
 * record, and the whole tenant's open queue on the compliance page — because the
 * work is identical and only the scope differs.
 *
 * Recording a new request happens in a drawer rather than an inline form. The
 * form used to unfold above the list and push everything a screen down, so the
 * queue you were checking disappeared the moment you started typing into it.
 */

const TYPE_OPTIONS = [
  { value: 'access', label: 'Access request' },
  { value: 'portability', label: 'Data portability' },
  { value: 'erasure', label: 'Erasure' },
  { value: 'rectification', label: 'Rectification' },
  { value: 'restriction', label: 'Restrict processing' },
  { value: 'objection', label: 'Objection' },
];

const CHANNEL_OPTIONS = [
  { value: 'in_person', label: 'In person' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'web', label: 'Web' },
  { value: 'staff', label: 'Staff recorded' },
];

const STATUS_LABEL: Record<PrivacyRequest['status'], string> = {
  received: 'Received',
  in_progress: 'In progress',
  awaiting_identity: 'Awaiting identity',
  completed: 'Completed',
  declined: 'Declined',
};

const isClosed = (request: PrivacyRequest) => request.status === 'completed' || request.status === 'declined';

/** Typed verbatim to confirm an erasure. Deliberately not the customer's name:
 *  that is visible on screen and could be copied without reading anything. */
const ERASE_PHRASE = 'ERASE';

const TEXTAREA =
  'w-full rounded-sm border border-input bg-field p-3 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground transition-[border-color,outline-color] focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured';

const CREATE_FORM_ID = 'privacy-request-form';

export function PrivacyRequestsPanel({ customerId, tenantId }: { customerId?: string; tenantId?: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<PrivacyRequest | null>(null);
  const [type, setType] = useState<PrivacyRequestType>('access');
  const [channel, setChannel] = useState('in_person');
  const [details, setDetails] = useState('');
  const [resolution, setResolution] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [now] = useState(() => Date.now());

  const capabilities = useAuthStore((state) => state.capabilities);
  // Completing an erasure destroys data, so the API requires customers:erase on
  // top of privacy:write. Checked here too, so the button explains itself rather
  // than failing with a 403 after the notes have been written.
  const canErase = hasCapability(capabilities, 'customers:erase');
  const isErasure = completing?.type === 'erasure';

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: moduleQueryKeys.compliance.key('privacy-requests', tenantId, customerId),
    queryFn: () => getPrivacyRequests({ tenantId, customerId }),
    enabled: Boolean(tenantId || customerId),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: moduleQueryKeys.compliance.key('privacy-requests') });

  const create = useMutation({
    mutationFn: () =>
      createPrivacyRequest({ tenantId, customerId: customerId!, type, requestChannel: channel, details: details.trim() || undefined }),
    onSuccess: () => {
      void refresh();
      if (customerId) void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-timeline', customerId) });
      setCreating(false);
      setDetails('');
      toast('success', 'Privacy request recorded.');
    },
    onError: (error) => toast('error', error.message || 'The privacy request wasn’t recorded. Review the details and try again.'),
  });

  const progress = useMutation({
    mutationFn: (request: PrivacyRequest) => updatePrivacyRequest(request.id, { status: 'in_progress' }),
    onSuccess: () => void refresh(),
    onError: (error) => toast('error', error.message || 'The privacy request wasn’t updated. Try again.'),
  });

  const complete = useMutation({
    mutationFn: () => completePrivacyRequest(completing!.id, resolution),
    onSuccess: () => {
      void refresh();
      if (customerId) {
        void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer', customerId) });
        void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-timeline', customerId) });
      }
      setCompleting(null);
      setResolution('');
      setConfirmPhrase('');
      toast('success', isErasure ? 'Customer data erased and request completed.' : 'Privacy request completed.');
    },
    onError: (error) => toast('error', error.message || 'The privacy request wasn’t completed. Review it and try again.'),
  });

  const visibleRequests = useMemo(
    () =>
      [...data]
        .filter((request) => customerId || !isClosed(request))
        .sort((a, b) => {
          if (isClosed(a) !== isClosed(b)) return isClosed(a) ? 1 : -1;
          return Date.parse(a.dueAt) - Date.parse(b.dueAt);
        }),
    [customerId, data],
  );

  const openCount = data.filter((request) => !isClosed(request)).length;
  const scoped = Boolean(customerId);

  return (
    <section className={cn(scoped && 'rounded-sm border border-rule bg-card')} aria-label="Privacy requests">
      <div className={cn('flex flex-wrap items-center justify-between gap-3', scoped ? 'border-b border-rule/60 px-4 py-3' : 'px-1')}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={cn('font-semibold text-foreground', scoped ? 'text-sm' : 'text-lg tracking-title')}>
              {scoped ? 'Privacy requests' : 'Open requests'}
            </h2>
            <Badge variant={openCount ? 'warning' : 'success'}>{openCount} open</Badge>
          </div>
          {!scoped && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Only requests that still need action are shown here.</p>}
        </div>
        {scoped && (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            Record request
          </Button>
        )}
      </div>

      <div className={cn(scoped && 'p-4')}>
        {isLoading ? (
          <div className="space-y-2" aria-label="Loading privacy requests">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-sm border border-rule bg-band/40" />
            ))}
          </div>
        ) : isError ? (
          <QueueMessage
            icon={AlertTriangle}
            title="Privacy requests could not be loaded"
            description="Check your connection and try again."
            action={
              <Button variant="outline" onClick={() => void refetch()}>
                Try again
              </Button>
            }
            tone="text-exception"
          />
        ) : visibleRequests.length === 0 ? (
          <QueueMessage
            icon={ShieldCheck}
            title={scoped ? 'No privacy requests recorded' : 'No open privacy work'}
            description={
              scoped
                ? 'If this guest asks for their data, or asks to be erased, record it here so the clock and the trail both start.'
                : 'All recorded requests are currently completed or declined.'
            }
            tone="text-momentum"
          />
        ) : (
          <div className="space-y-2">
            {visibleRequests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                customerScoped={scoped}
                now={now}
                progressPending={progress.isPending}
                onStart={() => progress.mutate(request)}
                onComplete={() => {
                  setConfirmPhrase('');
                  setResolution('');
                  setCompleting(request);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Recording a new one ────────────────────────────────────────── */}
      {creating && customerId && (
        <Drawer
          title="Record a privacy request"
          description="Capture the original channel and wording while it is fresh."
          onClose={() => setCreating(false)}
          footer={
            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={() => setCreating(false)} disabled={create.isPending} className="flex-1">
                Cancel
              </Button>
              <Button size="lg" type="submit" form={CREATE_FORM_ID} disabled={create.isPending} className="flex-1">
                {create.isPending ? 'Recording…' : 'Record request'}
              </Button>
            </div>
          }
        >
          <form
            id={CREATE_FORM_ID}
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="privacy-request-type" className="block text-label uppercase text-muted-foreground">
                Request type
              </label>
              <Select
                id="privacy-request-type"
                value={type}
                onValueChange={(value) => setType(value as PrivacyRequestType)}
                options={TYPE_OPTIONS}
                ariaLabel="Request type"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="privacy-request-channel" className="block text-label uppercase text-muted-foreground">
                How it was received
              </label>
              <Select
                id="privacy-request-channel"
                value={channel}
                onValueChange={setChannel}
                options={CHANNEL_OPTIONS}
                ariaLabel="Request channel"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="privacy-request-details" className="block text-label uppercase text-muted-foreground">
                Customer’s wording (optional)
              </label>
              <textarea
                id="privacy-request-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={2000}
                placeholder="Record what the customer asked for, in their words where you can"
                className={cn(TEXTAREA, 'min-h-28')}
              />
            </div>

            <p className="rounded-sm border border-rule bg-band/55 px-3 py-2.5 text-xs text-muted-foreground">
              Recording this starts the statutory clock. The due date is set from the day it was received, and the request appears on the
              compliance queue until it is closed.
            </p>
          </form>
        </Drawer>
      )}

      {/* ── Closing one ────────────────────────────────────────────────── */}
      {completing && (
        <Modal
          title="Complete privacy request"
          description={TYPE_OPTIONS.find((option) => option.value === completing.type)?.label}
          onClose={() => setCompleting(null)}
          size={isErasure ? 'lg' : 'md'}
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCompleting(null)} disabled={complete.isPending} className="flex-1">
                Cancel
              </Button>
              <Button
                variant={isErasure ? 'destructive' : 'default'}
                onClick={() => complete.mutate()}
                disabled={complete.isPending || !resolution.trim() || (isErasure && (!canErase || confirmPhrase.trim() !== ERASE_PHRASE))}
                className="flex-1"
              >
                {complete.isPending ? 'Completing…' : isErasure ? 'Erase and complete' : 'Complete request'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {isErasure && (
              <>
                <div className="rounded-sm border border-destructive/30 bg-destructive/6 p-3 text-sm text-destructive">
                  <p className="font-semibold">This permanently destroys personal data. It cannot be undone.</p>
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
                    <li>Name, phone, email and date of birth are overwritten</li>
                    <li>Allergies, dietary needs, seating preference and alerts are cleared</li>
                    <li>Internal notes are deleted and the points balance is zeroed</li>
                    <li>Sent emails are redacted; anything unsent is cancelled</li>
                    <li>The email address is suppressed so it cannot be re-enrolled</li>
                  </ul>
                  <p className="mt-2 text-xs">
                    Orders and payments stay linked to the anonymised record — there is a separate legal basis for keeping financial
                    history, and what is removed is the ability to tie it to a person.
                  </p>
                </div>

                {!canErase && (
                  <p className="rounded-sm border border-warning/25 bg-warning/6 p-3 text-sm text-warning" role="alert">
                    You can work this request but not complete it: erasing customer data requires the{' '}
                    <code className="font-mono text-xs">customers:erase</code> capability, which only an owner holds. Ask an owner to
                    complete it.
                  </p>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <label htmlFor="privacy-request-resolution" className="block text-label uppercase text-muted-foreground">
                Resolution and checks
              </label>
              <textarea
                id="privacy-request-resolution"
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                maxLength={2000}
                placeholder="Describe the checks performed and the outcome — how identity was confirmed, what was sent or removed"
                className={cn(TEXTAREA, 'min-h-32')}
              />
              <p className="text-xs text-muted-foreground">Required. This is the record that the request was handled properly.</p>
            </div>

            {/* Typing the phrase is friction on purpose: this is the one action in
                the app that destroys data with no way back, and a single click is
                too cheap for it. */}
            {isErasure && canErase && (
              <div className="space-y-1.5">
                <label htmlFor="erasure-confirm" className="block text-label uppercase text-muted-foreground">
                  Type <span className="font-mono text-destructive">{ERASE_PHRASE}</span> to confirm
                </label>
                <input
                  id="erasure-confirm"
                  value={confirmPhrase}
                  onChange={(event) => setConfirmPhrase(event.target.value)}
                  autoComplete="off"
                  aria-label={`Type ${ERASE_PHRASE} to confirm erasure`}
                  className="h-9 w-full rounded-sm border border-input bg-field px-3 text-sm text-foreground shadow-sm outline-none transition-[border-color,outline-color] focus:border-exception focus:outline-2 focus:outline-offset-0 focus:outline-exception"
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}

function QueueMessage({
  icon: Icon,
  title,
  description,
  action,
  tone,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-rule px-6 py-10 text-center">
      <span className={cn('flex size-11 items-center justify-center rounded-sm bg-band', tone)}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function RequestRow({
  request,
  customerScoped,
  now,
  progressPending,
  onStart,
  onComplete,
}: {
  request: PrivacyRequest;
  customerScoped: boolean;
  now: number;
  progressPending: boolean;
  onStart: () => void;
  onComplete: () => void;
}) {
  const name = request.customer ? `${request.customer.firstName} ${request.customer.lastName}` : request.customerSnapshot?.name;
  const closed = isClosed(request);
  const overdue = !closed && Date.parse(request.dueAt) < now;
  const typeLabel = TYPE_OPTIONS.find((option) => option.value === request.type)?.label ?? request.type;
  const channelLabel =
    CHANNEL_OPTIONS.find((option) => option.value === request.requestChannel)?.label ?? request.requestChannel.replaceAll('_', ' ');
  const badgeVariant =
    request.status === 'completed'
      ? 'success'
      : request.status === 'declined'
        ? 'muted'
        : overdue
          ? 'destructive'
          : request.status === 'in_progress'
            ? 'primary'
            : 'warning';

  return (
    <article
      className={cn(
        'rounded-sm border bg-background p-3.5',
        // Overdue is the one state that earns an edge; everything else stays on
        // the shared hairline so the queue reads as one list.
        overdue ? 'border-exception/40' : 'border-rule',
        closed && 'opacity-75',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{typeLabel}</h3>
            {!customerScoped && name && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <UserCircle2 size={13} aria-hidden="true" />
                {name}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className={cn('inline-flex items-center gap-1.5', overdue && 'font-semibold text-exception')}>
              <CalendarClock size={13} aria-hidden="true" />
              {overdue ? 'Overdue' : closed ? 'Was due' : 'Due'} {formatDate(request.dueAt)}
            </span>
            <span>Received {formatDate(request.receivedAt)}</span>
            <span className="capitalize">Via {channelLabel}</span>
          </div>
        </div>
        <Badge variant={badgeVariant}>{STATUS_LABEL[request.status]}</Badge>
      </div>

      {request.details && <p className="mt-2.5 max-w-3xl text-sm text-muted-foreground">{request.details}</p>}

      {closed && request.resolutionNotes && (
        <div className="mt-2.5 rounded-sm border border-rule/60 bg-momentum/6 px-3 py-2 text-sm text-foreground">
          <span className="font-semibold">Outcome:</span> {request.resolutionNotes}
        </div>
      )}

      {!closed && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule/50 pt-3">
          {request.status === 'received' && (
            <Button variant="outline" size="sm" onClick={onStart} disabled={progressPending}>
              Start work
            </Button>
          )}
          {(request.type === 'access' || request.type === 'portability') && (
            <Button asChild variant="outline" size="sm">
              <a href={privacyExportUrl(request.id)} download>
                <Download data-icon="inline-start" />
                Export data
              </a>
            </Button>
          )}
          <Button size="sm" onClick={onComplete} className="ml-auto">
            <ShieldCheck data-icon="inline-start" />
            Complete request
          </Button>
        </div>
      )}
    </article>
  );
}
