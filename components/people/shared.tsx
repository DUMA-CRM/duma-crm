import { CalendarDays, HeartPulse, type IconComponent, Sun } from '@/components/icons';

import { type StaffRole, type StaffScope } from '@/lib/modules/identity/client';
import type { EmploymentType, PayType } from '@/lib/modules/people/client';
import { formatDate } from '@/lib/utils/date';
import { type LeaveKind, leaveKind } from '@/lib/utils/my-hr';

// ── Role / scope config ───────────────────────────────────────────────────────

type RoleAppearance = { label: string; bg: string; text: string; border: string };

export const ROLE_CONFIG: Record<string, RoleAppearance> = {
  super_admin: { label: 'Super Admin', bg: 'bg-destructive/6', text: 'text-destructive', border: 'border-destructive/30' },
  franchise_owner: { label: 'Franchise Owner', bg: 'bg-warning/6', text: 'text-warning', border: 'border-warning/30' },
  store_manager: { label: 'Store Manager', bg: 'bg-band', text: 'text-primary', border: 'border-primary/30' },
  barista: { label: 'Barista', bg: 'bg-success/6', text: 'text-success', border: 'border-success/30' },
  // Periwinkle and apricot rather than raw Tailwind violet-500/orange-500, which
  // were the last two hues in the app from outside the token layer.
  hr_manager: { label: 'HR Manager', bg: 'bg-reference/10', text: 'text-reference', border: 'border-reference/30' },
  marketing_manager: { label: 'Marketing Manager', bg: 'bg-measured/10', text: 'text-measured', border: 'border-measured/30' },
  auditor: { label: 'Auditor', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-rule' },
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
export function roleConfig(role: StaffRole, label?: string): RoleAppearance {
  return (
    ROLE_CONFIG[role] ?? {
      label: label ?? role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
      bg: 'bg-muted',
      text: 'text-foreground',
      border: 'border-rule',
    }
  );
}
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

// The last role allow-lists in the people components — `MONEY_ROLES`,
// `canSeeMoney` and `canManageTeam` — were deleted on 2026-09-10 once every
// caller read the capability list instead. They existed only because the old
// rank table could not express "hr_manager but not store_manager", which is
// the problem capabilities solve, and each one silently excluded `auditor`.
//
// The replacements: pay, bank and statutory data -> `hr.sensitive:read`;
// onboarding -> `staff:onboard`; reaching a record -> `staff:read` /
// `hr.people:read`. See lib/auth/capabilities.ts and UI-ADR-002.

export const fmtMoney = (v: string | number | null | undefined): string => {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
};
export const fmtHours = (h: number): string => `${Math.round(h * 100) / 100}h`;

// ── Shared form styles ────────────────────────────────────────────────────────

export const inp =
  'w-full h-9 bg-control border border-input rounded-sm px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
export const sel = inp + ' cursor-pointer';
export const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

// ── Helpers ─────────────────────────────────────────────────────────────────

export const fmtDate = (x: string) => formatDate(x);
export const toDateInput = (x?: string) => (x ? new Date(x).toISOString().slice(0, 10) : '');

// ── Avatar ────────────────────────────────────────────────────────────────────

/** Moved to `components/shared/Avatar` so every screen draws people the same way. */
export { Avatar } from '@/components/shared/Avatar';

// ── Leave type glyph ──────────────────────────────────────────────────────────

const LEAVE_ICON: Record<LeaveKind, IconComponent> = { annual: Sun, sick: HeartPulse, other: CalendarDays };

/** The glyph a leave row leads with: a sun for holiday, a pulse for sickness, a calendar for the rest. */
export const leaveIcon = (name: string | null | undefined): IconComponent => LEAVE_ICON[leaveKind(name)];

/** `leaveIcon` as an element, for inline use where a component can't be picked during render. */
export function LeaveTypeIcon({ name, size = 14, className }: { name: string | null | undefined; size?: number; className?: string }) {
  const kind = leaveKind(name);
  const props = { size, className, 'aria-hidden': true as const };
  return kind === 'annual' ? <Sun {...props} /> : kind === 'sick' ? <HeartPulse {...props} /> : <CalendarDays {...props} />;
}
