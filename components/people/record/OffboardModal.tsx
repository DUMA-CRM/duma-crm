'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Banknote, CalendarCheck, CalendarDays, Clock, type IconComponent, Loader2, Package, UserMinus } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { getEmployeeEntitlements } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { leaveBalance } from '@/lib/utils/my-hr';

/**
 * Offboarding, confirmed. What happens is said first and plainly — the login
 * stops, the record stays — and what still has to be done by hand follows as a
 * checklist in the record's row style, with the one figure the app knows
 * (holiday left) filled in. Country-neutral: "final pay and leaver paperwork"
 * is a P45 in the UK and something else everywhere else.
 */
export function OffboardModal({
  userId,
  name,
  isPending,
  onConfirm,
  onClose,
}: {
  userId: string;
  name: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  // Same key and year as the record's holiday tile, so it is usually cached.
  const [year] = useState(() => new Date().getFullYear());
  const entitlements = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-entitlements', userId, year),
    queryFn: () => getEmployeeEntitlements(userId, year),
  });
  const leave = leaveBalance(entitlements.data ?? []);
  const holiday = entitlements.isPending
    ? 'Checking their allowance…'
    : leave.hasEntitlement
      ? `${leave.remaining} ${leave.remaining === 1 ? 'day' : 'days'} left this year — pay them or agree they’re taken.`
      : 'No allowance is recorded, so check what they’re owed.';

  return (
    <Modal
      title={`Offboard ${name}?`}
      description="They won’t be able to sign in. Their record, hours and documents are kept, and you can reactivate them later."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserMinus aria-hidden="true" />}
            {isPending ? 'Offboarding…' : 'Offboard'}
          </Button>
        </div>
      }
    >
      <p className="mb-2 text-label uppercase text-muted-foreground">Before you confirm</p>
      <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <Step icon={CalendarCheck} title="Record the last working day and why" detail="Add it to their documents so the reason is on file." />
        <Step icon={Clock} title="Approve their final hours" detail="Anything unapproved won’t reach their last pay." />
        <Step icon={CalendarDays} title="Settle unused holiday" detail={holiday} />
        <Step icon={Banknote} title="Run their final pay and leaver paperwork" detail="In payroll, as your country requires." />
        <Step icon={Package} title="Collect keys, uniform and equipment" detail="And decide when their access should end, if not now." />
      </ul>
    </Modal>
  );
}

function Step({ icon: Icon, title, detail }: { icon: IconComponent; title: string; detail: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-measured/8 text-measured">
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}
