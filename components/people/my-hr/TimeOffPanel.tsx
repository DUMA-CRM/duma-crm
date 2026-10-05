'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { Ban, CalendarDays, History, Sun } from '@/components/icons';
import { RecordBlock, RecordList, RecordListRow } from '@/components/people/record/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Button } from '@/components/ui/button';

import { type LeaveEntitlement, type LeaveRequest, cancelLeaveRequest } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { splitLeaveRequests } from '@/lib/utils/my-hr';
import { toast } from '@/stores/toastStore';

import { fmt } from './shared';

const STATUS_PILL = {
  approved: { label: 'Approved', tone: 'success' },
  pending: { label: 'Awaiting approval', tone: 'warning' },
  declined: { label: 'Declined', tone: 'exception' },
} as const;

const days = (value: string | number) => {
  const n = Number(value);
  return `${n} ${n === 1 ? 'day' : 'days'}`;
};

/**
 * Your time off, laid out as BambooHR and most HR tools do it: what is coming
 * up (or still waiting for an answer) first, then what has been, with your
 * balances beside them. Requesting lives in the page header, once.
 *
 * No heading repeats the tab's name.
 */
export function TimeOffPanel({ requests, entitlements }: { requests: LeaveRequest[]; entitlements: LeaveEntitlement[] }) {
  const qc = useQueryClient();
  const [today] = useState(() => {
    const at = new Date();
    return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  });
  const cancel = useMutation({
    mutationFn: cancelLeaveRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('leave-requests-me') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('leave-entitlements-me') });
      toast('success', 'Leave request cancelled.');
    },
    onError: (e) => toast('error', (e as Error).message),
  });

  const { upcoming, history } = splitLeaveRequests(requests, today);

  const row = (request: LeaveRequest, past: boolean) => {
    const pill = request.status === 'cancelled' ? undefined : STATUS_PILL[request.status];
    const single = request.startDate.slice(0, 10) === request.endDate.slice(0, 10);
    return (
      <RecordListRow
        key={request.id}
        icon={request.status === 'declined' || request.status === 'cancelled' ? Ban : past ? History : Sun}
        tone={past || request.status === 'cancelled' ? 'muted' : 'reference'}
        value={single ? fmt(request.startDate) : `${fmt(request.startDate)} – ${fmt(request.endDate)}`}
        label={`${request.leaveType.name} · ${days(request.totalDays)}`}
        detail={request.status === 'cancelled' ? 'Cancelled' : request.reviewNotes ? `HR: ${request.reviewNotes}` : undefined}
        // Settled history says nothing extra for "approved" — it happened.
        pill={pill && !(past && request.status === 'approved') ? pill : undefined}
        trailing={
          request.status === 'pending' ? (
            <Button variant="ghost" size="sm" onClick={() => cancel.mutate(request.id)} disabled={cancel.isPending}>
              Cancel
            </Button>
          ) : undefined
        }
      />
    );
  };

  return (
    <motion.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      <SettingsTabBody narrowAside aside={<Balances entitlements={entitlements} />}>
        <RecordBlock id="time-off-upcoming" title="Upcoming">
          <RecordList>
            {upcoming.length > 0 ? (
              upcoming.map((request) => row(request, false))
            ) : (
              <RecordListRow icon={CalendarDays} tone="muted" label="Book time away with Request time off" placeholder="Nothing booked" />
            )}
          </RecordList>
        </RecordBlock>

        {history.length > 0 && (
          <RecordBlock id="time-off-history" title="History" note="Kept for your record. Ask HR if anything here looks wrong.">
            <RecordList>{history.map((request) => row(request, true))}</RecordList>
          </RecordBlock>
        )}
      </SettingsTabBody>
    </motion.div>
  );
}

/** Each allowance with how much is left — the figure you check before you ask. */
function Balances({ entitlements }: { entitlements: LeaveEntitlement[] }) {
  // No panel around it: the balances are cards already, and a second border
  // would only box them in. The year rides on the heading's row.
  return (
    <motion.section variants={SECTION_RISE} aria-labelledby="time-off-balances-title" className="scroll-mt-6">
      <div className="mb-3 flex min-h-8 items-center gap-3">
        <h2 id="time-off-balances-title" className="flex-1 text-base font-semibold tracking-title text-foreground">
          Balances
        </h2>
        {entitlements[0] && <span className="text-xs tabular-nums text-muted-foreground">Leave year {entitlements[0].year}</span>}
      </div>
      {entitlements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
          No allowance has been set for you yet. Ask HR to add one.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {entitlements.map((item) => {
            const total = Number(item.totalDays);
            const used = Number(item.usedDays);
            const remaining = Math.round((total - used) * 100) / 100;
            const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
            return (
              <li key={item.id} className="rounded-lg border border-rule/60 bg-card px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {item.leaveType.name}
                    {!item.leaveType.isPaid && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Unpaid</span>}
                  </p>
                  <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    <span className="text-base font-semibold text-foreground">{remaining}</span> of {total} left
                  </p>
                </div>
                {total > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-band" role="presentation">
                    <div
                      className={cn('h-full rounded-full', remaining <= 0 ? 'bg-exception' : 'bg-primary')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">{days(used)} used</p>
              </li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
