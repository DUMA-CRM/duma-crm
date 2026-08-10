'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { AlertTriangle, CalendarClock, Download, Plus, ShieldCheck, UserCircle2, X } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import {
  type PrivacyRequest,
  type PrivacyRequestType,
  completePrivacyRequest,
  createPrivacyRequest,
  getPrivacyRequests,
  privacyExportUrl,
  updatePrivacyRequest,
} from '@/lib/api/privacy.service';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';

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

export function PrivacyRequestsPanel({ customerId, tenantId }: { customerId?: string; tenantId?: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<PrivacyRequest | null>(null);
  const [type, setType] = useState<PrivacyRequestType>('access');
  const [channel, setChannel] = useState('in_person');
  const [details, setDetails] = useState('');
  const [resolution, setResolution] = useState('');
  const [now] = useState(() => Date.now());

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['privacy-requests', tenantId, customerId],
    queryFn: () => getPrivacyRequests({ tenantId, customerId }),
    enabled: Boolean(tenantId || customerId),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['privacy-requests'] });

  const create = useMutation({
    mutationFn: () =>
      createPrivacyRequest({ tenantId, customerId: customerId!, type, requestChannel: channel, details: details.trim() || undefined }),
    onSuccess: () => {
      void refresh();
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
      setCompleting(null);
      setResolution('');
      toast('success', 'Privacy request completed.');
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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-title text-foreground">{customerId ? 'Privacy history' : 'Open requests'}</h2>
            <Badge variant={openCount ? 'warning' : 'success'}>{openCount} open</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {customerId
              ? 'Every privacy request and recorded outcome for this customer.'
              : 'Only requests that still need action are shown here.'}
          </p>
        </div>
        {customerId && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={15} aria-hidden="true" />
            Record request
          </Button>
        )}
      </div>

      {creating && customerId && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
          className="rounded-lg border border-rule/65 bg-band/45 p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Record a customer request</h3>
              <p className="mt-1 text-xs text-muted-foreground">Capture the original channel and wording while it is fresh.</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCreating(false)} aria-label="Cancel new request">
              <X size={15} aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="privacy-request-type" className="mb-1.5 block text-xs font-semibold text-foreground">
                Request type
              </label>
              <Select
                id="privacy-request-type"
                value={type}
                onValueChange={(value) => setType(value as PrivacyRequestType)}
                options={TYPE_OPTIONS}
                ariaLabel="Request type"
                className="h-10 w-full rounded-md"
              />
            </div>
            <div>
              <label htmlFor="privacy-request-channel" className="mb-1.5 block text-xs font-semibold text-foreground">
                How it was received
              </label>
              <Select
                id="privacy-request-channel"
                value={channel}
                onValueChange={setChannel}
                options={CHANNEL_OPTIONS}
                ariaLabel="Request channel"
                className="h-10 w-full rounded-md"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="privacy-request-details" className="mb-1.5 block text-xs font-semibold text-foreground">
                Customer’s wording (optional)
              </label>
              <textarea
                id="privacy-request-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={2000}
                placeholder="Record what the customer asked for"
                className="min-h-24 w-full rounded-md border border-input bg-field p-3 text-sm outline-none transition-[border-color,outline-color] focus:border-primary focus:outline-2 focus:outline-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-rule/45 pt-4">
            <Button type="button" variant="outline" onClick={() => setCreating(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Recording…' : 'Record request'}
            </Button>
          </div>
        </form>
      )}

      <div>
        {isLoading ? (
          <div className="space-y-3" aria-label="Loading privacy requests">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-lg border border-rule/55 bg-card" />
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
            title={customerId ? 'No privacy requests recorded' : 'No open privacy work'}
            description={
              customerId
                ? 'Requests recorded for this customer will appear here.'
                : 'All recorded requests are currently completed or declined.'
            }
            tone="text-momentum"
          />
        ) : (
          <div className="space-y-3">
            {visibleRequests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                customerScoped={Boolean(customerId)}
                now={now}
                progressPending={progress.isPending}
                onStart={() => progress.mutate(request)}
                onComplete={() => setCompleting(request)}
              />
            ))}
          </div>
        )}
      </div>

      {completing && (
        <Modal title="Complete privacy request" onClose={() => setCompleting(null)}>
          <div className="space-y-4">
            {completing.type === 'erasure' && (
              <p className="rounded-md border border-destructive/30 bg-destructive/6 p-3 text-sm text-destructive">
                Completing this request permanently anonymises the customer’s contact details and loyalty balance. Orders remain linked to
                the anonymised record for financial reporting.
              </p>
            )}
            <div>
              <label htmlFor="privacy-request-resolution" className="mb-1.5 block text-xs font-semibold text-foreground">
                Resolution and checks
              </label>
              <textarea
                id="privacy-request-resolution"
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                maxLength={2000}
                placeholder="Describe the checks performed and outcome"
                className="min-h-32 w-full rounded-md border border-input bg-field p-3 text-sm outline-none transition-[border-color,outline-color] focus:border-primary focus:outline-2 focus:outline-primary"
              />
            </div>
            <div className="flex gap-2 border-t border-rule/55 pt-4">
              <Button variant="outline" onClick={() => setCompleting(null)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant={completing.type === 'erasure' ? 'destructive' : 'default'}
                onClick={() => complete.mutate()}
                disabled={complete.isPending || !resolution.trim()}
                className="flex-1"
              >
                {complete.isPending ? 'Completing…' : 'Complete request'}
              </Button>
            </div>
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
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-rule/65 bg-card px-6 py-10 text-center">
      <span className={`flex size-12 items-center justify-center rounded-md bg-band ${tone}`}>
        <Icon size={21} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
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
    <article className="rounded-lg border border-rule/65 bg-card p-4 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-primary/35 hover:shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span
              className={overdue ? 'inline-flex items-center gap-1.5 font-semibold text-exception' : 'inline-flex items-center gap-1.5'}
            >
              <CalendarClock size={14} aria-hidden="true" /> {overdue ? 'Overdue' : 'Due'} {formatDate(request.dueAt)}
            </span>
            <span>Received {formatDate(request.receivedAt)}</span>
            <span className="capitalize">Via {channelLabel}</span>
          </div>
        </div>
        <Badge variant={badgeVariant}>{STATUS_LABEL[request.status]}</Badge>
      </div>

      {request.details && <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{request.details}</p>}
      {closed && request.resolutionNotes && (
        <div className="mt-3 rounded-md bg-momentum/8 px-3 py-2 text-sm text-foreground">
          <span className="font-semibold">Outcome:</span> {request.resolutionNotes}
        </div>
      )}

      {!closed && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule/45 pt-3">
          {request.status === 'received' && (
            <Button variant="outline" size="sm" onClick={onStart} disabled={progressPending}>
              Start work
            </Button>
          )}
          {(request.type === 'access' || request.type === 'portability') && (
            <Button asChild variant="outline" size="sm">
              <a href={privacyExportUrl(request.id)} download>
                <Download size={14} aria-hidden="true" />
                Export data
              </a>
            </Button>
          )}
          <Button size="sm" onClick={onComplete}>
            <ShieldCheck size={14} aria-hidden="true" />
            Complete request
          </Button>
        </div>
      )}
    </article>
  );
}
