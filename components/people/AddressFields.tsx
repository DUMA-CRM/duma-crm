'use client';

import { useState } from 'react';

import { inp, lbl, sel } from '@/components/people/shared';
import { useDrawerForm } from '@/components/shared/DrawerFormContext';
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/constants/countries';
import { type AddressParts, combineAddress, parseAddress } from '@/lib/utils/address';

export { type AddressParts, combineAddress, parseAddress };

/**
 * Four address inputs (line 1, city, post/zip code, country) that emit a single
 * combined line via onChange. Local state is the source of truth; `value` seeds
 * it once, so typing never fights a re-parse.
 *
 * Drawer fields use the shared label; other hosts may retain their label spacing.
 */
export function AddressFields({
  value,
  onChange,
  labelClassName = lbl,
}: {
  value: string;
  onChange: (combined: string) => void;
  labelClassName?: string;
}) {
  const drawer = useDrawerForm();
  const [parts, setParts] = useState<AddressParts>(() => {
    const p = parseAddress(value);
    if (!p.country) p.country = DEFAULT_COUNTRY;
    return p;
  });

  const update = (patch: Partial<AddressParts>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(combineAddress(next));
  };

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel className={drawer ? 'mb-1.5' : labelClassName}>Address line 1</FieldLabel>
        <input className={inp} value={parts.line1} onChange={(e) => update({ line1: e.target.value })} placeholder="123 High Street" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel className={drawer ? 'mb-1.5' : labelClassName}>City / town</FieldLabel>
          <input className={inp} value={parts.city} onChange={(e) => update({ city: e.target.value })} placeholder="London" />
        </div>
        <div>
          <FieldLabel className={drawer ? 'mb-1.5' : labelClassName}>Post / ZIP code</FieldLabel>
          <input className={inp} value={parts.postcode} onChange={(e) => update({ postcode: e.target.value })} placeholder="SW1A 1AA" />
        </div>
      </div>
      <div>
        <FieldLabel className={drawer ? 'mb-1.5' : labelClassName}>Country</FieldLabel>
        <Select
          value={parts.country}
          onValueChange={(country) => update({ country })}
          options={[
            ...(parts.country && !COUNTRIES.includes(parts.country as (typeof COUNTRIES)[number])
              ? [{ value: parts.country, label: parts.country }]
              : []),
            ...COUNTRIES.map((country) => ({ value: country, label: country })),
          ]}
          ariaLabel="Country"
          className={sel}
        />
      </div>
    </div>
  );
}
