'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import {
  Activity,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  type IconComponent,
  Layers3,
  User,
  X,
} from '@/components/icons';

import { auditChangeSet } from '@/lib/audit/change';
import {
  type AuditStatus,
  auditActor,
  auditDomain,
  auditPhrase,
  auditRole,
  auditSeverity,
  auditStatus,
  formatDuration,
  fullTimestamp,
  relativeTime,
  resourceLabel,
  severityClass,
} from '@/lib/audit/narrative';
import { actionPhrase } from '@/lib/audit/vocabulary';
import { type AuditLog, parseAuditMeta } from '@/lib/modules/audit/client';
import { cn } from '@/lib/utils/cn';

import { AuditGlyph, auditIcon } from './AuditGlyph';
import { auditRecordLink } from './auditLinks';

const EASE = [0.16, 1, 0.3, 1] as const;

const STATUS_TONE: Record<AuditStatus['tone'], string> = {
  success: 'bg-momentum/8 text-momentum',
  warning: 'bg-measured/10 text-measured',
  exception: 'bg-exception/8 text-exception',
};

/**
 * One audit entry, read top to bottom in the order an owner asks:
 *
 *   1. What changed     — the point of the entry
 *   2. Who and when     — the person, their role, the moment, and a way in
 *   3. See more         — everything by them, on this record, or like this
 *   4. Technical details — folded away: the request, the payloads, the IDs
 *
 * `chrome="drawer"` drops the header and the inner scroller for the narrow
 * layout, where the shared Drawer already owns both.
 */

export type AuditPivotKind = 'actor' | 'action' | 'resourceId';

export interface AuditPivot {
  kind: AuditPivotKind;
  value: string;
  label: string;
}

interface InspectorProps {
  log: AuditLog | null;
  activeActorId: string;
  activeAction: string;
  activeResourceId: string;
  onPivot: (pivot: AuditPivot) => void;
  /** Panel only — the drawer has its own close. */
  onClose?: () => void;
  /** The page's clock, for "5m ago"; omitted, the exact time shows instead. */
  now?: number;
  chrome?: 'panel' | 'drawer';
}

