'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

import { Check, ChefHat, Clock, Globe, MapPin, Pencil, Plus, Power, Store, Target, Trash2 } from '@/components/icons';
import { ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { StatusDot } from '@/components/shared/StatusDot';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { TimePicker } from '@/components/ui/time-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { ALWAYS_OPEN_HOURS, isAlwaysOpen } from '@/lib/utils/trading-day';
import {
  type Location,
  type LocationPayload,
  type OpeningHours,
  type OrderFulfilmentMode,
  type Tenant,
  WEEKDAYS,
  createLocation,
  deleteLocation,
  getLocationsByTenant,
  setLocationActive,
  setLocationDailyTarget,
  updateLocation,
} from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const WORKFLOWS = [
  {
    value: 'kitchen',
    label: 'Kitchen workflow',
    detail: 'Paid tickets stay open on the kitchen screen until they’re made.',
    icon: ChefHat,
  },
  {
    value: 'counter',
    label: 'Counter service',
    detail: 'A sale completes the moment it’s paid — stock and loyalty update at once.',
    icon: Store,
  },
] as const;

// A new location starts open Mon–Fri 09:00–17:00, closed at the weekend.
function defaultHours(): OpeningHours {
  const weekday = { open: '09:00', close: '17:00' };
  return { mon: { ...weekday }, tue: { ...weekday }, wed: { ...weekday }, thu: { ...weekday }, fri: { ...weekday }, sat: null, sun: null };
}

// All seven keys, whatever the API stored.
function normaliseHours(hours?: OpeningHours | null): OpeningHours {
  if (!hours) return defaultHours();
  return {
    mon: hours.mon ?? null,
    tue: hours.tue ?? null,
    wed: hours.wed ?? null,
    thu: hours.thu ?? null,
    fri: hours.fri ?? null,
    sat: hours.sat ?? null,
    sun: hours.sun ?? null,
  };
}

function hoursSummary(hours?: OpeningHours | null) {
  if (isAlwaysOpen(hours)) return 'Open 24/7';
  const open = WEEKDAYS.filter(({ key }) => hours?.[key]);
  if (!hours || open.length === 0) return 'Hours not set';
  const first = hours[open[0].key]!;
  const same = open.every(({ key }) => hours[key]!.open === first.open && hours[key]!.close === first.close);
  return same ? `${open.length} days, ${first.open}–${first.close}` : `${open.length} days a week`;
}

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; location: Location }
  | { mode: 'target'; location: Location }
  | { mode: 'delete'; location: Location }
  | { mode: 'active'; location: Location };

