'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  Cake,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
  Pencil,
  Receipt,
  ShieldCheck,
  Smartphone,
  Store,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { HrEmployee } from '@/lib/api/hr.service';
import { type StaffPerfWindowKey, type StaffProfile, getStaffPerformance } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';

import { Avatar, EMPLOYMENT_CONFIG, ROLE_CONFIG, fmtDate } from './shared';

const WIDTH = 'w-100 max-w-full';

export function PersonSidebar({
  member,
  employee,
  locations,
  onClose,
  onEditAccess,
  onEnroll,
  onEditEmployment,
}: {
  member: StaffProfile | null;
  employee?: HrEmployee;
  locations: { id: string; name: string }[];
  onClose: () => void;
  onEditAccess: (m: StaffProfile) => void;
  onEnroll: (m: StaffProfile) => void;
  onEditEmployment: (emp: HrEmployee) => void;
}) {
  if (!member) {
    return (
      <div className={cn(WIDTH, 'shrink-0 border-l border-border bg-card flex items-center justify-center px-6')}>
        <EmptyState icon={Users} title="Select a person" description="Pick someone to view their role, access and employment details." />
      </div>
    );
  }

  const rc = ROLE_CONFIG[member.role];
  const assignedNames = (member.locationIds ?? []).map((id) => locations.find((l) => l.id === id)?.name).filter(Boolean) as string[];

  return (
    <div className={cn(WIDTH, 'shrink-0 border-l border-border bg-card flex flex-col overflow-hidden')}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={member.name} size="lg" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground leading-snug truncate">{member.name ?? '—'}</p>
              <p className="text-xs text-muted-foreground truncate">{member.email ?? '—'}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide',
                    rc.bg,
                    rc.text,
                    rc.border,
                  )}
                >
                  {rc.label}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-medium',
                    member.isActive ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', member.isActive ? 'bg-success' : 'bg-muted-foreground')} />
                  {member.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X size={14} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-5 space-y-6">
          {/* Access & role */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Access &amp; role</p>
              <button
                onClick={() => onEditAccess(member)}
                className="flex items-center gap-1 px-1.5 py-1.5 -my-1.5 -mr-1.5 rounded-md text-[11px] font-medium text-primary hover:text-primary-hover transition-colors"
              >
                <Pencil size={11} /> Edit
              </button>
            </div>
            <InfoGroup>
              <InfoRow icon={ShieldCheck} label="Role" value={rc.label} />
              <InfoRow icon={Globe} label="Scope" value={member.scope.charAt(0).toUpperCase() + member.scope.slice(1)} />
              <InfoRow icon={Activity} label="Status" value={member.isActive ? 'Active' : 'Inactive'} />
              <InfoRow icon={MapPin} label="Locations" value={assignedNames.length > 0 ? assignedNames.join(', ') : '—'} />
            </InfoGroup>
          </section>

          {/* Employment */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Employment</p>
              {employee && (
                <button
                  onClick={() => onEditEmployment(employee)}
                  className="flex items-center gap-1 px-1.5 py-1.5 -my-1.5 -mr-1.5 rounded-md text-[11px] font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  <Pencil size={11} /> Edit
                </button>
              )}
            </div>
            {employee ? (
              <InfoGroup>
                <InfoRow icon={BriefcaseBusiness} label="Job title" value={employee.jobTitle} />
                <InfoRow icon={Building2} label="Department" value={employee.department ?? '—'} />
                <InfoRow icon={Clock} label="Employment type" value={EMPLOYMENT_CONFIG[employee.employmentType].label} />
                <InfoRow icon={CalendarDays} label="Start date" value={fmtDate(employee.startDate)} />
                <InfoRow icon={Cake} label="Date of birth" value={employee.dateOfBirth ? fmtDate(employee.dateOfBirth) : '—'} />
              </InfoGroup>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-5 text-center">
                <BriefcaseBusiness size={20} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground mb-3">Not enrolled as an employee — no employment record yet.</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEnroll(member)}>
                  <UserPlus size={13} /> Enroll as employee
                </Button>
              </div>
            )}
          </section>

          {/* Performance */}
          <PerformanceSection userId={member.userId} />
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Performance ────────────────────────────────────────────────────────────────

const WINDOW_TABS: { key: StaffPerfWindowKey; label: string }[] = [
  { key: 'last7Days', label: '7d' },
  { key: 'last30Days', label: '30d' },
  { key: 'allTime', label: 'All' },
];

const fmtMoney = (v: string) => `£${Number(v).toFixed(2)}`;
const fmtMins = (measured: number, mins: number) => (measured === 0 ? '—' : mins < 1 ? `${Math.round(mins * 60)}s` : `${mins} min`);

function StatTile({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className="text-muted-foreground" aria-hidden="true" />
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-lg font-semibold text-foreground leading-none tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function PerformanceSection({ userId }: { userId: string }) {
  const [tab, setTab] = useState<StaffPerfWindowKey>('last30Days');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['staff-performance', userId],
    queryFn: () => getStaffPerformance(userId),
  });

  const w = data?.windows[tab];

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Performance</p>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
          {WINDOW_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors',
                tab === t.key ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl border border-border bg-background animate-pulse" />
          ))}
        </div>
      ) : isError || !w ? (
        <div className="rounded-xl border border-dashed border-border p-5 text-center">
          <TrendingUp size={20} className="mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Couldn&apos;t load performance stats.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              icon={Receipt}
              label="Orders"
              value={String(w.totalOrders)}
              hint={`${w.activeDays} active ${w.activeDays === 1 ? 'day' : 'days'}`}
            />
            <StatTile icon={TrendingUp} label="Revenue" value={fmtMoney(w.totalRevenue)} hint="excl. cancelled" />
            <StatTile icon={Store} label="Avg order" value={fmtMoney(w.avgOrderValue)} />
            <StatTile icon={CalendarDays} label="Orders / day" value={String(w.avgOrdersPerActiveDay)} hint="per active day" />
          </div>
          <InfoGroup>
            <InfoRow icon={Timer} label="Avg prep (pending → ready)" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.avgMinutes)} />
            <InfoRow icon={Clock} label="Median prep" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.medianMinutes)} />
            <InfoRow icon={CheckCircle2} label="Completed" value={String(w.completedOrders)} />
            <InfoRow icon={XCircle} label="Cancelled" value={`${w.cancelledOrders} (${Math.round(w.cancellationRate * 100)}%)`} />
            <InfoRow icon={Store} label="POS orders" value={String(w.bySource.pos)} />
            <InfoRow icon={Smartphone} label="Mobile orders" value={String(w.bySource.mobile)} />
          </InfoGroup>
          {w.prepTime.measuredOrders === 0 && (
            <p className="text-[11px] text-muted-foreground px-1">
              No orders reached “ready” in this window, so prep time can’t be measured.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
