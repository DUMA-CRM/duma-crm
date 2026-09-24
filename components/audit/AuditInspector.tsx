'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Fingerprint,
  Globe,
  Layers3,
  Link2,
  ListView,
  Mail,
  Monitor,
  Route,
  Shield,
  ShieldCheck,
  Timer,
  User,
} from '@/components/icons';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';

import { auditChangeSet, shortId } from '@/lib/audit/change';
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
  resourceLabel,
  severityClass,
} from '@/lib/audit/narrative';
import { type AuditLog, parseAuditMeta } from '@/lib/modules/compliance/client';
import { cn } from '@/lib/utils/cn';

import { AuditGlyph, auditIcon } from './AuditGlyph';
import { auditRecordLink } from './auditLinks';

/** Same boxed-annotation construction as the table's status cell. */
const INSPECTOR_TONE: Record<AuditStatus['tone'], string> = {
  success: 'border-momentum/30 bg-momentum/8 text-momentum',
  warning: 'border-measured/40 bg-measured/8 text-measured',
  exception: 'border-exception/30 bg-exception/8 text-exception',
};

/**
 * The workbench beside the ledger, ordered by what an auditor asks:
 *
 *   1. What changed        — the point of the record
 *   2. The record          — who, in what role, on what, when, and a way in
 *   3. Trace from here     — the three follow-up questions
 *   4. Technical detail    — collapsed; the request, the payloads, the IDs
 *
 * Step four is a real layer, not a drawer for undecided things: everything in
 * it is a support fact — how the change reached the server — rather than an
 * audit fact about the change itself.
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
  chrome?: 'panel' | 'drawer';
}

export function AuditInspector({ log, activeActorId, activeAction, activeResourceId, onPivot, chrome = 'panel' }: InspectorProps) {
  if (!log) return <InspectorPlaceholder />;

  const severity = auditSeverity(log);
  const domain = auditDomain(log.resourceType);
  const chip = auditStatus(severity, log.statusCode);
  const duration = formatDuration(log.durationMs);
  const role = auditRole(log);
  const link = auditRecordLink(log);
  const { changes, facts, hasPayload } = auditChangeSet(log);
  const rawMeta = parseAuditMeta(log.metadata);
  const rawResponse = parseAuditMeta(log.response);

  const pivots: (AuditPivot & { applied: boolean; short: string; icon: typeof User; available: boolean })[] = [
    {
      kind: 'actor',
      value: log.userId ?? '',
      short: 'This actor',
      icon: User,
      label: log.userId ? `Everything by ${auditActor(log)}` : 'This entry has no signed-in actor to trace',
      applied: !!log.userId && activeActorId === log.userId,
      available: !!log.userId,
    },
    {
      kind: 'resourceId',
      value: log.resourceId ?? '',
      short: 'This record',
      icon: Layers3,
      label: log.resourceId ? 'Everything that happened to this record' : 'This entry names no single record to trace',
      applied: !!log.resourceId && activeResourceId === log.resourceId,
      available: !!log.resourceId,
    },
    {
      kind: 'action',
      value: log.action,
      short: 'This action',
      icon: Activity,
      label: `Every “${auditPhrase(log)}”`,
      applied: activeAction === log.action,
      available: true,
    },
  ];

  const body = (
    <>
      {/* Stated for every entry, not only the ones that went wrong — otherwise
          a reader cannot tell "this succeeded" from "the panel forgot to say". */}
      <p
        className={cn(
          'mb-4 inline-flex items-center rounded-sm border px-2 py-0.5 text-micro font-semibold tracking-micro uppercase',
          INSPECTOR_TONE[chip.tone],
        )}
      >
        {chip.label}
      </p>

      {/* 1 — What changed */}
      <SectionLabel>What changed</SectionLabel>
      {changes.length > 0 || facts.length > 0 ? (
        <dl className="mt-2 divide-y divide-rule/60 rounded-sm border border-rule bg-field px-3">
          {changes.map((change) => (
            <div key={change.label} className="flex items-baseline gap-3 py-2">
              <dt className="w-28 shrink-0 text-xs text-muted-foreground">{change.label}</dt>
              <dd className="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5 text-sm text-foreground">
                {change.before !== undefined && (
                  <>
                    <span className="text-muted-foreground line-through decoration-muted-foreground/50">{change.before}</span>
                    <ArrowRight size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  </>
                )}
                <span className="font-medium wrap-break-word">{change.after}</span>
              </dd>
            </div>
          ))}
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline gap-3 py-2">
              <dt className="w-28 shrink-0 text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="min-w-0 flex-1 text-sm wrap-break-word text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {hasPayload
            ? 'This entry recorded no field-level detail — only that the action happened.'
            : 'No payload was stored with this entry.'}
        </p>
      )}
      {changes.some((change) => change.before === undefined) && changes.every((change) => change.before === undefined) && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          These are the values that were set. The API stores no prior values for this action, so there is nothing to compare against.
        </p>
      )}

      {/* 2 — The record */}
      <SectionLabel className="mt-5">Record</SectionLabel>
      <InfoGroup className="mt-2 bg-field">
        <InfoRow icon={User} label="Actor" value={auditActor(log)} hint={role ?? undefined} />
        {log.userEmail && <InfoRow icon={Mail} label="Email" value={log.userEmail} copyable />}
        {!role && <InfoRow icon={Shield} label="Role" value={null} missingLabel="Not recorded" />}
        <InfoRow icon={ListView} label="Record type" value={resourceLabel(log.resourceType)} />
        <InfoRow icon={Timer} label="When" value={fullTimestamp(log.createdAt)} />
      </InfoGroup>

      {link && (
        <Link
          href={link.href}
          className="mt-2 flex items-center gap-2 rounded-sm border border-rule bg-field px-2.5 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/45 hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ExternalLink size={13} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            {link.exact ? 'Open this record' : `Open ${resourceLabel(log.resourceType).toLowerCase()}`}
          </span>
          {!link.exact && <span className="shrink-0 text-micro tracking-micro uppercase text-muted-foreground">Section</span>}
        </Link>
      )}

      {/* 3 — Pivots */}
      <SectionLabel className="mt-5">Trace from here</SectionLabel>
      <p className="mt-1 text-xs text-muted-foreground">Searches the whole log — the date range clears.</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {pivots.map((pivot) => (
          <PivotButton key={pivot.kind} pivot={pivot} icon={pivot.icon} onPivot={onPivot} />
        ))}
      </div>

      {/* 4 — Technical detail */}
      <details className="group mt-5 rounded-sm border border-rule bg-field">
        {/* Safari keeps its own triangle unless the webkit marker is hidden too. */}
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <ChevronDown
            size={13}
            className="shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
            aria-hidden="true"
          />
          Technical detail
          <span className="ml-auto text-micro tracking-micro uppercase text-muted-foreground">How it reached the server</span>
        </summary>
        <div className="border-t border-rule px-3 pt-1 pb-3">
          <InfoGroup className="border-0 bg-transparent px-0">
            {log.resourceId && <InfoRow icon={Link2} label="Record ID" value={log.resourceId} copyable />}
            {log.method && <InfoRow icon={Route} label="Method" value={log.method} />}
            {log.path && <InfoRow icon={Link2} label="Path" value={log.path} copyable />}
            {log.statusCode != null && <InfoRow icon={ShieldCheck} label="Status code" value={String(log.statusCode)} />}
            {duration && <InfoRow icon={Timer} label="Duration" value={duration} />}
            {log.requestId && <InfoRow icon={Fingerprint} label="Request ID" value={log.requestId} copyable />}
            {log.ipAddress && <InfoRow icon={Globe} label="IP address" value={log.ipAddress} copyable />}
            {log.userAgent && <InfoRow icon={Monitor} label="Device" value={log.userAgent} />}
            {log.tenantId && <InfoRow icon={Building2} label="Workspace ID" value={log.tenantId} copyable />}
            <InfoRow icon={Activity} label="Action key" value={log.action} copyable />
            <InfoRow icon={ListView} label="Resource key" value={log.resourceType} copyable />
            {log.userId && <InfoRow icon={User} label="User ID" value={shortId(log.userId)} copyable />}
          </InfoGroup>

          <JsonBlock title="Raw metadata" value={rawMeta} />
          <JsonBlock title="Raw response" value={rawResponse} />
        </div>
      </details>
    </>
  );

  if (chrome === 'drawer') return <div>{body}</div>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Identity of the entry — stays put while the detail below scrolls. */}
      <div className="flex shrink-0 items-start gap-3 border-b border-rule bg-surface px-4 py-3.5">
        <AuditGlyph icon={auditIcon(log, severity)} size={16} className={cn('size-9', severityClass(severity, domain))} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-foreground">
            <span className="font-semibold">{auditActor(log)}</span>
            {role && <span className="text-muted-foreground"> ({role})</span>} {auditPhrase(log)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{fullTimestamp(log.createdAt)}</p>
        </div>
        <AuditCopyButton value={JSON.stringify(log, null, 2)} label="entry as JSON" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{body}</div>
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-micro font-semibold tracking-micro uppercase text-muted-foreground', className)}>{children}</p>;
}

