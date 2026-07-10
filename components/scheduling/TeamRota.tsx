'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, CalendarClock, MapPin, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CoveragePanel } from '@/components/scheduling/CoveragePanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';

import {
  type ScheduledShift,
  type ScheduledShiftStatus,
  type VarianceStatus,
  createScheduledShift,
  deleteScheduledShift,
  getScheduledShifts,
  getStaffSuggestions,
  getVariance,
  publishScheduledShifts,
  updateScheduledShift,
} from '@/lib/api/scheduling.service';
import { type StaffProfile, getStaff } from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Shared form styles ────────────────────────────────────────────────────────

const inp =
  'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
const sel = inp + ' cursor-pointer';
const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

const STATUS_VARIANT: Record<ScheduledShiftStatus, 'muted' | 'success' | 'destructive'> = {
  draft: 'muted',
  published: 'success',
  cancelled: 'destructive',
};
const STATUSES: ScheduledShiftStatus[] = ['draft', 'published', 'cancelled'];

const ATTENDANCE: Record<VarianceStatus, { label: string; variant: 'success' | 'primary' | 'destructive' }> = {
  worked: { label: 'Worked', variant: 'success' },
  in_progress: { label: 'In progress', variant: 'primary' },
  no_show: { label: 'No show', variant: 'destructive' },
};
const fmtMinutes = (mins: number) => `${Math.floor(mins / 60)}:${String(Math.round(mins % 60)).padStart(2, '0')}`;

// ── Date helpers ──────────────────────────────────────────────────────────────

