'use client';

import { AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Gift,
  History,
  Minus,
  MoreHorizontal,
  Pause,
  Plus,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  TicketPercent,
  Trash2,
  UserPlus,
  UtensilsCrossed,
  X,
} from '@/components/icons';
import { CartRow } from '@/components/pos/CartRow';
import { ChoiceToggle } from '@/components/pos/ChoiceToggle';
import { CustomerAttach, type CustomerView } from '@/components/pos/CustomerAttach';
import { ItemCustomiser } from '@/components/pos/ItemCustomiser';
import { PromoCodeEntry } from '@/components/pos/PromoCodeEntry';
import { Avatar } from '@/components/shared/Avatar';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone } from '@/components/shared/Skeleton';
import { SwipeRoot } from '@/components/swipe-actions';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import type { CustomerLoyaltyProgram } from '@/lib/api/loyalty.service';
import { cn } from '@/lib/utils/cn';
import { type OptionGroupRule, cartCount, cartTotal, formatPrice } from '@/lib/utils/pos';
import { formatInstant } from '@/lib/utils/workspace-time';
import type { HeldTicket } from '@/stores/heldTicketsStore';
import { usePosSettingsStore } from '@/stores/posSettingsStore';
import { Customer } from '@/types/customers';
import type { AppliedLoyaltyReward, CartItem, MenuItem, MenuOption } from '@/types/pos';

interface OrderPanelProps {
  cart: CartItem[];
  selectedItem: MenuItem | null;
  groups: OptionGroupRule[] | null;
  onAddToCart: (selected: MenuOption[], quantity: number, note: string) => void;
  onCancelItem: () => void;
  /** The ticket line open in the editor, when the customiser is changing one rather than adding. */
  editingLine: CartItem | null;
  /** Opens a ticket line in the customiser. */
  onEditLine: (cartId: string) => void;
  onSaveLine: (selected: MenuOption[], quantity: number, note: string) => void;
  onRemove: (cartId: string) => void;
  /** The last removed line, offered back for a few seconds. */
  removed: CartItem | null;
  onUndoRemove: () => void;
  flashId: string | null;
  onClearCart: () => void;
  selectedCustomer: Customer | null;
  onCustomerSelect: (c: Customer | null) => void;
  loyaltyProgrammes: CustomerLoyaltyProgram[];
  loyaltyLoading: boolean;
  loyaltyRewards: AppliedLoyaltyReward[];
  onLoyaltyRewards: (rewards: AppliedLoyaltyReward[]) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  /** Eat in or takeaway; null when not chosen. */
  orderType: 'eat_in' | 'takeaway' | null;
  onOrderTypeChange: (value: 'eat_in' | 'takeaway' | null) => void;
  held: HeldTicket[];
  onHold: () => void;
  onResume: (id: string) => void;
  onDiscardHeld: (id: string) => void;
  onCharge: () => void;
  currency?: string;
  /** Present when the promotions module is on for this workspace. */
  promo?: React.ComponentProps<typeof PromoCodeEntry> | undefined;
}

