import { type TillHardwareConnector, type TillHardwareSettings, drawerPulse } from './model';

let connection: Promise<typeof import('qz-tray')> | undefined;

async function connectedQz() {
  const qz = (await import('qz-tray')).default;
  if (qz.websocket.isActive()) return qz;
  if (!connection) {
    // QZ's own trust prompts remain enabled. Never ship a private signing key to the browser.
    connection = qz.websocket
      .connect({ retries: 0, host: 'localhost', usingSecure: true })
      .then(() => qz)
      .finally(() => {
        connection = undefined;
      });
  }
  return connection;
}

async function send(settings: TillHardwareSettings, command: string) {
  const qz = await connectedQz();
  // Resolve exact names, not QZ's partial-name/default-printer fallback.
  const found = await qz.printers.find();
  const printers = Array.isArray(found) ? found : [found];
  if (!printers.includes(settings.printer)) throw new Error('The configured printer is unavailable.');
  // Hex avoids text encodings changing pulse bytes above 0x7f (e.g. 500 ms = 0xfa).
  const data = Array.from(command, (byte) => byte.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  await qz.print(qz.configs.create(settings.printer, { forceRaw: true }), [{ type: 'raw', format: 'command', flavor: 'hex', data }]);
}

export const qzConnector: TillHardwareConnector = {
  id: 'qz-tray',
  capabilities: { cashDrawer: true, testPrint: true },
  async listPrinters() {
    const found = await (await connectedQz()).printers.find();
    return Array.isArray(found) ? found : [found];
  },
  async openCashDrawer(settings) {
    await send(settings, drawerPulse(settings));
  },
  async testPrint(settings) {
    await send(settings, '\x1b@DUMA printer test\n\n\n');
  },
};
