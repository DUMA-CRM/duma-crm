'use client';

import { useState } from 'react';

import { TRIGGER_HELP, TRIGGER_OPTIONS } from '@/components/communications/shared';
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Funnel,
  Gift,
  HeartHandshake,
  type IconComponent,
  Moon,
  PackageMinus,
  RotateCcw,
  Search,
  ShoppingCart,
  Sun,
  TicketPercent,
  UserPlus,
  XCircle,
} from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Input } from '@/components/ui/input';

import type { EmailAutomation } from '@/lib/modules/communications/client';
import { cn } from '@/lib/utils/cn';

type Trigger = EmailAutomation['trigger'];

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

/** The order the dialog lists its groups in: the busiest sources first. */
const GROUPS: Group[] = ['Orders', 'Bookings', 'Customers', 'Promotions & referrals', 'People', 'Inventory'];

/** One glyph per event, so a scan down the list reads the events, not the groups. */
const TRIGGER_ICON: Record<Trigger, IconComponent> = {
  order_created: ShoppingCart,
  order_paid: CreditCard,
  order_ready: Bell,
  order_completed: CheckCircle2,
  order_cancelled: XCircle,
  order_refunded: RotateCcw,
  reservation_confirmed: CalendarCheck,
  reservation_reminder: CalendarClock,
  reservation_changed: CalendarRange,
  reservation_cancelled: CalendarDays,
  customer_created: UserPlus,
  customer_birthday: Gift,
  customer_inactive: Moon,
  segment_entered: Funnel,
  promo_redeemed: TicketPercent,
  referral_completed: HeartHandshake,
  staff_onboarded: ClipboardCheck,
  staff_leave_approved: Sun,
  staff_document_expiring: FileText,
  stock_low: PackageMinus,
};

/** The icon an event is drawn with — in this dialog and on the trigger row. */
export const triggerIcon = (event: string): IconComponent => TRIGGER_ICON[event as Trigger] ?? ShoppingCart;

/**
 * Choosing what starts a workflow: a search over a short list, grouped by
 * where the event comes from — each choice its icon and full name, the
 * current one ticked. One click chooses and closes; Enter chooses a lone match.
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
  const needle = search.trim().toLowerCase();
  const shown = TRIGGER_OPTIONS.filter((option) =>
    `${option.label} ${TRIGGER_HELP[option.value] ?? ''} ${triggerGroup(option.value)}`.toLowerCase().includes(needle),
  );
  const groups = GROUPS.map((group) => ({ group, options: shown.filter((option) => triggerGroup(option.value) === group) })).filter(
    (entry) => entry.options.length > 0,
  );

  return (
    <Modal title="Choose an event" description="What happens that should start this workflow." size="xl" onClose={onClose}>
      <div className="space-y-4">
        <Input
          autoFocus
          type="search"
          leftIcon={<Search size={14} aria-hidden="true" />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && shown.length === 1) {
              event.preventDefault();
              onChoose(shown[0].value);
            }
          }}
          placeholder="Birthday, booking, order…"
          aria-label="Search events"
        />

        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No event matches. Try “order”, “customer” or “booking”.</p>
        ) : (
          <div role="radiogroup" aria-label="Events" className="max-h-[min(30rem,60vh)] gap-6 overflow-y-auto pr-1 sm:columns-2">
            {groups.map(({ group, options }) => (
              <div
                key={group}
                role="group"
                aria-labelledby={`trigger-group-${group.replace(/\W+/g, '-')}`}
                className="break-inside-avoid pb-3"
              >
                <p id={`trigger-group-${group.replace(/\W+/g, '-')}`} className="px-2 pb-1 text-xs font-semibold text-muted-foreground">
                  {group}
                </p>
                {options.map((option) => {
                  const chosen = current === option.value;
                  const Icon = triggerIcon(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      title={TRIGGER_HELP[option.value]}
                      onClick={() => onChoose(option.value)}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                        chosen ? 'bg-primary/6 font-semibold text-foreground' : 'text-foreground hover:bg-band/50',
                      )}
                    >
                      <Icon
                        size={16}
                        className={cn('mt-0.5 shrink-0', chosen ? 'text-primary' : 'text-muted-foreground')}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">{option.label}</span>
                      {chosen && <Check size={15} className="mt-0.5 shrink-0 text-primary" aria-label="Current" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