/** Where the business trades from. Every action is shown only to a role the API will accept it from. */
export function LocationList({ tenant }: { tenant?: Tenant }) {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const capabilities = useAuthStore((state) => state.capabilities);
  const { tenantId, locationId, setLocationId } = useWorkspaceStore();
  const [modal, setModal] = useState<ModalState | null>(null);
  const canWrite = hasCapability(capabilities, 'locations:write');
  const canActivate = hasCapability(capabilities, 'locations:activate');
  const canTarget = hasCapability(capabilities, 'locations:targets');
  const workspaceActive = !tenant || tenant.status === 'active';
  const key = moduleQueryKeys.organization.key('locations', tenantId);

  const locations = useQuery({ queryKey: key, queryFn: () => getLocationsByTenant(tenantId!), enabled: Boolean(tenantId) });

  // A persisted location that no longer exists here, or was switched off, would
  // send POS, orders and stock an unusable id — clear it once the list is known.
  useEffect(() => {
    if (locations.isSuccess && locationId && !locations.data.some((row) => row.id === locationId && row.isActive)) setLocationId(null);
  }, [locations.isSuccess, locations.data, locationId, setLocationId]);

  const done = (message: string) => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant') });
    toast('success', message);
    setModal(null);
  };
  const failed = (error: Error) => toast('error', error.message);

  const create = useMutation({ mutationFn: createLocation, onSuccess: () => done('Location added.'), onError: failed });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<LocationPayload, 'tenantId'>> }) => updateLocation(id, data),
    onSuccess: () => done('Location saved.'),
    onError: failed,
  });
  const target = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number | null }) => setLocationDailyTarget(id, value),
    onSuccess: () => done('Daily target saved.'),
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: deleteLocation,
    onSuccess: (_, id) => {
      if (locationId === id) setLocationId(null);
      done('Location deleted.');
    },
    onError: failed,
  });
  const activate = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setLocationActive(id, isActive),
    onSuccess: (_, { id, isActive }) => {
      if (!isActive && locationId === id) setLocationId(null);
      done(isActive ? 'Location reopened.' : 'Location closed. Its history is kept.');
    },
    onError: failed,
  });

  const rows = locations.data ?? [];

  return (
    <SettingsSection
      title="Locations"
      description={workspaceActive ? undefined : 'This workspace is winding down, so locations can be closed but not added or reopened.'}
      actions={
        canWrite && tenantId ? (
          <Button size="sm" disabled={!workspaceActive} onClick={() => setModal({ mode: 'create' })}>
            <Plus aria-hidden="true" /> Add location
          </Button>
        ) : undefined
      }
    >
      {!tenantId ? (
        <EmptyState icon={MapPin} title="No workspace selected" description="Choose a workspace to see where it trades from." compact />
      ) : locations.isPending ? (
        <TilesSkeleton count={2} label="Loading locations" />
      ) : locations.isError ? (
        <ErrorState title="Couldn’t load locations" onRetry={() => void locations.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add the first place this business trades from."
          action={
            canWrite && workspaceActive ? { label: 'Add location', icon: Plus, onClick: () => setModal({ mode: 'create' }) } : undefined
          }
          compact
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const selected = row.id === locationId;
            const details = [
              row.orderFulfilmentMode === 'counter' ? 'Counter service' : 'Kitchen',
              hoursSummary(row.openingHours),
              row.dailyRevenueTarget != null ? `${Number(row.dailyRevenueTarget).toLocaleString()} a day` : null,
            ].filter(Boolean);
            return (
              <motion.li
                key={row.id}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                  row.isActive && !selected && 'hover:border-rule hover:bg-band/45',
                  selected ? 'border-primary/40 bg-primary/5' : 'border-rule/50 bg-background/60',
                )}
              >
                <button
                  type="button"
                  // Clicking the current location again clears it, as it did before.
                  onClick={() => row.isActive && setLocationId(selected ? null : row.id)}
                  disabled={!row.isActive}
                  aria-pressed={selected}
                  aria-label={selected ? `Stop using ${row.name} on this device` : `Use ${row.name} on this device`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring disabled:cursor-default"
                >
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-md transition-colors',
                      // Light green like every other icon tile; a closed site goes grey.
                      row.isActive ? 'bg-primary/8 text-primary' : 'bg-band text-muted-foreground opacity-60',
                    )}
                  >
                    {selected ? <Check size={17} aria-hidden="true" /> : <MapPin size={17} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn('truncate text-sm font-semibold', row.isActive ? 'text-foreground' : 'text-muted-foreground')}>
                        {row.name}
                      </span>
                      {!row.isActive && <StatusDot tone="muted" label="Closed" />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {[row.address || 'No address', ...details].join(' · ')}
                    </span>
                  </span>
                </button>

                {/* The tint and the tick mark this device's location; aria-pressed says it. */}
                {/* Above the stretched row button, so the icons stay their own targets. */}
                {(canWrite || canTarget || canActivate) && (
                  <div className="relative z-10 flex shrink-0 items-center gap-0.5">
                    {!canWrite && canTarget && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Daily target"
                        aria-label={`Daily target for ${row.name}`}
                        onClick={() => setModal({ mode: 'target', location: row })}
                      >
                        <Target aria-hidden="true" />
                      </Button>
                    )}
                    {canWrite && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit"
                        aria-label={`Edit ${row.name}`}
                        onClick={() => setModal({ mode: 'edit', location: row })}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    )}
                    {canActivate && (row.isActive || workspaceActive) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={row.isActive ? 'Close' : 'Reopen'}
                        aria-label={`${row.isActive ? 'Close' : 'Reopen'} ${row.name}`}
                        onClick={() => setModal({ mode: 'active', location: row })}
                      >
                        <Power aria-hidden="true" />
                      </Button>
                    )}
                    {canWrite && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-exception"
                        title="Delete"
                        aria-label={`Delete ${row.name}`}
                        onClick={() => setModal({ mode: 'delete', location: row })}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}

      {(modal?.mode === 'create' || modal?.mode === 'edit') && tenantId && (
        <Modal title={modal.mode === 'create' ? 'Add a location' : `Edit ${modal.location.name}`} size="lg" onClose={() => setModal(null)}>
          <LocationForm
            initial={modal.mode === 'edit' ? modal.location : undefined}
            tenantId={tenantId}
            defaultTimezone={tenant?.timezone}
            pending={create.isPending || update.isPending}
            onClose={() => setModal(null)}
            onSubmit={({ tenantId: ignored, ...data }) => {
              void ignored;
              if (modal.mode === 'edit') update.mutate({ id: modal.location.id, data });
              else create.mutate({ tenantId, ...data });
            }}
          />
        </Modal>
      )}
      {modal?.mode === 'target' && (
        <Modal title={`Daily target · ${modal.location.name}`} onClose={() => setModal(null)}>
          <TargetForm
            location={modal.location}
            pending={target.isPending}
            onClose={() => setModal(null)}
            onSubmit={(value) => target.mutate({ id: modal.location.id, value })}
          />
        </Modal>
      )}
      {modal?.mode === 'delete' && (
        <ConfirmModal
          title={`Delete ${modal.location.name}?`}
          message="This can’t be undone. A location that has taken orders can’t be deleted — close it instead to keep its history."
          confirmLabel="Delete location"
          pendingLabel="Deleting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(modal.location.id)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'active' && (
        <ConfirmModal
          title={modal.location.isActive ? `Close ${modal.location.name}?` : `Reopen ${modal.location.name}?`}
          message={
            modal.location.isActive
              ? 'It stops appearing on the till and in location pickers. Orders, stock and reports are kept.'
              : 'It becomes available on the till and in location pickers again.'
          }
          confirmLabel={modal.location.isActive ? 'Close location' : 'Reopen location'}
          pendingLabel="Saving…"
          isPending={activate.isPending}
          onConfirm={() => activate.mutate({ id: modal.location.id, isActive: !modal.location.isActive })}
          onClose={() => setModal(null)}
        />
      )}
    </SettingsSection>
  );
}

