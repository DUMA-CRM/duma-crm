'use client';

import Link from 'next/link';

import { CalendarDays } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';

import { useAuthStore } from '@/stores/authStore';

// These schedules retain their domain's permissions, validation and editor.
// This directory deliberately does not imply that a job is enabled or healthy.
const schedules = [
  {
    capability: 'hr.payroll:read',
    title: 'Payroll auto-finalisation',
    description: 'Prepare pay runs on your configured schedule. Issuing payslips remains a separate payroll action.',
    href: '/staff/payroll',
  },
  {
    capability: 'cms:read',
    title: 'Content publishing',
    description: 'Schedule content to publish or unpublish from its entry editor.',
    href: '/content',
  },
  {
    capability: 'reservations.settings:write',
    title: 'Booking reminders',
    description: 'Choose when guests receive a reminder in a booking-reminder workflow.',
    href: '/automation?tab=workflows',
  },
];
export function ScheduledAutomations() {
  const capabilities = useAuthStore((state) => state.capabilities);
  const visible = schedules.filter((item) => capabilities.includes(item.capability));
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Schedules across DUMA</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Open the owning feature to review its current settings. These entries describe available schedules, not whether they are switched
          on.
        </p>
      </div>
      {visible.length ? (
        <ul className="divide-y divide-rule/60 border-y border-rule/60">
          {visible.map((item) => (
            <li key={item.title}>
              <Link
                href={item.href}
                className="flex items-start gap-3 px-3 py-4 hover:bg-band focus-visible:outline-2 focus-visible:outline-ring"
              >
                <CalendarDays size={18} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{item.description}</span>
                  <span className="mt-2 block text-xs font-semibold text-primary">Review schedule</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="No schedules available to your role"
          description="Your workflow timing can still be changed in its trigger and wait steps."
        />
      )}
    </div>
  );
}
