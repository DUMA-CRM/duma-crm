import { AccountHome } from '@/components/settings/AccountHome';

/**
 * The settings entry point (the sidebar's Settings link). On a wide screen it is
 * the Account page; on a phone the shell lists the areas instead.
 */
export default function SettingsPage() {
  return <AccountHome />;
}
