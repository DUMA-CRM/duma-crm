import { ProfileTab } from '@/components/settings/tabs/ProfileTab';
import { SecurityTab } from '@/components/settings/tabs/SecurityTab';

export function AccountHome() {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div className="min-w-0"><ProfileTab /></div>
      <div className="min-w-0"><SecurityTab /></div>
    </div>
  );
}
