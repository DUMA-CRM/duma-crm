import { Suspense } from 'react';

import { SettingsShell } from '@/components/settings/SettingsShell';

// One shell for every settings tab, so the tab strip persists across routes.
// Suspense because the shell reads ?connector= to step aside for a connector's
// own full-screen pages.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <SettingsShell>{children}</SettingsShell>
    </Suspense>
  );
}
