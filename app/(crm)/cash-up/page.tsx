import { redirect } from 'next/navigation'; import { CashUpPage } from '@/components/reports/CashUpPage'; import { getCurrentStaffProfile } from '@/lib/auth/current-staff'; import { hasCapability } from '@/lib/auth/capabilities';
export default async function Page(){const p=await getCurrentStaffProfile();if(!p||!hasCapability(p,'cashups:read'))redirect('/dashboard');return <CashUpPage/>}
