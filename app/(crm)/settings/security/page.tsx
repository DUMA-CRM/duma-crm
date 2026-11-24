import { permanentRedirect } from 'next/navigation';

/** Sign-in and sessions are a section of Settings → Account; old links (and the email-change confirmation) land on it. */
export default function SettingsSecurityPage() {
  permanentRedirect('/settings/account#security');
}
