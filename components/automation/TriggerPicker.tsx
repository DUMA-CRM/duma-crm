'use client';

import { useState } from 'react';

import { RowTile } from '@/components/cms/rows';
import { TRIGGER_HELP, TRIGGER_OPTIONS } from '@/components/communications/shared';
import { CalendarDays, Check, type IconComponent, Search, ShoppingBag, Tag, UserRound, Users } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { EmailAutomation } from '@/lib/modules/communications/client';
import { cn } from '@/lib/utils/cn';

type Group = 'Inventory' | 'Orders' | 'Customers' | 'Bookings' | 'People' | 'Promotions & referrals';

export const triggerGroup = (event: string): Group =>
  event === 'stock_low'
    ? 'Inventory'
    : event.startsWith('order_')
      ? 'Orders'
      : event.startsWith('staff_')
        ? 'People'
        : event.startsWith('reservation_')
          ? 'Bookings'
          : event === 'promo_redeemed' || event === 'referral_completed'
            ? 'Promotions & referrals'
            : 'Customers';

const GROUPS: { group: Group; icon: IconComponent }[] = [
  { group: 'Inventory', icon: ShoppingBag },
  { group: 'Orders', icon: ShoppingBag },
  { group: 'Customers', icon: Users },
  { group: 'Bookings', icon: CalendarDays },
  { group: 'People', icon: UserRound },
  { group: 'Promotions & referrals', icon: Tag },
];

/** The icon an event's kind is drawn with — in this dialog and on the trigger card. */
export const triggerIcon = (event: string): IconComponent => GROUPS.find((entry) => entry.group === triggerGroup(event))!.icon;

/**
 * Choosing what starts a workflow: search, a pill per kind of event, and the
 * events as cards — each its name and what it means — the current one ticked.
 * One click chooses and closes.
 */
export function TriggerDialog({
  current,
  onChoose,
  onClose,
}: {
  current?: string;
  onChoose: (trigger: EmailAutomation['trigger']) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<Group | 'all'>('all');
  const needle = search.trim().toLowerCase();
  const shown = TRIGGER_OPTIONS.filter(
    (option) =>
      (group === 'all' || triggerGroup(option.value) === group) &&
      `${option.label} ${TRIGGER_HELP[option.value] ?? ''} ${triggerGroup(option.value)}`.toLowerCase().includes(needle),
  );
  const count = (target: Group) => TRIGGER_OPTIONS.filter((option) => triggerGroup(option.value) === target).length;

  return (
    <Modal title="Choose an event" description="What happens that should start this workflow." size="xl" onClose={onClose}>
      <div className="space-y-4">
        <Input
          autoFocus
          leftIcon={<Search size={14} aria-hidden="true" />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search — birthday, booking, order…"
          aria-label="Search events"
        />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of event">
          {[{ group: 'all' as const, icon: undefined }, ...GROUPS].map((entry) => {
            const active = group === entry.group;
            return (
              <Button
                key={entry.group}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                role="radio"
                aria-checked={active}
                className="gap-1.5"
                onClick={() => setGroup(entry.group)}
              >
                {entry.icon && <entry.icon size={14} aria-hidden="true" />}
                {entry.group === 'all' ? 'All' : entry.group}
                {entry.group !== 'all' && <span className="tabular-nums opacity-70">{count(entry.group)}</span>}
              </Button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No event matches. Try “order”, “customer” or “booking”.</p>
        ) : (
          <div className="grid max-h-[min(28rem,60vh)] gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Events">
            {shown.map((option) => {
              const chosen = current === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => onChoose(option.value)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    chosen ? 'border-primary bg-primary/6' : 'border-rule/60 hover:bg-band/50',
                  )}
                >
                  <RowTile icon={triggerIcon(option.value)} tone={chosen ? 'success' : 'default'} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{TRIGGER_HELP[option.value]}</span>
                  </span>
                  {chosen && <Check size={15} className="mt-1 shrink-0 text-primary" aria-label="Current" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
