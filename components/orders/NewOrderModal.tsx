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
  UserPlus,
  Users,
  Wallet,
} from '@/components/icons';
import { CartRow } from '@/components/pos/CartRow';
import { CustomerAttach } from '@/components/pos/CustomerAttach';
import { ItemCustomiser } from '@/components/pos/ItemCustomiser';
import { MENU_STALE_MS, pence, toPosItem } from '@/components/pos/useTillMenuData';
import { EmptyState } from '@/components/shared/EmptyState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { Bone } from '@/components/shared/Skeleton';
import { useFormatMoney, useWorkspaceCurrency } from '@/components/shared/useWorkspaceMoney';
import { SwipeRoot } from '@/components/swipe-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { getItemCatalog, getMenuItemModifierGroups, getMenuItemModifiers, getMenuItems } from '@/lib/modules/catalog/client';
import { type Order, type RecordedPaymentMethod, createOrder } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type BasketLine,
  RECORDED_PAYMENT_LABEL,
  addToBasket,
  basketCount,
  basketKey,
  basketTotalPence,
  manualOrderPayload,
  setLineNote,
  setLineQuantity,
} from '@/lib/utils/manual-order';
import { type OptionGroupRule, buildOptionGroups } from '@/lib/utils/pos';
import { toast } from '@/stores/toastStore';
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
  const [paid, setPaid] = useState<'paid' | 'later'>('paid');
  const [method, setMethod] = useState<RecordedPaymentMethod>('card');
  // One key for this order, so a retried submit can't create it twice.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const request = useRef(0);

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
  const create = useMutation({
    mutationFn: () =>
      createOrder(
        manualOrderPayload({
          locationId: locationId!,
          customerId: customer?.id,
          lines,
          notes,
          payment: paid === 'paid' ? { paid: true, method } : { paid: false },
        }),
        idempotencyKey,
      ),
    onSuccess: (order) => onCreated(order),
    onError: (error) => toast('error', error instanceof Error && error.message ? error.message : 'The order wasn’t created. Try again.'),
  });

  const footer = (
    <div className="flex flex-wrap items-center gap-3">
      <p className="mr-auto text-sm text-muted-foreground">
        {lines.length > 0 ? (
          <>
            {basketCount(lines)} {basketCount(lines) === 1 ? 'item' : 'items'} ·{' '}
            <span data-figure className="font-semibold text-foreground">
              {money(total / 100, 2)}
            </span>
            <span className="text-xs"> before any discounts</span>
          </>
        ) : (
          'Add something to the order'
        )}
      </p>
      <Button variant="outline" onClick={onClose} disabled={create.isPending}>
        Cancel
      </Button>
      <Button onClick={() => create.mutate()} disabled={lines.length === 0 || !locationId || create.isPending}>
        {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {paid === 'paid' ? `Create · paid by ${RECORDED_PAYMENT_LABEL[method].toLowerCase()}` : 'Create · pay later'}
      </Button>
    </div>
  );

  return (
    <Modal
      title="New order"
      onClose={onClose}
      size="2xl"
      // Wider than the largest preset: the catalogue and the order sit side by side.
      className="max-w-7xl"
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
        <div className="grid h-[min(76vh,52rem)] min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
          {/* ── What they want ── */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-rule/60 bg-control" aria-label="Catalogue">
            {left.kind === 'options' ? (
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
                      [left.variant?.name, selected.map((option) => option.label).join(', ')].filter(Boolean).join(' · ') || undefined,
                    unitPence: left.item.price + selected.reduce((sum, option) => sum + option.price, 0),
                    quantity,
                    modifierIds: selected.map((option) => option.id),
                    note: note || undefined,
                  })
                }
              />
            ) : left.kind === 'variant' ? (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-rule/60 px-3 py-3">
                  <Button variant="ghost" size="icon-sm" onClick={() => setLeft({ kind: 'browse' })} aria-label="Back to the catalogue">
                    <ArrowLeft aria-hidden="true" />
                  </Button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{left.item.name}</p>
                    <p className="text-xs text-muted-foreground">Choose one</p>
                  </div>
                </div>
                <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                  {left.variants.map((variant) => (
                    <li key={variant.id}>
                      <button
                        type="button"
                        onClick={() => chooseVariant(left.item, variant, left.groups)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{variant.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{variant.sku}</span>
                        </span>
                        <span data-figure className="shrink-0 text-sm font-semibold text-foreground">
                          {money(Number(variant.price ?? left.item.price), 2)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div className="shrink-0 border-b border-rule/60 p-3">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search what they want…"
                    aria-label="Search the catalogue"
                    leftIcon={<Search size={14} />}
                    autoFocus
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {items.isPending ? (
                    <div className="space-y-2 p-1" role="status" aria-busy="true" aria-label="Loading the catalogue">
                      {['w-40', 'w-32', 'w-48', 'w-36', 'w-28'].map((width) => (
                        <div key={width} className="flex items-center gap-3" aria-hidden="true">
                          <Bone className="size-10 shrink-0" />
                          <Bone className={`h-3.5 ${width}`} />
                          <Bone className="ml-auto h-3.5 w-12" />
                        </div>
                      ))}
                    </div>
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
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => void choose(item)}
                              disabled={left.kind === 'loading'}
                              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
                            >
                              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-band">
                                {toPosItem(item).image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={toPosItem(item).image} alt="" className="size-full object-cover" />
                                ) : (
                                  <ShoppingBag size={15} className="text-muted-foreground" aria-hidden="true" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>
                              <span data-figure className="shrink-0 text-sm text-muted-foreground">
                                {money(Number(item.price), 2)}
                              </span>
                              {busy ? (
                                <Loader2 size={15} className="shrink-0 animate-spin text-muted-foreground" aria-label="Loading options" />
                              ) : (
                                <Plus size={15} className="shrink-0 text-primary" aria-hidden="true" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ── Who, what, and how they paid ── */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-rule/60 bg-control" aria-label="The order">
            {findingCustomer ? (
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
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-rule/60 p-3">
                  {customer ? (
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary"
                        aria-hidden="true"
                      >
                        <Users size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email || 'Customer'}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{customer.email ?? customer.phone ?? ''}</span>
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setFindingCustomer(true)}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setFindingCustomer(true)}>
                      <UserPlus aria-hidden="true" /> Add a customer
                      <span className="ml-auto text-xs font-normal text-muted-foreground">optional</span>
                    </Button>
                  )}
                </div>

                {/* The Till's own ticket rows: tap to edit (quantity, note, remove), swipe left to remove, Undo after. */}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                  {lines.length === 0 ? (
                    <EmptyState
                      icon={ShoppingBag}
                      title="Nothing added yet"
                      description="Pick from the catalogue on the left."
                      compact
                      className="flex-1"
                    />
                  ) : (
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
                            surface="control"
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
                    className="mx-3 mb-3 flex shrink-0 items-center justify-between gap-3 rounded-lg bg-foreground px-4 py-1.5 text-sm text-background"
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

                <div className="shrink-0 space-y-3 border-t border-rule/60 p-3">
                  <Input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Note — collection time, delivery…"
                    aria-label="Order note"
                  />
                  <ChoiceCards
                    columns={2}
                    value={paid}
                    onChange={(next) => setPaid(next as 'paid' | 'later')}
                    options={[
                      { value: 'paid', label: 'Paid', icon: CheckCircle2 },
                      { value: 'later', label: 'Pay later', icon: Clock },
                    ]}
                  />
                  {paid === 'paid' ? (
                    // A rule between "whether" and "how", so the two rows of cards don't read as one grid.
                    <div role="group" aria-label="How they paid" className="border-t border-rule/60 pt-3">
                      <ChoiceCards
                        columns={2}
                        value={method}
                        onChange={setMethod}
                        options={PAYMENT_METHODS.map((option) => ({
                          value: option,
                          label: RECORDED_PAYMENT_LABEL[option],
                          icon: PAYMENT_ICON[option],
                        }))}
                      />
                    </div>
                  ) : (
                    <p className="border-t border-rule/60 pt-3 text-xs leading-relaxed text-muted-foreground">
                      It can be made and sent now; mark it paid from the order when the money comes in.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
