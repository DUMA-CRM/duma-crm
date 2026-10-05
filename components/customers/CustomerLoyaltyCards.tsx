'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BalanceAdjustModal } from '@/components/customers/BalanceAdjustModal';
import { AlertTriangle, ChevronRight, Coffee, Gift, Minus, Plus, ShoppingBag, Sparkles, Tag } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Drawer } from '@/components/shared/Drawer';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type CustomerLoyaltyProgram, adjustCustomerLoyaltyBalance, grantCustomerLoyaltyReward } from '@/lib/api/loyalty.service';
import { getMenuCategories, getMenuItems, getModifierGroups } from '@/lib/api/menu.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { rewardsCompleted } from '@/lib/utils/balance-adjust';
import { cn } from '@/lib/utils/cn';
import { describeRewardScope, getLoyaltyCardProgress, stampColumns } from '@/lib/utils/loyalty-card';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const STAMP_PRESETS = [1, 2, 3, 5] as const;

function unitLabel(programme: CustomerLoyaltyProgram, amount: number) {
  return amount === 1 ? programme.unitSingular : programme.unitPlural;
}

/** A hand-stamped look: each impression lands a few degrees off, as a real one does. Fixed, so it never jitters. */
const STAMP_TILT = [-7, 4, -2, 6, -4, 3, -6, 5, -3, 7, -5, 2];

/**
 * A printed punch card: the programme's band across the top, a perforated tear
 * line, then the stamp grid on card stock with the reward as the last slot —
 * the way Loopy Loyalty and Stamp Me draw theirs, and the way a guest already
 * pictures their card. A stamp is an ink impression, not a tick in a box.
 */
