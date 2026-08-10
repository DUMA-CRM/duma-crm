'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Building2, MapPin, Pencil, Plus, Trash2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type Location,
  type LocationPayload,
  type OpeningHours,
  WEEKDAYS,
  createLocation,
  deleteLocation,
  getLocationsByTenant,
  updateLocation,
} from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Sensible starting point for a new location: open Mon–Fri 09:00–17:00, weekend closed.
function defaultHours(): OpeningHours {
  const weekday = { open: '09:00', close: '17:00' };
  return { mon: { ...weekday }, tue: { ...weekday }, wed: { ...weekday }, thu: { ...weekday }, fri: { ...weekday }, sat: null, sun: null };
}

// Guarantee all 7 keys exist (API may omit or store null for the whole field).
function normaliseHours(h?: OpeningHours | null): OpeningHours {
  const base = defaultHours();
  if (!h) return base;
  return {
    mon: h.mon ?? null,
    tue: h.tue ?? null,
    wed: h.wed ?? null,
    thu: h.thu ?? null,
    fri: h.fri ?? null,
    sat: h.sat ?? null,
    sun: h.sun ?? null,
  };
}

// ── Form ─────────────────────────────────────────────────────────────────────

function LocationForm({
  initial,
  tenantId,
  onSubmit,
  onClose,
  isPending,
}: {
  initial?: Location;
  tenantId: string;
  onSubmit: (data: LocationPayload) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [timezone, setTimezone] = useState(initial?.timezone ?? 'Europe/London');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [hours, setHours] = useState<OpeningHours>(normaliseHours(initial?.openingHours));
  const [dailyTarget, setDailyTarget] = useState(initial?.dailyRevenueTarget != null ? String(Number(initial.dailyRevenueTarget)) : '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const inputClass =
    'w-full h-9 bg-field border border-input rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
  const timeClass =
    'h-9 bg-field border border-input rounded-md px-2 text-sm text-foreground tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150 disabled:opacity-40';

  const toggleDay = (key: keyof OpeningHours, open: boolean) =>
    setHours((h) => ({ ...h, [key]: open ? { open: '09:00', close: '17:00' } : null }));
  const setDayTime = (key: keyof OpeningHours, field: 'open' | 'close', value: string) =>
    setHours((h) => ({ ...h, [key]: { ...(h[key] ?? { open: '09:00', close: '17:00' }), [field]: value } }));
  const copyMondayToAll = () =>
    setHours((h) =>
      h.mon
        ? { mon: h.mon, tue: { ...h.mon }, wed: { ...h.mon }, thu: { ...h.mon }, fri: { ...h.mon }, sat: { ...h.mon }, sun: { ...h.mon } }
        : h,
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          tenantId,
          name,
          address,
          timezone,
          phone: phone || undefined,
          openingHours: hours,
          // Empty clears the target rather than storing a zero, which the
          // dashboard would otherwise read as "aiming for nothing".
          dailyRevenueTarget: dailyTarget.trim() === '' ? null : Number(dailyTarget),
          isActive,
        });
      }}
      className="space-y-4"
    >
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Camden High Street" />
      <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="42 High St, London NW1" />
      <div>
        <label className="mb-1.5 block text-label uppercase text-muted-foreground">Timezone</label>
        <TimezoneSelect value={timezone} onChange={setTimezone} required inputClassName={inputClass} placeholder="Search timezone…" />
      </div>
      <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 20 1234 5678" maxLength={30} />

      {/* Working hours */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="block text-label uppercase text-muted-foreground">Working hours</label>
          <button
            type="button"
            onClick={copyMondayToAll}
            className="text-label font-semibold text-primary hover:underline disabled:opacity-40"
            disabled={!hours.mon}
          >
            Copy Monday to all
          </button>
        </div>
        <div className="flex flex-col gap-1.5 rounded-md border border-rule p-2.5">
          {WEEKDAYS.map(({ key, label }) => {
            const day = hours[key];
            const open = day !== null;
            return (
              <div key={key} className="flex items-center gap-2">
                <label className="flex w-28 shrink-0 cursor-pointer select-none items-center gap-2">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) => toggleDay(key, e.target.checked)}
                    className="size-4 rounded accent-primary"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
                {open ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={day.open}
                      onChange={(e) => setDayTime(key, 'open', e.target.value)}
                      className={timeClass}
                      aria-label={`${label} opening time`}
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <input
                      type="time"
                      value={day.close}
                      onChange={(e) => setDayTime(key, 'close', e.target.value)}
                      className={timeClass}
                      aria-label={`${label} closing time`}
                    />
                  </div>
                ) : (
                  <span className="text-xs italic text-muted-foreground">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Input
          label="Daily revenue target"
          type="number"
          min={0}
          step={10}
          inputMode="decimal"
          value={dailyTarget}
          onChange={(e) => setDailyTarget(e.target.value)}
          placeholder="e.g. 1600"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Net takings this site aims for in a day. The dashboard spreads it across the day using the site&rsquo;s typical trading shape, so
          progress is fair at 09:00 as well as at close. Leave empty for no target.
        </p>
      </div>

      <label className="flex cursor-pointer select-none items-center gap-2.5">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="size-4 rounded accent-primary"
        />
        <span className="text-sm text-foreground">Active</span>
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Create location'}
        </Button>
      </div>
    </form>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirm({
  location,
  onConfirm,
  onClose,
  isPending,
}: {
  location: Location;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Are you sure you want to delete <span className="font-semibold text-foreground">{location.name}</span>? This action cannot be
        undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
          {isPending ? 'Deleting…' : 'Delete location'}
        </Button>
      </div>
    </div>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────

type ModalState = { mode: 'create' } | { mode: 'edit'; location: Location } | { mode: 'delete'; location: Location };

/** Step 2 of the workspace settings: the sites inside the selected workspace. */
export function LocationList() {
  const qc = useQueryClient();
  const { tenantId, locationId, setLocationId } = useWorkspaceStore();
  const [modal, setModal] = useState<ModalState | null>(null);

  const {
    data: locations = [],
    isLoading,
    isSuccess,
  } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  // Reconcile stale persisted selection: if the active location no longer
  // exists under this workspace (deleted, or left over from a previous
  // session), clear it so POS/orders/inventory don't send an invalid id.
  // Guarded on isSuccess so we never clear during the loading/empty flash.
  useEffect(() => {
    if (isSuccess && locationId && !locations.some((l) => l.id === locationId)) {
      setLocationId(null);
    }
  }, [isSuccess, locations, locationId, setLocationId]);

  const createMutation = useMutation({
    mutationFn: createLocation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations', tenantId] });
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<LocationPayload, 'tenantId'>> }) => updateLocation(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations', tenantId] });
      setModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLocation,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['locations', tenantId] });
      if (locationId === id) setLocationId(null);
      setModal(null);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <SettingsSection
      title="Locations"
      description={
        tenantId
          ? 'Pick a location to make it active — it drives POS, orders and inventory. Click it again to clear.'
          : 'Select a workspace first to see its locations.'
      }
      actions={
        tenantId ? (
          <Button size="sm" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={14} aria-hidden="true" />
            New
          </Button>
        ) : undefined
      }
    >
      <div className="flex max-h-128 flex-col gap-2 overflow-y-auto">
        {!tenantId ? (
          <EmptyState icon={Building2} title="No workspace selected" description="Choose a workspace to manage its locations." />
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />)
        ) : locations.length === 0 ? (
          <EmptyState icon={MapPin} title="No locations yet" description="Add the first location for this workspace." />
        ) : (
          locations.map((loc) => {
            const isSelected = loc.id === locationId;
            return (
              <div
                key={loc.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setLocationId(isSelected ? null : loc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setLocationId(isSelected ? null : loc.id);
                  }
                }}
                className={cn(
                  'group cursor-pointer rounded-md border px-4 py-3 transition-colors duration-150',
                  'outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isSelected ? 'border-primary bg-band' : 'border-rule bg-card hover:border-primary/30 hover:bg-band',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md',
                      isSelected ? 'bg-card text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <MapPin size={14} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{loc.name}</p>
                      {isSelected && (
                        <Badge variant="success" className="shrink-0">
                          Current
                        </Badge>
                      )}
                      {!loc.isActive && (
                        <Badge variant="muted" className="shrink-0">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{loc.address}</p>
                    {loc.phone && <p className="truncate text-xs text-muted-foreground">{loc.phone}</p>}
                  </div>
                  {/* Actions — always visible on touch, hover-revealed on desktop */}
                  <div className="flex shrink-0 gap-1 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal({ mode: 'edit', location: loc });
                      }}
                      aria-label={`Edit ${loc.name}`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:text-exception"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal({ mode: 'delete', location: loc });
                      }}
                      aria-label={`Delete ${loc.name}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {modal?.mode === 'create' && tenantId && (
        <Modal title="New location" onClose={() => setModal(null)}>
          <LocationForm
            tenantId={tenantId}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={(data) => createMutation.mutate(data)}
          />
        </Modal>
      )}
      {modal?.mode === 'edit' && tenantId && (
        <Modal title="Edit location" onClose={() => setModal(null)}>
          <LocationForm
            initial={modal.location}
            tenantId={tenantId}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={({ tenantId: ignoredTenantId, ...data }) => {
              void ignoredTenantId;
              updateMutation.mutate({ id: modal.location.id, data });
            }}
          />
        </Modal>
      )}
      {modal?.mode === 'delete' && (
        <Modal title="Delete location" onClose={() => setModal(null)}>
          <DeleteConfirm
            location={modal.location}
            onClose={() => setModal(null)}
            isPending={isPending}
            onConfirm={() => deleteMutation.mutate(modal.location.id)}
          />
        </Modal>
      )}
    </SettingsSection>
  );
}
