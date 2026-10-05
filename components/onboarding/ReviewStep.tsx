'use client';

import { Input } from '@/components/ui/input';
import { businessProfile } from '@/lib/onboarding/answers';
import { type OnboardingDraft, type StepId, isStepVisible, slugFrom } from '@/lib/onboarding/flow';

// Lenient while typing so a hyphen can be entered; slugFrom tidies the ends on submit.
const typingSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-/, '').slice(0, 63);

const PRESENCE = { in_person: 'In person', online: 'Online', both: 'In person and online' } as const;
const TEAM = { solo: 'Just me', small: '2–10 people', medium: '11–50 people', large: 'More than 50' } as const;
const STOCK = { none: 'Not tracked', simple: 'Counts on hand', batch_expiry: 'Batches and use-by dates', serial: 'Serial numbers' } as const;

const list = (values: readonly string[], empty = 'None') => (values.length ? values.join(', ') : empty);
const yes = (value: boolean | undefined) => (value ? 'Yes' : 'No');

interface ReviewStepProps {
  draft: OnboardingDraft;
  error: string | null;
  onEdit: (step: StepId) => void;
  update: (patch: Partial<OnboardingDraft>) => void;
}

export function ReviewStep({ draft, error, onEdit, update }: ReviewStepProps) {
  const profile = businessProfile(draft);
  const shown = (step: StepId) => isStepVisible(step, draft);

  const rows: Array<{ step: StepId; label: string; value: string }> = [
    { step: 'name', label: 'Business', value: draft.businessName.trim() },
    { step: 'kind', label: 'Type', value: profile.noun.charAt(0).toUpperCase() + profile.noun.slice(1) },
    { step: 'presence', label: 'Sells', value: draft.presence ? PRESENCE[draft.presence] : '—' },
    ...(shown('locations') ? [{ step: 'locations' as const, label: 'Locations', value: String(draft.locationCount) }] : []),
    { step: 'payments', label: 'Payments', value: list(draft.paymentMethods.map((method) => method.charAt(0).toUpperCase() + method.slice(1))) },
    ...(shown('kitchen') ? [{ step: 'kitchen' as const, label: 'Kitchen screen', value: yes(draft.kitchenScreen) }] : []),
    ...(shown('qr') ? [{ step: 'qr' as const, label: 'Table ordering', value: yes(draft.qrOrdering) }] : []),
    { step: 'stock', label: 'Stock', value: draft.stockTracking ? STOCK[draft.stockTracking] : '—' },
    { step: 'team', label: 'Team', value: draft.teamSize ? TEAM[draft.teamSize] : '—' },
    { step: 'owner', label: 'Owner', value: draft.ownerName.trim() },
    { step: 'email', label: 'Email', value: draft.email.trim() },
    { step: 'location', label: 'First location', value: `${draft.locationName.trim()} · ${draft.locationAddress.trim()}` },
  ];

  const slugInvalid = slugFrom(draft.workspaceSlug).length < 3;

  return (
    <div>
      {error && (
        <p role="alert" className="mb-6 rounded-md border border-exception/35 bg-destructive/6 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <dl className="divide-y divide-rule/45 border-y border-rule/45">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-4 py-2.5">
            <dt className="w-32 shrink-0 text-label uppercase text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 flex-1 truncate text-sm text-foreground">{row.value}</dd>
            <dd>
              <button
                type="button"
                onClick={() => onEdit(row.step)}
                className="text-xs font-semibold text-reference underline-offset-4 hover:underline"
                aria-label={`Change ${row.label.toLowerCase()}`}
              >
                Change
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <Input
          label="Workspace ID"
          name="workspaceSlug"
          autoComplete="off"
          spellCheck={false}
          value={draft.workspaceSlug}
          onChange={(event) => update({ workspaceSlug: typingSlug(event.target.value), slugTouched: true })}
          hint="A unique ID for your workspace. Lowercase letters, numbers and hyphens."
          error={slugInvalid ? 'Use at least 3 lowercase letters, numbers or hyphens.' : undefined}
          minLength={3}
          maxLength={63}
          required
        />
      </div>
    </div>
  );
}
