'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Plus, Users } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';

import {
  type CreateStaffPayload,
  type StaffProfile,
  type StaffRole,
  type StaffScope,
  type UpdateStaffPayload,
  createStaff,
  getStaff,
  updateStaff,
} from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Role / scope config ───────────────────────────────────────────────────────

const ROLE_CONFIG: Record<StaffRole, { label: string; bg: string; text: string; border: string }> = {
  super_admin: { label: 'Super Admin', bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
  franchise_owner: { label: 'Franchise Owner', bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  store_manager: { label: 'Store Manager', bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  barista: { label: 'Barista', bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  hr_manager: { label: 'HR Manager', bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/30' },
  marketing_manager: { label: 'Marketing Manager', bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30' },
  auditor: { label: 'Auditor', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
};

const ROLES: StaffRole[] = ['super_admin', 'franchise_owner', 'store_manager', 'barista', 'hr_manager', 'marketing_manager', 'auditor'];
const SCOPES: StaffScope[] = ['global', 'franchise', 'location'];

// ── Shared form styles ────────────────────────────────────────────────────────

const inp =
  'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
const sel = inp + ' cursor-pointer';
const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

// ── Initials avatar ───────────────────────────────────────────────────────────

function Avatar({ name }: { name?: string }) {
  const parts = (name ?? '?').trim().split(' ');
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
  return (
    <div className="w-9 h-9 rounded-full bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white text-xs font-bold shrink-0 select-none uppercase">
      {initials}
    </div>
  );
}

// ── Create staff modal ────────────────────────────────────────────────────────

function CreateStaffModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<StaffRole>('barista');
  const [scope, setScope] = useState<StaffScope>('location');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createStaff({ name, email, password, tenantId, role, scope }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className={lbl}>Full name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Jane Smith"
          className={inp}
          autoFocus
        />
      </div>
      <div>
        <label className={lbl}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="jane@example.com"
          className={inp}
        />
      </div>
      <div>
        <label className={lbl}>Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min 8 characters"
            className={inp + ' pr-10'}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={sel}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_CONFIG[r].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as StaffScope)} className={sel}>
            {SCOPES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}

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
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ── Edit staff modal ──────────────────────────────────────────────────────────

function EditStaffModal({
  member,
  locations,
  onClose,
}: {
  member: StaffProfile;
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [role, setRole] = useState<StaffRole>(member.role);
  const [scope, setScope] = useState<StaffScope>(member.scope);
  const [isActive, setIsActive] = useState(member.isActive);
  const [selectedLocs, setSelectedLocs] = useState<string[]>(member.locationIds ?? []);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload: UpdateStaffPayload = { role, scope, isActive };
      if (scope === 'location') payload.locationIds = selectedLocs;
      return updateStaff(member.userId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
  });

  const toggleLoc = (id: string) => setSelectedLocs((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      {/* Staff identity (read-only) */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/40 border border-border rounded-xl">
        <Avatar name={member.name} />
        <div>
          <p className="text-sm font-semibold text-foreground">{member.name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{member.email ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={sel}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_CONFIG[r].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as StaffScope)} className={sel}>
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {scope === 'location' && locations.length > 0 && (
        <div>
          <label className={lbl}>Assigned locations</label>
          <div className="flex flex-col gap-1.5 mt-1">
            {locations.map((loc) => (
              <label
                key={loc.id}
                className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-lg hover:bg-muted transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedLocs.includes(loc.id)}
                  onChange={() => toggleLoc(loc.id)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-sm text-foreground">{loc.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm text-foreground">Active</span>
      </label>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}

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
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

// ── Staff row ─────────────────────────────────────────────────────────────────

function StaffRow({
  member,
  locations,
  onEdit,
}: {
  member: StaffProfile;
  locations: { id: string; name: string }[];
  onEdit: (m: StaffProfile) => void;
}) {
  const rc = ROLE_CONFIG[member.role];
  const assignedNames = (member.locationIds ?? []).map((id) => locations.find((l) => l.id === id)?.name).filter(Boolean);

  return (
    <tr
      className="group border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
      onClick={() => onEdit(member)}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={member.name} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{member.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground truncate">{member.email ?? '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide',
            rc.bg,
            rc.text,
            rc.border,
          )}
        >
          {rc.label}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-xs text-muted-foreground capitalize">{member.scope}</span>
      </td>
      <td className="px-5 py-3.5">
        {assignedNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {assignedNames.map((n) => (
              <span key={n} className="text-[11px] bg-muted border border-border rounded-md px-2 py-px text-muted-foreground">
                {n}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide',
            member.isActive ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground border-border',
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', member.isActive ? 'bg-success' : 'bg-muted-foreground')} />
          {member.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-5 py-3.5 pr-6 text-right">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(member.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Modal = { type: 'create' } | { type: 'edit'; member: StaffProfile };

export default function StaffPage() {
  const { tenantId } = useWorkspaceStore();
  const [modal, setModal] = useState<Modal | null>(null);
  const close = () => setModal(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  return (
    <>
      <PageLayout
        eyebrow="Management"
        title="Staff"
        fullHeight
        headerBorder={false}
        headerSlot={
          tenantId ? (
            <button
              onClick={() => setModal({ type: 'create' })}
              className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} />
              New Staff
            </button>
          ) : undefined
        }
      >
        <div className="flex flex-col h-full gap-4">
          <div className="flex-1 min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Member</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Scope</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Locations
                    </th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3.5 pr-6 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-5 py-4">
                            <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + ((i * 11 + j * 19) % 35)}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : !tenantId ? (
                    <tr>
                      <td colSpan={6} className="py-24">
                        <EmptyState icon={Users} title="No workspace selected" description="Select a workspace to view staff." />
                      </td>
                    </tr>
                  ) : staff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-24">
                        <EmptyState icon={Users} title="No staff members" description='Click "New Staff" to add your first team member.' />
                      </td>
                    </tr>
                  ) : (
                    staff.map((member) => (
                      <StaffRow
                        key={member.userId}
                        member={member}
                        locations={locations}
                        onEdit={(m) => setModal({ type: 'edit', member: m })}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {staff.length > 0 && (
              <div className="px-5 py-3 border-t border-border shrink-0">
                <p className="text-xs text-muted-foreground">
                  {staff.length} {staff.length === 1 ? 'member' : 'members'} · {staff.filter((s) => s.isActive).length} active
                </p>
              </div>
            )}
          </div>
        </div>
      </PageLayout>

      {modal?.type === 'create' && tenantId && (
        <Modal title="New Staff Member" onClose={close}>
          <CreateStaffModal tenantId={tenantId} onClose={close} />
        </Modal>
      )}

      {modal?.type === 'edit' && (
        <Modal title="Edit Staff Member" onClose={close}>
          <EditStaffModal member={modal.member} locations={locations} onClose={close} />
        </Modal>
      )}
    </>
  );
}
