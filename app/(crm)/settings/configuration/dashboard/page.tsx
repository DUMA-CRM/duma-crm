import { redirect } from 'next/navigation';

export default function DashboardConfigurationPage() {
  redirect('/dashboard?edit=1');
}
