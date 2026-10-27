'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { InfoRow } from '@/components/cms/rows';
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Globe,
  Hash,
  ListChecks,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
} from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type FormDetail,
  type FormResponse,
  type FormResponseStatus,
  type ResponseFilter,
  bulkFormResponses,
  deleteFormResponse,
  exportFormResponses,
  getFormResponses,
  markFormResponse,
} from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/date';
import { type FormField, answerText, isInputField, responseTitle } from '@/lib/utils/forms';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const STATUS_BADGE: Record<FormResponseStatus, 'success' | 'muted' | 'outline'> = {
  new: 'success',
  reviewed: 'outline',
  archived: 'muted',
};
const STATUS_LABEL: Record<FormResponseStatus, string> = { new: 'New', reviewed: 'Reviewed', archived: 'Archived' };
const SOURCE_LABEL = { hosted: 'Form page', embed: 'Website', api: 'API' } as const;
const PAGE_SIZE = 25;

/**
 * Responses as an inbox: open ones first (new and reviewed), a search across
 * every answer, newest at the top. Opening one shows every answer and where it
 * came from — and marks it reviewed. Several can be marked or deleted at once;
 * Export takes what the filter shows as CSV.
 */
export function ResponsesPanel({ form }: { form: FormDetail }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const canTriage = hasCapability(
    useAuthStore((state) => state.capabilities),
    'forms.responses:write',
  );
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ResponseFilter>('open');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // Held as a copy, so marking it reviewed (which can drop it from the "New" list) doesn't close it.
  const [open, setOpen] = useState<FormResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  // The search waits for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: moduleQueryKeys.forms.key('responses', form.id, tenantId, filter, q, page),
    queryFn: () => getFormResponses(form.id, { page, limit: PAGE_SIZE, status: filter, q: q || undefined }, tenantId),
    placeholderData: keepPreviousData,
  });
  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const fields = useMemo(
    () => (form.publishedDefinition ?? form.definition).fields.filter((field) => isInputField(field) && field.type !== 'hidden'),
    [form],
  );
  // Two answers beside who it's from, so the list says something without opening each one.
  const columns = useMemo(() => {
    const title = fields.find((field) => field.type === 'short_text' && /name/i.test(`${field.key} ${field.label}`));
    return fields.filter((field) => field !== title && field.type !== 'consent').slice(0, 2);
  }, [fields]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.all });
  const mark = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FormResponseStatus }) => markFormResponse(form.id, id, status, tenantId),
    onSuccess: () => invalidate(),
    onError: (error) => toast('error', error.message),
  });
  const bulk = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: FormResponseStatus | 'delete' }) =>
      bulkFormResponses(form.id, ids, action, tenantId),
    onSuccess: async (result, { action }) => {
      setChosen(new Set());
      setConfirmDelete(null);
      await invalidate();
      toast(
        'success',
        `${result.data.changed} ${result.data.changed === 1 ? 'response' : 'responses'} ${action === 'delete' ? 'deleted' : `marked ${STATUS_LABEL[action].toLowerCase()}`}.`,
      );
    },
    onError: (error) => toast('error', error.message),
  });
  const removeOne = useMutation({
    mutationFn: (id: string) => deleteFormResponse(form.id, id, tenantId),
    onSuccess: async () => {
      setConfirmDelete(null);
      setOpen(null);
      await invalidate();
      toast('success', 'Response deleted.');
    },
    onError: (error) => toast('error', error.message),
  });
  const exportCsv = useMutation({
    mutationFn: () => exportFormResponses(form.id, { status: filter, q: q || undefined }, tenantId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${form.name.replace(/[^\w -]+/g, '').trim() || 'form'} responses.csv`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onError: (error) => toast('error', error.message),
  });

  const openResponse = (response: FormResponse) => {
    setOpen(response);
    if (canTriage && response.status === 'new')
      mark.mutate(
        { id: response.id, status: 'reviewed' },
        { onSuccess: () => setOpen((current) => (current?.id === response.id ? { ...current, status: 'reviewed' } : current)) },
      );
  };
  const allChosen = rows.length > 0 && rows.every((row) => chosen.has(row.id));
  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const total = query.data?.total ?? 0;
  const pages = query.data?.pages ?? 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<ResponseFilter>
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setPage(1);
            setChosen(new Set());
          }}
          ariaLabel="Which responses"
          options={[
            { value: 'open', label: 'Open' },
            { value: 'new', label: 'New' },
            { value: 'reviewed', label: 'Reviewed' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <Input
            aria-label="Search the answers"
            placeholder="Search the answers"
            value={search}
            leftIcon={<Search size={14} aria-hidden="true" />}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="ml-auto h-9 gap-1.5"
          disabled={total === 0 || exportCsv.isPending}
          onClick={() => exportCsv.mutate()}
        >
          <Download size={14} aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      {chosen.size > 0 && canTriage && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule/60 bg-band/50 px-3 py-2">
          <span className="mr-auto text-sm font-medium">{chosen.size} chosen</span>
          <Button variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => bulk.mutate({ ids: [...chosen], action: 'reviewed' })}>
            <Check size={13} aria-hidden="true" />
            Mark reviewed
          </Button>
          <Button
            variant="ghost"
            className="h-8 gap-1.5 text-xs"
            onClick={() => bulk.mutate({ ids: [...chosen], action: filter === 'archived' ? 'reviewed' : 'archived' })}
          >
            {filter === 'archived' ? <RotateCcw size={13} aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />}
            {filter === 'archived' ? 'Unarchive' : 'Archive'}
          </Button>
          <Button variant="destructive" className="h-8 gap-1.5 text-xs" onClick={() => setConfirmDelete([...chosen])}>
            <Trash2 size={13} aria-hidden="true" />
            Delete
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-rule/60 bg-field">
        {query.isPending ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <Bone key={index} className="h-10 rounded-md" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState title="Couldn’t load the responses" onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            compact
            title={
              q
                ? `Nothing matches “${q}”`
                : filter === 'open'
                  ? 'No responses yet'
                  : `No ${STATUS_LABEL[filter as FormResponseStatus]?.toLowerCase() ?? ''} responses`
            }
            description={
              q
                ? 'The search looks through every answer.'
                : filter === 'open'
                  ? form.publishedAt
                    ? 'Share the form and answers appear here the moment they’re sent.'
                    : 'Publish the form, then share it — answers appear here the moment they’re sent.'
                  : undefined
            }
          />
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', query.isPlaceholderData && 'opacity-60')}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule/50 text-left text-xs text-muted-foreground">
                  {canTriage && (
                    <th className="w-10 py-2.5 pl-4">
                      <input
                        type="checkbox"
                        aria-label="Choose every response on this page"
                        checked={allChosen}
                        onChange={() => setChosen(allChosen ? new Set() : new Set(rows.map((row) => row.id)))}
                        className="size-4 accent-primary"
                      />
                    </th>
                  )}
                  <th className="py-2.5 pr-3 pl-4 font-medium">From</th>
                  {columns.map((field) => (
                    <th key={field.id} className="hidden max-w-48 truncate px-3 py-2.5 font-medium md:table-cell">
                      {field.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-medium">Sent</th>
                  <th className="py-2.5 pr-4 pl-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openResponse(row)}
                    className={cn(
                      'cursor-pointer border-b border-rule/30 transition-colors last:border-0 hover:bg-band/40',
                      row.status === 'new' && 'font-semibold',
                      chosen.has(row.id) && 'bg-band/50',
                    )}
                  >
                    {canTriage && (
                      <td className="py-2.5 pl-4" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Choose this response"
                          checked={chosen.has(row.id)}
                          onChange={() => toggle(row.id)}
                          className="size-4 accent-primary"
                        />
                      </td>
                    )}
                    <td className="max-w-56 py-2.5 pr-3 pl-4">
                      <span className="flex items-center gap-2">
                        {row.status === 'new' && <span className="size-2 shrink-0 rounded-full bg-momentum" aria-label="New" />}
                        <span className="truncate">{row.customer?.name ?? responseTitle(fields, row.answers) ?? 'Anonymous'}</span>
                      </span>
                    </td>
                    {columns.map((field) => (
                      <td key={field.id} className="hidden max-w-48 truncate px-3 py-2.5 font-normal text-muted-foreground md:table-cell">
                        {answerText(row.answers[field.id])}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 font-normal whitespace-nowrap text-muted-foreground">
                      <RelativeTime iso={row.submittedAt} />
                    </td>
                    <td className="py-2.5 pr-4 pl-3 text-right">
                      <Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString('en-GB')}
          </span>
          <span className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={page >= pages}
              onClick={() => setPage((current) => current + 1)}
            >
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </span>
        </div>
      )}

      {open && (
        <ResponseDrawer
          response={open}
          fields={(form.publishedDefinition ?? form.definition).fields}
          canTriage={canTriage}
          onClose={() => setOpen(null)}
          onMark={(status) =>
            mark.mutate(
              { id: open.id, status },
              { onSuccess: () => (status === 'archived' ? setOpen(null) : setOpen({ ...open, status })) },
            )
          }
          onDelete={() => setConfirmDelete([open.id])}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete.length === 1 ? 'Delete this response?' : `Delete ${confirmDelete.length} responses?`}
          message="Their answers are gone for good, and won’t be in exports or the summary. Archive instead to keep them out of the way."
          confirmLabel="Delete"
          isPending={bulk.isPending || removeOne.isPending}
          onConfirm={() =>
            confirmDelete.length === 1 ? removeOne.mutate(confirmDelete[0]!) : bulk.mutate({ ids: confirmDelete, action: 'delete' })
          }
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/** Every answer, the questions it was for, and where it came from. */
function ResponseDrawer({
  response,
  fields,
  canTriage,
  onClose,
  onMark,
  onDelete,
}: {
  response: FormResponse;
  fields: FormField[];
  canTriage: boolean;
  onClose: () => void;
  onMark: (status: FormResponseStatus) => void;
  onDelete: () => void;
}) {
  const shown = fields.filter(isInputField);
  const known = new Set(shown.map((field) => field.id));
  // Answers to questions since removed from the form are still the respondent's.
  const earlier = Object.entries(response.answers).filter(([id]) => !known.has(id));
  const title = response.customer?.name ?? responseTitle(fields, response.answers) ?? 'Anonymous response';

  return (
    <Drawer
      title={title}
      description={`Sent ${formatDateTime(response.submittedAt)}`}
      icon={ListChecks}
      onClose={onClose}
      footer={
        canTriage ? (
          <div className="flex flex-wrap gap-2">
            {response.status === 'archived' ? (
              <Button variant="outline" className="gap-1.5" onClick={() => onMark('reviewed')}>
                <RotateCcw size={14} aria-hidden="true" />
                Unarchive
              </Button>
            ) : (
              <Button variant="outline" className="gap-1.5" onClick={() => onMark('archived')}>
                <Archive size={14} aria-hidden="true" />
                Archive
              </Button>
            )}
            {response.status !== 'new' && response.status !== 'archived' && (
              <Button variant="ghost" onClick={() => onMark('new')}>
                Mark as new
              </Button>
            )}
            <Button variant="destructive" className="ml-auto gap-1.5" onClick={onDelete}>
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <dl className="space-y-4">
          {shown.map((field) => {
            const value = response.answers[field.id];
            if (value === undefined && field.type === 'hidden') return null;
            return (
              <div key={field.id}>
                <dt className="text-xs font-medium text-muted-foreground">{field.label || field.key}</dt>
                <dd
                  className={cn('mt-0.5 text-sm whitespace-pre-line', value === undefined ? 'text-muted-foreground/60' : 'text-foreground')}
                >
                  {value === undefined
                    ? 'Not answered'
                    : field.type === 'rating'
                      ? `${'★'.repeat(Number(value))} ${value}`
                      : answerText(value)}
                </dd>
              </div>
            );
          })}
        </dl>

        {earlier.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Questions since removed</p>
            <dl className="space-y-3">
              {earlier.map(([id, value]) => (
                <div key={id}>
                  <dt className="font-mono text-xs text-muted-foreground">{id}</dt>
                  <dd className="mt-0.5 text-sm">{answerText(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-rule/50 bg-field p-4">
          <InfoRow icon={UserRound} title="Customer">
            {response.customer ? (
              <Link
                href={`/customers/${response.customer.id}`}
                className="text-sm font-medium text-reference underline-offset-2 hover:underline"
              >
                {response.customer.name}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">Not linked</span>
            )}
          </InfoRow>
          <InfoRow icon={Globe} title="Came from">
            <span className="text-sm text-muted-foreground">{SOURCE_LABEL[response.source]}</span>
          </InfoRow>
          <InfoRow icon={Clock} title="Sent">
            <span className="text-sm text-muted-foreground">
              <RelativeTime iso={response.submittedAt} />
            </span>
          </InfoRow>
          <InfoRow icon={Hash} title="Form version">
            <span className="text-sm tabular-nums text-muted-foreground">{response.formVersion}</span>
          </InfoRow>
          {Object.entries(response.metadata).map(([key, value]) => (
            <InfoRow key={key} icon={Globe} title={key.replace(/^utm_/, 'Campaign ').replace('referrer', 'From page')}>
              <span className="max-w-48 truncate text-sm text-muted-foreground" title={value}>
                {value}
              </span>
            </InfoRow>
          ))}
        </div>
      </div>
    </Drawer>
  );
}
