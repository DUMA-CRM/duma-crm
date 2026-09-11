'use client';


import {
} from '@/components/icons';
import {
} from '@/components/people/shared';

import {
  getEmployee,
} from '@/lib/api/hr.service';
import {
} from '@/lib/api/people-ops.service';


/* The pieces more than one section of the record needs. */

/** The employee record as the API returns it. */
export type Employee = Awaited<ReturnType<typeof getEmployee>>;

// Current + previous month range presets for the hours view.
export function monthRange(offset: number): { from: string; to: string; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  };
}

export function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">{label}</dt>
      <dd className="text-foreground mt-0.5">{value || <span className="text-muted-foreground/60">—</span>}</dd>
    </div>
  );
}


// ── The card shell ───────────────────────────────────────────────────────────
//
// One definition, because the record had four: `rounded-sm border p-5`,
// `rounded-sm border shadow-sm overflow-hidden`, `rounded-sm border
// overflow-hidden`, and `DetailCard`'s `rounded-md p-4 shadow-sm md:p-5`. Four
// shells on one page is visible as slightly different corners and shadows from
// card to card.
//
// `mb-4 break-inside-avoid` is the load-bearing part. These cards hold wildly
// different numbers of rows, and a `grid` reserves the height of its tallest —
// leaving a hole under every short one. Flowing them in `columns-*` packs them
// instead, but only if each card declares that it must not be split.

/** Edge-to-edge content: tables, divided lists, anything with its own padding. */
export const CARD = 'mb-4 break-inside-avoid rounded-md border border-rule bg-card shadow-sm';

/** The usual case: a card that pads its own content. */
export const CARD_PADDED = `${CARD} p-4 md:p-5`;
