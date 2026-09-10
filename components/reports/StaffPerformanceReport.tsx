'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Avatar } from '@/components/people/shared';
import { StaffPerformancePanel } from '@/components/reports/StaffPerformancePanel';
import { ArrowRight, TrendingUp } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';

import { getStaffMember } from '@/lib/api/staff.service';

/**
 * The page around the panel: who this is about, and the way back to their
 * record. The record is where someone acts on what they read here, so the
 * link out matters as much as the figures.
 */
export function StaffPerformanceReport({ userId }: { userId: string }) {
  const { data: member } = useQuery({ queryKey: ['staff-member', userId], queryFn: () => getStaffMember(userId) });
  const name = member?.name ?? member?.email ?? 'Staff member';

  return (
    <EditorShell
      eyebrow="Reports"
      title={name}
      leading={member ? <Avatar name={member.name} email={member.email} size="lg" /> : undefined}
      icon={member ? undefined : <TrendingUp size={20} aria-hidden="true" />}
      meta={<span className="text-xs text-muted-foreground">Operational performance</span>}
      actions={
        <Link
          href={`/staff/${userId}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-rule px-3 text-xs font-semibold transition-colors hover:bg-band"
        >
          Open the HR record <ArrowRight size={13} aria-hidden="true" />
        </Link>
      }
    >
      <StaffPerformancePanel userId={userId} />
    </EditorShell>
  );
}
