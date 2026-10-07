'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import QRCode from 'react-qr-code';

import { GrantRewardModal, rewardLabel } from '@/components/customers/CustomerLoyaltyCards';
import { CustomerNotesPanel } from '@/components/customers/CustomerNotesPanel';
import { Ban, Calendar, CheckCircle2, Coffee, Coins, Gift, Mail, Pencil, Phone, QrCode, Send, ShieldAlert } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Modal } from '@/components/shared/Modal';
import { CopyGlyph } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';

import type { CustomerLoyaltyProgram } from '@/lib/api/loyalty.service';
import { getMarketingPreferences } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { birthdayHint, daysUntilBirthday } from '@/lib/utils/customer-card';
import { customerQrValue } from '@/lib/utils/customer-qr';
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
 * The consent row is here rather than on the Compliance tab because it gates
 * the action directly above it: an address that must not be emailed should say
 * so next to the Send button, not two tabs away.
 */

export type WorkbenchAction = 'email' | 'points' | 'edit';

interface Props {
  customer: Customer;
  /** The loyalty wallet; birthday programmes put a "give it now" action here. */
  loyaltyProgrammes: CustomerLoyaltyProgram[];
  canEdit: boolean;
  canAdjustPoints: boolean;
  /** False on the Compliance tab, where the full consent panel sits beside it. */
  showConsent?: boolean;
  onAction: (action: WorkbenchAction) => void;
  className?: string;
}

