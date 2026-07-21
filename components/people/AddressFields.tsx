'use client';

import { useState } from 'react';

import { inp, lbl, sel } from '@/components/people/shared';
import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/constants/countries';

// The DB stores a single `address` line, so we compose "line1, city, postcode,
// country" and parse it back into the four fields for editing. Parsing pops
// from the end (country last), which round-trips our own fully-filled
// addresses; a first line that itself contains commas is preserved because
// everything before the last three segments becomes line 1.

export interface AddressParts {
  line1: string;
  city: string;
  postcode: string;
  country: string;
}

export function combineAddress(p: AddressParts): string {
  return [p.line1, p.city, p.postcode, p.country].map((s) => s.trim()).filter(Boolean).join(', ');
}

export function parseAddress(value: string | null | undefined): AddressParts {
  const segs = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (segs.length === 0) return { line1: '', city: '', postcode: '', country: '' };
  if (segs.length === 1) return { line1: segs[0], city: '', postcode: '', country: '' };
  const country = segs.pop() ?? '';
  const postcode = segs.length >= 3 ? (segs.pop() ?? '') : '';
  const city = segs.length >= 2 ? (segs.pop() ?? '') : '';
  return { line1: segs.join(', '), city, postcode, country };
}

/**
 * Four address inputs (line 1, city, post/zip code, country) that emit a single
 * combined line via onChange. Local state is the source of truth; `value` seeds
 * it once, so typing never fights a re-parse.
 */
export function AddressFields({ value, onChange }: { value: string; onChange: (combined: string) => void }) {
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
        <label className={lbl}>Address line 1</label>
        <input
          className={inp}
          value={parts.line1}
          onChange={(e) => update({ line1: e.target.value })}
          placeholder="123 High Street"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>City / town</label>
          <input className={inp} value={parts.city} onChange={(e) => update({ city: e.target.value })} placeholder="London" />
        </div>
        <div>
          <label className={lbl}>Post / ZIP code</label>
          <input className={inp} value={parts.postcode} onChange={(e) => update({ postcode: e.target.value })} placeholder="SW1A 1AA" />
        </div>
      </div>
      <div>
        <label className={lbl}>Country</label>
        <select className={sel} value={parts.country} onChange={(e) => update({ country: e.target.value })}>
          {/* Keep a stored non-standard country selectable rather than silently dropping it. */}
          {parts.country && !COUNTRIES.includes(parts.country as (typeof COUNTRIES)[number]) && (
            <option value={parts.country}>{parts.country}</option>
          )}
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
