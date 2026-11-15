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
  Clock,
  ExternalLink,
  type IconComponent,
  Layers3,
  User,
  X,
} from '@/components/icons';
import { Avatar } from '@/components/shared/Avatar';
import { CopyGlyph } from '@/components/ui/action-button';

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
 *   2. Who and when     — the person, their role, the moment and the record
 *   3. See more         — open the record; everything by them, on it, or like this
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
          <dl className="overflow-hidden rounded-lg border border-border bg-card">
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
        {onlyNewValues && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Earlier values weren’t recorded.</p>}
      </section>

      {/* Who and when, then where to go next — both as the same rows: tile, line, action. */}
      <section>
        <SectionTitle>Who and when</SectionTitle>
        <ul className="overflow-hidden rounded-lg border border-border bg-card">
          {/* In the drawer the title already names who and the description says when. */}
          {chrome === 'drawer' ? (
            log.userEmail && (
              <PanelRow
                tile={<RowIcon icon={User} />}
                title={log.userEmail}
                trailing={<AuditCopyButton value={log.userEmail} label="email" />}
              />
            )
          ) : (
            <PanelRow
              tile={<Avatar name={auditActor(log)} email={log.userEmail} size="sm" />}
              title={auditActor(log)}
              detail={[role ?? 'Role not recorded', log.userEmail].filter(Boolean).join(' · ')}
              trailing={log.userEmail && <AuditCopyButton value={log.userEmail} label="email" />}
            />
          )}
          {chrome !== 'drawer' && <PanelRow tile={<RowIcon icon={Clock} />} title={fullTimestamp(log.createdAt)} detail="When" />}
          <PanelRow tile={<RowIcon icon={Layers3} />} title={resourceLabel(log.resourceType)} detail="Record" />
        </ul>
      </section>

      <section>
        <SectionTitle>See more</SectionTitle>
        <ul className="overflow-hidden rounded-lg border border-border bg-card">
          {link && (
            <PanelRow
              href={link.href}
              tile={<RowIcon icon={ExternalLink} />}
              title={link.exact ? 'Open this record' : `Open ${resourceLabel(log.resourceType).toLowerCase()}`}
              trailing={<ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
            />
          )}
          {pivots.map((pivot) => {
            const disabled = pivot.applied || !pivot.available;
            return (
              <PanelRow
                key={pivot.kind}
                onClick={disabled ? undefined : () => onPivot({ kind: pivot.kind, value: pivot.value, label: pivot.label })}
                disabled={disabled}
                tile={<RowIcon icon={pivot.icon} muted={disabled} />}
                title={pivot.label}
                trailing={
                  pivot.applied ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                      <Check size={13} aria-hidden="true" /> Showing
                    </span>
                  ) : (
                    pivot.available && <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  )
                }
              />
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
      <header className="flex shrink-0 items-start gap-3 border-b border-border bg-surface px-5 py-4">
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
  return <h3 className="mb-2 text-sm font-semibold text-heading">{children}</h3>;
}

/** A tinted icon tile, the size the rows share. */
function RowIcon({ icon: Icon, muted = false }: { icon: IconComponent; muted?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md',
        muted ? 'bg-band text-muted-foreground' : 'bg-primary/8 text-primary',
      )}
    >
      <Icon size={15} aria-hidden="true" />
    </span>
  );
}

/**
 * One row of the panel's lists — a tile, a line (and a muted line under it), something on
 * the right. A link with `href`, a button with `onClick`, otherwise a plain fact.
 */
function PanelRow({
  tile,
  title,
  detail,
  trailing,
  href,
  onClick,
  disabled = false,
}: {
  tile: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const body = (
    <>
      {tile}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm', disabled ? 'text-muted-foreground' : 'text-foreground', detail && 'font-semibold')}>
          {title}
        </span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
      {trailing}
    </>
  );
  const rowClass = 'flex w-full items-center gap-3 px-3.5 py-2.5 text-left';
  const interactive =
    'transition-colors hover:bg-band/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';
  return (
    <li className="border-b border-border last:border-b-0">
      {href ? (
        <Link href={href} className={cn(rowClass, interactive)}>
          {body}
        </Link>
      ) : onClick || disabled ? (
        <button type="button" disabled={disabled} onClick={onClick} className={cn(rowClass, disabled ? 'cursor-default' : interactive)}>
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

function Row({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0">
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
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        Technical details
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
            className="overflow-hidden border-t border-border"
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
            <div className="space-y-3 border-t border-border p-3.5">
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
      <CopyGlyph copied={copied} size={13} className="size-3.25 text-momentum" />
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
      <CopyGlyph copied={copied} size={13} className="size-3.25 text-momentum" />
    </button>
  );
}
