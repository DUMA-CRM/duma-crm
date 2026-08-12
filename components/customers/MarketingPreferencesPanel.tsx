'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Ban, CheckCircle2, MailX, RotateCcw, ShieldAlert } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type MarketingPreferenceStatus, getMarketingPreferences, updateMarketingPreferences } from '@/lib/api/customers.service';
import { liftMarketingSuppression } from '@/lib/api/email.service';
import { formatDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Marketing consent, and the trail behind it.
 *
 * Three things this panel now says that it previously held and hid. A
 * suppression arrives with a reason, a source and a date — staff used to see
 * only the word "suppressed" and had no way to find out why an address had gone
 * dark, or to lift it. An unsubscribe made by the customer from inside an email
 * is a different fact from an opt-out typed in by a member of staff, and only
 * one of them is evidence of what the customer actually did. And the ordinary
 * change is binary: someone says "stop emailing me", so the button says
 * "Record opt-out" and the form is left asking the one question it has to.
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
const CURRENT: Record<Current, { icon: IconComponent; label: string; detail: string; className: string }> = {
  opted_in: {
    icon: CheckCircle2,
    label: 'Opted in',
    detail: 'Marketing email may be sent to this address.',
    className: 'border-momentum/30 bg-momentum/6 text-momentum',
  },
  opted_out: {
    icon: Ban,
    label: 'Opted out',
    detail: 'No marketing. Transactional messages — receipts, confirmations — are still allowed.',
    className: 'border-rule bg-band/55 text-foreground',
  },
  suppressed: {
    icon: ShieldAlert,
    label: 'Suppressed — do not contact',
    detail: 'Nothing may be sent to this address at all, transactional mail included.',
    className: 'border-exception/30 bg-exception/8 text-exception',
  },
};

/** How a history entry reads at a glance. */
const EVENT: Record<MarketingPreferenceStatus, { icon: IconComponent; label: string; tone: string }> = {
  opted_in: { icon: CheckCircle2, label: 'Opted in', tone: 'text-momentum' },
  opted_out: { icon: Ban, label: 'Opted out', tone: 'text-muted-foreground' },
  suppressed: { icon: ShieldAlert, label: 'Suppressed', tone: 'text-exception' },
};

export function MarketingPreferencesPanel({ customerId, email }: { customerId: string; email?: string }) {
  const qc = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);

  /** The status being recorded, or null when the form is closed. */
  const [recording, setRecording] = useState<MarketingPreferenceStatus | null>(null);
  const [source, setSource] = useState('customer_request');
  const [reason, setReason] = useState('');
  const [liftOpen, setLiftOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-preferences', customerId],
    queryFn: () => getMarketingPreferences(customerId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['marketing-preferences', customerId] });
    void qc.invalidateQueries({ queryKey: ['customer', customerId] });
    void qc.invalidateQueries({ queryKey: ['customer-timeline', customerId] });
  };

  const save = useMutation({
    mutationFn: () => updateMarketingPreferences(customerId, { status: recording!, source, reason: reason.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      toast('success', recording === 'suppressed' ? 'Address suppressed.' : 'Marketing preference recorded.');
      setRecording(null);
      setReason('');
    },
    onError: (error) => toast('error', error.message || 'Marketing preferences weren’t updated. Try again.'),
  });

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
  const state = CURRENT[current];
  const StateIcon = state.icon;
  const history = data?.history ?? [];
  const lastChange = history[0];

  const open = (status: MarketingPreferenceStatus) => {
    setRecording(status);
    // An unsubscribe is the customer's own act; everything else defaults to the
    // conversation that most likely produced it.
    setSource(status === 'opted_out' ? 'customer_request' : status === 'suppressed' ? 'staff_correction' : 'in_person');
    setReason('');
  };

  return (
    <section className="rounded-sm border border-rule bg-card" aria-label="Marketing consent">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-rule/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Marketing consent</h2>
        {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
      </div>

      <div className="space-y-4 p-4">
        {!email ? (
          <p className="text-sm text-muted-foreground">
            There is no email address on this record, so there is no email consent to record. Add one from Edit details first.
          </p>
        ) : (
          <>
            {/* ── Where they stand ─────────────────────────────────────── */}
            <div className={cn('rounded-sm border px-3 py-2.5', state.className)}>
              <div className="flex items-start gap-2.5">
                <StateIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{state.label}</p>
                  <p className="mt-0.5 text-xs opacity-90">{state.detail}</p>
                </div>
              </div>

              {/* The suppression's own facts. Without them "suppressed" is a
                  dead end: nobody can tell a hard bounce from an erasure, and
                  the difference decides whether lifting it is even legitimate. */}
              {suppression && (
                <dl className="mt-2.5 space-y-1 border-t border-exception/20 pt-2.5 text-xs">
                  <Fact label="Why">{suppression.reason}</Fact>
                  <Fact label="Added by">{sourceLabel(suppression.source)}</Fact>
                  <Fact label="Blocked since">{formatDate(suppression.createdAt)}</Fact>
                  <Fact label="Address">
                    <span className="font-mono">{suppression.maskedValue}</span>
                  </Fact>
                </dl>
              )}

              {!suppression && lastChange && (
                <p className="mt-2 text-xs opacity-75">
                  Last changed {formatDate(lastChange.occurredAt)} · {sourceLabel(lastChange.source)}
                </p>
              )}
            </div>

            {/* An unsubscribe clicked inside an email is the customer's own act,
                and it is not the same evidence as a staff-typed opt-out. */}
            {!suppression && data?.emailUnsubscribedAt && (
              <p className="flex items-start gap-2 rounded-sm border border-rule bg-background px-3 py-2 text-xs text-muted-foreground">
                <MailX size={13} className="mt-px shrink-0" aria-hidden="true" />
                <span>
                  They unsubscribed themselves from an email on {formatDate(data.emailUnsubscribedAt)}. Only opt them back in if they ask
                  you to.
                </span>
              </p>
            )}

            {/* ── Changing it ──────────────────────────────────────────── */}
            {recording ? (
              <RecordForm
                status={recording}
                source={source}
                reason={reason}
                onSource={setSource}
                onReason={setReason}
                onCancel={() => setRecording(null)}
                onSubmit={() => save.mutate()}
                isPending={save.isPending || isLoading}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {suppression ? (
                  <Button variant="outline" onClick={() => setLiftOpen(true)} disabled={isLoading}>
                    <RotateCcw data-icon="inline-start" />
                    Lift the block
                  </Button>
                ) : (
                  <>
                    <Button
                      variant={current === 'opted_in' ? 'outline' : 'default'}
                      onClick={() => open(current === 'opted_in' ? 'opted_out' : 'opted_in')}
                      disabled={isLoading}
                    >
                      {current === 'opted_in' ? <Ban data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
                      Record {current === 'opted_in' ? 'opt-out' : 'opt-in'}
                    </Button>
                    <Button variant="outline" onClick={() => open('suppressed')} disabled={isLoading}>
                      <ShieldAlert data-icon="inline-start" />
                      Suppress this address
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── The trail ────────────────────────────────────────────── */}
            <div>
              <h3 className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Consent history</h3>
              {history.length === 0 ? (
                <p className="mt-2 rounded-sm border border-dashed border-rule px-3 py-3 text-xs text-muted-foreground">
                  Nothing recorded yet. Every change made here is kept permanently, with how it was received — that record is what makes a
                  consent claim hold up.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-rule/50 overflow-hidden rounded-sm border border-rule">
                  {history.map((event) => {
                    const meta = EVENT[event.action] ?? EVENT.opted_out;
                    const EventIcon = meta.icon;
                    return (
                      <li key={event.id} className="flex items-start gap-2.5 bg-background px-3 py-2.5 text-xs">
                        <EventIcon size={13} className={cn('mt-0.5 shrink-0', meta.tone)} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{meta.label}</p>
                          <p className="mt-0.5 text-muted-foreground">
                            {sourceLabel(event.source)}
                            {event.reason ? ` · ${event.reason}` : ''}
                          </p>
                        </div>
                        <time className="shrink-0 tabular-nums text-muted-foreground" dateTime={event.occurredAt}>
                          {formatDate(event.occurredAt)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Lifting is permissive, not destructive — so it is a plain confirm, not
          a red one. What it must be clear about is what it does *not* do. */}
      {liftOpen && suppression && (
        <Modal
          title="Lift this block?"
          description={suppression.maskedValue}
          onClose={() => setLiftOpen(false)}
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLiftOpen(false)} disabled={lift.isPending} className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => lift.mutate()} disabled={lift.isPending} className="flex-1">
                {lift.isPending ? 'Lifting…' : 'Lift the block'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              The address was blocked because: <strong className="font-semibold text-foreground">{suppression.reason}</strong>. Lifting
              it means email can reach this address again.
            </p>
            <p>
              It does <strong className="font-semibold text-foreground">not</strong> opt them back into marketing — their preference stays
              exactly as it is, and you would record an opt-in separately if they have asked for one.
            </p>
            <p className="rounded-sm border border-warning/25 bg-warning/6 px-3 py-2 text-xs text-warning">
              If this address was suppressed to fulfil an erasure request, lifting it undoes part of that request. Check the Privacy
              requests below first.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 opacity-75">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  );
}

// ── The one form ──────────────────────────────────────────────────────────

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

function RecordForm({
  status,
  source,
  reason,
  onSource,
  onReason,
  onCancel,
  onSubmit,
  isPending,
}: {
  status: MarketingPreferenceStatus;
  source: string;
  reason: string;
  onSource: (value: string) => void;
  onReason: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const copy = RECORD_COPY[status];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={cn(
        'rounded-sm border p-3',
        status === 'suppressed' ? 'border-exception/30 bg-exception/5' : 'border-rule bg-band/40',
      )}
    >
      <p className={cn('text-sm font-semibold', status === 'suppressed' ? 'text-exception' : 'text-foreground')}>{copy.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{copy.hint}</p>

      {status === 'suppressed' && (
        <p className="mt-2.5 flex items-start gap-2 rounded-sm border border-exception/30 bg-exception/8 px-3 py-2 text-xs text-exception">
          <ShieldAlert size={13} className="mt-px shrink-0" aria-hidden="true" />
          Suppressing blocks every email to this address, receipts included. It can be lifted afterwards, but the block applies the moment
          you record it.
        </p>
      )}

      <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="marketing-source" className="block text-label uppercase text-muted-foreground">
            How it was recorded
          </label>
          <Select
            id="marketing-source"
            value={source}
            onValueChange={onSource}
            options={SOURCE_OPTIONS}
            ariaLabel="How this consent change was recorded"
            className="w-full"
          />
        </div>
        <Input
          label="Reason or customer wording (optional)"
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          maxLength={500}
          placeholder="For example: asked at the till"
        />
      </div>

      <div className="mt-3 flex justify-end gap-2 border-t border-rule/50 pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant={status === 'suppressed' ? 'destructive' : 'default'} disabled={isPending}>
          {isPending ? 'Recording…' : copy.confirm}
        </Button>
      </div>
    </form>
  );
}
