'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { EmployeeRecordPage } from './EmployeeRecordPage';
import { getStaffMember } from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';

export function EmployeeRecordRoute() {
  const router = useRouter();
  const userId = String(useParams<{ userId: string }>().userId);
  const { data: member } = useQuery({ queryKey: ['staff-member', userId], queryFn: () => getStaffMember(userId) });
  const { data: locations = [] } = useQuery({ queryKey: ['locations', member?.tenantId], queryFn: () => getLocationsByTenant(member!.tenantId), enabled: !!member?.tenantId });
  return <EmployeeRecordPage userId={userId} member={member ?? null} locations={locations} onClose={() => router.push('/staff')} />;
}
