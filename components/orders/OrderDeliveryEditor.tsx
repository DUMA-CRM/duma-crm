'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Loader2, MapPin, Pencil, Plus, Store, Truck, User, UserPlus, Users } from '@/components/icons';
import { AddressDrawer } from '@/components/customers/CustomerAddresses';
import { DeliveryAddressFields } from '@/components/customers/DeliveryAddressFields';
import { CustomerAttach } from '@/components/pos/CustomerAttach';
import { ChoiceCards, FormSection } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { type CustomerAddress, getCustomerAddresses, getCustomer } from '@/lib/modules/customers/client';
import { type OrderDetail, type OrderShippingAddress, updateOrderDetails } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useHomeCountries } from '@/lib/hooks/useHomeCountries';
import { addressErrors, cleanAddress, emptyAddress, sameAddress } from '@/lib/utils/delivery-address';
import { shippingAddressLines } from '@/lib/utils/orders-list';
import { toast } from '@/stores/toastStore';
import type { Customer } from '@/types/customers';

import { invalidateOrder } from './StatusMenu';

/* Who an order taken by hand is for, and how it reaches them — set when the
 * order was taken or added afterwards. A delivery needs an address: one the
 * customer has used before, or a new one, which is saved to them for next time. */

const NEW = 'new';
const fromSaved = (row: CustomerAddress): OrderShippingAddress => ({
  recipientName: row.recipientName ?? '',
  phone: row.phone,
  line1: row.line1,
  line2: row.line2,
  city: row.city,
  region: row.region,
  postcode: row.postcode,
  country: row.country,
});

