'use client';

import { motion } from 'motion/react';

import { AlertTriangle, Leaf, MapPin, ShieldAlert, ShieldCheck } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils/cn';
import type { Customer, CustomerAlert } from '@/types/customers';

/**
 * What a member of staff must know about this guest before serving them.
 *
 * Three tiers, in the order they can hurt someone: allergies, then pinned
 * alerts, then preferences. Each allergen is its own boxed label rather than a
 * dot-separated run, because "peanuts · milk · sesame" is read as one blur at a
 * glance and the whole point of this block is the glance.
 *
 * The panel itself is the settings porcelain and only the allergy band carries
 * exception red. An earlier version tinted the entire block red *and* the strip inside it,
 * which is how a warning stops being a warning — if the surface is always
 * shouting, the thing that matters is no louder than its own frame.
 *
 * Nothing renders when there is nothing to say. An always-present empty banner
 * trains people to skip the whole area, which defeats the point.
 */

const SEVERITY: Record<CustomerAlert['severity'], { tile: string; badge: 'destructive' | 'warning' | 'muted'; label: string }> = {
  critical: { tile: 'bg-exception/8 text-exception', badge: 'destructive', label: 'Critical' },
  warning: { tile: 'bg-measured/10 text-measured', badge: 'warning', label: 'Warning' },
  info: { tile: 'bg-band text-muted-foreground', badge: 'muted', label: 'Note' },
};

const labelFor = (slug: string) => {
  const words = slug.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function GuestSafetyBlock({ customer }: { customer: Customer }) {
  const alerts = customer.alerts ?? [];
  const allergies = customer.allergies ?? [];
  const dietary = customer.dietary ?? [];
  const seating = customer.seatingPreference;

  const hasAnything = alerts.length > 0 || allergies.length > 0 || dietary.length > 0 || !!seating;

  if (!hasAnything) {
    return (
      <motion.section
        variants={SECTION_RISE}
        aria-label="Guest safety and preferences"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-rule/60 px-4 py-3"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 basis-60">
          <span className="block text-sm font-semibold text-foreground">Nothing to know before serving</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            No allergies, dietary needs or alerts recorded. Add them with Edit details — they show here before service, every time.
          </span>
        </span>
      </motion.section>
    );
  }

  // Critical first: order here is read as priority.
  const ordered = [...alerts].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    return rank[a.severity] - rank[b.severity];
  });

  return (
    <SettingsSection
      title="Before you serve"
      description="Allergies, alerts and preferences — read before every order. Change them with Edit details."
      bodyClassName="space-y-3"
    >
      {/* ── Tier 1: the thing that can put someone in hospital ────────── */}
      {allergies.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-exception/40 bg-exception/6 px-3.5 py-3" role="alert">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-exception/10 text-exception">
            <AlertTriangle size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-exception">Allergic to</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {allergies.map((allergen) => (
                <li
                  key={allergen}
                  className="rounded-md border border-exception/45 bg-exception/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-exception"
                >
                  {labelFor(allergen)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-exception/85">
              Check every dish and drink against this list before it leaves the pass.
            </p>
          </div>
        </div>
      )}

      {/* ── Tier 2: pinned alerts ─────────────────────────────────────── */}
      {ordered.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          {ordered.map((alert, index) => {
            const severity = SEVERITY[alert.severity];
            return (
              <li key={`${alert.label}-${index}`} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', severity.tile)}>
                  <ShieldAlert size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold', alert.severity === 'critical' ? 'text-exception' : 'text-foreground')}>
                    {alert.label}
                  </p>
                  {alert.note && <p className="mt-0.5 text-xs text-muted-foreground">{alert.note}</p>}
                </div>
                <Badge variant={severity.badge}>{severity.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Tier 3: how they like it ──────────────────────────────────── */}
      {(dietary.length > 0 || seating) && (
        <dl className="grid gap-3 sm:grid-cols-2">
          {dietary.length > 0 && (
            <Preference icon={Leaf} label="Dietary">
              {dietary.map(labelFor).join(', ')}
            </Preference>
          )}
          {seating && (
            <Preference icon={MapPin} label="Seating">
              {seating}
            </Preference>
          )}
        </dl>
      )}
    </SettingsSection>
  );
}

/** A `Fact` tile whose value wraps rather than truncates — a dietary list cut short is a list misread. */
function Preference({ icon: Icon, label, children }: { icon: IconComponent; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-label uppercase text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-semibold text-foreground">{children}</dd>
      </div>
    </div>
  );
}
