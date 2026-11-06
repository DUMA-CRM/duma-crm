import { epsonEndpoint } from './network-policy.ts';

/** Hardware belongs to this browser's register, partitioned by workspace and location. */
export interface TillHardwareSettings {
  registerId: string;
  registerName: string;
  connector: 'none' | 'qz-tray' | 'epson-epos';
  networkOrigin?: string;
  printer: string;
  drawer: 'manual' | 'printer';
  openOnCash: boolean;
  pin: 2 | 5;
  pulseOnMs: number;
  pulseOffMs: number;
  /** Set only after the operator confirms a physical test. Invalidated by device changes. */
  drawerVerified: boolean;
}

export const DEFAULT_HARDWARE: TillHardwareSettings = {
  registerId: '',
  registerName: 'This till',
  connector: 'none',
  printer: '',
  drawer: 'manual',
  openOnCash: false,
  pin: 2,
  pulseOnMs: 100,
  pulseOffMs: 500,
  drawerVerified: false,
};

export function hardwareScope(tenantId: string, locationId: string): string {
  return JSON.stringify([tenantId, locationId]);
}

export function validateHardware(settings: TillHardwareSettings): string | null {
  if (
    typeof settings.registerId !== 'string' ||
    !settings.registerId ||
    typeof settings.registerName !== 'string' ||
    !settings.registerName.trim()
  )
    return 'Give this till a name.';
  if (!['none', 'qz-tray', 'epson-epos'].includes(settings.connector)) return 'Choose a supported connector.';
  if (!['manual', 'printer'].includes(settings.drawer)) return 'Choose a supported cash drawer connection.';
  if (settings.connector === 'qz-tray' && (typeof settings.printer !== 'string' || !settings.printer.trim()))
    return 'Choose a receipt printer.';
  if (settings.connector === 'epson-epos') {
    try {
      epsonEndpoint(settings.networkOrigin ?? '', settings.printer);
    } catch (error) {
      return error instanceof Error ? error.message : 'Check the network printer address.';
    }
  }
  if (settings.drawer === 'printer') {
    if (settings.connector === 'none') return 'A printer-connected drawer needs a hardware connector.';
    if (settings.pin !== 2 && settings.pin !== 5) return 'Choose drawer pin 2 or 5.';
    if (settings.connector === 'epson-epos') {
      if (![100, 200, 300, 400, 500].includes(settings.pulseOnMs))
        return 'Choose an Epson pulse of 100, 200, 300, 400 or 500 milliseconds.';
    } else {
      for (const value of [settings.pulseOnMs, settings.pulseOffMs]) {
        if (!Number.isInteger(value) || value < 2 || value > 510 || value % 2 !== 0)
          return 'Pulse times must be even numbers between 2 and 510 milliseconds.';
      }
      if (settings.pulseOffMs < settings.pulseOnMs) return 'The off time must be at least the on time.';
    }
  }
  if (settings.openOnCash && (settings.drawer !== 'printer' || !settings.drawerVerified))
    return 'Test the drawer and confirm it opened before enabling cash-payment opening.';
  return null;
}

/** ESC p, with timing units of 2 ms. No print/cut commands are sent with a drawer pulse. */
export function drawerPulse(settings: TillHardwareSettings): string {
  const error = validateHardware(settings);
  if (error) throw new Error(error);
  if (settings.connector !== 'qz-tray' || settings.drawer !== 'printer') throw new Error('No automatic drawer configured.');
  return String.fromCharCode(0x1b, 0x70, settings.pin === 2 ? 0 : 1, settings.pulseOnMs / 2, settings.pulseOffMs / 2);
}

export interface TillHardwareConnector {
  id: 'qz-tray' | 'epson-epos';
  capabilities: { cashDrawer: boolean; testPrint: boolean };
  listPrinters(): Promise<string[]>;
  openCashDrawer(settings: TillHardwareSettings): Promise<void>;
  testPrint(settings: TillHardwareSettings): Promise<void>;
}

export type CashDrawerResult = 'skipped' | 'duplicate' | 'sent' | 'unavailable';

/** Called only for a newly confirmed server payment. Never from receipt printing or queue replay.
 * Claim before sending: an ambiguous printer response must never cause an automatic retry.
 * A claim survives failure, because the physical pulse may already have been delivered.
 */
export async function openDrawerForPayment(input: {
  provider: string;
  status: string;
  paymentId: string;
  settings: TillHardwareSettings;
  claim: (paymentId: string) => Promise<boolean>;
  connector: TillHardwareConnector;
}): Promise<CashDrawerResult> {
  const { settings, connector } = input;
  if (input.provider !== 'cash' || input.status !== 'succeeded' || !settings.openOnCash) return 'skipped';
  if (!input.paymentId || validateHardware(settings) || settings.connector !== connector.id || !connector.capabilities.cashDrawer)
    return 'unavailable';
  try {
    if (!(await input.claim(input.paymentId))) return 'duplicate';
    await connector.openCashDrawer(settings);
    return 'sent';
  } catch {
    return 'unavailable';
  }
}
