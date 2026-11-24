import { permanentRedirect } from 'next/navigation';

/** Profile is a section of Settings → Account; old links land on it. */
export default function SettingsProfilePage() {
  permanentRedirect('/settings/account#profile');
}