/**
 * A magnetic label: glyph over a short name, with the full promise carried in
 * the accessible name and the hover title so the tile stays terse without the
 * button becoming vague about what it will do.
 */
function PivotButton({
  pivot,
  icon: Icon,
  onPivot,
}: {
  pivot: AuditPivot & { applied: boolean; short: string; available: boolean };
  icon: typeof User;
  onPivot: (pivot: AuditPivot) => void;
}) {
  const disabled = pivot.applied || !pivot.available;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPivot({ kind: pivot.kind, value: pivot.value, label: pivot.label })}
      title={pivot.applied ? `Already filtered: ${pivot.label}` : pivot.label}
      aria-label={pivot.label}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-sm border px-1 py-2.5 text-center transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        disabled
          ? 'cursor-default border-rule/50 bg-transparent text-muted-foreground'
          : 'border-rule bg-field text-foreground shadow-sm hover:border-primary/45 hover:bg-band',
      )}
    >
      <Icon size={15} className={cn('shrink-0', disabled ? 'text-muted-foreground' : 'text-primary')} aria-hidden="true" />
      <span className="w-full truncate text-xs font-medium">{pivot.applied ? 'Applied' : pivot.short}</span>
    </button>
  );
}

function InspectorPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-sm border border-rule bg-field text-muted-foreground">
        <ListView size={18} aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">Pick an entry to inspect it</p>
        <p className="mt-1 text-xs text-muted-foreground">What changed, who did it, and a way into the record.</p>
      </div>
      <dl className="mt-1 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Key>↑</Key>
          <Key>↓</Key>
          <dd>step through entries</dd>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Key>/</Key>
          <dd>jump to search</dd>
        </div>
      </dl>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <dt className="flex h-5 min-w-5 items-center justify-center rounded-sm border border-rule/70 bg-band px-1 text-micro font-semibold text-foreground">
      {children}
    </dt>
  );
}

function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  if (!value) return null;
  const serialised = JSON.stringify(value, null, 2);

  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-2">
        <SectionLabel>{title}</SectionLabel>
        <AuditCopyButton value={serialised} label={title.toLowerCase()} />
      </div>
      <pre className="mt-1.5 overflow-x-auto rounded-sm border border-rule bg-background px-3 py-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-muted-foreground">
        {serialised}
      </pre>
    </>
  );
}

export function AuditCopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      aria-label={copied ? 'Copied' : `Copy ${label}`}
      className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {copied ? <Check size={13} className="text-momentum" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  );
}