function TargetForm({
  location,
  pending,
  onClose,
  onSubmit,
}: {
  location: Location;
  pending: boolean;
  onClose: () => void;
  onSubmit: (value: number | null) => void;
}) {
  const [value, setValue] = useState(location.dailyRevenueTarget != null ? String(Number(location.dailyRevenueTarget)) : '');
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value.trim() === '' ? null : Number(value));
      }}
    >
      <Input
        label="Net takings per day"
        type="number"
        min={0}
        step={10}
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="e.g. 1600"
        hint="The dashboard spreads it across the day using this site’s usual trading pattern. Leave empty for no target."
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          {pending ? 'Saving…' : 'Save target'}
        </Button>
      </div>
    </form>
  );
}

function LocationForm({
  initial,
  tenantId,
  defaultTimezone,
  pending,
  onClose,
  onSubmit,
}: {
  initial?: Location;
  tenantId: string;
  /** A new location starts in the workspace's zone. */
  defaultTimezone?: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: LocationPayload) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [timezone, setTimezone] = useState(initial?.timezone ?? defaultTimezone ?? 'Europe/London');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  // Fixed hours, or open 24/7 — an online shop, or anywhere that never closes.
  const [hoursMode, setHoursMode] = useState<'set' | 'always'>(isAlwaysOpen(initial?.openingHours) ? 'always' : 'set');
  const [hours, setHours] = useState<OpeningHours>(normaliseHours(isAlwaysOpen(initial?.openingHours) ? null : initial?.openingHours));
  const [workflow, setWorkflow] = useState<OrderFulfilmentMode>(initial?.orderFulfilmentMode ?? 'kitchen');
  const [dailyTarget, setDailyTarget] = useState(initial?.dailyRevenueTarget != null ? String(Number(initial.dailyRevenueTarget)) : '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const setDay = (key: keyof OpeningHours, open: boolean) =>
    setHours((current) => ({ ...current, [key]: open ? { open: '09:00', close: '17:00' } : null }));
  const setTime = (key: keyof OpeningHours, field: 'open' | 'close', value: string) =>
    setHours((current) => ({ ...current, [key]: { ...(current[key] ?? { open: '09:00', close: '17:00' }), [field]: value } }));
  const copyMonday = () =>
    setHours((current) =>
      current.mon ? (Object.fromEntries(WEEKDAYS.map(({ key }) => [key, { ...current.mon! }])) as unknown as OpeningHours) : current,
    );

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          tenantId,
          name,
          address: address.trim() || null,
          timezone,
          phone: phone || undefined,
          openingHours: hoursMode === 'always' ? ALWAYS_OPEN_HOURS : hours,
          orderFulfilmentMode: workflow,
          // Empty clears the target rather than storing a zero the dashboard would read as "aiming for nothing".
          dailyRevenueTarget: dailyTarget.trim() === '' ? null : Number(dailyTarget),
          isActive,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          placeholder="Camden High Street"
        />
        <Input
          label="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+44 20 1234 5678"
          maxLength={30}
        />
        <div className="sm:col-span-2">
          <Input
            label="Address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="42 High St, London NW1"
            hint="Leave blank for an online shop with no premises."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-label uppercase text-muted-foreground">Timezone</label>
          <TimezoneSelect value={timezone} onChange={setTimezone} required placeholder="Search timezone…" />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-label uppercase text-muted-foreground">Order workflow</legend>
        <ChoiceGrid<OrderFulfilmentMode>
          label="Order workflow"
          shortcuts={false}
          selected={[workflow]}
          onChange={setWorkflow}
          choices={WORKFLOWS}
        />
      </fieldset>

      <fieldset>
        <div className="mb-2 flex items-center justify-between">
          <legend className="text-label uppercase text-muted-foreground">Opening hours</legend>
          {hoursMode === 'set' && (
            <button
              type="button"
              onClick={copyMonday}
              disabled={!hours.mon}
              className="text-xs font-semibold text-reference hover:underline disabled:opacity-40"
            >
              Copy Monday to every day
            </button>
          )}
        </div>
        <div className="mb-3">
          <ChoiceCards
            columns={2}
            value={hoursMode}
            onChange={(next) => setHoursMode(next as 'set' | 'always')}
            options={[
              { value: 'set', label: 'Set opening hours', icon: Clock },
              { value: 'always', label: 'Open 24/7', icon: Globe },
            ]}
          />
        </div>
        {hoursMode === 'always' ? (
          <p className="rounded-lg border border-rule/60 bg-band/40 px-3.5 py-3 text-sm text-muted-foreground">
            Orders are taken around the clock — right for an online shop. The dashboard reads the whole day as trading, and won’t ask for
            hours.
          </p>
        ) : (
        <div className="divide-y divide-rule/40 rounded-lg border border-rule/60">
          {WEEKDAYS.map(({ key, label }) => {
            const day = hours[key];
            return (
              <div key={key} className="flex h-12 items-center gap-3 px-3">
                <Switch label={`Open on ${label}`} checked={day !== null} onChange={(open) => setDay(key, open)} />
                <span className="w-24 text-sm font-medium text-foreground">{label}</span>
                <AnimatePresence mode="wait" initial={false}>
                  {day ? (
                    <motion.div
                      key="open"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <div className="w-28">
                        <TimePicker value={day.open} onValueChange={(value) => setTime(key, 'open', value)} required aria-label={`${label} opening time`} />
                      </div>
                      <span className="text-xs text-muted-foreground">to</span>
                      <div className="w-28">
                        <TimePicker value={day.close} onValueChange={(value) => setTime(key, 'close', value)} required aria-label={`${label} closing time`} />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.span
                      key="closed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-muted-foreground"
                    >
                      Closed
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        )}
      </fieldset>

      <Input
        label="Daily revenue target"
        type="number"
        min={0}
        step={10}
        inputMode="decimal"
        value={dailyTarget}
        onChange={(event) => setDailyTarget(event.target.value)}
        placeholder="e.g. 1600"
        hint="Net takings this site aims for in a day. Leave empty for no target."
      />

      <div className="flex items-center justify-between rounded-lg border border-rule/60 px-4 py-3">
        <span>
          <span className="block text-sm font-semibold text-foreground">Open for trading</span>
          <span className="text-xs text-muted-foreground">Closed locations keep their history but leave the till.</span>
        </span>
        <Switch label="Open for trading" checked={isActive} onChange={setIsActive} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="h-11 min-w-32" disabled={pending}>
          {pending ? 'Saving…' : initial ? 'Save location' : 'Add location'}
        </Button>
      </div>
    </form>
  );
}
