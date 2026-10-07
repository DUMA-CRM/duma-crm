'use client';

import Link from 'next/link';

import { ArrowUpRight, type IconComponent } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

/*
 * The drawer a report row opens: what that one refund, item, delivery or day
 * was, in full, with the way on to where it can be acted on. One set of parts,
 * so every report's drawer reads the same — figures in a grid, details as a
 * hairline list, actions as links in the footer.
 */

export interface DrawerLink {
  label: string;
  href: string;
  icon?: IconComponent;
  primary?: boolean;
}

export function ReportDrawer({
  title,
  description,
  leading,
  links = [],
  onClose,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  leading?: React.ReactNode;
  /** Where to act on it — the order, the item, the purchase order. */
  links?: DrawerLink[];
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer
      title={title}
      description={description}
      leading={leading}
      onClose={onClose}
      footer={
        links.length ? (
          <div className="flex gap-2">
            {links.map((link) => (
              <Button key={link.href} asChild size="lg" variant={link.primary ? 'default' : 'outline'} className="flex-1 gap-1.5">
                <Link href={link.href}>
                  {link.icon && <link.icon size={15} aria-hidden="true" />}
                  {link.label}
                  {!link.icon && <ArrowUpRight size={14} aria-hidden="true" />}
                </Link>
              </Button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">{children}</div>
    </Drawer>
  );
}

/** A coloured mark before the drawer title, matching the row's kind. */
export function DrawerMark({ icon: Icon, tone = 'bg-primary/8 text-primary' }: { icon: IconComponent; tone?: string }) {
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tone)} aria-hidden="true">
      <Icon size={18} />
    </span>
  );
}

/** The headline figures, two to a row. */
export function DrawerFacts({ facts }: { facts: { label: string; value: React.ReactNode; hint?: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule/60 bg-rule/50">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0 bg-card px-3.5 py-3">
          <dt className="text-xs text-muted-foreground">{fact.label}</dt>
          <dd className="mt-0.5 truncate text-base font-semibold tabular-nums text-foreground">{fact.value}</dd>
          {fact.hint && <dd className="mt-0.5 text-xs text-muted-foreground">{fact.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Label and value pairs as a hairline list — the record's details. A row's
    `icon` sits before its label; a timestamp's value reads best as `RelativeTime`. */
export function DrawerList({ rows }: { rows: { label: string; value: React.ReactNode; icon?: IconComponent }[] }) {
  const shown = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== '');
  if (shown.length === 0) return null;
  return (
    <dl className="overflow-hidden rounded-lg border border-rule/60 bg-card text-sm">
      {shown.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0">
          <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            {row.icon && <row.icon size={13} aria-hidden="true" />}
            {row.label}
          </dt>
          <dd className="min-w-0 text-right text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const LABEL_W = ['w-24', 'w-32', 'w-20', 'w-28', 'w-36'];

/**
 * A `DrawerList` (or a drawer's ranked list) loading: the same card, a row per
 * line, label on the left and value on the right. `lines={2}` for rows that
 * carry a second, quieter line under each side.
 */
export function DrawerListSkeleton({ rows = 3, lines = 1, label = 'Loading' }: { rows?: number; lines?: 1 | 2; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="overflow-hidden rounded-lg border border-rule/60 bg-card">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0"
          aria-hidden="true"
        >
          <span className="min-w-0 space-y-1.5">
            <Bone className={cn('h-3.5', LABEL_W[index % LABEL_W.length])} />
            {lines === 2 && <Bone className="h-3 w-16" />}
          </span>
          <span className="flex flex-col items-end space-y-1.5">
            <Bone className="h-3.5 w-16" />
            {lines === 2 && <Bone className="h-3 w-20" />}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DrawerSection({ title, children, aside }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** A note as written, kept apart so it reads as someone's words. */
export function DrawerNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule/60 bg-field px-3.5 py-3">
      <p className="text-xs font-semibold text-foreground">Note</p>
      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
