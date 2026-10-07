'use client';

import {
  Check,
  ChefHat,
  CreditCard,
  Globe,
  type IconComponent,
  Mail,
  MapPin,
  Minus,
  Package,
  Pencil,
  QrCode,
  Store,
  Tags,
  UserRound,
  Users,
} from '@/components/icons';
import { IconTag } from '@/components/shared/IconTag';
import { ListRow } from '@/components/shared/ListRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { businessProfile } from '@/lib/onboarding/answers';
import { type OnboardingDraft, type StepId, isStepVisible, slugFrom } from '@/lib/onboarding/flow';

// Lenient while typing so a hyphen can be entered; slugFrom tidies the ends on submit.
const typingSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-/, '')
    .slice(0, 63);

const PRESENCE = { in_person: 'In person', online: 'Online', both: 'In person and online' } as const;
const TEAM = { solo: 'Just me', small: '2–10 people', medium: '11–50 people', large: 'More than 50' } as const;
const STOCK = {
  none: 'Not tracked',
  simple: 'Counts on hand',
  batch_expiry: 'Batches and use-by dates',
  serial: 'Serial numbers',
} as const;

const list = (values: readonly string[], empty = 'None') => (values.length ? values.join(', ') : empty);

/** The tile each review row leads with. */
const ROW_ICON: Partial<Record<StepId, IconComponent>> = {
  name: Store,
  kind: Tags,
  presence: Globe,
  locations: MapPin,
  payments: CreditCard,
  kitchen: ChefHat,
  qr: QrCode,
  stock: Package,
  team: Users,
  owner: UserRound,
  email: Mail,
  location: MapPin,
};

interface ReviewStepProps {
  draft: OnboardingDraft;
  error: string | null;
  onEdit: (step: StepId) => void;
  update: (patch: Partial<OnboardingDraft>) => void;
}

export function ReviewStep({ draft, error, onEdit, update }: ReviewStepProps) {
  const profile = businessProfile(draft);
  const shown = (step: StepId) => isStepVisible(step, draft);

  // `on` marks a yes/no row: its answer is a tick or a dash beside the label.
  const rows: Array<{ step: StepId; label: string; value: string; on?: boolean }> = [
    { step: 'name', label: 'Business', value: draft.businessName.trim() },
    { step: 'kind', label: 'Type', value: profile.noun.charAt(0).toUpperCase() + profile.noun.slice(1) },
    { step: 'presence', label: 'Sells', value: draft.presence ? PRESENCE[draft.presence] : '—' },
    ...(shown('locations') ? [{ step: 'locations' as const, label: 'Locations', value: String(draft.locationCount) }] : []),
    {
      step: 'payments',
      label: 'Payments',
      value: list(draft.paymentMethods.map((method) => method.charAt(0).toUpperCase() + method.slice(1))),
    },
    ...(shown('kitchen') ? [{ step: 'kitchen' as const, label: 'Kitchen screen', value: '', on: !!draft.kitchenScreen }] : []),
    ...(shown('qr') ? [{ step: 'qr' as const, label: 'Table ordering', value: '', on: !!draft.qrOrdering }] : []),
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
      <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        {rows.map((row) => {
          const yesNo = row.on !== undefined;
          return (
            <ListRow
              key={row.label}
              icon={ROW_ICON[row.step] ?? Store}
              tone={yesNo && !row.on ? 'muted' : 'primary'}
              title={yesNo ? row.label : row.value}
              titleExtra={
                yesNo ? (
                  <IconTag icon={row.on ? Check : Minus} label={row.on ? 'Yes' : 'No'} tone={row.on ? 'success' : 'muted'} />
                ) : undefined
              }
              meta={yesNo ? undefined : row.label}
              trailing={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Change"
                  aria-label={`Change ${row.label.toLowerCase()}`}
                  onClick={() => onEdit(row.step)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              }
            />
          );
        })}
      </ul>

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
