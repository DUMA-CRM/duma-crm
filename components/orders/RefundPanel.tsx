'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Banknote, Clock, Coffee, CreditCard, HelpCircle, Loader2, Minus, PackageCheck, Plus, RotateCcw, Tag, User } from '@/components/icons';
import { type Choice, ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';

import { type OrderDetail, type RefundReason, createRefund, getRefundOptions } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type RefundSelection, refundAmount, refundLines, selectEverything } from '@/lib/utils/orders-list';
import { toast } from '@/stores/toastStore';

import { invalidateOrder } from './StatusMenu';

/*
 * The refund, inside the order's own drawer rather than a modal on top of it:
 * the same items, now selectable; why; where the money goes; one button that
 * says exactly how much. It starts from everything still refundable — the
 * common case — and lines come off for a partial one. Amounts are the API's
 * exact per-unit figures, so a discounted order refunds what was actually paid.
 */

export function useRefundDraft(order: OrderDetail, refundable: number, active: boolean, onDone: () => void) {
  const qc = useQueryClient();
  const options = useQuery({
    queryKey: moduleQueryKeys.payments.key('refund-options', order.id),
    queryFn: () => getRefundOptions(order.id),
    enabled: active,
  });
  const items = options.data?.items ?? [];
  const everything = selectEverything(items);
  const [selection, setSelection] = useState<RefundSelection | null>(null);
  const chosen = selection ?? everything;
  const [restock, setRestock] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<RefundReason | null>(null);
  const [notes, setNotes] = useState('');
  const amount = refundAmount(items, chosen);
  const lines = refundLines(items, chosen, restock);
  const isEverything = items.length > 0 && Math.abs(amount - refundAmount(items, everything)) < 0.001;

  const submit = useMutation({
    mutationFn: () => createRefund(order.id, { lines, reason: reason ?? 'other', notes: notes.trim() || undefined }),
    onSuccess: () => {
      invalidateOrder(qc, order.id);
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.payments.key('refund-options', order.id) });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-visits') });
      toast('success', `${Math.abs(amount - refundable) < 0.001 ? 'Full' : 'Partial'} refund recorded.`);
      setSelection(null);
      setRestock(new Set());
      setReason(null);
      setNotes('');
      onDone();
    },
    onError: (error) => toast('error', error.message || 'The refund wasn’t recorded. Check the amount and try again.'),
  });

  return {
    options,
    items,
    chosen,
    everything,
    isEverything,
    restock,
    reason,
    notes,
    amount,
    lines,
    submit,
    setQuantity: (key: string, value: number, max: number) => setSelection({ ...chosen, [key]: Math.max(0, Math.min(max, Math.floor(value || 0))) }),
    toggleItem: (item: (typeof items)[number]) => {
      const on = (chosen[`item:${item.id}`] ?? 0) === 0;
      const next = { ...chosen, [`item:${item.id}`]: on ? item.base.remainingQuantity : 0 };
      item.modifiers.forEach((modifier) => {
        next[`modifier:${modifier.id}`] = on ? modifier.remainingQuantity : 0;
      });
      setSelection(next);
      if (!on) setRestock((current) => new Set([...current].filter((id) => id !== item.id)));
    },
    toggleEverything: () => setSelection(isEverything ? {} : everything),
    toggleRestock: (id: string) =>
      setRestock((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    setReason,
    setNotes,
    canSubmit: lines.length > 0 && amount > 0 && amount <= refundable + 0.001 && reason !== null && !submit.isPending,
  };
}

export type RefundDraft = ReturnType<typeof useRefundDraft>;

const REASON_CHOICES: Choice<RefundReason>[] = [
  { value: 'customer_request', label: 'Customer asked', detail: 'Changed their mind or asked for it back', icon: User },
  { value: 'item_issue', label: 'Problem with an item', detail: 'Wrong, cold, or not as ordered', icon: Coffee },
  { value: 'service_issue', label: 'Service issue', detail: 'A long wait or a mix-up', icon: Clock },
  { value: 'duplicate_charge', label: 'Charged twice', detail: 'The same order paid for again', icon: CreditCard },
  { value: 'pricing_error', label: 'Wrong price', detail: 'Rung up at the wrong amount', icon: Tag },
  { value: 'other', label: 'Something else', detail: 'Say what in the note', icon: HelpCircle },
];

/** A titled block with no card around it — its rows and choices are already bordered. */
function PlainSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <header className="mb-3 flex min-h-8 items-center gap-3">
        <h3 className="min-w-0 flex-1 text-base font-semibold tracking-title text-foreground">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/** The refund, laid out as a settings page is: titled panels, rows with a switch on the right, a choice grid. */
export function RefundBody({
  draft,
  order,
  refundable,
  money,
}: {
  draft: RefundDraft;
  order: OrderDetail;
  refundable: number;
  money: (amount: string | number | null | undefined) => string;
}) {
  if (draft.options.isError) return <ErrorState title="What’s refundable couldn’t be loaded" onRetry={() => void draft.options.refetch()} />;
  if (draft.options.isPending)
    return (
      <div className="space-y-4" aria-hidden="true">
        <div className="h-48 animate-pulse rounded-lg bg-band/60" />
        <div className="h-56 animate-pulse rounded-lg bg-band/60" />
      </div>
    );

  const cash = order.paymentMethod === 'cash';
  const left = Math.max(0, refundable - draft.amount);
  const selectedCount = draft.items.filter((item) => (draft.chosen[`item:${item.id}`] ?? 0) > 0).length;
  const restockCount = draft.restock.size;

  return (
    <div className="space-y-5">
      <PlainSection
        title="What’s being refunded"
        action={
          <Button variant="ghost" size="sm" onClick={draft.toggleEverything}>
            {draft.isEverything ? 'Switch all off' : 'Switch all on'}
          </Button>
        }
      >
        <ul className="space-y-2">
          {draft.items.map((item) => {
            const key = `item:${item.id}`;
            const qty = draft.chosen[key] ?? 0;
            const selected = qty > 0;
            const gone = item.base.remainingQuantity === 0;
            const lineAmount = refundAmount([item], draft.chosen);
            const hasExtras = selected && (item.modifiers.length > 0 || !!item.canRestock);
            return (
              <li
                key={item.id}
                className={cn(
                  'overflow-hidden rounded-lg border transition-colors',
                  gone ? 'border-dashed border-rule/60 bg-transparent' : selected ? 'border-exception/35 bg-card' : 'border-rule/50 bg-background/60',
                )}
              >
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold transition-colors',
                      gone ? 'bg-band text-muted-foreground' : selected ? 'bg-exception/8 text-exception' : 'bg-band text-muted-foreground',
                    )}
                    aria-hidden="true"
                  >
                    {gone ? <RotateCcw size={16} /> : `${item.base.remainingQuantity}×`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-semibold', gone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                      {item.name}
                      {item.variantName && <span className="font-normal text-muted-foreground"> · {item.variantName}</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {gone ? 'Already refunded' : `${money(item.base.remainingAmount)} refundable`}
                    </span>
                  </span>
                  {selected && <span className="shrink-0 text-sm font-semibold text-exception">− {money(lineAmount)}</span>}
                  <Switch label={`Refund ${item.name}`} checked={selected} disabled={gone} onChange={() => draft.toggleItem(item)} />
                </div>

                {selected && item.base.remainingQuantity > 1 && (
                  <div className="flex items-center gap-2 border-t border-rule/45 px-3.5 py-2 text-xs text-muted-foreground">
                    <span>Refund</span>
                    <div className="flex h-7 items-center overflow-hidden rounded-md border border-rule/60 bg-background">
                      <button
                        type="button"
                        aria-label={`One fewer ${item.name}`}
                        disabled={qty <= 1}
                        onClick={() => draft.setQuantity(key, qty - 1, item.base.remainingQuantity)}
                        className="flex h-full w-7 items-center justify-center hover:bg-band disabled:opacity-40"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-foreground">{qty}</span>
                      <button
                        type="button"
                        aria-label={`One more ${item.name}`}
                        disabled={qty >= item.base.remainingQuantity}
                        onClick={() => draft.setQuantity(key, qty + 1, item.base.remainingQuantity)}
                        className="flex h-full w-7 items-center justify-center hover:bg-band disabled:opacity-40"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span>of {item.base.remainingQuantity}</span>
                  </div>
                )}

                {hasExtras && (
                  <ul className="space-y-2 border-t border-rule/45 bg-band/20 px-3.5 py-2.5">
                    {item.modifiers.map((modifier) => {
                      const mKey = `modifier:${modifier.id}`;
                      const on = (draft.chosen[mKey] ?? 0) > 0;
                      return (
                        <li key={modifier.id} className="flex items-center gap-3 border-l-2 border-rule/60 pl-3">
                          <span className="min-w-0 flex-1 text-sm text-foreground">
                            {modifier.name}
                            <span className="text-muted-foreground"> · {money(modifier.remainingAmount)}</span>
                          </span>
                          <Switch
                            label={`Refund ${modifier.name}`}
                            checked={on}
                            disabled={modifier.remainingQuantity === 0}
                            onChange={() => draft.setQuantity(mKey, on ? 0 : modifier.remainingQuantity, modifier.remainingQuantity)}
                          />
                        </li>
                      );
                    })}
                    {item.canRestock && (
                      <li className="flex items-center gap-3 border-l-2 border-primary/40 pl-3">
                        <PackageCheck size={15} className="shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-foreground">Put it back in stock</span>
                          <span className="block text-xs text-muted-foreground">It’s unopened and can be sold again</span>
                        </span>
                        <Switch label={`Put ${item.name} back in stock`} checked={draft.restock.has(item.id)} onChange={() => draft.toggleRestock(item.id)} />
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
          <span>
            {selectedCount} of {draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}
            {restockCount > 0 && ` · ${restockCount} back in stock`}
          </span>
          <span className="font-semibold text-foreground">{money(draft.amount)}</span>
        </p>
      </PlainSection>

      <PlainSection title="Why">
        <ChoiceGrid<RefundReason>
          label="Refund reason"
          shortcuts={false}
          choices={REASON_CHOICES}
          selected={draft.reason ? [draft.reason] : []}
          onChange={draft.setReason}
        />
        <input
          value={draft.notes}
          onChange={(event) => draft.setNotes(event.target.value)}
          maxLength={500}
          placeholder="A note for the record (optional)"
          aria-label="Refund note"
          className="mt-3 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
        />
      </PlainSection>

      <SettingsSection
        title="Where the money goes"
        footnote={left > 0 ? `${money(left)} will still be refundable after this.` : 'Nothing will be left to refund on this order.'}
      >
        <SettingRows>
          <SettingRow
            icon={cash ? Banknote : CreditCard}
            title={cash ? `Hand back ${money(draft.amount)} in cash` : `${money(draft.amount)} back to their card`}
            description={
              cash
                ? 'Hand the cash back first — this records the refund, it doesn’t open the till.'
                : 'Online card payments go back to the original card; it can take a few days to show.'
            }
          >
            {null}
          </SettingRow>
        </SettingRows>
      </SettingsSection>
    </div>
  );
}

export function RefundFooter({
  draft,
  money,
  onCancel,
}: {
  draft: RefundDraft;
  money: (amount: string | number | null | undefined) => string;
  onCancel: () => void;
}) {
  // One row, the same height as the order footer it replaces, so the drawer
  // doesn't jump when refund mode opens.
  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 truncate text-sm">
        {draft.reason ? (
          <>
            <span className="text-muted-foreground">Refund</span> <span className="font-semibold text-foreground">{money(draft.amount)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Choose why to continue</span>
        )}
      </p>
      <Button variant="outline" onClick={onCancel} disabled={draft.submit.isPending}>
        Back
      </Button>
      <Button variant="destructive" onClick={() => draft.submit.mutate()} disabled={!draft.canSubmit}>
        {draft.submit.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Record refund
      </Button>
    </div>
  );
}
