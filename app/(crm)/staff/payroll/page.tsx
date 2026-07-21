'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { PayrollHistoryPanel } from '@/components/payroll/PayrollHistoryPanel';
import { RunPayrollPanel } from '@/components/payroll/RunPayrollPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

import { useAuthStore } from '@/stores/authStore';

type Tab = 'run' | 'history';

const TABS = [
  { value: 'run' as const, label: 'Run Payroll' },
  { value: 'history' as const, label: 'History' },
];

// Payroll is sensitive: only these roles, regardless of general management rank
// (store_manager outranks hr_manager but must NOT see payroll — so no roleAtLeast).
const PAYROLL_ROLES = ['super_admin', 'franchise_owner', 'hr_manager'];

export default function PayrollPage() {
  const role = useAuthStore((s) => s.role);
  const canPayroll = PAYROLL_ROLES.includes(role ?? '');
  const [tab, setTab] = useState<Tab>('run');

  if (!canPayroll) {
    return (
      <PageLayout eyebrow="Management" title="Payroll" fullHeight headerBorder={false}>
        <div className="py-24">
          <EmptyState icon={Lock} title="Not available" description="You don't have access to payroll." />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      eyebrow="Management"
      title="Payroll"
      fullHeight
      headerBorder={false}
      headerSlot={<SegmentedControl options={TABS} value={tab} onChange={setTab} />}
    >
      {tab === 'run' ? <RunPayrollPanel onFinalised={() => setTab('history')} /> : <PayrollHistoryPanel />}
    </PageLayout>
  );
}
