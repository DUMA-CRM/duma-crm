'use client';

import Link from 'next/link';

import { ArrowRight, ChefHat, ClipboardCheck, Megaphone, ShieldCheck, ShoppingCart, Store, Users } from '@/components/icons';

const launches = {
  'organization.readiness': {
    href: '/settings/workspaces',
    label: 'Workspace readiness',
    description: 'Finish the decisions that make this workspace ready for service.',
    icon: ClipboardCheck,
  },
  'ordering.pos-launch': {
    href: '/pos',
    label: 'Take an order',
    description: 'Open the till and start serving customers.',
    icon: ShoppingCart,
  },
  'ordering.fulfilment-launch': {
    href: '/kds',
    label: 'Run fulfilment',
    description: 'See the live queue and move orders through the kitchen.',
    icon: ChefHat,
  },
  'people.team-launch': {
    href: '/staff/team',
    label: 'People workspace',
    description: 'Manage your team, roles and day-to-day people records.',
    icon: Users,
  },
  'customers.relationships-launch': {
    href: '/customers',
    label: 'Customer relationships',
    description: 'Understand returning guests and keep customer records useful.',
    icon: Store,
  },
  'communications.outreach-launch': {
    href: '/communications',
    label: 'Customer outreach',
    description: 'Prepare and send timely messages to your audience.',
    icon: Megaphone,
  },
  'compliance.audit-launch': {
    href: '/audit-log',
    label: 'Audit trail',
    description: 'Review important changes across the workspace.',
    icon: ShieldCheck,
  },
} as const;

export function DashboardLaunchBoard({ widgetKeys }: { widgetKeys: readonly string[] }) {
  const items = widgetKeys.flatMap((key) => (key in launches ? [launches[key as keyof typeof launches]] : []));
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="workspace-launches-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Workspace</p>
          <h2 id="workspace-launches-title" className="mt-1 text-base font-semibold tracking-title text-foreground">
            Ready when you are
          </h2>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{items.length} available</span>
      </div>

      <div className="divide-y divide-rule/55 border-y border-rule/65">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-band text-primary">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
              </span>
              <ArrowRight
                size={16}
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
