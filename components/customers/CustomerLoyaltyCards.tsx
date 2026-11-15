'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RowTile } from '@/components/cms/rows';
import { BalanceAdjustModal } from '@/components/customers/BalanceAdjustModal';
import { Drawer } from '@/components/customers/CustomerDialogs';
import { Modal } from '@/components/customers/CustomerDialogs';
import { AlertTriangle, Check, ChevronRight, Coffee, Gift, Minus, Plus, ShoppingBag, Tag, TicketPercent } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type CustomerLoyaltyProgram, adjustCustomerLoyaltyBalance, grantCustomerLoyaltyReward } from '@/lib/api/loyalty.service';
import { getMenuCategories, getMenuItems, getModifierGroups } from '@/lib/api/menu.service';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { rewardsCompleted } from '@/lib/utils/balance-adjust';
import { cn } from '@/lib/utils/cn';
import { describeRewardScope, getLoyaltyCardProgress } from '@/lib/utils/loyalty-card';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const STAMP_PRESETS = [1, 2, 3, 5] as const;

function unitLabel(programme: CustomerLoyaltyProgram, amount: number) {
  return amount === 1 ? programme.unitSingular : programme.unitPlural;
}

/**
 * A stamp card the way wallet passes draw one (Apple Wallet store cards, as
 * PassKit and Loopy issue them): a flat card in the brand colour — name and
 * count in the header, one strip of identical circles, filled for each stamp
 * earned and outlined for the rest, the reward as the last circle — then two
 * label/value fields. Staff actions sit under the card, not on it: the card is
 * what the guest sees.
 */
export function StampCard({
  programme,
  onAdjust,
  onGrant,
}: {
  programme: CustomerLoyaltyProgram;
  onAdjust?: () => void;
  onGrant?: () => void;
}) {
  const progress = getLoyaltyCardProgress(programme.balance, programme.rewardRule.cost);
  return (
    <div className="space-y-2">
      <article className="overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
        <header className="flex items-start justify-between gap-4 px-4 pt-3">
          {/* Coloured explicitly: the base heading colour would otherwise paint it dark on the brand fill. */}
          <h3 className="min-w-0 truncate pt-0.5 text-base font-semibold text-primary-foreground">{programme.name}</h3>
          <div className="shrink-0 text-right">
            <p className="text-micro font-semibold uppercase tracking-micro text-primary-foreground/70">{programme.unitPlural}</p>
            <p className="text-base font-semibold">
              {progress.stampsTowardNext}/{programme.rewardRule.cost}
            </p>
          </div>
        </header>

        {/* Fixed-size circles in rows, left to right — a wide card no longer spreads them into islands. */}
        <ol
          className="flex flex-wrap gap-1.5 px-4 pt-2 pb-3"
          aria-label={`${progress.stampsTowardNext} of ${programme.rewardRule.cost} ${programme.unitPlural} toward the next reward`}
        >
          {Array.from({ length: progress.slots }, (_, index) => {
            const filled = index < progress.filledSlots;
            const rewardSlot = index === progress.slots - 1;
            return (
              <li key={index} aria-hidden="true">
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full',
                    filled
                      ? 'bg-primary-foreground text-primary'
                      : rewardSlot
                        ? 'border-2 border-dashed border-primary-foreground/60 text-primary-foreground'
                        : 'border-2 border-primary-foreground/35',
                  )}
                >
                  {filled ? <Check className="size-1/2" strokeWidth={3} /> : rewardSlot ? <Gift className="size-[45%]" /> : null}
                </span>
              </li>
            );
          })}
        </ol>

        <dl className="grid grid-cols-2 gap-4 border-t border-primary-foreground/15 px-4 py-2.5">
          <div className="min-w-0">
            <dt className="text-micro font-semibold uppercase tracking-micro text-primary-foreground/70">Reward</dt>
            <dd className="truncate text-sm font-semibold">{rewardLabel(programme)}</dd>
          </div>
          {/* Rewards already earned are listed above the card, ready to use — not repeated here. */}
          <div className="min-w-0 text-right">
            <dt className="text-micro font-semibold uppercase tracking-micro text-primary-foreground/70">To go</dt>
            <dd className="truncate text-sm font-semibold">
              {progress.stampsRemaining} {unitLabel(programme, progress.stampsRemaining)}
            </dd>
          </div>
        </dl>
      </article>

      {(onGrant || onAdjust) && (
        <div className="flex justify-end gap-2">
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
      )}
    </div>
  );
}

