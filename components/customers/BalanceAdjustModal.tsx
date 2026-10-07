'use client';

import { useState } from 'react';

import { AlertTriangle, ArrowRight, type IconComponent, Minus, Plus } from '@/components/icons';
import { ModalActions } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { Input } from '@/components/ui/input';

import { type AdjustDirection, planAdjustment } from '@/lib/utils/balance-adjust';
import { cn } from '@/lib/utils/cn';

const FORM_ID = 'balance-adjust-form';

/** The situations behind nearly every manual change. One tap fills the reason; it can still be edited. */
const REASONS = ['Missed scan', 'Service recovery', 'Goodwill gesture', 'Correction'] as const;

export interface AdjustUnit {
  singular: string;
  plural: string;
}

/**
 * One dialog for changing a loyalty balance by hand — points or stamps.
 *
 * Direction is chosen, not typed: the old form took "-50" in a free-text box,
 * and a missed minus sign sent points the wrong way. The amount is a stepper
 * with the usual values a tap away, the outcome is drawn before it is
 * confirmed (`preview`), and the confirm button names exactly what it will do.
 */
export function BalanceAdjustModal({
  title,
  subject,
  icon: Icon,
  unit,
  balance,
  presets,
  reasonRequired,
  pending,
  preview,
  onSubmit,
  onClose,
}: {
  title: string;
  /** Who and what — the guest, and the programme for a stamp card. */
  subject: string;
  icon: IconComponent;
  unit: AdjustUnit;
  balance: number;
  /** Quick amounts, smallest first. */
  presets: readonly number[];
  /** Stamps insist on one (the API refuses fewer than two characters); points do not. */
  reasonRequired: boolean;
  pending: boolean;
  /** What the change does beyond the number — a stamp card filling up, a tier moving. */
  preview?: (after: number, delta: number) => React.ReactNode;
  onSubmit: (delta: number, reason: string) => void;
  onClose: () => void;
}) {
  const [direction, setDirection] = useState<AdjustDirection>('add');
  const [amount, setAmount] = useState(presets[0] ?? 1);
  const [reason, setReason] = useState('');

  const plan = planAdjustment(balance, direction, amount);
  const reasonOk = !reasonRequired || reason.trim().length >= 2;
  const label = (count: number) => `${count.toLocaleString()} ${count === 1 ? unit.singular : unit.plural}`;
  const submitLabel = plan.delta === 0 ? 'Confirm' : `${direction === 'add' ? 'Add' : 'Remove'} ${label(Math.abs(plan.delta))}`;

  return (
    <Modal
      title={title}
      description={subject}
      onClose={onClose}
      footer={
        <ModalActions
          form={FORM_ID}
          submitLabel={submitLabel}
          pending={pending}
          pendingLabel="Saving…"
          disabled={!plan.valid || !reasonOk}
          onCancel={onClose}
        />
      }
    >
      <form
        id={FORM_ID}
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (plan.valid && reasonOk) onSubmit(plan.delta, reason.trim());
        }}
      >
        {/* ── Which way ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Add or remove">
          {(
            [
              { value: 'add', label: `Add ${unit.plural}`, icon: Plus },
              { value: 'remove', label: `Remove ${unit.plural}`, icon: Minus },
            ] as const
          ).map((option) => {
            const on = direction === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setDirection(option.value)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border px-3.5 py-3 text-left text-sm font-semibold transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  on
                    ? option.value === 'add'
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-exception/60 bg-exception/5 text-foreground'
                    : 'border-rule/60 bg-background/60 text-muted-foreground hover:bg-band/40 hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-md',
                    on ? (option.value === 'add' ? 'bg-primary/10 text-primary' : 'bg-exception/10 text-exception') : 'bg-band',
                  )}
                >
                  <option.icon size={16} aria-hidden="true" />
                </span>
                <span className="capitalize">{option.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── How many ────────────────────────────────────────────────── */}
        <div>
          <p className="text-label uppercase text-muted-foreground" id="adjust-amount-label">
            How many {unit.plural}
          </p>
          <div className="mt-2 flex items-stretch overflow-hidden rounded-lg border border-input bg-control focus-within:border-ring">
            <button
              type="button"
              aria-label={`One fewer ${unit.singular}`}
              disabled={amount <= 1}
              onClick={() => setAmount((current) => Math.max(1, current - 1))}
              className="flex w-14 items-center justify-center text-muted-foreground transition-colors hover:bg-band hover:text-foreground disabled:opacity-40"
            >
              <Minus size={18} aria-hidden="true" />
            </button>
            <label className="flex flex-1 items-baseline justify-center gap-1.5 border-x border-rule/60 py-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                autoFocus
                aria-labelledby="adjust-amount-label"
                value={Number.isFinite(amount) && amount > 0 ? amount : ''}
                onChange={(event) => setAmount(Math.floor(Number(event.target.value)))}
                className="w-24 bg-transparent text-center text-3xl font-semibold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-sm text-muted-foreground">{amount === 1 ? unit.singular : unit.plural}</span>
            </label>
            <button
              type="button"
              aria-label={`One more ${unit.singular}`}
              onClick={() => setAmount((current) => (Number.isFinite(current) ? current : 0) + 1)}
              className="flex w-14 items-center justify-center text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick amounts">
            {presets.map((value) => (
              <Chip key={value} on={amount === value} onClick={() => setAmount(value)}>
                {value.toLocaleString()}
              </Chip>
            ))}
            {direction === 'remove' && balance > 0 && (
              <Chip on={amount === balance} onClick={() => setAmount(balance)}>
                All {balance.toLocaleString()}
              </Chip>
            )}
          </div>
        </div>

        {/* ── What it will be ─────────────────────────────────────────── */}
        <div className="rounded-lg border border-rule/60 bg-field p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
              <Icon size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-label uppercase text-muted-foreground">Now</p>
              <p data-figure className="text-xl font-semibold tabular-nums text-foreground">
                {balance.toLocaleString()}
              </p>
            </div>
            <ArrowRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-label uppercase text-muted-foreground">After</p>
              <p
                data-figure
                className={cn(
                  'text-xl font-semibold tabular-nums',
                  plan.belowZero ? 'text-exception' : plan.delta === 0 ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {plan.belowZero ? '—' : plan.after.toLocaleString()}
              </p>
            </div>
            {plan.delta !== 0 && !plan.belowZero && (
              <span
                className={cn(
                  'ml-auto shrink-0 rounded-md px-2 py-1 text-sm font-semibold tabular-nums',
                  plan.delta > 0 ? 'bg-momentum/10 text-momentum' : 'bg-exception/8 text-exception',
                )}
              >
                {plan.delta > 0 ? '+' : '−'}
                {Math.abs(plan.delta).toLocaleString()}
              </span>
            )}
          </div>
          {preview && !plan.belowZero && plan.delta !== 0 && (
            <div className="mt-4 border-t border-rule/45 pt-4">{preview(plan.after, plan.delta)}</div>
          )}
          {plan.belowZero && (
            <p role="alert" className="mt-3 flex items-start gap-2 border-t border-rule/45 pt-3 text-sm text-exception">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              Only {label(balance)} to remove — the balance can’t go below zero.
            </p>
          )}
        </div>

        {/* ── Why ─────────────────────────────────────────────────────── */}
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Common reasons">
            {REASONS.map((value) => (
              <Chip key={value} on={reason === value} onClick={() => setReason(reason === value ? '' : value)}>
                {value}
              </Chip>
            ))}
          </div>
          <Input
            label={reasonRequired ? 'Reason' : 'Reason (optional)'}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Or write your own"
            hint="Saved in the loyalty history and shown on their timeline."
            maxLength={255}
            required={reasonRequired}
          />
        </div>
      </form>
    </Modal>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-8 items-center rounded-md border px-2.5 text-xs font-semibold tabular-nums transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        on
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-rule/60 bg-background/60 text-muted-foreground hover:border-rule hover:bg-band/45 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
