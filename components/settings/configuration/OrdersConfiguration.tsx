'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { Ban, Bell, Check, Loader2 } from '@/components/icons';
import { SettingsChoice } from '@/components/settings/SettingsChoice';
import { SettingsSection } from '@/components/settings/SettingsSection';
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
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConfigurationBodySkeleton } from './shared';

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
  const id = useId();
  return (
    <fieldset aria-describedby={hint ? `${id}-hint` : undefined} className="min-w-0">
      <legend className="mb-1.5 text-label uppercase text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-2">
        <Input
          aria-label={label}
          value={amount}
          onChange={(e) => onChange({ amount: e.target.value, unit })}
          inputMode="decimal"
          error={error}
        />
        <Select
          value={unit}
          onValueChange={(next) => onChange({ amount, unit: next as DurationUnit })}
          options={UNITS}
          ariaLabel={`${label} unit`}
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </fieldset>
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
        <ConfigurationBodySkeleton label="Loading order settings" />
      </div>
    );
  }
  // Keep the form mounted across saves; reset only when switching workspace.
  return (
    <OrdersForm
      key={tenantId}
      ordering={ordering}
      vocabulary={vocabulary}
      canChange={canChange}
      qc={qc}
      tenantId={tenantId}
    />
  );
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
  const [nearly, setNearly] = useState(() => ({
    ...splitDuration(start.nearlyMins),
    amount: String(splitDuration(start.nearlyMins).amount),
  }));
  const [late, setLate] = useState(() => ({ ...splitDuration(start.lateMins), amount: String(splitDuration(start.lateMins).amount) }));
  const latestSaved = useRef(ordering);
  const pendingSave = useRef<(() => void) | null>(null);
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify(current));

  const nearlyMins = joinDuration(nearly.amount, nearly.unit);
  const lateMins = joinDuration(late.amount, late.unit);
  const errors = {
    late: on && lateMins === null ? 'More than 0.' : undefined,
    nearly:
      on && nearlyMins === null
        ? 'More than 0.'
        : on && nearlyMins !== null && lateMins !== null && nearlyMins >= lateMins
          ? 'Sooner than “late”.'
          : undefined,
  };
  const valid = !errors.late && !errors.nearly;

  const signature = JSON.stringify(on ? { nearlyMins, lateMins } : null);
  const dirty = signature !== savedSignature;
  const save = useMutation({
    mutationFn: (lateness: typeof current) =>
      updateTenantModuleConfiguration(
        tenantId!,
        'ordering',
        latestSaved.current,
        { lateness: lateness ?? { off: true } },
        lateness ? `Orders late after ${durationLabel(lateness.lateMins)}` : 'Late orders not flagged',
      ),
    onSuccess: async (result, lateness) => {
      latestSaved.current = result.module;
      setSavedSignature(JSON.stringify(lateness));
      await Promise.all([
        qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules') }),
        qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenant-modules') }),
      ]);
    },
  });
  const { mutate, isPending, isError } = save;

  // Wait for a pause in typing; do not persist an incomplete pair or retry a failed request automatically.
  useEffect(() => {
    pendingSave.current = null;
    if (!canChange || !tenantId || !dirty || !valid || isPending || isError) return;
    const persist = () => {
      pendingSave.current = null;
      mutate(on ? { nearlyMins: nearlyMins!, lateMins: lateMins! } : null);
    };
    pendingSave.current = persist;
    const timer = window.setTimeout(() => pendingSave.current?.(), 700);
    return () => window.clearTimeout(timer);
  }, [canChange, tenantId, dirty, valid, isPending, isError, on, nearlyMins, lateMins, mutate]);

  // Finish a queued valid edit if the user leaves before the typing delay ends.
  useEffect(() => () => pendingSave.current?.(), []);

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Late orders"
        descriptionClassName="max-w-none"
        description={
          vocabulary === 'retail'
            ? 'A parcel isn’t late after five minutes — set it in hours or days, or don’t flag lateness at all.'
            : 'Measured in each stage — how long an order has been new, preparing or ready — not since it was placed.'
        }
        actions={
          canChange ? (
            <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {save.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Saving…
                </>
              ) : save.isError ? (
                'Not saved'
              ) : dirty ? (
                valid ? (
                  'Waiting to save…'
                ) : (
                  'Check the times below'
                )
              ) : (
                <>
                  <Check size={14} aria-hidden="true" /> Saved
                </>
              )}
            </span>
          ) : undefined
        }
        footnote={canChange ? undefined : 'Only someone who can change workspace settings can change this.'}
      >
        <fieldset
          disabled={!canChange}
          className="space-y-4"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) pendingSave.current?.();
          }}
        >
          <legend className="sr-only">Late order settings</legend>
          <SettingsChoice
            label="Late order alerts"
            value={on ? 'on' : 'off'}
            onChange={(next) => {
              if (save.isError) save.reset();
              setOn(next === 'on');
            }}
            options={[
              { value: 'on', label: 'Flag late orders', icon: Bell },
              { value: 'off', label: 'Don’t flag them', icon: Ban },
            ]}
          />
          {on && (
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <DurationField
                label="Nearly late after"
                hint="Turns amber."
                amount={nearly.amount}
                unit={nearly.unit}
                onChange={(next) => {
                  if (save.isError) save.reset();
                  setNearly(next);
                }}
                error={dirty ? errors.nearly : undefined}
              />
              <DurationField
                label="Late after"
                hint="Turns red, and shows on the dashboard."
                amount={late.amount}
                unit={late.unit}
                onChange={(next) => {
                  if (save.isError) save.reset();
                  setLate(next);
                }}
                error={dirty ? errors.late : undefined}
              />
            </div>
          )}
        </fieldset>
        {save.isError && (
          <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-exception">
            <p>{save.error.message || 'Changes couldn’t be saved. Try again.'}</p>
            <Button
              variant="outline"
              size="sm"
              disabled={!canChange || !valid}
              onClick={() => save.mutate(on ? { nearlyMins: nearlyMins!, lateMins: lateMins! } : null)}
            >
              Retry
            </Button>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
