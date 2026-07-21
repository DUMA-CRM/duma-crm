import { GravatarImage } from '@/components/shared/GravatarImage';
import type { EmploymentType, PayType } from '@/lib/api/hr.service';
import { type StaffRole, type StaffScope, roleAtLeast } from '@/lib/api/staff.service';

// ── Role / scope config ───────────────────────────────────────────────────────

export const ROLE_CONFIG: Record<StaffRole, { label: string; bg: string; text: string; border: string }> = {
  super_admin: { label: 'Super Admin', bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
  franchise_owner: { label: 'Franchise Owner', bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  store_manager: { label: 'Store Manager', bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  barista: { label: 'Barista', bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  hr_manager: { label: 'HR Manager', bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/30' },
  marketing_manager: { label: 'Marketing Manager', bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30' },
  auditor: { label: 'Auditor', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
};

export const ROLES: StaffRole[] = [
  'super_admin',
  'franchise_owner',
  'store_manager',
  'barista',
  'hr_manager',
  'marketing_manager',
  'auditor',
];
export const SCOPES: StaffScope[] = ['global', 'franchise', 'location'];

// ── Employment type config ────────────────────────────────────────────────────

export const EMPLOYMENT_TYPES: EmploymentType[] = ['full_time', 'part_time', 'contractor', 'zero_hours'];

export const EMPLOYMENT_CONFIG: Record<EmploymentType, { label: string; variant: 'primary' | 'success' | 'warning' | 'muted' }> = {
  full_time: { label: 'Full time', variant: 'success' },
  part_time: { label: 'Part time', variant: 'primary' },
  contractor: { label: 'Contractor', variant: 'warning' },
  zero_hours: { label: 'Zero hours', variant: 'muted' },
};

// ── Pay config ────────────────────────────────────────────────────────────────

export const PAY_TYPES: PayType[] = ['hourly', 'salaried'];
export const PAY_CONFIG: Record<PayType, { label: string; variant: 'primary' | 'success' }> = {
  hourly: { label: 'Hourly', variant: 'primary' },
  salaried: { label: 'Salaried', variant: 'success' },
};

// ── UK allergen-free helpers ──────────────────────────────────────────────────

// The "money" roles — the only ones allowed to see/edit pay, bank and statutory
// data, and to onboard. NOTE store_manager out-ranks hr_manager in the rank
// table, so roleAtLeast('hr_manager') is WRONG here — check membership.
export const MONEY_ROLES: StaffRole[] = ['super_admin', 'franchise_owner', 'hr_manager'];
export const canSeeMoney = (role: StaffRole | null | undefined): boolean => !!role && MONEY_ROLES.includes(role);
// Managing the team (view records, hours, onboard entry point) is store_manager+.
export const canManageTeam = (role: StaffRole | null | undefined): boolean => roleAtLeast(role, 'store_manager');

export const fmtMoney = (v: string | number | null | undefined): string => {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
};
export const fmtHours = (h: number): string => `${Math.round(h * 100) / 100}h`;

// ── Shared form styles ────────────────────────────────────────────────────────

export const inp =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
export const sel = inp + ' cursor-pointer';
export const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

// ── Helpers ─────────────────────────────────────────────────────────────────

export const fmtDate = (x: string) => new Date(x).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const toDateInput = (x?: string) => (x ? new Date(x).toISOString().slice(0, 10) : '');

// ── Initials avatar ───────────────────────────────────────────────────────────

export function Avatar({ name, email, size = 'md' }: { name?: string; email?: string | null; size?: 'md' | 'lg' }) {
  const parts = (name ?? '?').trim().split(' ');
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
  const dim = size === 'lg' ? 'w-12 h-12 text-sm' : 'w-9 h-9 text-xs';
  const px = size === 'lg' ? 96 : 72;

  const fallback = (
    <div
      className={`${dim} rounded-lg bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white font-bold shrink-0 select-none uppercase`}
    >
      {initials}
    </div>
  );

  if (!email) return fallback;
  return <GravatarImage email={email} px={px} className={`${dim} rounded-lg object-cover shrink-0 select-none`} alt={name ?? ''} fallback={fallback} />;
}
