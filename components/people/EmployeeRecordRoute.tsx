'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { getStaffMember } from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { useAuthStore } from '@/stores/authStore';

import { EmployeeRecordPage } from './EmployeeRecordPage';
import { canManageTeam } from './shared';

export function EmployeeRecordRoute() {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const canManage = canManageTeam(role);
  const userId = String(useParams<{ userId: string }>().userId);
  useEffect(() => {
    if (role && !canManage) router.replace('/dashboard');
  }, [canManage, role, router]);
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
  return <EmployeeRecordPage userId={userId} member={member ?? null} locations={locations} onClose={() => router.push('/staff')} />;
}
