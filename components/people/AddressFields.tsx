'use client';

import { useState } from 'react';

import { inp, lbl, sel } from '@/components/people/shared';
import { Select } from '@/components/ui/select';

import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/constants/countries';

import { type AddressParts, combineAddress, parseAddress } from '@/lib/utils/address';

export { type AddressParts, combineAddress, parseAddress };

/**
 * Four address inputs (line 1, city, post/zip code, country) that emit a single
 * combined line via onChange. Local state is the source of truth; `value` seeds
 * it once, so typing never fights a re-parse.
 *
 * `labelClassName` exists because this is used inside two different form
 * idioms: the HR-side forms label with the uppercase `lbl` style, while the
 * employee drawer uses plain sentence-case labels. Defaulting to `lbl` keeps
 * every existing caller as it was.
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
        <label className={labelClassName}>Address line 1</label>
        <input className={inp} value={parts.line1} onChange={(e) => update({ line1: e.target.value })} placeholder="123 High Street" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClassName}>City / town</label>
          <input className={inp} value={parts.city} onChange={(e) => update({ city: e.target.value })} placeholder="London" />
        </div>
        <div>
          <label className={labelClassName}>Post / ZIP code</label>
          <input className={inp} value={parts.postcode} onChange={(e) => update({ postcode: e.target.value })} placeholder="SW1A 1AA" />
        </div>
      </div>
      <div>
        <label className={labelClassName}>Country</label>
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
