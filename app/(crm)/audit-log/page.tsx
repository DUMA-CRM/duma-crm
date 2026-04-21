'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getAuditLogs } from '@/lib/api/audit.service';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils/cn';

// ── Helpers ───────────────────────────────────────────────────────────────────

function actionColor(action: string) {
  if (/delete|remove/i.test(action)) return 'text-destructive bg-destructive/10 border-destructive/20';
  if (/create|add/i.test(action)) return 'text-success bg-success/10 border-success/20';
  if (/update|patch|edit/i.test(action)) return 'text-primary bg-primary/10 border-primary/20';
  if (/transfer|receive|adjust/i.test(action)) return 'text-warning bg-warning/10 border-warning/20';
  return 'text-muted-foreground bg-muted border-border';
}

function humanise(str: string) {
  return str.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({
  log,
}: {
  log: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getAuditLogs>>>>['data'] extends { data: (infer T)[] } | undefined ? T : never;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta = log.meta && Object.keys(log.meta).length > 0;

  return (
    <tr
      className={cn('group border-b border-border/50 transition-colors', hasMeta && 'cursor-pointer hover:bg-surface-offset')}
      onClick={() => hasMeta && setExpanded((v) => !v)}
    >
      <td className="py-3.5 pr-4 w-36 align-top">
        <span
          className={cn(
            'inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border whitespace-nowrap',
            actionColor(log.action),
          )}
        >
          {humanise(log.action)}
        </span>
      </td>
      <td className="py-3.5 pr-4 align-top">
        <p className="text-sm font-medium text-foreground leading-snug">{humanise(log.resourceType)}</p>
        {log.resourceId && <p className="text-xs text-muted-foreground font-mono mt-0.5 opacity-60">{log.resourceId}</p>}
        {expanded && hasMeta && (
          <pre className="mt-2 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all border border-border">
            {JSON.stringify(log.meta, null, 2)}
          </pre>
        )}
      </td>
      <td className="py-3.5 pr-4 w-44 align-top">
        {log.user?.name ? (
          <>
            <p className="text-sm text-foreground leading-snug">{log.user.name}</p>
            <p className="text-xs text-muted-foreground truncate max-w-40 mt-0.5">{log.user.email}</p>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3.5 w-44 align-top">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
          <Clock size={11} aria-hidden="true" className="shrink-0" />
          {formatDate(log.createdAt)}
        </span>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const LIMIT = 50;

const inputClass =
  'h-8 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const hasFilters = !!(action || resourceType || from || to);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, action, resourceType, from, to],
    queryFn: () =>
      getAuditLogs({
        page,
        limit: LIMIT,
        action: action || undefined,
        resourceType: resourceType || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      }),
  });

  const logs = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  function clearFilters() {
    setAction('');
    setResourceType('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  const filterBar = (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        value={action}
        onChange={(e) => {
          setAction(e.target.value);
          setPage(1);
        }}
        placeholder="Filter by action…"
        className={cn(inputClass, 'w-44')}
      />
      <input
        value={resourceType}
        onChange={(e) => {
          setResourceType(e.target.value);
          setPage(1);
        }}
        placeholder="Resource type…"
        className={cn(inputClass, 'w-40')}
      />
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className={cn(inputClass, 'w-36')}
        />
        <span className="text-xs text-muted-foreground shrink-0">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          className={cn(inputClass, 'w-36')}
        />
      </div>
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="h-8 px-2.5 flex items-center gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
        >
          <X size={12} aria-hidden="true" />
          Clear
        </button>
      )}
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{data ? `${data.total.toLocaleString()} entries` : ''}</span>
    </div>
  );

  return (
    <PageLayout eyebrow="System" title="Audit Log" headerSlot={filterBar} headerBorder fullHeight>
      <div className="h-full flex flex-col">
        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-2 pt-1">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No audit logs found"
              description={hasFilters ? 'Try adjusting your filters.' : 'Actions performed in the system will appear here.'}
            />
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="text-left pb-2.5 pr-4 w-36">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Action</span>
                  </th>
                  <th className="text-left pb-2.5 pr-4">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resource</span>
                  </th>
                  <th className="text-left pb-2.5 pr-4 w-44">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">User</span>
                  </th>
                  <th className="text-left pb-2.5 w-44">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Time</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 pb-1 shrink-0 border-t border-border mt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-surface-offset transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              Prev
            </button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-surface-offset transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
