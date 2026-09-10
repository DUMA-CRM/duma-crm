'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { getStaffMember } from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { useAuthStore } from '@/stores/authStore';

import { hasAnyCapability } from '@/lib/auth/capabilities';

import { EmployeeRecordPage } from './EmployeeRecordPage';

export function EmployeeRecordRoute() {
  const router = useRouter();
  // Same capabilities as the workspace and its route guard. The role list this
  // replaced excluded `auditor`, who holds both and was bounced to the
  // dashboard from a record they are meant to be able to read.
  const capabilities = useAuthStore((state) => state.capabilities);
  const canManage = hasAnyCapability(capabilities, 'staff:read', 'hr.people:read');
  const userId = String(useParams<{ userId: string }>().userId);
  useEffect(() => {
    if (capabilities.length > 0 && !canManage) router.replace('/dashboard');
  }, [canManage, capabilities.length, router]);
  const { data: member } = useQuery({
    queryKey: ['staff-member', userId],
    queryFn: () => getStaffMember(userId),
    enabled: canManage,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', member?.tenantId],
    queryFn: () => getLocationsByTenant(member!.tenantId),
    enabled: !!member?.tenantId,
  });
  if (!canManage) return null;
  return <EmployeeRecordPage userId={userId} member={member ?? null} locations={locations} onClose={() => router.push('/staff/team')} />;
}
