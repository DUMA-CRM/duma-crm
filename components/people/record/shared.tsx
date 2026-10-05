'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { Check, Copy } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';

import { getEmployee } from '@/lib/modules/people/client';
import { cn } from '@/lib/utils/cn';
import { monthRangeOf } from '@/lib/utils/employee-record';

/* The pieces more than one section of the record needs. */

/** The employee record as the API returns it. */
export type Employee = Awaited<ReturnType<typeof getEmployee>>;

// Current + previous month range presets for the hours view.
export function monthRange(offset: number): { from: string; to: string; label: string } {
  return monthRangeOf(new Date(), offset);
}

/** The copy action for a row. */
export function CopyButton({ value, label }: { value: string; label: string }) {
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
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
    >
      {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
    </button>
  );
}

// ── Audit-log rows ───────────────────────────────────────────────────────────

/** The audit log's domain tints, so a record's rows colour the way its history does. */
const ROW_TONE = {
  team: 'bg-momentum/8 text-momentum',
  money: 'bg-measured/8 text-measured',
  reference: 'bg-reference/8 text-reference',
  muted: 'bg-band text-muted-foreground',
  missing: 'bg-exception/8 text-exception',
} as const;

const PILL_TONE = {
  success: 'bg-momentum/8 text-momentum',
  warning: 'bg-measured/10 text-measured',
  exception: 'bg-exception/8 text-exception',
} as const;

const INTERACTIVE =
  'transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';

/** A list of `RecordListRow`s in the audit log's frame: one hairline box, rows divided inside it. */
export function RecordList({ children }: { children: React.ReactNode }) {
  return <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">{children}</ul>;
}

/**
 * One fact drawn as an audit-log row: a tinted icon tile, the value in bold,
 * what it is (and any detail) muted underneath, and on the right a status pill
 * only when something is off — a complete row says nothing extra.
 */
export function RecordListRow({
  icon: Icon,
  tone = 'team',
  label,
  value,
  detail,
  missing,
  placeholder = 'Not set',
  pill,
  trailing,
  href,
  onSelect,
}: {
  icon: IconComponent;
  tone?: keyof typeof ROW_TONE;
  /** What the value is — the muted second line. */
  label: string;
  value?: React.ReactNode;
  /** Appended to the label line, e.g. "Mon, Tue, Thu, Fri". */
  detail?: string;
  /** Shown in place of an empty value; with it, the row takes the exception tint and a "Missing" pill. */
  missing?: string;
  /** Shown for an empty value that is fine as it is (no tint, no pill). */
  placeholder?: string;
  pill?: { label: string; tone: keyof typeof PILL_TONE };
  trailing?: React.ReactNode;
  /** Makes the row a link — the audit log's hover, the whole row the target. */
  href?: string;
  /** Like `href`, for a row that opens something in place (a modal). */
  onSelect?: () => void;
}) {
  const empty = value === undefined || value === null || value === '' || value === false;
  const flagged = empty && missing !== undefined;
  const status = pill ?? (flagged ? { label: 'Missing', tone: 'warning' as const } : undefined);
  const body = (
    <>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', flagged ? ROW_TONE.missing : ROW_TONE[tone])}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm', empty ? 'text-muted-foreground' : 'font-semibold text-foreground')}>
          {empty ? (missing ?? placeholder) : value}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {label}
          {detail && ` · ${detail}`}
        </span>
      </span>
      {status && <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', PILL_TONE[status.tone])}>{status.label}</span>}
      {trailing && <span className="shrink-0 text-xs text-muted-foreground">{trailing}</span>}
    </>
  );
  const row = 'flex items-center gap-3 px-3.5 py-3';
  return (
    <li className="border-b border-rule/45 last:border-b-0">
      {href ? (
        <Link href={href} className={cn(row, INTERACTIVE)}>
          {body}
        </Link>
      ) : onSelect ? (
        <button type="button" onClick={onSelect} className={cn(row, 'w-full text-left', INTERACTIVE)}>
          {body}
        </button>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

/**
 * A heading and what sits under it, straight on the page — the audit log's
 * shape. The list is already a bordered box, so no panel goes around it.
 */
export function RecordBlock({
  id,
  title,
  label,
  action,
  note,
  children,
}: {
  id: string;
  /** Omit when the rows name themselves; pass `label` then, for assistive tech. */
  title?: string;
  label?: string;
  action?: React.ReactNode;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={SECTION_RISE}
      id={id}
      aria-labelledby={title ? `${id}-title` : undefined}
      aria-label={title ? undefined : label}
      className="scroll-mt-6"
    >
      {(title || action) && (
        <div className="mb-3 flex min-h-8 items-center gap-3">
          {title && (
            <h2 id={`${id}-title`} className="flex-1 text-base font-semibold tracking-title text-foreground">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
      {note && <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </motion.section>
  );
}

// The form parts moved to `components/shared/FormParts.tsx` so the orders
// screens can use them too; re-exported here for the record's files.
export { ChoiceCards, ModalActions, NumberStepper } from '@/components/shared/FormParts';
