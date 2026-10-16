'use client';

import { AccountHome } from '@/components/settings/AccountHome';
import { ConfigurationHome } from '@/components/settings/configuration/ConfigurationHome';
import { ConnectorsRoute } from '@/components/settings/connectors/ConnectorsRoute';
import { ApiReference } from '@/components/settings/developers/ApiReference';
import { DevelopersPanel } from '@/components/settings/developers/DevelopersPanel';
import { WorkspaceTab } from '@/components/settings/tabs/WorkspaceTab';
import { usePathname } from 'next/navigation';


import type { SETTINGS_AREAS } from './SettingsShell';

type SettingsAreaId = (typeof SETTINGS_AREAS)[number]['id'];

/** The area's existing settings panels, composed together as one continuous page. */
export function SettingsAreaContent({ area }: { area: SettingsAreaId }) {
  const pathname = usePathname();

  switch (area) {
    case 'account':
      return <AccountHome />;
    case 'workspace':
      return <WorkspaceTab />;
    case 'operations':
      return <ConfigurationHome />;
    case 'connections':
      return <ConnectorsRoute />;
    case 'developers':
      return pathname.startsWith('/settings/developers/docs') ? <ApiReference /> : <DevelopersPanel />;
  }
}
