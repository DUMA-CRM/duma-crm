'use client';

import { useState } from 'react';

import { TRIGGER_HELP, TRIGGER_OPTIONS } from '@/components/communications/shared';
import { Search, Zap } from '@/components/icons';
import { Input } from '@/components/ui/input';

import type { EmailAutomation } from '@/lib/modules/communications/client';

export const triggerGroup = (event: string) =>
  event.startsWith('order_')
    ? 'Orders'
    : event.startsWith('staff_')
      ? 'People'
      : event.startsWith('reservation_')
        ? 'Bookings'
        : event === 'promo_redeemed' || event === 'referral_completed'
          ? 'Promotions & referrals'
          : 'Customers';
const groups = ['Orders', 'Customers', 'Bookings', 'People', 'Promotions & referrals'];

export function TriggerPicker({ onChoose, current }: { onChoose: (trigger: EmailAutomation['trigger']) => void; current?: string }) {
  const [search, setSearch] = useState('');
  const matching = TRIGGER_OPTIONS.filter((option) =>
    `${option.label} ${triggerGroup(option.value)}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-4">
      <div>
        <h2 className="text-xl font-semibold">What starts this workflow?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Choose an event. You can add conditions, waits and actions next.</p>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-muted-foreground" aria-hidden="true" />
        <Input
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events, such as birthday or booking"
          aria-label="Search workflow triggers"
        />
      </div>
      {groups.map((group) => {
        const options = matching.filter((option) => triggerGroup(option.value) === group);
        return options.length ? (
          <section key={group} aria-label={group}>
            <h3 className="mb-2 text-sm font-semibold">{group}</h3>
            <div className="divide-y divide-rule/60 border-y border-rule/60">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChoose(option.value)}
                  aria-pressed={current === option.value}
                  className="flex min-h-16 w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Zap size={17} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {option.label}
                      {current === option.value && <span className="ml-2 text-xs text-muted-foreground">Current</span>}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{TRIGGER_HELP[option.value]}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null;
      })}
      {!matching.length && (
        <p role="status" className="text-sm text-muted-foreground">
          No matching events. Try “order”, “customer” or “booking”.
        </p>
      )}
    </div>
  );
}
