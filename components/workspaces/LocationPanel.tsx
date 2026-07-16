'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';

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
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const inputClass =
    'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
  const timeClass =
    'h-9 bg-background border border-border rounded-lg px-2 text-sm text-foreground tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150 disabled:opacity-40';

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
        onSubmit({ tenantId, name, address, timezone, phone: phone || undefined, openingHours: hours, isActive });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Camden High Street"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Address</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          placeholder="42 High St, London NW1"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Timezone</label>
        <TimezoneSelect value={timezone} onChange={setTimezone} required inputClassName={inputClass} placeholder="Search timezone…" />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+44 20 1234 5678"
          maxLength={30}
          className={inputClass}
        />
      </div>
      {/* Working hours */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">Working hours</label>
          <button
            type="button"
            onClick={copyMondayToAll}
            className="text-[11px] font-semibold text-primary hover:underline disabled:opacity-40"
            disabled={!hours.mon}
          >
            Copy Monday to all
          </button>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl border border-border p-2.5">
          {WEEKDAYS.map(({ key, label }) => {
            const day = hours[key];
            const open = day !== null;
            return (
              <div key={key} className="flex items-center gap-2">
                <label className="flex items-center gap-2 w-28 shrink-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) => toggleDay(key, e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
                {open ? (
                  <div className="flex items-center gap-1.5">
                    <input type="time" value={day.open} onChange={(e) => setDayTime(key, 'open', e.target.value)} className={timeClass} />
                    <span className="text-xs text-muted-foreground">–</span>
                    <input type="time" value={day.close} onChange={(e) => setDayTime(key, 'close', e.target.value)} className={timeClass} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm text-foreground">Active</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : initial ? 'Update' : 'Create'}
        </button>
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
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 h-10 bg-destructive hover:bg-destructive/90 active:translate-y-px text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

type ModalState = { mode: 'create' } | { mode: 'edit'; location: Location } | { mode: 'delete'; location: Location };

export function LocationPanel() {
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
    <aside className="w-100 max-w-full shrink-0 border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 border-b border-border shrink-0">
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Step 2 · Location</p>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Locations</h2>
          {tenantId && (
            <button
              onClick={() => setModal({ mode: 'create' })}
              className="h-8 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Plus size={13} aria-hidden="true" />
              New
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {tenantId
            ? 'Pick a location to make it active — it drives POS, orders and inventory. Click again to clear.'
            : 'Select a workspace first to see its locations.'}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!tenantId ? (
          <EmptyState
            icon={Building2}
            title="No workspace selected"
            description="Select a workspace on the left to manage its locations."
          />
        ) : isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : locations.length === 0 ? (
          <EmptyState icon={MapPin} title="No locations yet" description="Add the first location for this workspace." />
        ) : (
          <div className="flex flex-col gap-2">
            {locations.map((loc) => {
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
                    'group px-4 py-3 rounded-xl border cursor-pointer transition-colors duration-150',
                    'outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    isSelected ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/30 hover:bg-surface-offset',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                        isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <MapPin size={14} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">{loc.name}</p>
                        <span
                          className={cn(
                            'shrink-0 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full',
                            loc.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {loc.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{loc.address}</p>
                      {loc.phone && <p className="text-xs text-muted-foreground/70 truncate">{loc.phone}</p>}
                    </div>
                    {/* Actions — visible on hover */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal({ mode: 'edit', location: loc });
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-offset hover:text-foreground transition-colors"
                        aria-label={`Edit ${loc.name}`}
                      >
                        <Pencil size={12} aria-hidden="true" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal({ mode: 'delete', location: loc });
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label={`Delete ${loc.name}`}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.mode === 'create' && tenantId && (
        <Modal title="New Location" onClose={() => setModal(null)}>
          <LocationForm
            tenantId={tenantId}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={(data) => createMutation.mutate(data)}
          />
        </Modal>
      )}
      {modal?.mode === 'edit' && tenantId && (
        <Modal title="Edit Location" onClose={() => setModal(null)}>
          <LocationForm
            initial={modal.location}
            tenantId={tenantId}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={({ tenantId: _, ...data }) => updateMutation.mutate({ id: modal.location.id, data })}
          />
        </Modal>
      )}
      {modal?.mode === 'delete' && (
        <Modal title="Delete Location" onClose={() => setModal(null)}>
          <DeleteConfirm
            location={modal.location}
            onClose={() => setModal(null)}
            isPending={isPending}
            onConfirm={() => deleteMutation.mutate(modal.location.id)}
          />
        </Modal>
      )}
    </aside>
  );
}