export function rewardLabel(programme: CustomerLoyaltyProgram) {
  if (programme.rewardRule.kind === 'percentage_off') return `${programme.rewardRule.discountPercent ?? 0}% off`;
  return programme.rewardRule.kind === 'free_modifier' ? 'Free modifier' : 'Free item';
}

function rewardExpiryLabel(programme: CustomerLoyaltyProgram) {
  const expiry = programme.nextRewardExpiresAt ?? programme.rewards?.find((reward) => reward.expiresAt)?.expiresAt;
  if (expiry) {
    return `Use by ${formatInstant(expiry, { dateStyle: 'medium' })}.`;
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
function RewardRow({ programme, onOpen }: { programme: CustomerLoyaltyProgram; onOpen: () => void }) {
  const count = rewardCount(programme);
  return (
    <li className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <RowTile icon={Gift} tone="success" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {rewardLabel(programme)}
            {count > 1 && <span className="ml-1.5 font-normal text-muted-foreground">×{count}</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {programme.name} · {rewardExpiryLabel(programme)}
          </span>
        </span>
        <ChevronRight
          size={16}
          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

const fmtUseBy = (iso: string) => formatInstant(iso, { dateStyle: 'medium' });

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
  // A reward is redeemed at the Till; a hand-taken order has nowhere to apply it.
  const posOn = useModuleEnabled('pos');
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
      icon={TicketPercent}
      title={rewardLabel(programme)}
      description={programme.name}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="default" onClick={onClose} className="flex-1">
            Close
          </Button>
          {canOrder && posOn && (
            <Button size="default" onClick={() => router.push(`/pos?customer=${encodeURIComponent(customerId)}`)} className="flex-1">
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
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-stock text-on-fill shadow-sm">
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
          <h3 className="text-sm font-semibold text-heading">What it covers</h3>
          {scopeLoading ? (
            <div className="mt-2 flex flex-wrap gap-1.5" role="status" aria-busy="true" aria-label="Loading what it covers">
              {['w-24', 'w-32', 'w-20'].map((width) => (
                <Bone key={width} className={cn('h-7.5', width)} />
              ))}
            </div>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {scope.map((line) => (
                <li key={line} className="rounded-md border border-border bg-field px-2.5 py-1 text-sm text-foreground">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </section>

        {wallet.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-heading">In their wallet</h3>
            <ul className="mt-2 overflow-hidden rounded-lg border border-border bg-field">
              {wallet.map((reward, index) => (
                <li key={reward.id} className="flex items-center gap-3 border-b border-border px-3.5 py-3 last:border-b-0">
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
          <h3 className="text-sm font-semibold text-heading">How to use it</h3>
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
                // The card's circles: filled for a stamp, outlined for a gap.
                'flex size-7 items-center justify-center rounded-full border-2',
                added
                  ? 'border-momentum bg-momentum text-white'
                  : filled
                    ? 'border-primary bg-primary text-primary-foreground'
                    : removed
                      ? 'border-dashed border-exception/60 text-exception'
                      : 'border-rule',
              )}
            >
              {filled && <Check className="size-3.5" strokeWidth={3} />}
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
  stacked = false,
  framed = true,
}: {
  customerId: string;
  customerName: string;
  programmes: CustomerLoyaltyProgram[];
  canAdjust: boolean;
  /** Not for an erased record: there is no guest left to attach to an order. */
  canOrder: boolean;
  /** One column — for a narrow sidebar, where two cards side by side don't fit. */
  stacked?: boolean;
  /** False inside a section that already has the heading — the record's Loyalty section. */
  framed?: boolean;
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

  const body = (
    <>
      {available.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-heading">Ready to use</p>
          {/* A card per reward, two to a row — each is something to hand over, not a line in a table. */}
          <ul className={cn('grid gap-2', !stacked && 'sm:grid-cols-2')}>
            {available.map((programme) => (
              <RewardRow key={`reward-${programme.id}`} programme={programme} onOpen={() => setOpened(programme)} />
            ))}
          </ul>
        </div>
      )}
      {stampProgrammes.length > 0 && (
        <div className={cn('grid gap-4', !stacked && (stampProgrammes.length > 1 ? 'xl:grid-cols-2' : 'max-w-xl'))}>
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
    </>
  );
  if (!framed) return <div className="space-y-4">{body}</div>;
  return (
    <SettingsSection title="Loyalty cards" bodyClassName="space-y-4">
      {body}
    </SettingsSection>
  );
}
