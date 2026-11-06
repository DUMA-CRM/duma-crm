import { epsonRequest } from './epson-protocol';
import { type TillHardwareConnector, type TillHardwareSettings } from './model';
import { epsonEndpoint } from './network-policy';
import { printerReachableNow } from './printer-access';

async function send(settings: TillHardwareSettings, action: 'check' | 'print' | 'drawer'): Promise<void> {
  const endpoint = epsonEndpoint(settings.networkOrigin ?? '', settings.printer);
  // This page's CSP was set when it loaded; a printer added since needs one reload.
  if (!printerReachableNow(settings.networkOrigin!))
    throw new Error('Reload this page once so the till can reach this printer, then try again.');
  const body = epsonRequest(settings, action);
  const controller = new AbortController();
  // Abort does not prove the pulse wasn't delivered. The payment claim is retained.
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      redirect: 'error',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Printer returned HTTP ${response.status}.`);
    const document = new DOMParser().parseFromString(await response.text(), 'application/xml');
    const result = document.getElementsByTagNameNS('http://www.epson-pos.com/schemas/2011/03/epos-print', 'response')[0];
    if (document.getElementsByTagName('parsererror').length || !result) throw new Error('The printer returned an invalid ePOS response.');
    if (!['true', '1'].includes(result.getAttribute('success') ?? ''))
      throw new Error(
        `Printer did not confirm the command (${result.getAttribute('code') || 'unknown error'}). Check the drawer before trying again.`,
      );
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError'))
      throw new Error(
        'Could not confirm the printer response. Check the same Wi-Fi/LAN, HTTPS certificate and local-network permission. Check the drawer before trying again.',
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const checkEpsonConnection = (settings: TillHardwareSettings) => send(settings, 'check');
export const epsonConnector: TillHardwareConnector = {
  id: 'epson-epos',
  capabilities: { cashDrawer: true, testPrint: true },
  // Safari cannot discover network printers for this web API; configure an exact address.
  async listPrinters() {
    return [];
  },
  openCashDrawer: (settings) => send(settings, 'drawer'),
  testPrint: (settings) => send(settings, 'print'),
};
