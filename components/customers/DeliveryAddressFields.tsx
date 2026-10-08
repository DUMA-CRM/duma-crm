'use client';

import { useId, useMemo } from 'react';

import { Globe, Hash, Landmark, MapPin, Phone, User } from '@/components/icons';
import { DrawerSection, FieldLine } from '@/components/shared/DrawerSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { useHomeCountries } from '@/lib/hooks/useHomeCountries';
import type { OrderShippingAddress } from '@/lib/modules/ordering/client';
import { type AddressErrors, countryOptions } from '@/lib/utils/delivery-address';

/**
 * A delivery address's fields — recipient, phone, street, town, postcode,
 * country (the reader's own pinned first). Shared by an order's delivery and a
 * customer's saved addresses, so the two never drift apart.
 */
export function DeliveryAddressFields({
  value,
  onChange,
  errors,
  layout = 'grid',
}: {
  value: OrderShippingAddress;
  onChange: (patch: Partial<OrderShippingAddress>) => void;
  /** Shown under their fields; pass them once the form has been submitted. */
  errors?: AddressErrors;
  /** `sections`: the newer drawers' white cards of rows — who it's for, where it goes. */
  layout?: 'grid' | 'sections';
}) {
  // Every likely home country pinned at the top — the workspace's, and each the browser's languages name.
  const homeKey = useHomeCountries().join(',');
  const countries = useMemo(() => countryOptions('en-GB', homeKey.split(',')), [homeKey]);
  const id = useId();
  if (layout === 'sections') {
    return (
      <div className="space-y-6">
        <DrawerSection id={`${id}-who`} title="Who it’s for">
          <FieldLine icon={User} title="Recipient" htmlFor={`${id}-name`} error={errors?.recipientName}>
            <Input
              id={`${id}-name`}
              value={value.recipientName}
              onChange={(e) => onChange({ recipientName: e.target.value })}
              placeholder="Name on the parcel"
              aria-invalid={Boolean(errors?.recipientName) || undefined}
            />
          </FieldLine>
          <FieldLine icon={Phone} title="Phone" htmlFor={`${id}-phone`}>
            <Input
              id={`${id}-phone`}
              value={value.phone ?? ''}
              onChange={(e) => onChange({ phone: e.target.value })}
              inputMode="tel"
              placeholder="For the courier — optional"
            />
          </FieldLine>
        </DrawerSection>

        <DrawerSection id={`${id}-where`} title="Where it goes">
          <FieldLine icon={MapPin} title="Address" htmlFor={`${id}-line1`} error={errors?.line1}>
            <div className="space-y-2">
              <Input
                id={`${id}-line1`}
                value={value.line1}
                onChange={(e) => onChange({ line1: e.target.value })}
                placeholder="Street and number"
                aria-invalid={Boolean(errors?.line1) || undefined}
              />
              <Input
                value={value.line2 ?? ''}
                onChange={(e) => onChange({ line2: e.target.value })}
                placeholder="Flat, floor, building — optional"
                aria-label="Address line 2"
              />
            </div>
          </FieldLine>
          <FieldLine icon={Landmark} title="Town or city" htmlFor={`${id}-city`} error={errors?.city}>
            <Input
              id={`${id}-city`}
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value })}
              aria-invalid={Boolean(errors?.city) || undefined}
            />
          </FieldLine>
          <FieldLine icon={Hash} title="Postcode" htmlFor={`${id}-postcode`} error={errors?.postcode}>
            <Input
              id={`${id}-postcode`}
              value={value.postcode}
              onChange={(e) => onChange({ postcode: e.target.value })}
              className="uppercase"
              aria-invalid={Boolean(errors?.postcode) || undefined}
            />
          </FieldLine>
          <FieldLine icon={Globe} title="Country" htmlFor={`${id}-country`}>
            <Select
              value={value.country}
              onValueChange={(country) => onChange({ country })}
              options={countries}
              ariaLabel="Country"
              className="w-full"
            />
          </FieldLine>
        </DrawerSection>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        label="Recipient"
        value={value.recipientName}
        onChange={(e) => onChange({ recipientName: e.target.value })}
        error={errors?.recipientName}
      />
      <Input
        label="Phone"
        value={value.phone ?? ''}
        onChange={(e) => onChange({ phone: e.target.value })}
        inputMode="tel"
        placeholder="For the courier — optional"
      />
      <div className="sm:col-span-2">
        <Input
          label="Address"
          value={value.line1}
          onChange={(e) => onChange({ line1: e.target.value })}
          placeholder="Street and number"
          error={errors?.line1}
        />
      </div>
      <div className="sm:col-span-2">
        <Input
          value={value.line2 ?? ''}
          onChange={(e) => onChange({ line2: e.target.value })}
          placeholder="Flat, floor, building — optional"
          aria-label="Address line 2"
        />
      </div>
      <Input label="Town or city" value={value.city} onChange={(e) => onChange({ city: e.target.value })} error={errors?.city} />
      <Input label="Postcode" value={value.postcode} onChange={(e) => onChange({ postcode: e.target.value })} error={errors?.postcode} />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label uppercase>Country</Label>
        <Select value={value.country} onValueChange={(country) => onChange({ country })} options={countries} ariaLabel="Country" />
      </div>
    </div>
  );
}
