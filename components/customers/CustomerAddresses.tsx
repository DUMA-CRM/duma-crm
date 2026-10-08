'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { ActionRow, ActionRows, RowTile } from '@/components/cms/rows';
import { DeliveryAddressFields } from '@/components/customers/DeliveryAddressFields';
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { DrawerSection } from '@/components/shared/DrawerSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';

import { useHomeCountries } from '@/lib/hooks/useHomeCountries';
import {
  type CustomerAddress,
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  updateCustomerAddress,
} from '@/lib/modules/customers/client';
import type { OrderShippingAddress } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { addressErrors, cleanAddress, emptyAddress } from '@/lib/utils/delivery-address';
import { shippingAddressLines } from '@/lib/utils/orders-list';
import { toast } from '@/stores/toastStore';
import type { Customer } from '@/types/customers';

const asAddress = (row: CustomerAddress): OrderShippingAddress => ({
  recipientName: row.recipientName ?? '',
  phone: row.phone,
  line1: row.line1,
  line2: row.line2,
  city: row.city,
  region: row.region,
  postcode: row.postcode,
  country: row.country,
});

/**
 * Where this customer has things delivered — saved from website orders and from
 * orders taken by hand, and kept here to add to, correct or remove. Orders
 * already sent keep the address they went to; a change only affects next time.
 */
