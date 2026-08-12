'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import QRCode from 'react-qr-code';

import {
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Mail,
  Pencil,
  Phone,
  Send,
  ShieldAlert,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { CustomerNotesPanel } from '@/components/customers/CustomerNotesPanel';
import { InfoRow } from '@/components/shared/InfoRow';
import { Button } from '@/components/ui/button';

import { getMarketingPreferences } from '@/lib/api/customers.service';
import { customerQrValue } from '@/lib/utils/customer-qr';
import { formatDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import type { Customer } from '@/types/customers';

/**
 * The stable context column beside the record.
 *
 * Everything a member of staff needs *while* working a guest, in the same place
 * on every tab: who this is at the till, how to reach them, whether they may be
 * emailed, and every action they can take — as words.
 *
 * The actions were three unlabelled icon squares in the top bar. A pencil, an
 * envelope and a pile of coins are a quiz, not an interface, and "Coins" being
 * the only route to a points adjustment is the kind of thing staff learn once
 * and then teach each other. Naming them costs a column and buys the page.
 *
 * The consent line is here rather than on the Compliance tab because it gates
 * the action directly above it: an address that must not be emailed should say
 * so next to the Send button, not two tabs away.
 */

export type WorkbenchAction = 'email' | 'points' | 'edit';

interface Props {
  customer: Customer;
  canEdit: boolean;
  canAdjustPoints: boolean;
  onAction: (action: WorkbenchAction) => void;
  className?: string;
}

export function CustomerWorkbench({ customer, canEdit, canAdjustPoints, onAction, className }: Props) {
  // Read-only here; the Compliance tab owns changing it. Failing quietly is
  // correct — a missing consent record must not blank out the contact card.
  const { data: preferences } = useQuery({
    queryKey: ['marketing-preferences', customer.id],
    queryFn: () => getMarketingPreferences(customer.id),
    enabled: Boolean(customer.email),
  });

  const consent: ConsentState = !customer.email
    ? 'none'
    : preferences?.suppression
      ? 'suppressed'
      : preferences?.marketingOptIn
        ? 'opted_in'
        : 'opted_out';

  const erased = Boolean(customer.anonymisedAt);

  return (
    <aside className={cn('space-y-3', className)} aria-label="Guest details and actions">
      {/* ── What you can do ──────────────────────────────────────────────
          First, not last: on a phone this column sits above the figures, and
          someone holding a queue needs the verbs before the analytics. */}
      {!erased && (
        <section className="rounded-sm border border-rule bg-card p-3">
          <h2 className="px-1 pb-2 text-micro font-semibold uppercase tracking-micro text-muted-foreground">Actions</h2>
          <div className="grid gap-1.5">
            <Button
              variant="outline"
              onClick={() => onAction('email')}
              disabled={!customer.email || consent === 'suppressed'}
              title={
                !customer.email
                  ? 'Add an email address first'
                  : consent === 'suppressed'
                    ? 'This address is suppressed and cannot be emailed'
                    : undefined
              }
              className="w-full justify-start"
            >
              <Send data-icon="inline-start" />
              Send email
            </Button>

            {canAdjustPoints && (
              <Button variant="outline" onClick={() => onAction('points')} className="w-full justify-start">
                <Coins data-icon="inline-start" />
                Adjust points
              </Button>
            )}

            {canEdit && (
              <Button variant="outline" onClick={() => onAction('edit')} className="w-full justify-start">
                <Pencil data-icon="inline-start" />
                Edit details
              </Button>
            )}
          </div>

          {/* The disabled Send button above states the rule; this states the fix. */}
          {!customer.email && (
            <p className="mt-2 px-1 text-xs text-muted-foreground">No email address on this record, so nothing can be sent yet.</p>
          )}
        </section>
      )}

      {/* ── Reaching them ────────────────────────────────────────────────
          `InfoRow` rather than a bespoke row: it is the app's labelled-value
          row, and it brings the copy affordance with it — a phone number you
          have to select by hand is a phone number you mistype. Used without
          `InfoGroup`, whose own border would box a card inside a card. */}
      <section className="rounded-sm border border-rule bg-card">
        <h2 className="border-b border-rule/60 px-4 py-2.5 text-micro font-semibold uppercase tracking-micro text-muted-foreground">
          Contact
        </h2>
        <div className="px-4">
          <InfoRow icon={Phone} label="Phone" value={customer.phone} copyable missingLabel="No phone number" />
          <InfoRow icon={Mail} label="Email" value={customer.email} copyable missingLabel="No email address" />
          {customer.dob && <InfoRow icon={Calendar} label="Date of birth" value={formatDate(customer.dob)} />}
        </div>
        <div className="border-t border-rule/60 px-4 py-2.5">
          <ConsentLine state={consent} />
        </div>
      </section>

      {/* ── What the team should know ────────────────────────────────────
          In the column rather than the Guest tab, so a note can be written
          while reading the timeline that prompted it. */}
      <CustomerNotesPanel customer={customer} canEdit={canEdit && !erased} />

      {/* ── Identity at the till ─────────────────────────────────────── */}
      <section className="rounded-sm border border-rule bg-card p-4">
        <h2 className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Loyalty card</h2>
        <div className="mt-3 flex flex-col items-center gap-2">
          {/* Always on white so a phone camera reads it in dark mode too. */}
          <div className="rounded-sm border border-rule bg-white p-2.5">
            <QRCode
              value={customerQrValue(customer.id)}
              size={112}
              bgColor="#ffffff"
              fgColor="#111a40"
              aria-label={`Loyalty QR code for ${customer.firstName} ${customer.lastName}`}
            />
          </div>
          <CopyValue
            value={customer.id}
            display={customer.id.slice(0, 8)}
            label="Customer ID"
            className="font-mono text-micro font-semibold uppercase tracking-micro"
          />
          <p className="text-center text-micro leading-tight text-muted-foreground/70">Scan at the till to attach an order</p>
        </div>
      </section>
    </aside>
  );
}

/** Copy-to-clipboard that confirms in place rather than firing a toast. */
function CopyValue({ value, display, label, className }: { value: string; display: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      aria-label={copied ? `${label} copied` : `Copy full ${label.toLowerCase()}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-band hover:text-foreground',
        className,
      )}
    >
      {display}
      {copied ? <Check size={11} className="text-momentum" aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
    </button>
  );
}

// ── Consent ───────────────────────────────────────────────────────────────

type ConsentState = 'opted_in' | 'opted_out' | 'suppressed' | 'none';

/**
 * Consent carries a glyph and words, never colour alone — the Two-Channel Rule.
 */
const CONSENT: Record<ConsentState, { icon: IconComponent; label: string; tone: string }> = {
  opted_in: { icon: CheckCircle2, label: 'Opted in to marketing', tone: 'text-momentum' },
  opted_out: { icon: Ban, label: 'Opted out of marketing', tone: 'text-muted-foreground' },
  suppressed: { icon: ShieldAlert, label: 'Suppressed — do not contact', tone: 'text-exception' },
  none: { icon: Ban, label: 'No email address', tone: 'text-muted-foreground' },
};

function ConsentLine({ state }: { state: ConsentState }) {
  const { icon: Icon, label, tone } = CONSENT[state];

  return (
    <p className={cn('flex items-center gap-2 text-xs font-medium', tone)}>
      <Icon size={13} className="shrink-0" aria-hidden="true" />
      {label}
    </p>
  );
}
