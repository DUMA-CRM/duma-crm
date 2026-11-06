import assert from 'node:assert/strict';
import { test } from 'node:test';

import { epsonRequest } from '../../lib/pos-hardware/epson-protocol.ts';
import {
  DEFAULT_HARDWARE,
  type TillHardwareConnector,
  drawerPulse,
  hardwareScope,
  openDrawerForPayment,
  validateHardware,
} from '../../lib/pos-hardware/model.ts';
import { MAX_PRINTER_ORIGINS, epsonEndpoint, normalisePrinterAddress, parsePrinterOrigins } from '../../lib/pos-hardware/network-policy.ts';

const settings = {
  ...DEFAULT_HARDWARE,
  registerId: 'register-1',
  connector: 'qz-tray' as const,
  printer: 'Counter',
  drawer: 'printer' as const,
  drawerVerified: true,
  openOnCash: true,
};
function setup() {
  let sent = 0;
  const claims = new Set<string>();
  const connector: TillHardwareConnector = {
    id: 'qz-tray',
    capabilities: { cashDrawer: true, testPrint: true },
    listPrinters: async () => ['Counter'],
    testPrint: async () => {},
    openCashDrawer: async () => {
      sent++;
    },
  };
  const input = {
    settings,
    connector,
    provider: 'cash',
    status: 'succeeded',
    paymentId: 'payment-1',
    claim: async (id: string) => {
      if (claims.has(id)) return false;
      claims.add(id);
      return true;
    },
  };
  return { input, claims, sent: () => sent };
}

test('only successful cash payments with opt-in dispatch a drawer command', async () => {
  const { input, sent, claims } = setup();
  for (const patch of [
    { provider: 'manual_terminal' },
    { provider: 'stripe_terminal' },
    { status: 'pending' },
    { status: 'failed' },
    { status: 'cancelled' },
    { settings: { ...settings, openOnCash: false } },
  ]) {
    assert.equal(await openDrawerForPayment({ ...input, ...patch }), 'skipped');
  }
  assert.equal(claims.size, 0);
  assert.equal(sent(), 0);
  assert.equal(await openDrawerForPayment(input), 'sent');
  assert.equal(sent(), 1);
});

test('concurrent duplicate confirmations send once; a different payment can open', async () => {
  const { input, sent } = setup();
  assert.deepEqual(await Promise.all([openDrawerForPayment(input), openDrawerForPayment(input)]), ['sent', 'duplicate']);
  assert.equal(sent(), 1);
  assert.equal(await openDrawerForPayment({ ...input, paymentId: 'payment-2' }), 'sent');
  assert.equal(sent(), 2);
});

test('ambiguous hardware failures consume the claim and never throw into payment handling', async () => {
  const { input } = setup();
  input.connector.openCashDrawer = async () => {
    throw new Error('Connection lost after sending');
  };
  assert.equal(await openDrawerForPayment(input), 'unavailable');
  assert.equal(await openDrawerForPayment(input), 'duplicate');
});

test('storage failure fails closed before sending', async () => {
  const { input, sent } = setup();
  assert.equal(
    await openDrawerForPayment({
      ...input,
      claim: async () => {
        throw new Error('Storage full');
      },
    }),
    'unavailable',
  );
  assert.equal(sent(), 0);
});

test('unverified, missing, unsupported or invalid hardware cannot dispatch', async () => {
  const { input, sent, claims } = setup();
  for (const patch of [
    { drawerVerified: false },
    { printer: '' },
    { connector: 'none' as const },
    { drawer: 'manual' as const },
    { pulseOnMs: 511 },
  ]) {
    assert.equal(await openDrawerForPayment({ ...input, settings: { ...settings, ...patch } }), 'unavailable');
  }
  assert.equal(await openDrawerForPayment({ ...input, paymentId: '' }), 'unavailable');
  input.connector.capabilities.cashDrawer = false;
  assert.equal(await openDrawerForPayment(input), 'unavailable');
  assert.equal(sent(), 0);
  assert.equal(claims.size, 0);
});

test('pulse encoding validates electrical timings and sends only ESC p', () => {
  assert.deepEqual(
    [...drawerPulse(settings)].map((c) => c.charCodeAt(0)),
    [27, 112, 0, 50, 250],
  );
  assert.deepEqual(
    [...drawerPulse({ ...settings, pin: 5, pulseOnMs: 2, pulseOffMs: 510 })].map((c) => c.charCodeAt(0)),
    [27, 112, 1, 1, 255],
  );
  for (const pulseOnMs of [0, -2, 3, 512, NaN, Infinity]) assert.throws(() => drawerPulse({ ...settings, pulseOnMs }));
  assert.throws(() => drawerPulse({ ...settings, pulseOffMs: 2 }));
  assert.equal(validateHardware({ ...DEFAULT_HARDWARE, registerId: 'r' }), null);
});