export function CustomerWorkbench({
  customer,
  loyaltyProgrammes,
  canEdit,
  canAdjustPoints,
  showConsent = true,
  onAction,
  className,
}: Props) {
  const [granting, setGranting] = useState<CustomerLoyaltyProgram | null>(null);
  // Issued automatically once each birthday; this is the by-hand route, for a
  // birthday the guest mentions at the till, or one that fell before they joined.
  const birthdayProgrammes = loyaltyProgrammes.filter(
    (programme) => programme.earnRule.trigger === 'birthday' && (programme.earnRule.benefitMode ?? 'rewards') !== 'points',
  );
  // Read-only here; the Compliance tab owns changing it. Failing quietly is
  // correct — a missing consent record must not blank out the contact card.
  const { data: preferences } = useQuery({
    queryKey: moduleQueryKeys.customers.key('marketing-preferences', customer.id),
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
  // Pinned per mount; a countdown in days does not need a live clock.
  const [now] = useState(() => Date.now());
  const birthdaySoon = birthdayHint(daysUntilBirthday(customer.dob, now));

  return (
    <aside className={cn('flex min-w-0 flex-col gap-5', className)} aria-label="Guest details and actions">
      {/* ── What you can do ──────────────────────────────────────────────
          First, not last: on a phone this column sits above the figures, and
          someone holding a queue needs the verbs before the analytics. */}
      {!erased && (
        <SettingsSection
          title="Actions"
          footnote={
            // The disabled Send button states the rule; this states the fix.
            !customer.email ? 'No email address on this record, so nothing can be sent yet.' : undefined
          }
        >
          <div className="grid gap-2">
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

            {canAdjustPoints &&
              birthdayProgrammes.map((programme) => (
                <Button
                  key={programme.id}
                  variant="outline"
                  onClick={() => setGranting(programme)}
                  title={`${rewardLabel(programme)} — issued automatically each birthday`}
                  className="w-full justify-start"
                >
                  <Gift data-icon="inline-start" />
                  <span className="truncate">Give birthday reward</span>
                  {birthdayProgrammes.length > 1 && (
                    <span className="ml-auto truncate text-xs text-muted-foreground">{programme.name}</span>
                  )}
                </Button>
              ))}

            {canEdit && (
              <Button variant="outline" onClick={() => onAction('edit')} className="w-full justify-start">
                <Pencil data-icon="inline-start" />
                Edit details
              </Button>
            )}
          </div>
          {granting && (
            <GrantRewardModal
              customerId={customer.id}
              customerName={`${customer.firstName} ${customer.lastName}`.trim()}
              programme={granting}
              onClose={() => setGranting(null)}
            />
          )}
        </SettingsSection>
      )}

      {/* ── Reaching them ────────────────────────────────────────────────
          The record's own rows — value first, what it is beneath — with the
          things you do with a number on the right: call it, copy it. A phone
          number selected by hand is a phone number mistyped. */}
      <SettingsSection title="Contact" bodyClassName="px-2 pt-2 pb-2">
        <ul>
          <ContactRow
            icon={Phone}
            tile="bg-reference/8 text-reference"
            value={customer.phone}
            label="Phone"
            actions={
              customer.phone && (
                <>
                  <IconLink href={`tel:${customer.phone.replace(/\s+/g, '')}`} label={`Call ${customer.phone}`} icon={Phone} />
                  <CopyValue value={customer.phone} label="phone number" />
                </>
              )
            }
          />
          <ContactRow
            icon={Mail}
            tile="bg-reference/8 text-reference"
            value={customer.email}
            label="Email"
            actions={customer.email && <CopyValue value={customer.email} label="email address" />}
          />
          <ContactRow
            icon={Calendar}
            tile={birthdaySoon ? 'bg-stock/10 text-stock' : 'bg-band text-muted-foreground'}
            value={customer.dob ? formatBirthday(customer.dob) : undefined}
            label="Birthday"
            pill={birthdaySoon ? { label: birthdaySoon, className: 'bg-stock/10 text-stock' } : undefined}
          />
          {showConsent && (
            <ContactRow
              icon={CONSENT[consent].icon}
              tile={CONSENT[consent].tile}
              value={CONSENT[consent].label}
              label={CONSENT[consent].detail}
              pill={consent === 'suppressed' ? { label: 'Do not contact', className: 'bg-exception/8 text-exception' } : undefined}
            />
          )}
        </ul>
      </SettingsSection>

      {/* ── What the team should know ────────────────────────────────────
          In the column rather than the Guest tab, so a note can be written
          while reading the timeline that prompted it. */}
      <CustomerNotesPanel customer={customer} canEdit={canEdit && !erased} />

      {/* ── Identity at the till ─────────────────────────────────────── */}
      <MembershipCard customer={customer} />
    </aside>
  );
}

// ── Membership card ───────────────────────────────────────────────────────

/**
 * The guest's loyalty card as the card it stands for: who it belongs to, the
 * member number, and the code the till scans — tier and balance are on the
 * page already, so the card does not repeat them. The code
 * sits on its own white plate so a camera reads it in dark mode too.
 *
 * "Show to scan" is for the guest who has lost their card: the code goes full
 * size, so the till can read it straight off this screen.
 */
function MembershipCard({ customer }: { customer: Customer }) {
  const [scanning, setScanning] = useState(false);
  const name = `${customer.firstName} ${customer.lastName}`.trim();
  const memberNumber = customer.id.slice(0, 8).toUpperCase();
  const qrValue = customerQrValue(customer.id);

  return (
    <SettingsSection
      title="Loyalty card"
      description="Scan at the till to attach an order."
      actions={
        <Button variant="outline" size="sm" onClick={() => setScanning(true)}>
          <QrCode data-icon="inline-start" />
          Show to scan
        </Button>
      }
    >
      <article
        aria-label={`Loyalty card for ${name}`}
        className="relative overflow-hidden rounded-xl bg-primary p-4 text-primary-foreground shadow-sm"
      >
        {/* The stamp cards' rings, so the two read as one family. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -bottom-16 size-44 rounded-full border border-primary-foreground/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 -bottom-8 size-28 rounded-full border border-primary-foreground/10"
        />

        <p className="relative flex items-center gap-1.5 text-micro font-semibold uppercase tracking-micro text-primary-foreground/70">
          <Coffee size={13} aria-hidden="true" /> DUMA loyalty
        </p>

        <div className="relative mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {/* The name is the masthead's — the card carries only what the till reads. */}
            <p className="text-micro font-semibold uppercase tracking-micro text-primary-foreground/60">Member no.</p>
            <p className="flex items-center gap-1">
              <span className="font-mono text-sm font-semibold tracking-wider">{memberNumber}</span>
              <CopyValue value={customer.id} label="full customer ID" onDark />
            </p>
          </div>
          <div className="shrink-0 rounded-md bg-white p-1.5 shadow-sm">
            <QRCode value={qrValue} size={76} bgColor="#ffffff" fgColor="#111a40" aria-label={`Loyalty QR code for ${name}`} />
          </div>
        </div>
      </article>

      {scanning && (
        <Modal title="Scan this code" description={`${name} · member ${memberNumber}`} onClose={() => setScanning(false)}>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-lg border border-rule/60 bg-white p-4">
              <QRCode value={qrValue} size={240} bgColor="#ffffff" fgColor="#111a40" aria-label={`Loyalty QR code for ${name}`} />
            </div>
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              Hold the till’s scanner up to the screen. Turn the brightness up if it doesn’t read first time.
            </p>
            <Button variant="outline" onClick={() => setScanning(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </SettingsSection>
  );
}

/** Copy-to-clipboard that confirms in place rather than firing a toast. */
function CopyValue({ value, label, onDark = false }: { value: string; label: string; onDark?: boolean }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      aria-label={copied ? `Copied the ${label}` : `Copy the ${label}`}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        onDark
          ? 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground'
          : 'text-muted-foreground hover:bg-band hover:text-foreground',
      )}
    >
      <CopyGlyph copied={copied} className={cn('size-3.5', onDark ? 'text-primary-foreground' : 'text-momentum')} />
    </button>
  );
}

// ── Consent ───────────────────────────────────────────────────────────────

type ConsentState = 'opted_in' | 'opted_out' | 'suppressed' | 'none';

/**
 * Consent carries a glyph and words, never colour alone — the Two-Channel Rule.
 */
const CONSENT: Record<ConsentState, { icon: IconComponent; label: string; detail: string; tile: string }> = {
  opted_in: { icon: CheckCircle2, label: 'Marketing allowed', detail: 'Opted in', tile: 'bg-momentum/8 text-momentum' },
  opted_out: { icon: Ban, label: 'No marketing', detail: 'Receipts and confirmations only', tile: 'bg-band text-muted-foreground' },
  suppressed: { icon: ShieldAlert, label: 'Suppressed', detail: 'Nothing may be sent', tile: 'bg-exception/8 text-exception' },
  none: { icon: Ban, label: 'No marketing', detail: 'No email to consent with', tile: 'bg-band text-muted-foreground' },
};

/** "12 March" — the year stays out of the rail: it is an age, and the till does not need it. */
function formatBirthday(dob: string) {
  return new Date(`${dob.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** One contact fact: tinted tile, the value in bold (or "Not recorded"), what it is beneath, actions on the right. */
function ContactRow({
  icon: Icon,
  tile,
  value,
  label,
  pill,
  actions,
}: {
  icon: IconComponent;
  tile: string;
  value?: string | null;
  label: string;
  pill?: { label: string; className: string };
  actions?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md px-3 py-2.5">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', value ? tile : 'bg-band text-muted-foreground')}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn('block truncate text-sm', value ? 'font-semibold text-foreground' : 'text-muted-foreground')}
          title={value ?? undefined}
        >
          {value || 'Not recorded'}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{label}</span>
      </span>
      {pill && <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', pill.className)}>{pill.label}</span>}
      {actions && <span className="flex shrink-0 items-center">{actions}</span>}
    </li>
  );
}

function IconLink({ href, label, icon: Icon }: { href: string; label: string; icon: IconComponent }) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Icon size={14} aria-hidden="true" />
    </a>
  );
}
