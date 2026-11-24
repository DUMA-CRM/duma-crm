import { permanentRedirect } from 'next/navigation';

/** Installed apps are the Apps page's Installed tab; old links land there. */
export default function InstalledAppsPage() {
  permanentRedirect('/apps?tab=installed');
}