test('register settings cannot collide between locations or workspaces', () => {
  assert.notEqual(hardwareScope('workspace-a', 'counter'), hardwareScope('workspace-b', 'counter'));
  assert.notEqual(hardwareScope('workspace-a', 'counter'), hardwareScope('workspace-a', 'bar'));
});

test('a typed printer address becomes an HTTPS origin on the local network, or nothing', () => {
  assert.equal(normalisePrinterAddress('192.168.1.20'), 'https://192.168.1.20');
  assert.equal(normalisePrinterAddress(' https://10.0.0.7:8043/ '), 'https://10.0.0.7:8043');
  assert.equal(normalisePrinterAddress('printer.local'), 'https://printer.local');
  assert.equal(normalisePrinterAddress('COUNTER'), 'https://counter');
  assert.equal(normalisePrinterAddress('172.31.255.1'), 'https://172.31.255.1');
  // Pasted from the printer's own web page: only the origin is kept.
  assert.equal(normalisePrinterAddress('https://192.168.1.20/webconfig/?lang=en#top'), 'https://192.168.1.20');
  assert.equal(normalisePrinterAddress('http://192.168.1.20/PRESENTATION/BONJOUR'), 'https://192.168.1.20');
  assert.equal(normalisePrinterAddress('HTTP://Printer.Local/'), 'https://printer.local');
  for (const refused of [
    '',
    'http://192.168.1.20:8008/',
    'ftp://192.168.1.20',
    'javascript://192.168.1.20',
    'https://user:pass@192.168.1.20',
    'http://user:pass@192.168.1.20/',
    'http://evil.com/192.168.1.20',
    'https://*.local',
    '8.8.8.8',
    '172.32.0.1',
    '192.168.1.300',
    'printer.example.com',
    'evil.com',
  ])
    assert.equal(normalisePrinterAddress(refused), null, refused);
});

test('the printer cookie can only ever name local-network HTTPS origins, so it cannot widen the CSP', () => {
  assert.deepEqual(
    parsePrinterOrigins(
      'https://192.168.1.20, http://192.168.1.21, https://user:pass@printer.local, https://printer.local/path, https://evil.com, https://*.local, https://192.168.1.20',
    ),
    ['https://192.168.1.20'],
  );
  assert.deepEqual(parsePrinterOrigins('192.168.1.20'), [], 'a bare address is not an origin');
  const many = Array.from({ length: 12 }, (_, i) => `https://192.168.1.${i + 1}`).join(',');
  assert.equal(parsePrinterOrigins(many).length, MAX_PRINTER_ORIGINS);
});

test('Epson endpoints are built only for valid local origins and encode device IDs', () => {
  const endpoint = new URL(epsonEndpoint('https://192.168.1.20', 'local_printer'));
  assert.equal(endpoint.pathname, '/cgi-bin/epos/service.cgi');
  assert.equal(endpoint.searchParams.get('devid'), 'local_printer');
  assert.equal(endpoint.searchParams.get('timeout'), '10000');
  assert.throws(() => epsonEndpoint('https://evil.com', 'local_printer'));
  assert.throws(() => epsonEndpoint('http://192.168.1.20', 'local_printer'));
  assert.throws(() => epsonEndpoint('192.168.1.20', 'local_printer'));
  assert.throws(() => epsonEndpoint('https://192.168.1.20', 'printer&timeout=1'));
});

test('Epson cash drawer requests use supported pulse values; probe and test receipts never kick', () => {
  const network = { ...settings, connector: 'epson-epos' as const, printer: 'local_printer', networkOrigin: 'https://192.168.1.20' };
  assert.equal(validateHardware(network), null);
  const request = epsonRequest(network, 'drawer');
  assert.ok(request.includes('<pulse drawer="drawer_1" time="pulse_100"/>'));
  assert.ok(!request.includes('<text>'));
  assert.ok(!epsonRequest(network, 'check').includes('<pulse'));
  assert.ok(!epsonRequest(network, 'print').includes('<pulse'));
  assert.ok(epsonRequest({ ...network, pin: 5, pulseOnMs: 500 }, 'drawer').includes('drawer="drawer_2" time="pulse_500"'));
  assert.throws(() => epsonRequest({ ...network, pulseOnMs: 150 }, 'drawer'));
  assert.throws(() => epsonRequest({ ...network, drawer: 'manual', openOnCash: false }, 'drawer'));
  assert.throws(() => epsonRequest({ ...network, networkOrigin: 'https://evil.com' }, 'drawer'));
});