function StampCard({ programme, onAdjust, onGrant }: { programme: CustomerLoyaltyProgram; onAdjust?: () => void; onGrant?: () => void }) {
  const progress = getLoyaltyCardProgress(programme.balance, programme.rewardRule.cost);
  const columns = stampColumns(progress.slots);

  return (
    <article className="relative overflow-hidden rounded-xl border border-rule/60 bg-card shadow-sm">
      {/* ── The band ─────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-primary px-5 pt-4 pb-5 text-primary-foreground">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-14 -right-10 size-40 rounded-full border border-primary-foreground/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-7 -right-3 size-24 rounded-full border border-primary-foreground/10"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-micro text-primary-foreground/70">
              <Coffee size={13} aria-hidden="true" /> Stamp card
            </p>
            <h3 className="mt-1.5 truncate text-lg font-semibold">{programme.name}</h3>
            <p className="mt-0.5 text-sm text-primary-foreground/75">
              Collect {programme.rewardRule.cost} {unitLabel(programme, programme.rewardRule.cost)}, get{' '}
              {rewardLabel(programme).toLowerCase()}
            </p>
          </div>
          {progress.rewardCount > 0 && (
            <span className="shrink-0 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-2.5 py-1 text-xs font-semibold tabular-nums">
              {progress.rewardCount} earned
            </span>
          )}
        </div>
      </header>

      {/* ── Perforation ──────────────────────────────────────────────────
          Notches punched from each edge, joined by the tear line. They take
          the panel's own colour, so they read as holes in the card. */}
      <div aria-hidden="true" className="relative h-0">
        <span className="absolute top-0 -left-3 size-6 -translate-y-1/2 rounded-full border border-rule/60 bg-field" />
        <span className="absolute top-0 -right-3 size-6 -translate-y-1/2 rounded-full border border-rule/60 bg-field" />
        <span className="absolute inset-x-4 -top-px border-t-2 border-dashed border-card" />
      </div>

      {/* ── The stamps ───────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <ol
          className="mx-auto grid max-w-md gap-2.5 sm:gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          aria-label={`${progress.stampsTowardNext} of ${programme.rewardRule.cost} ${programme.unitPlural} toward the next reward`}
        >
          {Array.from({ length: progress.slots }, (_, index) => {
            const filled = index < progress.filledSlots;
            const rewardSlot = index === progress.slots - 1;
            return (
              <li key={index} aria-hidden="true" className="flex justify-center">
                {filled ? (
                  <span
                    className="relative flex aspect-square w-full max-w-16 items-center justify-center rounded-full border-2 border-primary/80 bg-primary/10 text-primary"
                    style={{ transform: `rotate(${STAMP_TILT[index % STAMP_TILT.length]}deg)` }}
                  >
                    {/* The inner ring is what makes a circle read as a rubber stamp. */}
                    <span className="absolute inset-1 rounded-full border border-dashed border-primary/45" />
                    <Coffee className="size-[42%]" strokeWidth={2.2} />
                  </span>
                ) : rewardSlot ? (
                  <span className="flex aspect-square w-full max-w-16 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-dashed border-stock/55 bg-stock/6 text-stock">
                    <Gift className="size-[34%]" />
                    <span className="text-[0.6rem] font-bold uppercase tracking-micro">Free</span>
                  </span>
                ) : (
                  <span className="flex aspect-square w-full max-w-16 items-center justify-center rounded-full border-2 border-dashed border-rule bg-band/30 text-xs font-semibold tabular-nums text-muted-foreground/60">
                    {index + 1}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── The back of the card ─────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-rule/45 bg-band/25 px-5 py-3">
        <div>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {progress.stampsTowardNext} of {programme.rewardRule.cost} {programme.unitPlural}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {progress.stampsRemaining} more {unitLabel(programme, progress.stampsRemaining)} to the next reward
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onGrant && (
            <Button type="button" variant="ghost" size="sm" onClick={onGrant}>
              <Gift data-icon="inline-start" /> Give reward
            </Button>
          )}
          {onAdjust && (
            <Button type="button" variant="outline" size="sm" onClick={onAdjust}>
              <Plus data-icon="inline-start" /> Adjust {programme.unitPlural}
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}

export function rewardLabel(programme: CustomerLoyaltyProgram) {
  if (programme.rewardRule.kind === 'percentage_off') return `${programme.rewardRule.discountPercent ?? 0}% off`;
  return programme.rewardRule.kind === 'free_modifier' ? 'Free modifier' : 'Free item';
}

function rewardExpiryLabel(programme: CustomerLoyaltyProgram) {
  const expiry = programme.nextRewardExpiresAt ?? programme.rewards?.find((reward) => reward.expiresAt)?.expiresAt;
  if (expiry) {
    return `Use by ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(expiry))}.`;
  }
  const validity = programme.rewardRule.validity;
  if (validity?.type === 'days') return `Valid for ${validity.days ?? 1} days after issue.`;
  if (validity?.type === 'end_of_year') return 'Valid until the end of the year.';
  if (validity?.type === 'date' && validity.date) {
    return `Use by ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(`${validity.date}T12:00:00Z`))}.`;
  }
  return 'No expiry.';
}

function rewardCount(programme: CustomerLoyaltyProgram) {
  return programme.rewards?.length || Math.floor(programme.balance / programme.rewardRule.cost);
}

/**
 * A reward ready to spend, drawn as a voucher: a tear-off stub with the gift,
 * what it is and when it runs out. The whole voucher opens the detail — like
 * Square's "Reward available", it is the thing staff act on, so it is a button.
 */
function RewardVoucher({ programme, onOpen }: { programme: CustomerLoyaltyProgram; onOpen: () => void }) {
  const count = rewardCount(programme);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex w-full items-stretch overflow-hidden rounded-lg border border-stock/40 bg-stock/8 text-left transition-colors hover:border-stock/60 hover:bg-stock/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex w-16 shrink-0 items-center justify-center bg-stock text-white">
        <Sparkles size={20} aria-hidden="true" />
      </span>
      {/* The stub's tear line, with a notch punched top and bottom. */}
      <span aria-hidden="true" className="relative w-0 border-l-2 border-dashed border-stock/45">
        <span className="absolute -top-2 -left-2 size-4 rounded-full border border-stock/40 bg-field" />
        <span className="absolute -bottom-2 -left-2 size-4 rounded-full border border-stock/40 bg-field" />
      </span>
      <span className="min-w-0 flex-1 px-4 py-3">
        <span className="block text-micro font-semibold uppercase tracking-micro text-stock">Reward ready</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
          {rewardLabel(programme)} · {programme.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{rewardExpiryLabel(programme)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 pr-4">
        {count > 1 && <span className="text-lg font-semibold tabular-nums text-stock">×{count}</span>}
        <ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </button>
  );
}

const fmtUseBy = (iso: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(iso));

/**
 * Everything about a ready reward: what it is, what it covers, each one in the
 * wallet with its own use-by date, and how to spend it. Spending happens at the
 * till — that is where the order is — so the one action here takes the guest
 * there, attached.
 */
function RewardDrawer({
  customerId,
  programme,
  canOrder,
  onClose,
}: {
  customerId: string;
  programme: CustomerLoyaltyProgram;
  canOrder: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const rule = programme.rewardRule;
  const needsItems = rule.kind !== 'free_modifier' && rule.menuItemIds.length > 0;
  const needsCategories = rule.kind !== 'free_modifier' && rule.categoryIds.length > 0;
  const needsGroups = rule.kind === 'free_modifier' && rule.modifierGroupIds.length > 0;

  // The programme editor's own keys, so a visit there has already warmed them.
  // A failure falls back to counts (`describeRewardScope`), never to "any item".
  const items = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: needsItems,
  });
  const categories = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId ?? undefined),
    enabled: needsCategories,
  });
  const groups = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifier-groups', tenantId),
    queryFn: () => getModifierGroups(tenantId ?? undefined),
    enabled: needsGroups,
  });
  const toMap = (rows?: { id: string; name: string }[]) => (rows ? new Map(rows.map((row) => [row.id, row.name])) : undefined);
  const scopeLoading = (needsItems && items.isPending) || (needsCategories && categories.isPending) || (needsGroups && groups.isPending);
  const scope = describeRewardScope(rule, {
    items: toMap(items.data),
    categories: toMap(categories.data),
    modifierGroups: toMap(groups.data),
  });

  const count = rewardCount(programme);
  const wallet = programme.rewards ?? [];

  return (
    <Drawer
      title={rewardLabel(programme)}
      description={programme.name}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onClose} className="flex-1">
            Close
          </Button>
          {canOrder && (
            <Button size="lg" onClick={() => router.push(`/pos?customer=${customerId}`)} className="flex-1">
              <ShoppingBag data-icon="inline-start" />
              Use in an order
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* The voucher itself, large. */}
        <div className="relative overflow-hidden rounded-xl border border-stock/40 bg-stock/8 p-5 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-stock text-white shadow-sm">
            <Gift size={24} aria-hidden="true" />
          </span>
          <p className="mt-3 text-micro font-semibold uppercase tracking-micro text-stock">Ready to use</p>
          <p className="mt-1 text-2xl font-semibold tracking-headline text-foreground">{rewardLabel(programme)}</p>
          {rule.kind === 'percentage_off' && rule.maxDiscountCents !== null && (
            <p className="mt-1 text-sm text-muted-foreground">Capped at {(rule.maxDiscountCents / 100).toFixed(2)} off</p>
          )}
          <p className="mt-2 text-sm tabular-nums text-muted-foreground">
            {count} in their wallet · {rewardExpiryLabel(programme)}
          </p>
        </div>

        <section>
          <h3 className="text-sm font-semibold text-foreground">What it covers</h3>
          {scopeLoading ? (
            <div className="mt-2 h-10 animate-pulse rounded-lg bg-band/60" aria-label="Loading what it covers" />
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {scope.map((line) => (
                <li key={line} className="rounded-md border border-rule/60 bg-background/60 px-2.5 py-1 text-sm text-foreground">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </section>

        {wallet.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-foreground">In their wallet</h3>
            <ul className="mt-2 overflow-hidden rounded-lg border border-rule/60 bg-card">
              {wallet.map((reward, index) => (
                <li key={reward.id} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-stock/10 text-stock">
                    <Tag size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">Reward {index + 1}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {reward.expiresAt ? `Use by ${fmtUseBy(reward.expiresAt)}` : 'No expiry'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold text-foreground">How to use it</h3>
          <ol className="mt-3 space-y-3">
            {[
              'Start an order — they come with it, already attached.',
              'Add the item the reward is for.',
              'Tap Customer rewards on the ticket and choose this one.',
            ].map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm text-foreground">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Drawer>
  );
}

function AdjustmentModal({
  customerId,
  customerName,
  programme,
  onClose,
}: {
  customerId: string;
  customerName: string;
  programme: CustomerLoyaltyProgram;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const adjustment = useMutation({
    mutationFn: ({ delta, reason }: { delta: number; reason: string }) =>
      adjustCustomerLoyaltyBalance(customerId, { programId: programme.id, delta, reason }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('loyalty-wallet', customerId) });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-timeline', customerId) });
      onClose();
      toast('success', `${programme.unitPlural} updated — balance is now ${result.balance}.`);
    },
    onError: (error) => toast('error', error.message || `The ${programme.unitPlural} could not be updated.`),
  });

  return (
    <BalanceAdjustModal
      title={`Adjust ${programme.unitPlural}`}
      subject={`${customerName} · ${programme.name}`}
      icon={Coffee}
      unit={{ singular: programme.unitSingular, plural: programme.unitPlural }}
      balance={programme.balance}
      presets={STAMP_PRESETS}
      reasonRequired
      pending={adjustment.isPending}
      onSubmit={(delta, reason) => adjustment.mutate({ delta, reason })}
      onClose={onClose}
      preview={(after) => <StampPreview programme={programme} after={after} />}
    />
  );
}

/**
 * The card as it will look: stamps kept, stamps being added (highlighted) and
 * stamps being taken off (dashed red) — so "+2" is seen landing on the card,
 * not just added to a number. A change that fills the card says so instead.
 */
function StampPreview({ programme, after }: { programme: CustomerLoyaltyProgram; after: number }) {
  const cost = programme.rewardRule.cost;
  const completed = rewardsCompleted(programme.balance, after, cost);
  const before = getLoyaltyCardProgress(programme.balance, cost);
  const next = getLoyaltyCardProgress(after, cost);
  // Across a completed (or reversed) reward the two cards are different cards,
  // so only the new one is drawn, without the before/after highlighting.
  const sameCard = completed === 0;

  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap gap-1.5" aria-label={`${next.stampsTowardNext} of ${cost} after the change`}>
        {Array.from({ length: next.slots }, (_, index) => {
          const filled = index < next.filledSlots;
          const added = sameCard && filled && index >= before.filledSlots;
          const removed = sameCard && !filled && index < before.filledSlots;
          return (
            <li
              key={index}
              aria-hidden="true"
              className={cn(
                'flex size-7 items-center justify-center rounded-full border-2',
                added
                  ? 'border-momentum bg-momentum/15 text-momentum'
                  : filled
                    ? 'border-primary/80 bg-primary/10 text-primary'
                    : removed
                      ? 'border-dashed border-exception/60 text-exception'
                      : 'border-dashed border-rule',
              )}
            >
              {filled && <Coffee className="size-3.5" strokeWidth={2.2} />}
              {removed && <Minus className="size-3" />}
            </li>
          );
        })}
      </ol>
      <p className="flex items-center gap-2 text-sm text-foreground">
        {completed > 0 ? (
          <>
            <Gift size={16} className="shrink-0 text-stock" aria-hidden="true" />
            <span>
              <span className="font-semibold">Completes {completed === 1 ? 'a reward' : `${completed} rewards`}</span>{' '}
              <span className="text-muted-foreground">— {rewardLabel(programme).toLowerCase()}, and the card starts again.</span>
            </span>
          </>
        ) : completed < 0 ? (
          <>
            <AlertTriangle size={16} className="shrink-0 text-exception" aria-hidden="true" />
            <span>Takes back {Math.abs(completed) === 1 ? 'an earned reward' : `${Math.abs(completed)} earned rewards`}.</span>
          </>
        ) : (
          <span className="text-muted-foreground">
            {next.stampsRemaining} more {unitLabel(programme, next.stampsRemaining)} to the next reward.
          </span>
        )}
      </p>
    </div>
  );
}

export function GrantRewardModal({
  customerId,
  customerName,
  programme,
  onClose,
}: {
  customerId: string;
  customerName: string;
  programme: CustomerLoyaltyProgram;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('Birthday or goodwill reward');
  const grant = useMutation({
    mutationFn: () => grantCustomerLoyaltyReward(customerId, { programId: programme.id, quantity: 1, reason: reason.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('loyalty-wallet', customerId) });
      onClose();
      toast('success', `${rewardLabel(programme)} added to ${customerName}’s wallet.`);
    },
    onError: (error) => toast('error', error.message || 'The reward could not be added.'),
  });
  return (
    <Modal
      title="Give a reward"
      description={`${customerName} · ${programme.name}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form="give-loyalty-reward" disabled={grant.isPending || reason.trim().length < 2} className="flex-1">
            {grant.isPending ? 'Adding…' : `Give ${rewardLabel(programme)}`}
          </Button>
        </div>
      }
    >
      <form
        id="give-loyalty-reward"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim().length >= 2) grant.mutate();
        }}
      >
        <div className="rounded-sm border border-stock/30 bg-stock/8 p-4">
          <p className="text-micro font-semibold uppercase tracking-micro text-stock">Reward</p>
          <p className="mt-1 text-base font-semibold text-foreground">{rewardLabel(programme)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This appears immediately as a separate reward card. Stamp progress stays unchanged. {rewardExpiryLabel(programme)}
          </p>
        </div>
        <Input
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={2}
          maxLength={255}
          required
          hint="Recorded in the loyalty history."
        />
      </form>
    </Modal>
  );
}

export function CustomerLoyaltyCards({
  customerId,
  customerName,
  programmes,
  canAdjust,
  canOrder,
}: {
  customerId: string;
  customerName: string;
  programmes: CustomerLoyaltyProgram[];
  canAdjust: boolean;
  /** Not for an erased record: there is no guest left to attach to an order. */
  canOrder: boolean;
}) {
  const [selected, setSelected] = useState<CustomerLoyaltyProgram | null>(null);
  const [granting, setGranting] = useState<CustomerLoyaltyProgram | null>(null);
  const [opened, setOpened] = useState<CustomerLoyaltyProgram | null>(null);
  const rewardProgrammes = programmes.filter((programme) => (programme.earnRule.benefitMode ?? 'rewards') !== 'points');
  // Birthday programmes have no stamps to show; giving one by hand is an
  // action, and lives with the others in the record's Actions panel.
  const stampProgrammes = rewardProgrammes.filter((programme) => programme.earnRule.trigger !== 'birthday');
  const available = rewardProgrammes.filter((programme) => programme.canRedeem);
  if (stampProgrammes.length === 0 && available.length === 0) return null;

  return (
    <SettingsSection
      title="Loyalty cards"
      description="Rewards ready to spend, then each stamp card as the guest carries it."
      actions={<span className="text-xs text-muted-foreground">{stampProgrammes.length} active</span>}
      bodyClassName="space-y-4"
    >
      {available.length > 0 && (
        <div className="grid gap-2.5 xl:grid-cols-2">
          {available.map((programme) => (
            <RewardVoucher key={`reward-${programme.id}`} programme={programme} onOpen={() => setOpened(programme)} />
          ))}
        </div>
      )}
      {stampProgrammes.length > 0 && (
        <div className="grid gap-4 2xl:grid-cols-2">
          {stampProgrammes.map((programme) => (
            <StampCard
              key={programme.id}
              programme={programme}
              onAdjust={canAdjust ? () => setSelected(programme) : undefined}
              onGrant={canAdjust ? () => setGranting(programme) : undefined}
            />
          ))}
        </div>
      )}
      {opened && <RewardDrawer customerId={customerId} programme={opened} canOrder={canOrder} onClose={() => setOpened(null)} />}
      {selected && (
        <AdjustmentModal customerId={customerId} customerName={customerName} programme={selected} onClose={() => setSelected(null)} />
      )}
      {granting && (
        <GrantRewardModal customerId={customerId} customerName={customerName} programme={granting} onClose={() => setGranting(null)} />
      )}
    </SettingsSection>
  );
}