export function CustomerAddresses({ customer, canEdit }: { customer: Customer; canEdit: boolean }) {
  const qc = useQueryClient();
  const key = moduleQueryKeys.customers.key('customer-addresses', customer.id);
  const addresses = useQuery({ queryKey: key, queryFn: () => getCustomerAddresses(customer.id) });
  const [editing, setEditing] = useState<CustomerAddress | 'new' | null>(null);
  const [removing, setRemoving] = useState<CustomerAddress | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: key });

  const makeDefault = useMutation({
    mutationFn: (row: CustomerAddress) =>
      updateCustomerAddress(customer.id, row.id, { ...asAddress(row), label: row.label, isDefault: true }),
    onSuccess: () => {
      refresh();
      toast('success', 'Default address changed.');
    },
    onError: (error) => toast('error', error instanceof Error && error.message ? error.message : 'The default wasn’t changed. Try again.'),
  });
  const remove = useMutation({
    mutationFn: (row: CustomerAddress) => deleteCustomerAddress(customer.id, row.id),
    onSuccess: () => {
      refresh();
      setRemoving(null);
      toast('success', 'Address removed.');
    },
    onError: (error) => {
      setRemoving(null);
      toast('error', error instanceof Error && error.message ? error.message : 'The address wasn’t removed. Try again.');
    },
  });

  // The default leads; the rest keep the order they were saved in.
  const rows = [...(addresses.data ?? [])].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return (
    // No card around it: the heading sits on the page and the tinted list is the container.
    <motion.section variants={SECTION_RISE} aria-labelledby="customer-addresses-title" className="space-y-3">
      <header className="flex items-center gap-2 px-1">
        <h2 id="customer-addresses-title" className="text-base font-semibold tracking-title text-foreground">
          Delivery addresses
        </h2>
        {rows.length > 0 && (
          <span className="rounded-full bg-band px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{rows.length}</span>
        )}
      </header>
      {addresses.isPending ? (
        <div className="space-y-2 rounded-lg bg-band/50 p-2" role="status" aria-busy="true" aria-label="Loading addresses">
          <Bone className="h-14 rounded-md" />
          <Bone className="h-14 rounded-md" />
        </div>
      ) : addresses.isError ? (
        <ErrorState className="rounded-lg bg-band/50 py-6" title="Addresses couldn’t be loaded" onRetry={() => void addresses.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MapPin}
          compact
          title="No addresses yet"
          description="One is saved when an order is delivered to them, or add one now."
          action={canEdit ? { label: 'Add an address', icon: Plus, onClick: () => setEditing('new') } : undefined}
          className="rounded-lg bg-band/50 py-8"
        />
      ) : (
        // Each address its own row on a tinted ground — the dashboard cards' shape — with
        // "add another" as the last line of the list, as on the product's options.
        <div className="space-y-2 rounded-lg bg-band/50 p-2">
          <ul className="space-y-2">
            {rows.map((row) => {
              const lines = shippingAddressLines(asAddress(row));
              const title = row.label || lines[0];
              const rest = lines.slice(row.label ? 0 : 1);
              const settingDefault = makeDefault.isPending && makeDefault.variables?.id === row.id;
              return (
                <li
                  key={row.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md bg-card px-3 py-2.5 shadow-sm',
                    row.isDefault && 'ring-1 ring-primary/25',
                  )}
                >
                  {/* As tall as the two lines beside it, so the row has no gap under the tile. */}
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-md border',
                      row.isDefault
                        ? 'border-momentum/35 bg-momentum/8 text-momentum'
                        : 'border-rule/55 bg-background text-muted-foreground',
                    )}
                    aria-hidden="true"
                  >
                    {row.isDefault ? <Star size={18} /> : <MapPin size={18} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{title}</span>
                      {row.isDefault && (
                        <span className="shrink-0 rounded-full bg-primary/8 px-1.5 py-0.5 text-micro font-semibold text-primary">
                          Default
                        </span>
                      )}
                    </span>
                    {rest.length > 0 && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{rest.join(', ')}</span>
                    )}
                  </span>
                  {canEdit && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      {!row.isDefault && (
                        <Tooltip label="Make default" side="top">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => makeDefault.mutate(row)}
                            disabled={makeDefault.isPending}
                            aria-label={`Make ${title} the default address`}
                          >
                            {settingDefault ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Star aria-hidden="true" />}
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip label="Edit" side="top">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row)} aria-label={`Edit ${title}`}>
                          <Pencil aria-hidden="true" />
                        </Button>
                      </Tooltip>
                      <Tooltip label="Remove" side="top">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setRemoving(row)}
                          aria-label={`Remove ${title}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </Tooltip>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {canEdit && (
            <ActionRows>
              <ActionRow icon={Plus} label="Add another address" onClick={() => setEditing('new')} />
            </ActionRows>
          )}
        </div>
      )}

      {removing && (
        <ConfirmModal
          title="Remove this address?"
          message={`${removing.label || shippingAddressLines(asAddress(removing))[0]} won’t be offered for their next delivery. Orders already sent there keep it.`}
          confirmLabel="Remove"
          pendingLabel="Removing…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
          onClose={() => setRemoving(null)}
        />
      )}

      {editing && (
        <AddressDrawer
          customer={customer}
          address={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
          onRemove={(row) => {
            setEditing(null);
            setRemoving(row);
          }}
        />
      )}
    </motion.section>
  );
}

/** Add or correct one saved address — also opened from an order's delivery editor. */
export function AddressDrawer({
  customer,
  address,
  onClose,
  onSaved,
  onRemove,
}: {
  customer: Pick<Customer, 'id' | 'firstName' | 'lastName' | 'phone'>;
  address: CustomerAddress | null;
  onClose: () => void;
  onSaved: (saved: CustomerAddress) => void;
  /** Offers Remove in the footer — the customer's list, which confirms it; an order's editor leaves it out. */
  onRemove?: (address: CustomerAddress) => void;
}) {
  const home = useHomeCountries()[0]!;
  const [value, setValue] = useState<OrderShippingAddress>(() =>
    address
      ? asAddress(address)
      : emptyAddress({
          name: [customer.firstName, customer.lastName].filter(Boolean).join(' '),
          phone: customer.phone,
          country: home,
        }),
  );
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const [submitted, setSubmitted] = useState(false);
  const errors = addressErrors(value);

  const save = useMutation({
    mutationFn: () => {
      const body = { ...cleanAddress(value), label: address?.label ?? null, isDefault };
      return address ? updateCustomerAddress(customer.id, address.id, body) : createCustomerAddress(customer.id, body);
    },
    onSuccess: (saved) => {
      toast('success', address ? 'Address updated.' : 'Address added.');
      onSaved(saved);
    },
    onError: (error) => toast('error', error instanceof Error && error.message ? error.message : 'The address wasn’t saved. Try again.'),
  });

  return (
    <Drawer
      title={address ? 'Edit address' : 'New address'}
      description={address ? 'Orders already sent here keep the address they went to.' : 'Saved to the customer for their next delivery.'}
      onClose={onClose}
      // The file drawer's footer: the destructive action on the left, saving on the right.
      footer={
        <div className="flex items-center justify-between gap-2">
          {address && onRemove ? (
            <Button
              variant="ghost"
              className="gap-1.5 text-exception hover:text-exception"
              onClick={() => onRemove(address)}
              disabled={save.isPending}
            >
              <Trash2 size={14} aria-hidden="true" /> Remove
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
          )}
          <Button
            className="min-w-32"
            disabled={save.isPending}
            onClick={() => {
              setSubmitted(true);
              if (Object.keys(errors).length === 0) save.mutate();
            }}
          >
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save address
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <DeliveryAddressFields
          layout="sections"
          value={value}
          onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
          errors={submitted ? errors : undefined}
        />
        <DrawerSection id="address-options" title="Options">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <RowTile icon={Star} tone={isDefault ? 'success' : 'default'} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">Default address</span>
              <span className="block text-xs text-muted-foreground">
                {address?.isDefault ? 'Offered first. Make another the default to change it.' : 'Offered first for their next delivery.'}
              </span>
            </span>
            {/* A default can't be un-set here — another one has to take its place. */}
            <Switch label="Default address" checked={isDefault} onChange={setIsDefault} disabled={address?.isDefault} />
          </div>
        </DrawerSection>
      </div>
    </Drawer>
  );
}
