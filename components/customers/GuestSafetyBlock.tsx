'use client';

import { AlertTriangle, Leaf, MapPin, Pencil, ShieldAlert } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Button } from '@/components/ui/button';

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
 * The panel itself stays porcelain and only the allergy band carries exception
 * red. An earlier version tinted the entire block red *and* the strip inside it,
 * which is how a warning stops being a warning — if the surface is always
 * shouting, the thing that matters is no louder than its own frame.
 *
 * Nothing renders when there is nothing to say. An always-present empty banner
 * trains people to skip the whole area, which defeats the point.
 */

const SEVERITY: Record<CustomerAlert['severity'], { chip: string; icon: string; label: string }> = {
  critical: { chip: 'bg-exception/12 text-exception', icon: 'text-exception', label: 'Critical' },
  warning: { chip: 'bg-warning/12 text-warning', icon: 'text-warning', label: 'Warning' },
  info: { chip: 'bg-band text-muted-foreground', icon: 'text-muted-foreground', label: 'Note' },
};

const labelFor = (slug: string) => {
  const words = slug.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function GuestSafetyBlock({ customer, onEdit }: { customer: Customer; onEdit?: () => void }) {
  const alerts = customer.alerts ?? [];
  const allergies = customer.allergies ?? [];
  const dietary = customer.dietary ?? [];
  const seating = customer.seatingPreference;

  const hasAnything = alerts.length > 0 || allergies.length > 0 || dietary.length > 0 || !!seating;

  if (!hasAnything) {
    return (
      <section
        aria-label="Guest safety and preferences"
        className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-dashed border-rule px-4 py-3"
      >
        <p className="text-xs text-muted-foreground">
          No allergies, dietary needs or alerts recorded. Anything added here shows before service, every time.
        </p>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            Add
          </Button>
        )}
      </section>
    );
  }

  // Critical first: order here is read as priority.
  const ordered = [...alerts].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    return rank[a.severity] - rank[b.severity];
  });

  return (
    <section aria-label="Guest safety and preferences" className="overflow-hidden rounded-sm border border-rule bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-rule/60 px-4 py-2.5">
        <h2 className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Before you serve</h2>
        {onEdit && (
          <Button variant="ghost" size="xs" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        )}
      </div>

      <div className="space-y-3 p-4">
        {/* ── Tier 1: the thing that can put someone in hospital ────────── */}
        {allergies.length > 0 && (
          <div className="rounded-sm border border-exception/40 bg-exception/8 p-3">
            <p className="flex items-center gap-2 text-micro font-semibold uppercase tracking-micro text-exception">
              <AlertTriangle size={14} aria-hidden="true" />
              Allergic to
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {allergies.map((allergen) => (
                <li
                  key={allergen}
                  className="rounded-sm border border-exception/45 bg-exception/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-exception"
                >
                  {labelFor(allergen)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-exception/85">Check every dish and drink against this list before it leaves the pass.</p>
          </div>
        )}

        {/* ── Tier 2: pinned alerts ─────────────────────────────────────── */}
        {ordered.length > 0 && (
          <ul className="divide-y divide-rule/50 overflow-hidden rounded-sm border border-rule">
            {ordered.map((alert, index) => {
              const severity = SEVERITY[alert.severity];
              return (
                <li key={`${alert.label}-${index}`} className="flex items-start gap-2.5 bg-background px-3 py-2.5">
                  <ShieldAlert size={15} className={cn('mt-0.5 shrink-0', severity.icon)} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        alert.severity === 'critical' ? 'text-exception' : 'text-foreground',
                      )}
                    >
                      {alert.label}
                    </p>
                    {alert.note && <p className="mt-0.5 text-xs text-muted-foreground">{alert.note}</p>}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold uppercase tracking-micro',
                      severity.chip,
                    )}
                  >
                    {severity.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* ── Tier 3: how they like it ──────────────────────────────────── */}
        {(dietary.length > 0 || seating) && (
          <dl className="grid gap-2.5 sm:grid-cols-2">
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
      </div>
    </section>
  );
}

function Preference({ icon: Icon, label, children }: { icon: IconComponent; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-sm border border-rule bg-background px-3 py-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}
