import { redirect } from 'next/navigation'; import { CashUpPage } from '@/components/reports/CashUpPage'; import { getCurrentStaffProfile } from '@/lib/auth/current-staff'; import { roleAtLeast } from '@/lib/api/staff.service';
export default async function Page(){const p=await getCurrentStaffProfile();if(!p||!roleAtLeast(p.role,'store_manager'))redirect('/dashboard');return <CashUpPage/>}
