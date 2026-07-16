'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ChevronDown,
  Clock,
  Fingerprint,
  Globe,
  History,
  Link2,
  Mail,
  Monitor,
  Route,
  Shield,
  ShieldCheck,
  Timer,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';

import { type AuditLog, getAuditLogs, parseAuditMeta } from '@/lib/api/audit.service';
import { cn } from '@/lib/utils/cn';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  franchise_owner: 'Franchise Owner',
  store_manager: 'Store Manager',
  barista: 'Barista',
  hr_manager: 'HR Manager',
  marketing_manager: 'Marketing',
  auditor: 'Auditor',
};

function fmtDuration(ms?: number | null) {
  if (ms == null) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function statusColor(code?: number | null) {
  if (code == null) return 'bg-muted text-muted-foreground';
  if (code < 300) return 'bg-success/10 text-success';
  if (code < 400) return 'bg-primary/10 text-primary';
  if (code < 500) return 'bg-warning/10 text-warning';
  return 'bg-destructive/10 text-destructive';
}

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

// ── Detail panel (details + metadata) ──────────────────────────────────────────

function AuditDetailPanel({ log }: { log: AuditLog }) {
  const meta = parseAuditMeta(log.metadata);
  const response = parseAuditMeta(log.response);
  const duration = fmtDuration(log.durationMs);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
      {/* Details */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Details</p>
        <InfoGroup>
          <InfoRow icon={User} label="Actor" value={log.userName ?? 'System / anonymous'} />
          {log.userRole && <InfoRow icon={Shield} label="Role" value={ROLE_LABEL[log.userRole] ?? log.userRole} />}
          {log.userEmail && <InfoRow icon={Mail} label="Email" value={log.userEmail} copyable />}
          {log.method && <InfoRow icon={Route} label="Method" value={log.method} />}
          {log.path && <InfoRow icon={Link2} label="Path" value={log.path} copyable />}
          {log.statusCode != null && <InfoRow icon={ShieldCheck} label="Status" value={String(log.statusCode)} />}
          {duration && <InfoRow icon={Timer} label="Duration" value={duration} />}
          {log.tenantId && <InfoRow icon={Building2} label="Tenant" value={log.tenantId} copyable />}
          {log.resourceId && <InfoRow icon={Link2} label="Resource ID" value={log.resourceId} copyable />}
          {log.ipAddress && <InfoRow icon={Globe} label="IP address" value={log.ipAddress} copyable />}
          {log.requestId && <InfoRow icon={Fingerprint} label="Request ID" value={log.requestId} copyable />}
          {log.userAgent && <InfoRow icon={Monitor} label="User agent" value={log.userAgent} />}
        </InfoGroup>
      </div>

      {/* Metadata + response */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Metadata</p>
        {meta ? (
          <pre className="text-xs text-muted-foreground bg-background border border-border rounded-xl px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(meta, null, 2)}
          </pre>
        ) : (
          <p className="text-[11px] text-muted-foreground">No metadata.</p>
        )}

        {response && (
          <>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Response</p>
            <pre className="text-xs text-muted-foreground bg-background border border-border rounded-xl px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(response, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const duration = fmtDuration(log.durationMs);

  return (
    <>
      <tr
        className="group border-b border-border/50 transition-colors align-top cursor-pointer hover:bg-surface-offset"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-5 py-4 w-6 align-top">
          <ChevronDown
            size={14}
            className={cn('text-muted-foreground transition-transform duration-150 mt-0.5', open && 'rotate-180')}
            aria-hidden="true"
          />
        </td>
        <td className="px-5 py-4 w-40 align-top">
          <span
            className={cn(
              'inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border whitespace-nowrap',
              actionColor(log.action),
            )}
          >
            {humanise(log.action)}
          </span>
        </td>
        <td className="px-5 py-4 align-top">
          <p className="text-sm font-medium text-foreground leading-snug">{humanise(log.resourceType)}</p>
          {(log.method || log.path) && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5 opacity-70 truncate max-w-md">
              {log.method && <span className="font-semibold">{log.method}</span>} {log.path}
            </p>
          )}
        </td>
        <td className="px-5 py-4 w-48 align-top">
          {log.userName || log.userEmail ? (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-foreground leading-snug truncate max-w-36">{log.userName ?? '—'}</p>
                {log.userRole && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {ROLE_LABEL[log.userRole] ?? log.userRole}
                  </span>
                )}
              </div>
              {log.userEmail && <p className="text-xs text-muted-foreground truncate max-w-44 mt-0.5">{log.userEmail}</p>}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">System / anonymous</span>
          )}
        </td>
        <td className="px-5 py-4 pr-6 w-44 align-top">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
            <Clock size={11} aria-hidden="true" className="shrink-0" />
            {formatDate(log.createdAt)}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            {log.statusCode != null && (
              <span className={cn('text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md', statusColor(log.statusCode))}>
                {log.statusCode}
              </span>
            )}
            {duration && <span className="text-[11px] text-muted-foreground tabular-nums">{duration}</span>}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border/50 bg-surface-offset/50">
          <td colSpan={5} className="px-8 pt-3 pb-5">
            <AuditDetailPanel log={log} />
          </td>
        </tr>
      )}
    </>
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
        {/* Audit table */}
        <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted">
                  <th className="px-5 py-3.5 w-6" />
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-40">
                    Action
                  </th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resource</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-48">User</th>
                  <th className="px-5 py-3.5 pr-6 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-44">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 13 + j * 17) % 40)}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-24">
                      <EmptyState
                        icon={History}
                        title="No audit logs found"
                        description={hasFilters ? 'Try adjusting your filters.' : 'Actions performed in the system will appear here.'}
                      />
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => <LogRow key={log.id} log={log} />)
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
              <p className="text-xs text-muted-foreground tabular-nums">
                Page {page} of {totalPages} · {(data?.total ?? 0).toLocaleString()} entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-surface-offset transition-colors disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-surface-offset transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
