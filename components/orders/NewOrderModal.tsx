'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  type IconComponent,
  Landmark,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  TicketPercent,
  UserPlus,
  Wallet,
} from '@/components/icons';
import { CartRow } from '@/components/pos/CartRow';
import { ChoiceToggle } from '@/components/pos/ChoiceToggle';
import { CustomerAttach } from '@/components/pos/CustomerAttach';
import { ItemCustomiser } from '@/components/pos/ItemCustomiser';
import { PromoCodeEntry } from '@/components/pos/PromoCodeEntry';
import { MENU_STALE_MS, pence, toPosItem } from '@/components/pos/useTillMenuData';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Bone } from '@/components/shared/Skeleton';
import { useFormatMoney, useWorkspaceCurrency } from '@/components/shared/useWorkspaceMoney';
import { SwipeRoot } from '@/components/ui/swipe-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { getItemCatalog, getMenuItemModifierGroups, getMenuItemModifiers, getMenuItems } from '@/lib/modules/catalog/client';
import { type Order, type RecordedPaymentMethod, createOrder } from '@/lib/modules/ordering/client';
import { checkPromotionCode } from '@/lib/modules/promotions/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import {
  type BasketLine,
  RECORDED_PAYMENT_LABEL,
  addToBasket,
  basketCount,
  basketKey,
  basketTotalPence,
  manualOrderPayload,
  promoCheckLinesFor,
  setLineNote,
  setLineQuantity,
} from '@/lib/utils/manual-order';
import { type OptionGroupRule, buildOptionGroups } from '@/lib/utils/pos';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { CatalogVariant } from '@/types/catalog';
import type { Customer } from '@/types/customers';
import type { AttachedModifier, MenuItem as CatalogMenuItem } from '@/types/menu';
import type { CartItem, MenuItem as TillItem } from '@/types/pos';

/* "New order" on the Orders page: an order staff take by hand — a phone call,
 * an email, a wholesale account. Not a second till: no cash drawer, no
 * held tickets, no offline queue. Pick or add the customer, find what they
 * want (its size or colour, its options), say whether they've paid, create.
 *
 * The order goes in as `manual`. Paid ones are recorded with how they were
 * paid (nothing is charged); unpaid ones can still be made and sent, and are
 * marked paid from the order later (lib/utils/order-workflow).
 */

type LeftPane =
  | { kind: 'browse' }
  | { kind: 'loading'; item: CatalogMenuItem }
  | { kind: 'variant'; item: CatalogMenuItem; variants: CatalogVariant[]; groups: OptionGroupRule[] | null }
  | { kind: 'options'; item: TillItem; variant?: CatalogVariant; groups: OptionGroupRule[] };

const toOption = (m: AttachedModifier) => ({
  id: m.id,
  label: m.label,
  price: m.priceAdjust ? pence(m.priceAdjust) : 0,
  category: m.category ?? undefined,
  isDefault: m.isDefault,
  groupId: m.groupId ?? null,
});

/** A basket line in the Till's ticket-row shape. Its unit price already includes the options, so they carry no price of their own. */
const toCartItem = (line: BasketLine): CartItem => ({
  cartId: line.key,
  item: { id: line.menuItemId, name: line.name, category: '', price: line.unitPence, image: '', modifiers: [] },
  quantity: line.quantity,
  selected: line.detail ? [{ id: 'detail', label: line.detail, price: 0 }] : [],
  note: line.note,
});

const PAYMENT_METHODS: RecordedPaymentMethod[] = ['card', 'cash', 'bank_transfer', 'custom'];
const PAYMENT_ICON: Record<RecordedPaymentMethod, IconComponent> = {
  card: CreditCard,
  cash: Banknote,
  bank_transfer: Landmark,
  custom: Wallet,
};

