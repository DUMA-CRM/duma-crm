import { requireAnyCapability } from '@/lib/auth/require-capability';

// One home for every public API: keys that record orders are a settings
// decision (`settings:write`), content keys and webhooks a Content one
// (`cms.keys:write`). Either opens the page; the API checks each action.
export default async function SettingsDevelopersLayout({ children }: { children: React.ReactNode }) {
  await requireAnyCapability('settings:write', 'cms.keys:write');
  return children;
}
