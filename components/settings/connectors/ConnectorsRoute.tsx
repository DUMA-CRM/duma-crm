'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { SettingsWorkspace } from '@/components/settings/SettingsWorkspace';

import { EmailConnectWizard, EmailConnectorPage } from './EmailConnector';
import { PaymentsConnectWizard, PaymentsConnectorPage } from './PaymentsConnector';
import type { ConnectorId } from './registry';

const LIST = '/settings/connectors';

/**
 * Connectors is URL-driven: `?connector=email` opens its manage page and
 * `&mode=connect` opens the step-by-step setup. Both replace the settings shell
 * rather than nesting inside it, so the back button closes them, links are
 * shareable, and a refresh keeps you where you were.
 */
export function ConnectorsRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connector = searchParams.get('connector') as ConnectorId | null;
  const connecting = searchParams.get('mode') === 'connect';

  const toList = () => router.push(LIST);
  const toManage = (id: ConnectorId) => router.replace(`${LIST}?connector=${id}`);
  const toConnect = (id: ConnectorId) => router.push(`${LIST}?connector=${id}&mode=connect`);

  if (connector === 'email') {
    return connecting ? (
      <EmailConnectWizard onClose={toList} onDone={() => toManage('email')} />
    ) : (
      <EmailConnectorPage onClose={toList} onReconnect={() => toConnect('email')} />
    );
  }

  if (connector === 'card-payments') {
    return connecting ? (
      <PaymentsConnectWizard onClose={toList} onDone={() => toManage('card-payments')} />
    ) : (
      <PaymentsConnectorPage onClose={toList} onAdd={() => toConnect('card-payments')} />
    );
  }

  return <SettingsWorkspace tab="connectors" />;
}
