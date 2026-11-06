import { epsonConnector } from './epson';
import { type TillHardwareSettings, openDrawerForPayment } from './model';
import { qzConnector } from './qz';

/** Web Locks serialize the persistent claim across tabs. If storage/locks are
 * unavailable, fail closed rather than risk a second pulse. No claim eviction:
 * old payment callbacks must not become eligible again after a refresh.
 */
async function claimPayment(scope: string, paymentId: string): Promise<boolean> {
  if (!navigator.locks) throw new Error('This browser cannot safely coordinate drawer commands.');
  const key = `duma-drawer-payment:${JSON.stringify([scope, paymentId])}`;
  return navigator.locks.request(key, () => {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, 'attempted');
    return true;
  });
}

export function openPaidCashDrawer(
  scope: string,
  settings: TillHardwareSettings,
  payment: {
    id: string;
    provider: string;
    status: string;
  },
) {
  return openDrawerForPayment({
    paymentId: payment.id,
    provider: payment.provider,
    status: payment.status,
    settings,
    connector: settings.connector === 'epson-epos' ? epsonConnector : qzConnector,
    claim: (id) => claimPayment(scope, id),
  });
}
