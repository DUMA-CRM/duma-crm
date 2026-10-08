'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Ban, Bell, Loader2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { updateTenantModuleConfiguration } from '@/lib/api/modules.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type DurationUnit, FOOD_LATENESS, durationLabel, joinDuration, latenessFor, splitDuration } from '@/lib/utils/kitchen-age';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConfigurationBodySkeleton, ConfigurationHeader } from './shared';

const UNITS: { value: DurationUnit; label: string }[] = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
];

/** An amount and its unit — "5 minutes", "2 days" — for one threshold. */
function DurationField({
  label,
  hint,
  amount,
  unit,
  onChange,
  error,
}: {
  label: string;
  hint?: string;
  amount: string;
  unit: DurationUnit;
  onChange: (next: { amount: string; unit: DurationUnit }) => void;
  error?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-end gap-2">
      <Input label={label} hint={hint} value={amount} onChange={(e) => onChange({ amount: e.target.value, unit })} inputMode="decimal" error={error} />
      <Select value={unit} onValueChange={(next) => onChange({ amount, unit: next as DurationUnit })} options={UNITS} ariaLabel={`${label} unit`} />
    </div>
  );
}

/**
 * When an order counts as late — per workspace, because five minutes is late
 * for a flat white and nothing for a parcel. Feeds the kitchen screen's colours,
 * the dashboard's "needs you" strip and anything else that flags a late order.
 */
export function OrdersConfiguration() {
  const qc = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const canChange = hasCapability(
    useAuthStore((state) => state.capabilities),
    'settings:write',
  );
  const { vocabulary } = useCatalogWords();
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const ordering = modules.data?.modules.find((state) => state.moduleId === 'ordering');

  if (!ordering) {
    return (
      <div className="space-y-5">
        <ConfigurationHeader title="Orders" description="When an order counts as late." storageLabel="For the whole workspace" />
        <ConfigurationBodySkeleton label="Loading order settings" />
      </div>
    );
  }
  // Keyed by the saved revision, so a save from elsewhere resets the form to it.
  return <OrdersForm key={ordering.configurationVersion} ordering={ordering} vocabulary={vocabulary} canChange={canChange} qc={qc} tenantId={tenantId} />;
}

function OrdersForm({
  ordering,
  vocabulary,
  canChange,
  qc,
  tenantId,
}: {
  ordering: NonNullable<Awaited<ReturnType<typeof getCurrentTenantModules>>['modules'][number]>;
  vocabulary: 'menu' | 'retail' | 'mixed';
  canChange: boolean;
  qc: ReturnType<typeof useQueryClient>;
  tenantId: string | null;
}) {
  const current = latenessFor(ordering.configuration, vocabulary);
  // Off still remembers what "on" would be: the defaults for food, a day for products.
  const start = current ?? (vocabulary === 'retail' ? { nearlyMins: 720, lateMins: 1440 } : FOOD_LATENESS);
  const [on, setOn] = useState(current !== null);
  const [nearly, setNearly] = useState(() => ({ ...splitDuration(start.nearlyMins), amount: String(splitDuration(start.nearlyMins).amount) }));
  const [late, setLate] = useState(() => ({ ...splitDuration(start.lateMins), amount: String(splitDuration(start.lateMins).amount) }));
  const [submitted, setSubmitted] = useState(false);

  const nearlyMins = joinDuration(nearly.amount, nearly.unit);
  const lateMins = joinDuration(late.amount, late.unit);
  const errors = {
    late: on && lateMins === null ? 'More than 0.' : undefined,
    nearly: on && nearlyMins === null ? 'More than 0.' : on && nearlyMins !== null && lateMins !== null && nearlyMins >= lateMins ? 'Sooner than “late”.' : undefined,
  };
  const valid = !errors.late && !errors.nearly;

  const save = useMutation({
    mutationFn: () =>
      updateTenantModuleConfiguration(
        tenantId!,
        'ordering',
        ordering,
        { lateness: on ? { nearlyMins, lateMins } : { off: true } },
        on ? `Orders late after ${durationLabel(lateMins!)}` : 'Late orders not flagged',
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenant-modules') });
      toast('success', on ? `Orders now count as late after ${durationLabel(lateMins!)}.` : 'Late orders are no longer flagged.');
    },
    onError: (error) => toast('error', error.message || 'The setting wasn’t saved. Try again.'),
  });

  return (
    <div className="space-y-5">
      <ConfigurationHeader
        title="Orders"
        description="When an order counts as late — for the kitchen screen's colours and the dashboard's “needs you” strip."
        storageLabel="For the whole workspace"
      />
      <SettingsSection
        title="Late orders"
        description={
          vocabulary === 'retail'
            ? 'A parcel isn’t late after five minutes — set it in hours or days, or don’t flag lateness at all.'
            : 'Measured in each stage — how long an order has been new, preparing or ready — not since it was placed.'
        }
        footnote={canChange ? undefined : 'Only someone who can change workspace settings can change this.'}
      >
        <div className="space-y-4">
          <ChoiceCards
            columns={2}
            value={on ? 'on' : 'off'}
            onChange={(next) => setOn(next === 'on')}
            options={[
              { value: 'on', label: 'Flag late orders', icon: Bell },
              { value: 'off', label: 'Don’t flag them', icon: Ban },
            ]}
          />
          {on && (
            <div className="grid gap-4 border-t border-rule/60 pt-4 sm:grid-cols-2">
              <DurationField
                label="Nearly late after"
                hint="Turns amber."
                amount={nearly.amount}
                unit={nearly.unit}
                onChange={setNearly}
                error={submitted ? errors.nearly : undefined}
              />
              <DurationField
                label="Late after"
                hint="Turns red, and shows on the dashboard."
                amount={late.amount}
                unit={late.unit}
                onChange={setLate}
                error={submitted ? errors.late : undefined}
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button
              disabled={!canChange || save.isPending}
              onClick={() => {
                setSubmitted(true);
                if (valid) save.mutate();
              }}
            >
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