export function AuditInspector({
  log,
  activeActorId,
  activeAction,
  activeResourceId,
  onPivot,
  onClose,
  now,
  chrome = 'panel',
}: InspectorProps) {
  if (!log) return null;

  const severity = auditSeverity(log);
  const status = auditStatus(severity, log.statusCode);
  const role = auditRole(log);
  const link = auditRecordLink(log);
  const { changes, facts, hasPayload } = auditChangeSet(log);
  const onlyNewValues = changes.length > 0 && changes.every((change) => change.before === undefined);

  const pivots: (AuditPivot & { icon: IconComponent; applied: boolean; available: boolean })[] = [
    {
      kind: 'actor',
      value: log.userId ?? '',
      icon: User,
      label: log.userId ? `Everything by ${auditActor(log)}` : 'No signed-in person to follow',
      applied: !!log.userId && activeActorId === log.userId,
      available: !!log.userId,
    },
    {
      kind: 'resourceId',
      value: log.resourceId ?? '',
      icon: Layers3,
      label: log.resourceId ? 'Everything on this record' : 'Not tied to one record',
      applied: !!log.resourceId && activeResourceId === log.resourceId,
      available: !!log.resourceId,
    },
    {
      kind: 'action',
      value: log.action,
      icon: Activity,
      label: `Every time someone ${actionPhrase(log.action, log.resourceType)}`,
      applied: activeAction === log.action,
      available: true,
    },
  ];

  const body = (
    <div className="space-y-6">
      <section>
        <SectionTitle>What changed</SectionTitle>
        {changes.length > 0 || facts.length > 0 ? (
          <dl className="overflow-hidden rounded-lg border border-rule/60 bg-field">
            {changes.map((change) => (
              <Row key={change.label} label={change.label}>
                {change.before !== undefined && (
                  <>
                    <span className="text-muted-foreground line-through decoration-muted-foreground/50">{change.before}</span>
                    <ArrowRight size={12} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  </>
                )}
                <span className="font-semibold wrap-break-word">{change.after}</span>
              </Row>
            ))}
            {facts.map((fact) => (
              <Row key={fact.label} label={fact.label}>
                <span className="wrap-break-word">{fact.value}</span>
              </Row>
            ))}
          </dl>
        ) : (
          <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
            {hasPayload ? 'Only that it happened — no field-level detail was recorded.' : 'No details were stored with this entry.'}
          </p>
        )}
        {onlyNewValues && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">These are the new values. Earlier ones weren’t recorded.</p>
        )}
      </section>

      <section>
        <SectionTitle>Who and when</SectionTitle>
        <div className="overflow-hidden rounded-lg border border-rule/60 bg-field">
          <div className="flex items-center gap-3 px-3.5 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
              {initials(auditActor(log))}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{auditActor(log)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[role ?? 'Role not recorded', log.userEmail].filter(Boolean).join(' · ')}
              </p>
            </div>
            {log.userEmail && <AuditCopyButton value={log.userEmail} label="email" />}
          </div>
          <dl className="border-t border-rule/50">
            <Row label="When">
              <span>{fullTimestamp(log.createdAt)}</span>
            </Row>
            <Row label="Record">
              <span>{resourceLabel(log.resourceType)}</span>
            </Row>
          </dl>
        </div>
        {link && (
          <Link
            href={link.href}
            className="mt-2 flex h-10 items-center justify-center gap-2 rounded-md border border-rule/70 bg-field text-sm font-semibold text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ExternalLink size={14} className="text-primary" aria-hidden="true" />
            {link.exact ? 'Open this record' : `Open ${resourceLabel(log.resourceType).toLowerCase()}`}
          </Link>
        )}
      </section>

      <section>
        <SectionTitle>See more</SectionTitle>
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-field">
          {pivots.map((pivot) => {
            const Icon = pivot.icon;
            const disabled = pivot.applied || !pivot.available;
            return (
              <li key={pivot.kind} className="border-b border-rule/45 last:border-b-0">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPivot({ kind: pivot.kind, value: pivot.value, label: pivot.label })}
                  className={cn(
                    'flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                    disabled ? 'cursor-default text-muted-foreground' : 'text-foreground hover:bg-band/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-md',
                      disabled ? 'bg-band text-muted-foreground' : 'bg-primary/8 text-primary',
                    )}
                  >
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{pivot.label}</span>
                  {pivot.applied ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                      <Check size={13} aria-hidden="true" /> Showing
                    </span>
                  ) : (
                    pivot.available && <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <TechnicalDetails log={log} />
    </div>
  );

  if (chrome === 'drawer') return body;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-start gap-3 border-b border-rule/60 bg-surface px-5 py-4">
        <AuditGlyph
          icon={auditIcon(log, severity)}
          size={18}
          className={cn('size-11 rounded-lg', severityClass(severity, auditDomain(log.resourceType)))}
        />
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug text-foreground">
            <span className="font-semibold">{auditActor(log)}</span> {auditPhrase(log)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {/* Stated for every entry, so "it worked" is never left to be inferred. */}
            <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', STATUS_TONE[status.tone])}>{status.label}</span>
            <span title={fullTimestamp(log.createdAt)}>{now ? relativeTime(log.createdAt, now) : fullTimestamp(log.createdAt)}</span>
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="-mr-1.5 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{body}</div>
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-foreground">{children}</h3>;
}

function Row({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0">
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5 text-sm text-foreground',
          mono && 'font-mono text-xs break-all',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function initials(name: string) {
  const parts = name.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** How the change reached the server — for support, not for the owner, so it starts folded. */
function TechnicalDetails({ log }: { log: AuditLog }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const duration = formatDuration(log.durationMs);
  const rows: [string, string | null | undefined, boolean?][] = [
    ['Record ID', log.resourceId, true],
    ['Request', log.method && log.path ? `${log.method} ${log.path}` : log.path, true],
    ['Status', log.statusCode != null ? String(log.statusCode) : null],
    ['Duration', duration],
    ['Request ID', log.requestId, true],
    ['IP address', log.ipAddress, true],
    ['Device', log.userAgent],
    ['Action key', log.action, true],
    ['User ID', log.userId, true],
    ['Workspace ID', log.tenantId, true],
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-rule/60 bg-field">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        Technical details
        <span className="font-normal text-muted-foreground">· for support</span>
        <ChevronDown
          size={15}
          className={cn('ml-auto shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden border-t border-rule/50"
          >
            <dl>
              {rows
                .filter(([, value]) => value)
                .map(([label, value, mono]) => (
                  <Row key={label} label={label} mono={mono}>
                    <span className="min-w-0 flex-1">{value}</span>
                    {mono && <AuditCopyButton value={value!} label={label.toLowerCase()} />}
                  </Row>
                ))}
            </dl>
            <div className="space-y-3 border-t border-rule/50 p-3.5">
              <JsonBlock title="Request body" value={parseAuditMeta(log.metadata)} />
              <JsonBlock title="Response" value={parseAuditMeta(log.response)} />
              <div className="flex justify-end">
                <CopyTextButton value={JSON.stringify(log, null, 2)}>Copy entry as JSON</CopyTextButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  if (!value) return null;
  const serialised = JSON.stringify(value, null, 2);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <AuditCopyButton value={serialised} label={title.toLowerCase()} />
      </div>
      <pre className="max-h-64 overflow-auto rounded-md bg-background px-3 py-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-muted-foreground">
        {serialised}
      </pre>
    </div>
  );
}

function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
}

function CopyTextButton({ value, children }: { value: string; children: React.ReactNode }) {
  const { copied, copy } = useCopy(value);
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {copied ? <Check size={13} className="text-momentum" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {copied ? 'Copied' : children}
    </button>
  );
}

export function AuditCopyButton({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopy(value);
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? 'Copied' : `Copy ${label}`}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {copied ? <Check size={13} className="text-momentum" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  );
}
