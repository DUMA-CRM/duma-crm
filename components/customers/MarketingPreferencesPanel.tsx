'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { Ban, CheckCircle2, MailX, RotateCcw, ShieldAlert } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { liftMarketingSuppression } from '@/lib/modules/communications/client';
import { type MarketingPreferenceStatus, getMarketingPreferences, updateMarketingPreferences } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Marketing consent, and the trail behind it — drawn as the record's other
 * blocks are (the privacy requests beneath it, the audit log): a heading with
 * its actions, then one hairline list of rows.
 *
 * Three things this says that it once held and hid. A suppression arrives with
 * a reason, a source and a date — without them nobody can tell a hard bounce
 * from an erasure, and that decides whether lifting it is legitimate. An
 * unsubscribe clicked inside an email is the customer's own act, a different
 * fact from an opt-out typed in by staff. And the ordinary change is binary,
 * so the button says "Record opt-out" and the dialog asks only how it came.
 */

const SOURCE_OPTIONS = [
  { value: 'customer_request', label: 'Customer request' },
  { value: 'in_person', label: 'In person' },
  { value: 'phone', label: 'Phone' },
  { value: 'email_unsubscribe', label: 'Email unsubscribe' },
  { value: 'web_form', label: 'Web form' },
  { value: 'staff_correction', label: 'Staff correction' },
];

const sourceLabel = (source: string) => SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source.replaceAll('_', ' ');

type Current = 'opted_in' | 'opted_out' | 'suppressed';

/** Colour never carries the state on its own — glyph and words do too. */
const STATE: Record<MarketingPreferenceStatus, { icon: IconComponent; label: string; detail: string; tile: string }> = {
  opted_in: {
    icon: CheckCircle2,
    label: 'Opted in',
    detail: 'Marketing email may be sent.',
    tile: 'bg-momentum/8 text-momentum',
  },
  opted_out: {
    icon: Ban,
    label: 'Opted out',
    detail: 'No marketing. Receipts and confirmations are still allowed.',
    tile: 'bg-band text-muted-foreground',
  },
  suppressed: {
    icon: ShieldAlert,
    label: 'Suppressed',
    detail: 'Nothing may be sent at all, transactional mail included.',
    tile: 'bg-exception/8 text-exception',
  },
};

const PILL = 'shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold';

