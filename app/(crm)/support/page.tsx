import { BookOpen, CircleHelp, Mail, MessageSquareText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { roleAtLeast } from '@/lib/api/staff.service';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

const commonSupportOptions = [
  {
    title: 'Operational help',
    description: 'Review orders, stock alerts, restocks, and shift activity.',
    icon: CircleHelp,
    href: '/dashboard',
    action: 'Review operations',
  },
  {
    title: 'Account and security',
    description: 'Manage your profile, appearance, sessions, and account preferences.',
    icon: ShieldCheck,
    href: '/settings',
    action: 'Open settings',
  },
];

export default async function SupportPage() {
  const profile = await getCurrentStaffProfile();
  const canManageWorkspaces = roleAtLeast(profile?.role, 'franchise_owner');
  const canManageMenu = roleAtLeast(profile?.role, 'store_manager');
  const gettingStarted = canManageWorkspaces
    ? {
        description: 'Set up locations, menus, staff access, and your first service.',
        href: '/workspaces',
        action: 'Open workspace setup',
      }
    : canManageMenu
      ? {
          description: 'Set up your menu and review the tools used during service.',
          href: '/menu',
          action: 'Open menu setup',
        }
      : {
          description: 'Review your current shift, assigned location, and service activity.',
          href: '/dashboard',
          action: 'Open your dashboard',
        };
  const supportOptions = [{ title: 'Getting started', icon: BookOpen, ...gettingStarted }, ...commonSupportOptions];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Help centre</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground md:text-3xl">How can we help?</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Find the right part of DUMA quickly or contact the support team when you need a hand.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {supportOptions.map(({ title, description, icon: Icon, href, action }) => (
          <article key={title} className="flex flex-col rounded-2xl border border-border bg-card p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon size={18} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{description}</p>
            <Link href={href} className="mt-5 text-sm font-semibold text-primary hover:underline">
              {action}
            </Link>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
              <MessageSquareText size={18} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Still need help?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Include your location, what you were trying to do, and any error message.
              </p>
            </div>
          </div>
          <a
            href="mailto:support@duma.coffee"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <Mail size={15} aria-hidden="true" />
            Email support
          </a>
        </div>
      </section>
    </div>
  );
}