export function NewOrderModal({
  onClose,
  onCreated,
  initialCustomer = null,
}: {
  onClose: () => void;
  onCreated: (order: Order) => void;
  /** Already picked — "Start an order" from a customer's record, in a workspace without a Till. */
  initialCustomer?: Customer | null;
}) {
  const qc = useQueryClient();
  const money = useFormatMoney();
  // The Till's rows and option picker format in GBP unless told otherwise.
  const currency = useWorkspaceCurrency();
  const { tenantId, locationId } = useWorkspaceStore();
  const [left, setLeft] = useState<LeftPane>({ kind: 'browse' });
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Just added or merged — a brief highlight ties the pick on the left to its line on the right.
  const [flashKey, setFlashKey] = useState<string | null>(null);
  // The last removed line, offered back for five seconds — as at the Till, so no confirm dialog.
  const [removed, setRemoved] = useState<{ line: BasketLine; index: number } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), 5000);
    return () => window.clearTimeout(timer);
  }, [removed]);
  useEffect(() => {
    if (!flashKey) return;
    const timer = window.setTimeout(() => setFlashKey(null), 700);
    return () => window.clearTimeout(timer);
  }, [flashKey]);

  function removeLine(key: string) {
    const index = lines.findIndex((line) => line.key === key);
    if (index < 0) return;
    setRemoved({ line: lines[index]!, index });
    setExpanded(null);
    setLines((current) => current.filter((line) => line.key !== key));
  }
  function undoRemove() {
    if (!removed) return;
    setLines((current) => [...current.slice(0, removed.index), removed.line, ...current.slice(removed.index)]);
    setFlashKey(removed.line.key);
    setRemoved(null);
  }
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const [findingCustomer, setFindingCustomer] = useState(false);
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState<string | null>(null);
  // The code field opens from "Add promo code" and folds away again if left empty.
  const [promoEditing, setPromoEditing] = useState(false);
  const promotionsOn = useModuleEnabled('promotions');
  const [paid, setPaid] = useState<'paid' | 'later'>('paid');
  const [method, setMethod] = useState<RecordedPaymentMethod>('card');
  // One key for this order, so a retried submit can't create it twice.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const request = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  // The catalogue list under the search field is open.
  const [picking, setPicking] = useState(false);

  const items = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
    staleTime: MENU_STALE_MS,
  });
  const term = search.trim().toLowerCase();
  const shown = useMemo(
    () => (items.data ?? []).filter((item) => item.isAvailable && (!term || item.name.toLowerCase().includes(term))).slice(0, 80),
    [items.data, term],
  );

  const addLine = (line: Omit<BasketLine, 'key'>) => {
    const next = addToBasket(lines, line);
    setLines(next);
    // The line it went to: new at the end, or the one it merged into.
    setFlashKey((next.find((entry) => basketKey(entry) === basketKey(line)) ?? next.at(-1))?.key ?? null);
    setLeft({ kind: 'browse' });
    setSearch('');
    searchRef.current?.focus();
  };

  /** An item may have variants (size, colour) and options (milk, extras): ask for each it has, in that order. */
  async function choose(item: CatalogMenuItem) {
    const mine = ++request.current;
    setLeft({ kind: 'loading', item });
    try {
      const [modifiers, rules, catalog] = await Promise.all([
        qc.fetchQuery({
          queryKey: moduleQueryKeys.catalog.key('menu-item-modifiers', item.id),
          queryFn: () => getMenuItemModifiers(item.id),
          staleTime: MENU_STALE_MS,
        }),
        qc
          .fetchQuery({
            queryKey: moduleQueryKeys.catalog.key('menu-item-modifier-groups', item.id),
            queryFn: () => getMenuItemModifierGroups(item.id),
            staleTime: MENU_STALE_MS,
          })
          .catch(() => []),
        // Only a product with variants has a catalogue to read; a menu item without one answers empty.
        getItemCatalog(item.id, tenantId ?? undefined).catch(() => null),
      ]);
      if (request.current !== mine) return;
      const options = modifiers.filter((m) => m.isAvailable).map(toOption);
      const groups = options.length > 0 ? buildOptionGroups(options, rules) : null;
      const variants = (catalog?.variants ?? []).filter((variant) => variant.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
      if (variants.length > 0) return setLeft({ kind: 'variant', item, variants, groups });
      if (groups) return setLeft({ kind: 'options', item: toPosItem(item), groups });
      addLine({ menuItemId: item.id, name: item.name, unitPence: pence(item.price), quantity: 1, modifierIds: [] });
    } catch {
      if (request.current !== mine) return;
      setLeft({ kind: 'browse' });
      toast('error', `${item.name} couldn’t be added. Try again.`);
    }
  }

  function chooseVariant(item: CatalogMenuItem, variant: CatalogVariant, groups: OptionGroupRule[] | null) {
    const unitPence = pence(variant.price ?? item.price);
    if (groups) return setLeft({ kind: 'options', item: { ...toPosItem(item), price: unitPence }, variant, groups });
    addLine({ menuItemId: item.id, variantId: variant.id, name: item.name, detail: variant.name, unitPence, quantity: 1, modifierIds: [] });
  }

  const total = basketTotalPence(lines);

  // The promo code, checked against the basket and customer as they change;
  // the order checks it again under lock and prices it for real.
  const promoLines = useMemo(() => promoCheckLinesFor(lines), [lines]);
  const promoCheck = useQuery({
    queryKey: moduleQueryKeys.promotions.key('check', promoCode, locationId, customer?.id ?? null, false, promoLines),
    queryFn: () =>
      checkPromotionCode({
        code: promoCode!,
        locationId: locationId!,
        source: 'manual',
        customerId: customer?.id ?? null,
        lines: promoLines,
      }),
    enabled: Boolean(promotionsOn && promoCode && locationId && lines.length > 0),
    placeholderData: (previous) => previous,
    retry: false,
  });
  const promoCents =
    promoCode && promoCheck.data?.valid && promoCheck.data.estimatedDiscount
      ? Math.round(Number(promoCheck.data.estimatedDiscount) * 100)
      : 0;

  const create = useMutation({
    mutationFn: () =>
      createOrder(
        manualOrderPayload({
          locationId: locationId!,
          customerId: customer?.id,
          lines,
          notes,
          payment: paid === 'paid' ? { paid: true, method } : { paid: false },
          promoCode,
        }),
        idempotencyKey,
      ),
    onSuccess: (order) => onCreated(order),
    onError: (error) => toast('error', error instanceof Error && error.message ? error.message : 'The order wasn’t created. Try again.'),
  });

  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email || 'Customer' : null;
  const count = basketCount(lines);

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onClose} disabled={create.isPending}>
        Cancel
      </Button>
      <Button onClick={() => create.mutate()} disabled={lines.length === 0 || !locationId || create.isPending}>
        {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {lines.length === 0 ? 'Create order' : `Create order · ${money((total - promoCents) / 100, 2)}${paid === 'paid' ? '' : ' unpaid'}`}
      </Button>
    </div>
  );

  // The catalogue opens under the search field, as Square's "Search items" does — not as a second pane.
  const browsing = left.kind !== 'browse' || picking || term.length > 0;
  const closePicker = () => {
    setPicking(false);
    setSearch('');
    setLeft({ kind: 'browse' });
  };

  return (
    <Modal
      title="New order"
      onClose={onClose}
      size="2xl"
      // Wider than the largest preset: the form and its summary sit side by side.
      className="max-w-6xl"
      footer={footer}
    >
      {!locationId ? (
        <EmptyState
          icon={ShoppingBag}
          title="Pick a location"
          description="An order is made at one location — choose it in the sidebar first."
          compact
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            {/* ── Customer ── */}
            <FormSection title="Customer">
              {findingCustomer ? (
                <div className="h-[26rem] overflow-hidden rounded-lg border border-border">
                  <CustomerAttach
                    initialView="find"
                    current={customer}
                    onSelect={(picked) => {
                      setCustomer(picked);
                      setFindingCustomer(false);
                    }}
                    onRemove={() => {
                      setCustomer(null);
                      setFindingCustomer(false);
                    }}
                    onClose={() => setFindingCustomer(false)}
                  />
                </div>
              ) : customer ? (
                <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                  <Avatar name={customerName!} email={customer.email} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-heading">{customerName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {customer.email ?? customer.phone ?? 'No phone or email on file'}
                    </span>
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setFindingCustomer(true)}>
                    Change
                  </Button>
                </div>
              ) : (
                <AddButton icon={UserPlus} onClick={() => setFindingCustomer(true)}>
                  Add customer
                  <span className="font-normal text-muted-foreground"> · needed to send or deliver it</span>
                </AddButton>
              )}
            </FormSection>

            {/* ── Items ── */}
            <FormSection title="Items" aside={count > 0 ? `${count} ${count === 1 ? 'item' : 'items'}` : undefined}>
              <div className="overflow-hidden rounded-lg border border-border">
                {left.kind === 'options' ? (
                  <div className="h-[30rem]">
                    <ItemCustomiser
                      item={left.item}
                      groups={left.groups}
                      currency={currency}
                      onCancel={() => setLeft({ kind: 'browse' })}
                      onAdd={(selected, quantity, note) =>
                        addLine({
                          menuItemId: left.item.id,
                          variantId: left.variant?.id,
                          name: left.item.name,
                          detail:
                            [left.variant?.name, selected.map((option) => option.label).join(', ')].filter(Boolean).join(' · ') ||
                            undefined,
                          unitPence: left.item.price + selected.reduce((sum, option) => sum + option.price, 0),
                          quantity,
                          modifierIds: selected.map((option) => option.id),
                          note: note || undefined,
                        })
                      }
                    />
                  </div>
                ) : left.kind === 'variant' ? (
                  <>
                    <div className="flex h-14 items-center gap-2 border-b border-border px-3">
                      <Button variant="ghost" size="icon" onClick={() => setLeft({ kind: 'browse' })} aria-label="Back to the catalogue">
                        <ArrowLeft aria-hidden="true" />
                      </Button>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-heading">{left.item.name}</p>
                        <p className="text-xs text-muted-foreground">Choose one</p>
                      </div>
                    </div>
                    <ul className="max-h-80 overflow-y-auto">
                      {left.variants.map((variant) => (
                        <li key={variant.id} className="border-b border-border last:border-b-0">
                          <button type="button" onClick={() => chooseVariant(left.item, variant, left.groups)} className={ROW}>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">{variant.name}</span>
                              {variant.sku && <span className="block truncate text-xs text-muted-foreground">{variant.sku}</span>}
                            </span>
                            <span data-figure className="shrink-0 text-sm font-medium text-foreground tabular-nums">
                              {money(Number(variant.price ?? left.item.price), 2)}
                            </span>
                            <AddMark />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <div className={cn('flex h-14 items-center gap-2 px-3', (browsing || lines.length > 0) && 'border-b border-border')}>
                      <Input
                        ref={searchRef}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onFocus={() => setPicking(true)}
                        onKeyDown={(event) => {
                          // Escape folds the list away; it only closes the dialog once the list is shut.
                          if (event.key === 'Escape' && browsing) {
                            event.stopPropagation();
                            closePicker();
                          }
                        }}
                        placeholder="Search items to add"
                        aria-label="Search items to add"
                        leftIcon={<Search size={14} />}
                        autoFocus
                        className="w-full"
                      />
                      {browsing && (
                        <Button variant="ghost" onClick={closePicker}>
                          Done
                        </Button>
                      )}
                    </div>
                    {browsing && (
                      <div className={cn('max-h-80 overflow-y-auto', lines.length > 0 && 'border-b border-border')}>
                        {items.isPending ? (
                          <ul role="status" aria-busy="true" aria-label="Loading the catalogue">
                            {['w-40', 'w-32', 'w-48', 'w-36'].map((width) => (
                              <li
                                key={width}
                                className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                                aria-hidden="true"
                              >
                                <Bone className="size-9 shrink-0" />
                                <Bone className={`h-3.5 ${width}`} />
                                <Bone className="ml-auto h-3.5 w-12" />
                                <Bone className="size-8 shrink-0" />
                              </li>
                            ))}
                          </ul>
                        ) : items.isError ? (
                          <EmptyState
                            icon={ShoppingBag}
                            title="The catalogue couldn’t load"
                            description="Check your connection, then try again."
                            action={{ label: 'Try again', onClick: () => void items.refetch() }}
                            compact
                          />
                        ) : shown.length === 0 ? (
                          <EmptyState
                            icon={Search}
                            kind={term ? 'search' : 'start'}
                            title={term ? 'Nothing matches' : 'Nothing to sell yet'}
                            description={term ? 'Try another word.' : 'Add items to the catalogue first.'}
                            compact
                          />
                        ) : (
                          <ul>
                            {shown.map((item) => {
                              const busy = left.kind === 'loading' && left.item.id === item.id;
                              const image = toPosItem(item).image;
                              return (
                                <li key={item.id} className="border-b border-border last:border-b-0">
                                  <button
                                    type="button"
                                    onClick={() => void choose(item)}
                                    disabled={left.kind === 'loading'}
                                    className={ROW}
                                  >
                                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-band text-muted-foreground">
                                      {image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={image} alt="" className="size-full object-cover" />
                                      ) : (
                                        <ShoppingBag size={16} aria-hidden="true" />
                                      )}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>
                                    <span data-figure className="shrink-0 text-sm text-muted-foreground tabular-nums">
                                      {money(Number(item.price), 2)}
                                    </span>
                                    <AddMark busy={busy} />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* The Till's own ticket rows: tap to edit (quantity, note, remove), swipe left to remove, Undo after. */}
                {lines.length > 0 && (
                  <SwipeRoot render={<ul />}>
                    <AnimatePresence initial={false}>
                      {lines.map((line) => (
                        <CartRow
                          key={line.key}
                          cartItem={toCartItem(line)}
                          expanded={expanded === line.key}
                          flash={flashKey === line.key}
                          onToggle={() => setExpanded((current) => (current === line.key ? null : line.key))}
                          onQty={(delta) => setLines((current) => setLineQuantity(current, line.key, Math.max(1, line.quantity + delta)))}
                          onNote={(note) => setLines((current) => setLineNote(current, line.key, note))}
                          onRemove={() => removeLine(line.key)}
                          swipe
                          currency={currency}
                          notePlaceholder="Note — packing, delivery, the kitchen…"
                        />
                      ))}
                    </AnimatePresence>
                  </SwipeRoot>
                )}
              </div>

              {removed && (
                <div
                  role="status"
                  className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-foreground px-4 py-1.5 text-sm text-background"
                >
                  <span className="truncate">
                    Removed {removed.line.quantity > 1 ? `${removed.line.quantity}× ` : ''}
                    {removed.line.name}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={undoRemove}
                    className="h-9 shrink-0 gap-1.5 px-3 text-background hover:bg-background/10 hover:text-background"
                  >
                    <RotateCcw size={15} aria-hidden="true" /> Undo
                  </Button>
                </div>
              )}
            </FormSection>

            {/* ── Payment ── */}
            <FormSection title="Payment">
              <div className="space-y-3">
                {/* Whether they've paid, then how — one control each, not two grids of cards. */}
                <ChoiceToggle
                  options={[
                    { value: 'paid', label: 'Paid', icon: CheckCircle2 },
                    { value: 'later', label: 'Pay later', icon: Clock },
                  ]}
                  value={paid}
                  onChange={setPaid}
                  ariaLabel="Have they paid?"
                />
                {paid === 'paid' ? (
                  <ChoiceToggle
                    options={PAYMENT_METHODS.map((option) => ({
                      value: option,
                      label: RECORDED_PAYMENT_LABEL[option],
                      icon: PAYMENT_ICON[option],
                    }))}
                    value={method}
                    onChange={setMethod}
                    ariaLabel="How they paid"
                    className="max-sm:grid-cols-2!"
                  />
                ) : (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    It can be made and sent now; mark it paid from the order when the money comes in.
                  </p>
                )}
              </div>
            </FormSection>

            {/* ── Note ── */}
            <FormSection title="Note">
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Collection time, delivery, anything the team should know"
                aria-label="Order note"
              />
            </FormSection>
          </div>

          {/* ── Order summary — Square's right-hand column, pinned while the form scrolls. ── */}
          <aside className="space-y-4 rounded-lg border border-border bg-band/30 p-4 lg:sticky lg:top-0" aria-label="Order summary">
            <h3 className="text-sm font-semibold text-heading">Order summary</h3>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing added yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {lines.map((line) => (
                  <li key={line.key} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-foreground">
                        {line.quantity > 1 && <span className="text-muted-foreground tabular-nums">{line.quantity}× </span>}
                        {line.name}
                      </span>
                      {line.detail && <span className="block truncate text-xs text-muted-foreground">{line.detail}</span>}
                    </span>
                    <span data-figure className="shrink-0 tabular-nums text-foreground">
                      {money((line.unitPence * line.quantity) / 100, 2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {promotionsOn && lines.length > 0 && !promoCode && !promoEditing && (
              <AddButton icon={TicketPercent} onClick={() => setPromoEditing(true)}>
                Add promo code
              </AddButton>
            )}
            {promotionsOn && (lines.length > 0 || promoCode) && (
              <PromoCodeEntry
                editing={promoEditing}
                onEditingChange={setPromoEditing}
                code={promoCode}
                check={promoCheck.data}
                checking={promoCheck.isFetching}
                failed={promoCheck.isError}
                discountCents={promoCents}
                offline={false}
                onApply={setPromoCode}
                onRemove={() => setPromoCode(null)}
                currency={currency}
              />
            )}

            {lines.length > 0 && (
              <dl className="space-y-1 border-t border-border pt-3 text-sm">
                {promoCents > 0 && (
                  <>
                    <TotalRow label="Subtotal" value={money(total / 100, 2)} />
                    <TotalRow label={`Promo code ${promoCode}`} value={`− ${money(promoCents / 100, 2)}`} />
                  </>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-semibold text-foreground">Total</dt>
                  <dd data-figure className="text-lg font-semibold text-heading tabular-nums">
                    {money((total - promoCents) / 100, 2)}
                  </dd>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">Automatic discounts are applied when the order is created.</p>
              </dl>
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}

const ROW =
  'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-60';

/** One part of the form — a plain heading over its content, as Square stacks Customer, Items, Payment. */
function FormSection({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Square's "+ Add customer" / "Add promo code": a dashed row that opens the real control. */
function AddButton({ icon: Icon, onClick, children }: { icon: IconComponent; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center gap-2 rounded-md border border-dashed border-edge px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Icon size={16} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

/** The "+" at the end of a catalogue row — a tile, so the whole row reads as "add this". */
function AddMark({ busy = false }: { busy?: boolean }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary" aria-hidden={!busy}>
      {busy ? <Loader2 size={15} className="animate-spin" aria-label="Loading options" /> : <Plus size={15} />}
    </span>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
      <dt className="min-w-0 truncate">{label}</dt>
      <dd data-figure className="shrink-0 tabular-nums">
        {value}
      </dd>
    </div>
  );
}
