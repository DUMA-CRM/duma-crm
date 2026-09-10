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