export function OrderDeliveryEditor({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState<string | null>(order.customerId ?? null);
  const [picked, setPicked] = useState<Customer | null>(null);
  const [finding, setFinding] = useState(false);
  const [type, setType] = useState<'collection' | 'delivery'>(order.fulfilmentType === 'delivery' ? 'delivery' : 'collection');
  // '' until someone picks: the order's own saved address, else the default (see `selection`).
  const [chosen, setChosen] = useState<string>('');
  // Null until someone types: the form then shows what we already know — the
  // customer's name and phone, the address the order already had — and keeps
  // showing it as the customer loads, without ever overwriting a typed field.
  const [draft, setDraft] = useState<OrderShippingAddress | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [editingSaved, setEditingSaved] = useState<CustomerAddress | null>(null);
  const home = useHomeCountries()[0]!;

  // The customer on the order, by id — the drawer only has their name.
  const current = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer', customerId),
    queryFn: () => getCustomer(customerId!),
    enabled: !!customerId && !picked,
  });
  const customer = picked ?? current.data ?? null;
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : (order.customerName ?? '');
  const saved = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-addresses', customerId),
    queryFn: () => getCustomerAddresses(customerId!),
    enabled: !!customerId && type === 'delivery',
  });
  const savedRows = saved.data ?? [];
  // The address the order already goes to, when it's one of the customer's saved ones.
  const orderAddress = order.shippingAddress ?? null;
  const matchedId = orderAddress ? savedRows.find((row) => sameAddress(fromSaved(row), orderAddress))?.id : undefined;
  // An address on the order that isn't saved anywhere is kept as the new one, so nothing is lost;
  // otherwise "A new address" starts blank — just the customer's name and phone.
  const unsavedOrderAddress = orderAddress && !matchedId && (saved.isSuccess || !customerId) ? orderAddress : null;
  const defaults = unsavedOrderAddress ?? emptyAddress({ name: customerName, phone: customer?.phone, country: home });
  const address = draft ?? defaults;
  // Until someone picks: the order's own address, else the customer's default, else a new one.
  const selection = chosen || matchedId || (unsavedOrderAddress || !customerId ? NEW : (savedRows[0]?.id ?? NEW));
  const usingNew = selection === NEW;
  const finalAddress = usingNew ? address : fromSaved(savedRows.find((row) => row.id === selection) ?? savedRows[0]!);
  const errors = type === 'delivery' && usingNew ? addressErrors(address) : {};

  const save = useMutation({
    mutationFn: () =>
      updateOrderDetails(order.id, {
        ...(customerId !== (order.customerId ?? null) ? { customerId } : {}),
        fulfilment: type === 'delivery' ? { type, address: cleanAddress(finalAddress) } : { type },
      }),
    onSuccess: () => {
      invalidateOrder(qc, order.id);
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-addresses', customerId) });
      toast('success', type === 'delivery' ? 'Delivery details saved.' : 'Saved — it will be collected.');
      onClose();
    },
    onError: (error) => toast('error', error instanceof Error && error.message ? error.message : 'The details weren’t saved. Try again.'),
  });

  const set = (patch: Partial<OrderShippingAddress>) => setDraft((current) => ({ ...(current ?? defaults), ...patch }));
  const name = customerName || customer?.email || 'Customer';

  return (
    <Modal
      title="Customer & delivery"
      description="Who it's for, and how it reaches them."
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending || finding}
            onClick={() => {
              setSubmitted(true);
              if (Object.keys(errors).length === 0) save.mutate();
            }}
          >
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </div>
      }
    >
      {finding ? (
        <div className="h-[28rem] overflow-hidden rounded-lg border border-rule/60 bg-control">
          <CustomerAttach
            initialView="find"
            current={customer}
            onSelect={(next) => {
              setPicked(next);
              setCustomerId(next.id);
              setChosen('');
              // A typed address keeps what was typed; its blanks take the new customer's details.
              setDraft((current) =>
                current
                  ? { ...current, recipientName: current.recipientName || [next.firstName, next.lastName].filter(Boolean).join(' '), phone: current.phone || next.phone }
                  : null,
              );
              setFinding(false);
            }}
            onRemove={() => {
              setPicked(null);
              setCustomerId(null);
              setChosen(NEW);
              setFinding(false);
            }}
            onClose={() => setFinding(false)}
          />
        </div>
      ) : (
        <div className="space-y-7">
          <FormSection icon={User} title="Customer" note="Optional — but a delivery needs someone to deliver to.">
            {customerId ? (
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary" aria-hidden="true">
                  <Users size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{customer?.email ?? customer?.phone ?? ''}</span>
                </span>
                <Button variant="outline" size="sm" onClick={() => setFinding(true)}>
                  Change
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full justify-start gap-2 bg-control" onClick={() => setFinding(true)}>
                <UserPlus aria-hidden="true" /> Add a customer
              </Button>
            )}
          </FormSection>

          <FormSection icon={Truck} title="How it reaches them">
            <ChoiceCards
              columns={2}
              value={type}
              onChange={(next) => setType(next as 'collection' | 'delivery')}
              options={[
                { value: 'collection', label: 'They collect it', icon: Store },
                { value: 'delivery', label: 'We deliver it', icon: Truck },
              ]}
            />
          </FormSection>

          {type === 'delivery' && (
            <FormSection
              icon={MapPin}
              title="Deliver to"
              note={savedRows.length > 0 ? `${name}'s saved addresses, or a new one.` : customerId ? `Saved to ${name} for next time.` : undefined}
            >
              {/* Addresses this customer has had before — one tap instead of typing. */}
              {savedRows.length > 0 && (
                <div className="grid gap-2" role="radiogroup" aria-label="Saved addresses">
                  {[...savedRows.map((row) => ({ id: row.id, lines: shippingAddressLines(fromSaved(row)) })), { id: NEW, lines: ['A new address'] }].map(
                    (option) => (
                      <div key={option.id} className="relative">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selection === option.id}
                        onClick={() => setChosen(option.id)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-lg border py-2.5 pr-11 pl-3.5 text-left text-sm transition-colors',
                          selection === option.id ? 'border-primary bg-primary/5' : 'border-rule/60 bg-control hover:bg-band/40',
                        )}
                      >
                        {option.id === NEW ? (
                          <Plus size={15} className={cn('mt-0.5 shrink-0', selection === option.id ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                        ) : (
                          <MapPin size={15} className={cn('mt-0.5 shrink-0', selection === option.id ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                        )}
                        <span className="min-w-0">
                          <span className={cn('block text-foreground', selection === option.id ? 'font-semibold' : 'font-medium')}>{option.lines[0]}</span>
                          {option.lines.length > 1 && <span className="block text-xs text-muted-foreground">{option.lines.slice(1).join(', ')}</span>}
                        </span>
                      </button>
                      {/* Correct a saved address in place — it changes for next time too. */}
                      {option.id !== NEW && customer && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-2 right-2 text-muted-foreground"
                          onClick={() => setEditingSaved(savedRows.find((row) => row.id === option.id) ?? null)}
                          aria-label="Edit this address"
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                      )}
                      </div>
                    ),
                  )}
                </div>
              )}

              {usingNew && (
                <div className={cn(savedRows.length > 0 && 'border-t border-rule/60 pt-3')}>
                  <DeliveryAddressFields value={address} onChange={set} errors={submitted ? errors : undefined} />
                </div>
              )}
            </FormSection>
          )}
        </div>
      )}

      {editingSaved && customer && (
        <AddressDrawer
          customer={customer}
          address={editingSaved}
          onClose={() => setEditingSaved(null)}
          onSaved={(saved) => {
            void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-addresses', customerId) });
            setChosen(saved.id);
            setEditingSaved(null);
          }}
        />
      )}
    </Modal>
  );
}