export function MarketingPreferencesPanel({ customerId, email }: { customerId: string; email?: string }) {
  const qc = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  // The API is the boundary (`PATCH …/marketing-preferences` checks the first,
  // `DELETE /email/suppressions/:id` the second); these only keep a reader from
  // being offered buttons that would come back 403.
  const canWrite = hasCapability(capabilities, 'customers.consent:write');
  const canLift = hasCapability(capabilities, 'email:suppressions');

  /** The status being recorded, or null when the dialog is closed. */
  const [recording, setRecording] = useState<MarketingPreferenceStatus | null>(null);
  const [liftOpen, setLiftOpen] = useState(false);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: moduleQueryKeys.customers.key('marketing-preferences', customerId),
    queryFn: () => getMarketingPreferences(customerId),
    enabled: Boolean(email),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('marketing-preferences', customerId) });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer', customerId) });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-timeline', customerId) });
  };

  const lift = useMutation({
    mutationFn: () => liftMarketingSuppression(data!.suppression!.id, tenantId ?? undefined),
    onSuccess: () => {
      invalidate();
      setLiftOpen(false);
      toast('success', 'Block lifted. Their marketing preference is unchanged.');
    },
    onError: (error) => toast('error', error.message || 'The block wasn’t lifted. Try again.'),
  });

  const suppression = data?.suppression ?? null;
  const current: Current = suppression ? 'suppressed' : data?.marketingOptIn ? 'opted_in' : 'opted_out';
  const state = STATE[current];
  const StateIcon = state.icon;
  const history = data?.history ?? [];
  const lastChange = history[0];
  const loaded = Boolean(email) && !isPending && !isError;

  const actions = loaded && (
    <div className="flex flex-wrap items-center gap-2">
      {suppression
        ? canLift && (
            <Button variant="outline" size="sm" onClick={() => setLiftOpen(true)}>
              <RotateCcw data-icon="inline-start" />
              Lift the block
            </Button>
          )
        : canWrite && (
            <>
              <Button variant="outline" size="sm" onClick={() => setRecording(current === 'opted_in' ? 'opted_out' : 'opted_in')}>
                {current === 'opted_in' ? <Ban data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
                Record {current === 'opted_in' ? 'opt-out' : 'opt-in'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRecording('suppressed')} className="text-exception hover:text-exception">
                <ShieldAlert data-icon="inline-start" />
                Suppress
              </Button>
            </>
          )}
    </div>
  );

  return (
    <motion.section variants={SECTION_RISE} className="scroll-mt-6" aria-labelledby="marketing-consent-title">
      <div className="mb-3 flex min-h-8 flex-wrap items-center gap-3">
        <h2 id="marketing-consent-title" className="flex-1 text-base font-semibold tracking-title text-foreground">
          Marketing consent
        </h2>
        {actions}
      </div>

      {!email ? (
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          <Row
            icon={MailX}
            tile="bg-band text-muted-foreground"
            lead="No email address"
            detail="Add one with Edit details to record consent."
          />
        </ul>
      ) : isPending ? (
        <div className="h-32 animate-pulse rounded-lg bg-band/60" aria-label="Loading marketing consent" />
      ) : isError ? (
        // Not the opted-out default: a preference that has not loaded is not a
        // preference, and showing one would be a consent claim.
        <div className="rounded-lg border border-rule/60 bg-card">
          <ErrorState
            title="Marketing consent couldn’t be loaded"
            description="Their preference is unknown until it loads — don’t assume either way."
            onRetry={() => void refetch()}
          />
        </div>
      ) : (
        <>
          {/* ── Where they stand ───────────────────────────────────────── */}
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            <Row
              icon={StateIcon}
              tile={state.tile}
              lead={state.label}
              phrase={current === 'suppressed' ? '— do not contact' : 'to marketing'}
              detail={`${state.detail} ${email}`}
              pill={current === 'suppressed' ? { label: 'Blocked', className: 'bg-exception/8 text-exception' } : undefined}
              trailing={!suppression && lastChange ? `Since ${formatDate(lastChange.occurredAt)}` : undefined}
            >
              {/* The suppression's own facts, unfolded under it the way an
                  audit group lists its entries. */}
              {suppression && (
                <dl className="border-t border-rule/45 bg-band/25 py-1 pl-15">
                  <Fact label="Why">{suppression.reason}</Fact>
                  <Fact label="Added by">{sourceLabel(suppression.source)}</Fact>
                  <Fact label="Since">{formatDate(suppression.createdAt)}</Fact>
                  <Fact label="Address">
                    <span className="font-mono text-xs">{suppression.maskedValue}</span>
                  </Fact>
                </dl>
              )}
            </Row>

            {/* An unsubscribe clicked inside an email is the customer's own act,
                and it is not the same evidence as a staff-typed opt-out. */}
            {!suppression && data?.emailUnsubscribedAt && (
              <Row
                icon={MailX}
                tile="bg-measured/10 text-measured"
                lead="Unsubscribed"
                phrase="themselves, from an email"
                detail="Only opt them back in if they ask you to."
                trailing={formatDate(data.emailUnsubscribedAt)}
              />
            )}
          </ul>

          {/* ── The trail ──────────────────────────────────────────────── */}
          <h3 className="mt-5 mb-2 flex items-baseline gap-2 px-1 text-sm font-semibold text-foreground">
            History
            {history.length > 0 && <span className="text-xs font-normal tabular-nums text-muted-foreground">{history.length}</span>}
          </h3>
          {history.length === 0 ? (
            <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
              Nothing recorded yet.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              {history.map((event) => {
                const meta = STATE[event.action] ?? STATE.opted_out;
                return (
                  <Row
                    key={event.id}
                    icon={meta.icon}
                    tile={meta.tile}
                    lead={meta.label}
                    phrase={`· ${sourceLabel(event.source).toLowerCase()}`}
                    detail={event.reason ?? undefined}
                    trailing={formatDate(event.occurredAt)}
                  />
                );
              })}
            </ul>
          )}
          <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
            Every change is kept permanently, with how it was received — that record is what makes a consent claim hold up.
          </p>
        </>
      )}

      {recording && email && (
        <RecordConsentModal
          customerId={customerId}
          email={email}
          status={recording}
          onDone={invalidate}
          onClose={() => setRecording(null)}
        />
      )}

      {/* Lifting is permissive, not destructive — so it is a plain confirm, not
          a red one. What it must be clear about is what it does *not* do. */}
      {liftOpen && suppression && (
        <Modal
          title="Lift this block?"
          description={suppression.maskedValue}
          onClose={() => setLiftOpen(false)}
          footer={
            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={() => setLiftOpen(false)} disabled={lift.isPending} className="flex-1">
                Cancel
              </Button>
              <Button size="lg" onClick={() => lift.mutate()} disabled={lift.isPending} className="flex-1">
                {lift.isPending ? 'Lifting…' : 'Lift the block'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              The address was blocked because: <strong className="font-semibold text-foreground">{suppression.reason}</strong>. Lifting it
              means email can reach this address again.
            </p>
            <p>
              It does <strong className="font-semibold text-foreground">not</strong> opt them back into marketing — their preference stays
              exactly as it is, and you would record an opt-in separately if they have asked for one.
            </p>
            <p className="rounded-lg border border-measured/30 bg-measured/6 px-3.5 py-2.5 text-xs text-measured">
              If this address was suppressed to fulfil an erasure request, lifting it undoes part of that request. Check the privacy
              requests below first.
            </p>
          </div>
        </Modal>
      )}
    </motion.section>
  );
}

/** One fact as an audit-log row: tinted tile, bold lead and phrase, a muted line, a pill only when it matters. */
function Row({
  icon: Icon,
  tile,
  lead,
  phrase,
  detail,
  pill,
  trailing,
  children,
}: {
  icon: IconComponent;
  tile: string;
  lead: string;
  phrase?: string;
  detail?: string;
  pill?: { label: string; className: string };
  trailing?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="border-b border-rule/45 last:border-b-0">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', tile)}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">
            <span className="font-semibold">{lead}</span>
            {phrase && ` ${phrase}`}
          </span>
          {detail && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
        {pill && <span className={cn(PILL, pill.className)}>{pill.label}</span>}
        {trailing && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{trailing}</span>}
      </div>
      {children}
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 pr-3.5">
      <dt className="w-16 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm wrap-break-word text-foreground">{children}</dd>
    </div>
  );
}

// ── Recording a change ────────────────────────────────────────────────────

const RECORD_COPY: Record<MarketingPreferenceStatus, { title: string; hint: string; confirm: string }> = {
  opted_in: {
    title: 'Record an opt-in',
    hint: 'Only when the customer has clearly agreed. How you were told is the part that matters later.',
    confirm: 'Record opt-in',
  },
  opted_out: {
    title: 'Record an opt-out',
    hint: 'Marketing stops immediately. Receipts and confirmations are unaffected.',
    confirm: 'Record opt-out',
  },
  suppressed: {
    title: 'Suppress this address',
    hint: 'For erasure requests and hard bounces — not for an ordinary opt-out.',
    confirm: 'Suppress address',
  },
};

const FORM_ID = 'record-consent-form';

function RecordConsentModal({
  customerId,
  email,
  status,
  onDone,
  onClose,
}: {
  customerId: string;
  email: string;
  status: MarketingPreferenceStatus;
  onDone: () => void;
  onClose: () => void;
}) {
  const copy = RECORD_COPY[status];
  // An unsubscribe is usually the customer's own request; a suppression a
  // staff correction; an opt-in most often comes in person.
  const [source, setSource] = useState(
    status === 'opted_out' ? 'customer_request' : status === 'suppressed' ? 'staff_correction' : 'in_person',
  );
  const [reason, setReason] = useState('');

  const save = useMutation({
    mutationFn: () => updateMarketingPreferences(customerId, { status, source, reason: reason.trim() || undefined }),
    onSuccess: () => {
      onDone();
      toast('success', status === 'suppressed' ? 'Address suppressed.' : 'Marketing preference recorded.');
      onClose();
    },
    onError: (error) => toast('error', error.message || 'Marketing preferences weren’t updated. Try again.'),
  });

  return (
    <Modal
      title={copy.title}
      description={email}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            size="lg"
            variant={status === 'suppressed' ? 'destructive' : 'default'}
            className="flex-1"
            disabled={save.isPending}
          >
            {save.isPending ? 'Recording…' : copy.confirm}
          </Button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">{copy.hint}</p>

        {status === 'suppressed' && (
          <p className="flex items-start gap-2.5 rounded-lg border border-exception/30 bg-exception/5 px-3.5 py-3 text-sm text-exception">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Suppressing blocks every email to this address, receipts included. It can be lifted afterwards, but it applies the moment you
            record it.
          </p>
        )}

        <fieldset>
          <legend className="mb-2 text-label uppercase text-muted-foreground">How it was recorded</legend>
          <ChoiceCards value={source} onChange={setSource} options={SOURCE_OPTIONS} columns={2} />
        </fieldset>

        <Input
          label="Reason or customer wording (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="For example: asked at the till"
        />
      </form>
    </Modal>
  );
}
