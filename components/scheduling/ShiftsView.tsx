'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';

import { type Shift, getActiveShifts, getShifts } from '@/lib/api/shifts.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

function shiftStaffName(shift: Shift): string {
  return shift.staff?.user?.name ?? shift.staff?.name ?? 'Unknown';
}
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
function fmtMinutes(mins: number): string {
  return `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`;
}
const elapsedMinutes = (from: string, now: number) => Math.max(0, Math.floor((now - new Date(from).getTime()) / 60000));

export function ShiftsView() {
  const { locationId } = useWorkspaceStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: active = [], isLoading: activeLoading } = useQuery({ queryKey: ['shifts-active'], queryFn: getActiveShifts });
  const { data: recent = [], isLoading: recentLoading } = useQuery({
    queryKey: ['shifts', locationId],
    queryFn: () => getShifts({ locationId: locationId ?? undefined }),
  });

  const th = 'px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest';
  // Location is secondary context — hide it (and Out) on phones so times stay readable.
  const hideSm = ' hidden md:table-cell';

  return (
    <div className="flex flex-col h-full gap-4 overflow-auto pb-4">
      {/* Active now */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shrink-0">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <Radio size={14} className="text-success" />
          <p className="text-sm font-semibold text-foreground">Active now</p>
          <span className="text-xs text-muted-foreground">({active.length})</span>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className={th}>Staff</th>
              <th className={th + hideSm}>Location</th>
              <th className={th}>Clocked in</th>
              <th className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Elapsed
              </th>
            </tr>
          </thead>
          <tbody>
            {activeLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className={'px-3 md:px-5 py-4' + (j === 1 ? hideSm : '')}>
                      <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + ((i * 11 + j * 19) % 30)}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : active.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12">
                  <EmptyState icon={Clock} title="Nobody clocked in" description="Active shifts will appear here." />
                </td>
              </tr>
            ) : (
              active.map((s) => (
                <tr key={s.id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 md:px-5 py-3.5 text-sm font-semibold text-foreground">{shiftStaffName(s)}</td>
                  <td className={'px-5 py-3.5 text-xs text-muted-foreground' + hideSm}>{s.location?.name ?? '—'}</td>
                  <td className="px-3 md:px-5 py-3.5 text-sm text-foreground">
                    {fmtTime(s.clockedIn)}
                    <span className="text-xs text-muted-foreground ml-2">{fmtDate(s.clockedIn)}</span>
                  </td>
                  <td className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 text-right tabular-nums text-sm text-success font-semibold">
                    {fmtMinutes(elapsedMinutes(s.clockedIn, now))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent shifts */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shrink-0">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <Clock size={14} className="text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Recent shifts</p>
          {!locationId && <span className="text-xs text-muted-foreground">· all locations</span>}
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className={th}>Staff</th>
              <th className={th + hideSm}>Location</th>
              <th className={th}>In</th>
              <th className={th + hideSm}>Out</th>
              <th className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {recentLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className={'px-3 md:px-5 py-4' + (j === 1 || j === 3 ? hideSm : '')}>
                      <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 13 + j * 17) % 35)}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12">
                  <EmptyState icon={MapPin} title="No shifts" description="Clocked-out shifts will appear here." />
                </td>
              </tr>
            ) : (
              recent.map((s) => (
                <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors">
                  <td className="px-3 md:px-5 py-3.5 text-sm font-semibold text-foreground">{shiftStaffName(s)}</td>
                  <td className={'px-5 py-3.5 text-xs text-muted-foreground' + hideSm}>{s.location?.name ?? '—'}</td>
                  <td className="px-3 md:px-5 py-3.5 text-sm text-foreground">
                    {fmtTime(s.clockedIn)}
                    <span className="text-xs text-muted-foreground ml-2">{fmtDate(s.clockedIn)}</span>
                  </td>
                  <td className={'px-5 py-3.5 text-sm text-foreground' + hideSm}>
                    {s.clockedOut ? fmtTime(s.clockedOut) : <span className="text-success font-semibold">Active</span>}
                  </td>
                  <td className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 text-right tabular-nums text-sm text-foreground">
                    {s.durationMinutes != null ? fmtMinutes(s.durationMinutes) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