export function OrderPanel(props: OrderPanelProps) {
  const {
    cart,
    selectedItem,
    groups,
    onAddToCart,
    onCancelItem,
    editingLine,
    onEditLine,
    onSaveLine,
    onRemove,
    removed,
    onUndoRemove,
    flashId,
    onClearCart,
    selectedCustomer,
    onCustomerSelect,
    loyaltyProgrammes,
    loyaltyLoading,
    loyaltyRewards,
    onLoyaltyRewards,
    notes,
    onNotesChange,
    orderType,
    onOrderTypeChange,
    held,
    onHold,
    onResume,
    onDiscardHeld,
    onCharge,
    currency,
    promo,
  } = props;
  const [view, setView] = useState<'ticket' | 'customer' | 'held' | 'rewards'>('ticket');
  const [customerView, setCustomerView] = useState<CustomerView>('find');
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  // Set when a ⋯ item opens a field: the menu then doesn't hand focus back to ⋯ as it
  // closes, which used to pull the cursor out of the field just opened — typing went nowhere.
  const openingField = useRef(false);
  const swipeToRemove = usePosSettingsStore((state) => state.swipeToRemove);

  // "Clear" is armed by the first tap and fires on the second — no dialog, and no accidental wipe.
  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  const count = cartCount(cart);
  const loyaltyDiscount = loyaltyRewards.reduce((sum, reward) => sum + reward.discountCents, 0);
  // The promo's saving is the API's estimate; the order's own total replaces it at Charge.
  const subtotal = cartTotal(cart);
  const promoDiscount = promo?.discountCents ?? 0;
  const total = Math.max(0, subtotal - loyaltyDiscount - promoDiscount);
  const empty = cart.length === 0;

  let body: React.ReactNode;
  if (selectedItem) {
    body = (
      <ItemCustomiser
        key={editingLine?.cartId ?? selectedItem.id}
        item={selectedItem}
        groups={groups}
        onAdd={editingLine ? onSaveLine : onAddToCart}
        onCancel={onCancelItem}
        currency={currency}
        editing={
          editingLine
            ? { quantity: editingLine.quantity, selectedIds: editingLine.selected.map((option) => option.id), note: editingLine.note ?? '' }
            : undefined
        }
        onRemove={
          editingLine
            ? () => {
                onRemove(editingLine.cartId);
                onCancelItem();
              }
            : undefined
        }
      />
    );
  } else if (view === 'customer') {
    body = (
      <CustomerAttach
        initialView={customerView}
        current={selectedCustomer}
        onRemove={() => {
          onCustomerSelect(null);
          setView('ticket');
        }}
        onSelect={(customer) => {
          onCustomerSelect(customer);
          setView('ticket');
        }}
        onClose={() => setView('ticket')}
      />
    );
  } else if (view === 'held') {
    body = (
      <>
        <PanelHeader title="Held tickets" onBack={() => setView('ticket')} />
        <div className="min-h-0 flex-1 overflow-auto">
          {held.length === 0 ? (
            <PanelEmpty
              icon={History}
              title="Nothing on hold"
              description="Hold a ticket to serve the next customer, then pick it up here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {held.map((ticket) => (
                <li key={ticket.id} className="flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResume(ticket.id);
                      setView('ticket');
                    }}
                    disabled={!empty}
                    className="flex min-h-16 min-w-0 flex-1 touch-manipulation items-center gap-3 py-2.5 pl-4 text-left transition-colors duration-75 enabled:active:bg-band disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    {ticket.customer && (
                      <Avatar name={`${ticket.customer.firstName} ${ticket.customer.lastName}`} email={ticket.customer.email} size="sm" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col justify-center">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[15px] font-semibold text-heading">{ticket.name}</span>
                        <span data-figure className="shrink-0 text-[15px] font-semibold tabular-nums text-heading">
                          {formatPrice(cartTotal(ticket.cart), currency)}
                        </span>
                      </span>
                      <span className="truncate text-[13px] text-muted-foreground">
                        {cartCount(ticket.cart)} item{cartCount(ticket.cart) === 1 ? '' : 's'} · held <RelativeTime iso={ticket.heldAt} />
                      </span>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDiscardHeld(ticket.id)}
                    aria-label={`Discard ${ticket.name}`}
                    className="size-11 shrink-0 text-muted-foreground hover:bg-destructive/8 hover:text-destructive"
                  >
                    <Trash2 size={17} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!empty && held.length > 0 && (
          <p className="shrink-0 border-t border-border bg-band/40 px-4 py-3 text-sm text-muted-foreground">
            Charge or hold the current ticket before picking one up.
          </p>
        )}
      </>
    );
  } else if (view === 'rewards') {
    body = (
      <>
        <PanelHeader title="Customer rewards" onBack={() => setView('ticket')} />
        <div className="min-h-0 flex-1 overflow-auto">
          {loyaltyLoading ? (
            <div className="divide-y divide-border" role="status" aria-busy="true" aria-label="Loading customer rewards">
              {[0, 1].map((row) => (
                <div key={row} className="space-y-3 px-4 py-4" aria-hidden="true">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <Bone className={row === 0 ? 'h-4 w-36' : 'h-4 w-28'} />
                      <Bone className="h-3 w-48 max-w-full" />
                    </span>
                    <Bone className="h-6 w-14 shrink-0 rounded-full" />
                  </div>
                  <Bone className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : loyaltyProgrammes.length === 0 ? (
            <PanelEmpty
              icon={Gift}
              title="No active rewards"
              description="This customer will see programmes here when an active loyalty rule applies at this location."
            />
          ) : (
            <div className="divide-y divide-border">
              {loyaltyProgrammes.map((programme) => {
                const targets: Array<{ cartId: string; modifierId?: string; name: string; discount: number; maxQuantity: number }> =
                  programme.rewardRule.kind !== 'free_modifier'
                    ? cart.flatMap((line) => {
                        const itemAllowed =
                          programme.rewardRule.menuItemIds.length === 0 || programme.rewardRule.menuItemIds.includes(line.item.id);
                        const categoryAllowed =
                          programme.rewardRule.categoryIds.length === 0 || programme.rewardRule.categoryIds.includes(line.item.category);
                        const baseDiscount =
                          programme.rewardRule.kind === 'percentage_off'
                            ? Math.round((line.item.price * (programme.rewardRule.discountPercent ?? 0)) / 100)
                            : line.item.price;
                        const discount = Math.min(baseDiscount, programme.rewardRule.maxDiscountCents ?? Number.MAX_SAFE_INTEGER);
                        return itemAllowed && categoryAllowed && discount > 0
                          ? [{ cartId: line.cartId, name: line.item.name, discount, maxQuantity: line.quantity }]
                          : [];
                      })
                    : cart.flatMap((line) =>
                        line.selected.flatMap((modifier) => {
                          const allowed = Boolean(modifier.groupId && programme.rewardRule.modifierGroupIds.includes(modifier.groupId));
                          const discount = Math.min(modifier.price, programme.rewardRule.maxDiscountCents ?? Number.MAX_SAFE_INTEGER);
                          return allowed && discount > 0
                            ? [
                                {
                                  cartId: line.cartId,
                                  modifierId: modifier.id,
                                  name: `${modifier.label} on ${line.item.name}`,
                                  discount,
                                  maxQuantity: line.quantity,
                                },
                              ]
                            : [];
                        }),
                      );
                const enough = programme.canRedeem;
                const rewardsAvailable = programme.rewards?.length ?? Math.floor(programme.balance / programme.rewardRule.cost);
                const nextProgress = programme.balance % programme.rewardRule.cost;
                return (
                  <section key={programme.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-heading">{programme.name}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {nextProgress} of {programme.rewardRule.cost} {programme.unitPlural} on the next card
                        </p>
                        {programme.nextRewardExpiresAt && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Earliest reward expires {formatInstant(programme.nextRewardExpiresAt, { dateStyle: 'medium' })}
                          </p>
                        )}
                      </div>
                      <span className={cn('text-label uppercase', enough ? 'text-primary' : 'text-muted-foreground')}>
                        {enough ? `${rewardsAvailable} ready` : `${programme.rewardRule.cost - nextProgress} to go`}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-band">
                      <div
                        className="h-full bg-primary transition-[width]"
                        style={{ width: `${Math.min(100, (nextProgress / programme.rewardRule.cost) * 100)}%` }}
                      />
                    </div>
                    {enough && targets.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {targets.map((target) => {
                          const rewardIndex = loyaltyRewards.findIndex(
                            (reward) =>
                              reward.programId === programme.id &&
                              reward.cartId === target.cartId &&
                              reward.modifierId === target.modifierId,
                          );
                          const selected = rewardIndex >= 0 ? loyaltyRewards[rewardIndex] : null;
                          const usedByProgramme = loyaltyRewards
                            .filter((reward) => reward.programId === programme.id)
                            .reduce((sum, reward) => sum + reward.quantity, 0);
                          const usedOnLine = loyaltyRewards
                            .filter((reward) => reward.cartId === target.cartId)
                            .reduce((sum, reward) => sum + reward.quantity, 0);
                          const remainingRewards = Math.max(0, rewardsAvailable - usedByProgramme);
                          const canAdd = usedOnLine < target.maxQuantity && remainingRewards > 0;
                          const changeQuantity = (delta: number) => {
                            const nextQuantity = Math.max(0, Math.min(target.maxQuantity, (selected?.quantity ?? 0) + delta));
                            const next = loyaltyRewards.filter((_, index) => index !== rewardIndex);
                            if (nextQuantity > 0) {
                              next.push({
                                programId: programme.id,
                                cartId: target.cartId,
                                modifierId: target.modifierId,
                                quantity: nextQuantity,
                                unitDiscountCents: target.discount,
                                discountCents: target.discount * nextQuantity,
                                label: programme.name,
                              });
                            }
                            onLoyaltyRewards(next);
                          };
                          return (
                            <div
                              key={`${target.cartId}:${target.modifierId ?? 'item'}`}
                              className={cn(
                                'flex min-h-14 w-full items-center gap-3 rounded-md border px-3 text-left text-sm transition-colors',
                                selected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-band/40',
                              )}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-foreground">{target.name}</span>
                                <span className="block text-xs text-muted-foreground">
                                  Save {formatPrice(target.discount, currency)} each
                                </span>
                              </span>
                              <div
                                className="flex shrink-0 items-center rounded-md border border-border bg-field"
                                aria-label={`Rewards applied to ${target.name}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(-1)}
                                  disabled={!selected}
                                  aria-label={`Remove one ${programme.name} reward from ${target.name}`}
                                  className="flex size-11 items-center justify-center text-muted-foreground disabled:opacity-30"
                                >
                                  <Minus size={16} aria-hidden="true" />
                                </button>
                                <span
                                  data-figure
                                  className="min-w-7 text-center font-semibold tabular-nums text-foreground"
                                  aria-live="polite"
                                >
                                  {selected?.quantity ?? 0}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(1)}
                                  disabled={!canAdd}
                                  aria-label={`Use one ${programme.name} reward on ${target.name}`}
                                  className="flex size-11 items-center justify-center text-primary disabled:text-muted-foreground disabled:opacity-30"
                                >
                                  <Plus size={16} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : enough ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Add an eligible {programme.rewardRule.kind === 'free_modifier' ? 'modifier' : 'item'} to this ticket.
                      </p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  } else {
    body = (
      <>
        {/* The ticket's own bar: what it is and who it's for on the left; the
            customer, held tickets, and the rarer actions behind ⋮ on the right. */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border pr-2 pl-4">
          <div className="min-w-0">
            <p className="text-base leading-tight font-semibold text-heading">
              Ticket
              {count > 0 && (
                <span className="ml-1.5 text-sm font-normal tabular-nums text-muted-foreground">
                  · {count} item{count === 1 ? '' : 's'}
                </span>
              )}
            </p>
            {selectedCustomer && (
              <p className="truncate text-xs text-muted-foreground">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
                <span data-figure className="tabular-nums">
                  {' '}
                  · {(selectedCustomer.pointsBalance ?? 0).toLocaleString()} pts
                </span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setCustomerView('find');
                setView('customer');
              }}
              aria-label={
                selectedCustomer
                  ? `Customer: ${selectedCustomer.firstName} ${selectedCustomer.lastName}. Change or remove`
                  : 'Add a customer'
              }
              className="size-11 text-muted-foreground"
            >
              {selectedCustomer ? (
                <Avatar name={`${selectedCustomer.firstName} ${selectedCustomer.lastName}`} email={selectedCustomer.email} size="xs" />
              ) : (
                <UserPlus size={19} />
              )}
            </Button>
            <Button variant="ghost" onClick={() => setView('held')} className="h-11 gap-1.5 px-2.5 text-muted-foreground">
              <History size={18} aria-hidden="true" />
              Held
              {held.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-heading px-1 text-xs font-semibold tabular-nums text-background">
                  {held.length}
                </span>
              )}
            </Button>
            {!empty && (
              <Popover
                open={moreOpen}
                onOpenChange={(open) => {
                  setMoreOpen(open);
                  if (!open) setConfirmClear(false);
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More ticket actions" className="size-11 text-muted-foreground">
                    <MoreHorizontal size={19} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-60 p-1.5"
                  onCloseAutoFocus={(event) => {
                    if (!openingField.current) return;
                    event.preventDefault();
                    openingField.current = false;
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      openingField.current = true;
                      setNoteOpen(true);
                      setMoreOpen(false);
                    }}
                    className={MENU_ITEM}
                  >
                    <FileText size={17} aria-hidden="true" className="text-muted-foreground" />
                    {notes ? 'Edit order note' : 'Add order note'}
                  </button>
                  {promo && !promo.code && (
                    <button
                      type="button"
                      disabled={promo.offline}
                      onClick={() => {
                        openingField.current = true;
                        setPromoOpen(true);
                        setMoreOpen(false);
                      }}
                      className={MENU_ITEM}
                    >
                      <TicketPercent size={17} aria-hidden="true" className="text-muted-foreground" />
                      {promo.offline ? 'Promo code needs a connection' : 'Add promo code'}
                    </button>
                  )}
                  {/* Armed by the first tap, fired by the second — no dialog, and no accidental wipe. */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmClear) return setConfirmClear(true);
                      onClearCart();
                      setConfirmClear(false);
                      setMoreOpen(false);
                    }}
                    className={cn(MENU_ITEM, 'text-destructive', confirmClear && 'bg-destructive/8 font-semibold')}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                    {confirmClear ? 'Tap again to clear' : 'Clear ticket'}
                  </button>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {empty ? (
            <PanelEmpty icon={ShoppingCart} title="The ticket is empty" description="Tap an item on the menu to add it." />
          ) : swipeToRemove ? (
            <SwipeRoot render={<ul />}>
              <AnimatePresence initial={false}>
                {cart.map((line) => (
                  <CartRow
                    key={line.cartId}
                    cartItem={line}
                    flash={flashId === line.cartId}
                    onOpen={() => onEditLine(line.cartId)}
                    onRemove={() => onRemove(line.cartId)}
                    swipe={swipeToRemove}
                    currency={currency}
                  />
                ))}
              </AnimatePresence>
            </SwipeRoot>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {cart.map((line) => (
                  <CartRow
                    key={line.cartId}
                    cartItem={line}
                    flash={flashId === line.cartId}
                    onOpen={() => onEditLine(line.cartId)}
                    onRemove={() => onRemove(line.cartId)}
                    swipe={swipeToRemove}
                    currency={currency}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {removed && (
          <div
            role="status"
            className="mx-4 mb-3 flex shrink-0 items-center justify-between gap-3 rounded-lg bg-foreground px-4 py-2 text-sm text-background"
          >
            <span className="truncate">
              Removed {removed.quantity > 1 ? `${removed.quantity}× ` : ''}
              {removed.item.name}
            </span>
            <Button
              variant="ghost"
              onClick={onUndoRemove}
              className="h-11 shrink-0 gap-1.5 px-3 text-background hover:bg-background/10 hover:text-background"
            >
              <RotateCcw size={16} aria-hidden="true" /> Undo
            </Button>
          </div>
        )}

        <div className="shrink-0 space-y-3 border-t border-border p-4">
          {selectedCustomer && !empty && (
            <button
              type="button"
              onClick={() => setView('rewards')}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-md border px-3 text-left transition-colors',
                loyaltyRewards.length > 0 ? 'border-primary/40 bg-primary/5' : 'border-border bg-card active:bg-band/60',
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-primary/8 text-primary">
                <Gift size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {loyaltyRewards.length > 0
                    ? `${loyaltyRewards.reduce((sum, reward) => sum + reward.quantity, 0)} reward${loyaltyRewards.reduce((sum, reward) => sum + reward.quantity, 0) === 1 ? '' : 's'} applied`
                    : 'Customer rewards'}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {loyaltyRewards.length > 0
                    ? `Save ${formatPrice(loyaltyDiscount, currency)}`
                    : loyaltyProgrammes.some((programme) => programme.canRedeem)
                      ? 'A reward is ready to use'
                      : 'View balances and progress'}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">{loyaltyRewards.length > 0 ? 'Change rewards' : 'View rewards'}</span>
            </button>
          )}
          {promo && (promo.code || (promoOpen && !empty)) && (
            <PromoCodeEntry {...promo} currency={currency} editing={promoOpen} onEditingChange={setPromoOpen} />
          )}
          {(noteOpen || notes) && (
            <div className="relative">
              <FileText size={16} aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 text-muted-foreground" />
              <input
                autoFocus={noteOpen && !notes}
                value={notes}
                maxLength={500}
                onChange={(event) => onNotesChange(event.target.value)}
                // Left empty: fold it away again, back into ⋯.
                onBlur={() => {
                  if (!notes.trim()) setNoteOpen(false);
                }}
                placeholder="Order note, e.g. name for the cup"
                aria-label="Order note"
                className="h-11 w-full rounded-md border border-input bg-control pr-12 pl-9 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:outline-2 focus:outline-ring/30"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onNotesChange('');
                  setNoteOpen(false);
                }}
                aria-label="Remove order note"
                className="absolute top-0 right-0 size-11 text-muted-foreground"
              >
                <X size={16} />
              </Button>
            </div>
          )}

          {/* How the customer is having it — the kitchen and the orders list both show it. Tap the
              chosen one again to clear it: a till that doesn't ask never has to. */}
          {!empty && (
            <ChoiceToggle clearable options={ORDER_TYPES} value={orderType} onChange={onOrderTypeChange} ariaLabel="Eat in or takeaway" />
          )}

          {/* Receipt arithmetic: the subtotal and each saving only when there is a saving. */}
          <dl className="space-y-1 text-sm">
            {(loyaltyDiscount > 0 || promoDiscount > 0) && (
              <>
                <TotalRow label="Subtotal" value={formatPrice(subtotal, currency)} />
                {loyaltyDiscount > 0 && <TotalRow label="Rewards" value={`−${formatPrice(loyaltyDiscount, currency)}`} />}
                {promoDiscount > 0 && <TotalRow label="Promo code" value={`−${formatPrice(promoDiscount, currency)}`} />}
              </>
            )}
            <div className="flex items-baseline justify-between gap-3 pt-0.5">
              <dt className="text-base font-semibold text-heading">Total</dt>
              <dd data-figure className="text-xl font-semibold tabular-nums text-heading">
                {formatPrice(total, currency)}
              </dd>
            </div>
          </dl>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onHold}
              disabled={empty}
              className="h-14 shrink-0 gap-2 px-4 text-base"
              aria-label="Hold this ticket"
            >
              <Pause size={18} aria-hidden="true" />
              Hold
            </Button>
            <Button onClick={onCharge} disabled={empty} className="h-14 flex-1 justify-between px-5 text-lg">
              <span>Charge</span>
              <span data-figure className="tabular-nums">
                {formatPrice(total, currency)}
              </span>
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <aside
      aria-label="Ticket"
      className="flex w-[24rem] max-w-full shrink-0 flex-col overflow-hidden border-l border-border bg-card xl:w-[27rem]"
    >
      {body}
    </aside>
  );
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border px-2">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to the ticket" className="size-11">
        <ArrowLeft size={20} />
      </Button>
      <p className="text-base font-semibold text-heading">{title}</p>
    </div>
  );
}

function PanelEmpty({ icon: Icon, title, description }: { icon: typeof ShoppingCart; title: string; description: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-md bg-band text-muted-foreground" aria-hidden="true">
        <Icon size={22} />
      </span>
      <p className="mt-3 text-base font-semibold text-heading">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

const ORDER_TYPES = [
  { value: 'eat_in', label: 'Eat in', icon: UtensilsCrossed },
  { value: 'takeaway', label: 'Takeaway', icon: ShoppingBag },
] as const;

const MENU_ITEM =
  'flex h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-band/60 disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
      <dt>{label}</dt>
      <dd data-figure className="tabular-nums">
        {value}
      </dd>
    </div>
  );
}