function mondayOf(d: Date): Date {
  const diff = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const localToISO = (v: string): string => new Date(v).toISOString();
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function staffName(shift: ScheduledShift, staff: StaffProfile[]): string {
  if (!shift.userId) return 'Open slot';
  return shift.staff?.user?.name ?? staff.find((s) => s.userId === shift.userId)?.name ?? 'Unknown';
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateShiftModal({ defaultLocationId, locations, staff, onClose }: { defaultLocationId: string; locations: { id: string; name: string }[]; staff: StaffProfile[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [userId, setUserId] = useState<string>('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');

  const suggestReady = !!locationId && !!startsAt && !!endsAt && new Date(endsAt) > new Date(startsAt);
  const { data: suggestions = [] } = useQuery({
    queryKey: ['shift-suggestions', locationId, startsAt, endsAt],
    queryFn: () => getStaffSuggestions({ locationId, startsAt: localToISO(startsAt), endsAt: localToISO(endsAt) }),
    enabled: suggestReady,
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createScheduledShift({ locationId, userId: userId || null, startsAt: localToISO(startsAt), endsAt: localToISO(endsAt), role: role || undefined, notes: notes || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduled-shifts'] }); onClose(); },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutate(); }} className="space-y-4">
      <div>
        <label className={lbl}>Location</label>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={sel} required>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Starts at</label><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={inp} /></div>
        <div><label className={lbl}>Ends at</label><input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className={inp} /></div>
      </div>
      <div>
        <label className={lbl}>Staff</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className={sel}>
          <option value="">Open slot</option>
          {staff.map((s) => <option key={s.userId} value={s.userId}>{s.name ?? s.email ?? s.userId}</option>)}
        </select>
      </div>
      {suggestReady && suggestions.length > 0 && (
        <div>
          <label className={lbl}><span className="inline-flex items-center gap-1"><Sparkles size={11} /> Suggested staff</span></label>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s.userId} type="button" onClick={() => setUserId(s.userId)} title={s.reason}
                className={'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors ' + (userId === s.userId ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:bg-surface-offset')}>
                <span className="font-semibold">{s.name}</span>
                <span className="text-muted-foreground">{s.scheduledHoursThisWeek}h</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div><label className={lbl}>Role</label><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Barista" className={inp} /></div>
      <div><label className={lbl}>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inp} /></div>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors">Cancel</button>
        <button type="submit" disabled={isPending} className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">{isPending ? 'Creating…' : 'Create'}</button>
      </div>
    </form>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditShiftModal({ shift, staff, onClose }: { shift: ScheduledShift; staff: StaffProfile[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string>(shift.userId ?? '');
  const [startsAt, setStartsAt] = useState(isoToLocalInput(shift.startsAt));
  const [endsAt, setEndsAt] = useState(isoToLocalInput(shift.endsAt));
  const [role, setRole] = useState(shift.role ?? '');
  const [status, setStatus] = useState<ScheduledShiftStatus>(shift.status);
  const [notes, setNotes] = useState(shift.notes ?? '');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['scheduled-shifts'] });
  const { mutate, isPending, error } = useMutation({
    mutationFn: () => updateScheduledShift(shift.id, { userId: userId || null, startsAt: localToISO(startsAt), endsAt: localToISO(endsAt), role: role || undefined, status, notes: notes || undefined }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  const del = useMutation({ mutationFn: () => deleteScheduledShift(shift.id), onSuccess: () => { invalidate(); onClose(); } });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutate(); }} className="space-y-4">
      <div>
        <label className={lbl}>Staff</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className={sel}>
          <option value="">Open slot</option>
          {staff.map((s) => <option key={s.userId} value={s.userId}>{s.name ?? s.email ?? s.userId}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Starts at</label><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={inp} /></div>
        <div><label className={lbl}>Ends at</label><input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className={inp} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Role</label><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Barista" className={inp} /></div>
        <div>
          <label className={lbl}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ScheduledShiftStatus)} className={sel}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <div><label className={lbl}>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inp} /></div>

      {(error || del.error) && <p className="text-xs text-destructive">{((error ?? del.error) as Error).message}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => del.mutate()} disabled={del.isPending} className="h-10 px-3 border border-destructive/30 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-60 flex items-center gap-1.5">
          <Trash2 size={14} /> {del.isPending ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" onClick={onClose} className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors">Cancel</button>
        <button type="submit" disabled={isPending} className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">{isPending ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

type ModalState = { type: 'create' } | { type: 'edit'; shift: ScheduledShift };

export function TeamRota() {
  const { tenantId, locationId } = useWorkspaceStore();
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const close = () => setModal(null);

  const week = useMemo(() => {
    const monday = mondayOf(new Date());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toDateInput(monday), to: toDateInput(sunday) };
  }, []);
  const [from, setFrom] = useState(week.from);
  const [to, setTo] = useState(week.to);
  const fromISO = useMemo(() => new Date(`${from}T00:00:00`).toISOString(), [from]);
  const toISO = useMemo(() => new Date(`${to}T23:59:59`).toISOString(), [to]);

  const { data: staff = [] } = useQuery({ queryKey: ['staff', tenantId], queryFn: () => getStaff(tenantId ?? undefined), enabled: !!tenantId });
  const { data: locations = [] } = useQuery({ queryKey: ['locations', tenantId], queryFn: () => getLocationsByTenant(tenantId!), enabled: !!tenantId });
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['scheduled-shifts', locationId, fromISO, toISO],
    queryFn: () => getScheduledShifts({ locationId: locationId!, from: fromISO, to: toISO }),
    enabled: !!locationId,
  });

  // Planned-vs-actual, joined into each rota row by scheduledShiftId.
  const { data: variance = [] } = useQuery({
    queryKey: ['variance', locationId, fromISO, toISO],
    queryFn: () => getVariance({ locationId: locationId ?? undefined, from: fromISO, to: toISO }),
    enabled: !!locationId,
  });
  const varianceMap = useMemo(() => new Map(variance.map((v) => [v.scheduledShiftId, v])), [variance]);

  const publish = useMutation({
    mutationFn: () => publishScheduledShifts({ locationId: locationId!, from: fromISO, to: toISO }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-shifts'] }),
  });

  const dateInp = inp + ' w-auto';
  const th = 'px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest';

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      {locationId && (
        <div className="flex flex-wrap items-end gap-3 shrink-0">
          <div><label className={lbl}>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateInp} /></div>
          <div><label className={lbl}>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={dateInp} /></div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowCoverage((v) => !v)}
              className={
                'h-9 px-3 rounded-lg flex items-center gap-1.5 text-sm font-semibold transition-colors border ' +
                (showCoverage ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-foreground hover:bg-surface-offset')
              }
            >
              <BarChart3 size={15} /> Coverage
            </button>
            <button onClick={() => publish.mutate()} disabled={publish.isPending} className="h-9 px-3 border border-border rounded-lg flex items-center gap-1.5 text-sm font-semibold text-foreground hover:bg-surface-offset transition-colors disabled:opacity-60">
              <Send size={15} /> {publish.isPending ? 'Publishing…' : 'Publish drafts'}
            </button>
            <button onClick={() => setModal({ type: 'create' })} className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
              <Plus size={15} /> New Shift
            </button>
          </div>
        </div>
      )}

      {showCoverage && locationId && <CoveragePanel />}

      {publish.data && <p className="text-xs text-success shrink-0">Published {publish.data.published} draft shift(s).</p>}

      <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted">
                <th className={th}>Staff</th>
                <th className={th}>Role</th>
                <th className={th}>Planned</th>
                <th className={th}>Actual</th>
                <th className="px-5 py-3.5 pr-6 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {!locationId ? (
                <tr><td colSpan={5} className="py-24"><EmptyState icon={MapPin} title="Select a location" description="Choose a location to view its rota." /></td></tr>
              ) : isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + ((i * 11 + j * 19) % 35)}%` }} /></td>
                    ))}
                  </tr>
                ))
              ) : shifts.length === 0 ? (
                <tr><td colSpan={5} className="py-24"><EmptyState icon={CalendarClock} title="No shifts scheduled" description='Click "New Shift" to add one for this range.' /></td></tr>
              ) : (
                shifts.map((shift) => {
                  const v = varianceMap.get(shift.id);
                  const late = v?.startDeltaMinutes;
                  return (
                    <tr key={shift.id} onClick={() => setModal({ type: 'edit', shift })} className="group border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer">
                      <td className="px-5 py-3.5"><span className={'text-sm font-semibold ' + (shift.userId ? 'text-foreground' : 'text-muted-foreground italic')}>{staffName(shift, staff)}</span></td>
                      <td className="px-5 py-3.5"><span className="text-xs text-muted-foreground">{shift.role ?? '—'}</span></td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-foreground">{fmtTime(shift.startsAt)}–{fmtTime(shift.endsAt)}</span>
                        <span className="text-xs text-muted-foreground ml-2">{fmtDate(shift.startsAt)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {v ? (
                          <div className="flex items-center gap-2">
                            <Badge variant={ATTENDANCE[v.status].variant}>{ATTENDANCE[v.status].label}</Badge>
                            {v.status !== 'no_show' && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {fmtMinutes(v.workedMinutes)}
                                {late != null && late !== 0 && (
                                  <span className={late > 0 ? 'text-destructive ml-1' : 'text-success ml-1'}>{late > 0 ? `+${late}` : late}m</span>
                                )}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 pr-6 text-right"><Badge variant={STATUS_VARIANT[shift.status]} className="capitalize">{shift.status}</Badge></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {shifts.length > 0 && (
          <div className="px-5 py-3 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {shifts.length} {shifts.length === 1 ? 'shift' : 'shifts'} · {shifts.filter((s) => s.status === 'published').length} published · {shifts.filter((s) => s.status === 'draft').length} draft
              {variance.length > 0 && (
                <> · {variance.filter((v) => v.status === 'worked').length} worked · {variance.filter((v) => v.status === 'no_show').length} no-show</>
              )}
            </p>
          </div>
        )}
      </div>

      {modal?.type === 'create' && tenantId && locationId && (
        <Modal title="New Shift" onClose={close}><CreateShiftModal defaultLocationId={locationId} locations={locations} staff={staff} onClose={close} /></Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Shift" onClose={close}><EditShiftModal shift={modal.shift} staff={staff} onClose={close} /></Modal>
      )}
    </div>
  );
}
