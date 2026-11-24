import { ProfileTab } from '@/components/settings/tabs/ProfileTab';
import { SecurityTab } from '@/components/settings/tabs/SecurityTab';

/** Settings → Account. `#profile` and `#security` are where /settings/profile and /settings/security land. */
export function AccountHome() {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div id="profile" className="min-w-0 scroll-mt-5"><ProfileTab /></div>
      <div id="security" className="min-w-0 scroll-mt-5"><SecurityTab /></div>
    </div>
  );
}
