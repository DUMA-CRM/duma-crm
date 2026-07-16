'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, ExternalLink, History, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { type AuditLog, getAuditLogs } from '@/lib/api/audit.service';
import { cn } from '@/lib/utils/cn';

// ── Helpers ───────────────────────────────────────────────────────────────────

function actionColor(action: string) {
  if (/delete|remove/i.test(action)) return 'text-destructive bg-destructive/10';
  if (/create|add/i.test(action)) return 'text-success bg-success/10';
  if (/update|patch|edit/i.test(action)) return 'text-primary bg-primary/10';
  if (/transfer|receive|adjust/i.test(action)) return 'text-warning bg-warning/10';
  return 'text-muted-foreground bg-muted';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function humanise(str: string) {
  return str.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLog }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span
        className={cn(
          'mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md whitespace-nowrap',
          actionColor(log.action),
        )}
      >
        {humanise(log.action)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground font-medium truncate leading-snug">{humanise(log.resourceType)}</p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 leading-none">
          <Clock size={10} aria-hidden="true" className="shrink-0" />
          {formatTime(log.createdAt)}
          {log.userName && <span className="truncate">· {log.userName}</span>}
        </p>
      </div>
    </div>
  );
}

// ── Popup ─────────────────────────────────────────────────────────────────────

interface AuditDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function AuditDrawer({ open, onClose }: AuditDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    // Small delay so the click that opened the panel doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('pointerdown', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('pointerdown', handler);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs-preview'],
    queryFn: () => getAuditLogs({ limit: 12 }),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });

  const logs = data?.data ?? [];

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed top-14 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)]',
        'bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden',
        'animate-in fade-in slide-in-from-top-2 duration-150',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <History size={15} className="text-primary" aria-hidden="true" />
          <span className="font-semibold text-sm text-foreground">Activity</span>
          {data && <span className="text-xs text-muted-foreground">· {data.total} total</span>}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/audit-log"
            onClick={onClose}
            className="h-8 px-2.5 flex items-center gap-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <ExternalLink size={11} aria-hidden="true" />
            View all
          </Link>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-offset transition-colors"
            aria-label="Close"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto px-4 py-1">
        {isLoading ? (
          <div className="flex flex-col gap-3 py-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-5 w-20 bg-muted rounded-md animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <History size={24} className="text-muted-foreground opacity-40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          </div>
        ) : (
          <div>
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {logs.length > 0 && (
        <div className="px-4 py-3 border-t border-border shrink-0">
          <Link
            href="/audit-log"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full h-9 rounded-xl bg-surface-offset hover:bg-muted text-sm font-medium text-foreground transition-colors"
          >
            Open full audit log
            <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
