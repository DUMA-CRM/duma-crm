'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { InfoRow, InfoRows, RowWarning } from '@/components/cms/rows';
import { Banknote, CheckCircle2, ChevronRight, type IconComponent, Loader2, Monitor, Plug, Printer, Search, Zap } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { useMounted } from '@/components/settings/configuration/shared';
import { SaveBar, Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards, NumberStepper } from '@/components/shared/FormParts';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { checkEpsonConnection, epsonConnector } from '@/lib/pos-hardware/epson';
import { DEFAULT_HARDWARE, type TillHardwareSettings, hardwareScope, validateHardware } from '@/lib/pos-hardware/model';
import { normalisePrinterAddress } from '@/lib/pos-hardware/network-policy';
import { printerReachableNow, rememberPrinterOrigins } from '@/lib/pos-hardware/printer-access';
import { qzConnector } from '@/lib/pos-hardware/qz';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { networkOrigins, useTillHardwareStore } from '@/stores/tillHardwareStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConnectWizard, ProviderGrid, WizardRail, type WizardStep } from './ConnectWizard';
import { CONNECTORS_BY_ID, type ConnectorState } from './registry';
import { panelClass } from './shared';

const DEFINITION = CONNECTORS_BY_ID['till-hardware'];
const BROWSER_NOTE = 'Saved on this browser for this location — set up each till separately. Clearing browser data removes it.';

type Connector = TillHardwareSettings['connector'];
const CONNECTORS: { value: Connector; label: string; icon: IconComponent; hint: string }[] = [
  { value: 'epson-epos', label: 'Epson network printer', icon: Printer, hint: 'iPad or desktop, over your Wi-Fi or wired network' },
  { value: 'qz-tray', label: 'QZ Tray', icon: Monitor, hint: 'A Windows, Mac or Linux till with a receipt printer' },
  { value: 'none', label: 'No printer connection', icon: Banknote, hint: 'Staff open the drawer by hand' },
];

/**
 * A page allows only the printers its CSP named when it loaded, so the first
 * check of a new address reloads once. What was on screen rides across the
 * reload here, read once per page load.
 */
const RESUME_KEY = 'duma-till-hardware-resume';
type Resume = { scope: string; value: TillHardwareSettings; step: string };
let resumed: Resume | null = (() => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
    return raw ? (JSON.parse(raw) as Resume) : null;
  } catch {
    return null;
  }
})();

/** A till with a printer connection is set up; one without has nothing connected. */
export function tillHardwareState(settings: TillHardwareSettings | undefined): ConnectorState {
  return settings && settings.connector !== 'none' ? 'connected' : 'disconnected';
}

/** The till's connection in one line, for its row and its page. */
export function tillHardwareSummary(settings: TillHardwareSettings): string {
  const drawer = settings.openOnCash
    ? 'drawer opens after cash payments'
    : settings.drawer === 'printer'
      ? 'drawer on the printer'
      : 'manual drawer';
  if (settings.connector === 'epson-epos') return `Epson network · ${settings.networkOrigin ?? 'no address'} · ${drawer}`;
  if (settings.connector === 'qz-tray') return `QZ Tray · ${settings.printer || 'no printer chosen'} · ${drawer}`;
  return 'No printer connection · manual drawer';
}

/**
 * This browser's till for the current workspace and location, plus what is
 * being edited, shared by the wizard and the manage page. Changing the device
 * or the drawer wiring drops the drawer test, so it has to be proved again.
 */
function useTillHardware() {
  const mounted = useMounted();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const locationId = useWorkspaceStore((state) => state.locationId);
  const scope = tenantId && locationId ? hardwareScope(tenantId, locationId) : null;
  const saved = useTillHardwareStore((state) => (scope ? state.registers[scope] : undefined));
  const store = useTillHardwareStore((state) => state.save);
  const registers = useTillHardwareStore((state) => state.registers);
  const [fresh] = useState<TillHardwareSettings>(() => ({ ...DEFAULT_HARDWARE, registerId: crypto.randomUUID() }));
  const [resume] = useState(() => (resumed && resumed.scope === scope ? resumed : null));
  const [draftState, setDraftState] = useState<{ scope: string; value: TillHardwareSettings } | null>(resume);
  // Restored once; reopening the wizard later starts from what's saved.
  useEffect(() => {
    resumed = null;
  }, []);
  const [printers, setPrinters] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const base = saved ?? fresh;
  const draft = draftState && draftState.scope === scope ? draftState.value : base;
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const network = draft.connector === 'epson-epos';

  function update(patch: Partial<TillHardwareSettings>, deviceChanged = false) {
    if (!scope) return;
    setDraftState({
      scope,
      value: { ...draft, ...patch, ...(deviceChanged ? { drawerVerified: false, openOnCash: false } : {}) },
    });
    if (deviceChanged) setTestSent(false);
  }

  /** Each test reports in a toast; the drawer's also waits for someone to say it opened. */
  /** A printer this page's CSP doesn't name yet: allow it for this browser and reload once, keeping the draft. */
  function reloadToReach(step: string): boolean {
    const origin = draft.networkOrigin;
    if (!scope || !network || !origin || normalisePrinterAddress(origin) !== origin || printerReachableNow(origin)) return false;
    rememberPrinterOrigins([...networkOrigins(useTillHardwareStore.getState().registers), origin]);
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({ scope, value: draft, step } satisfies Resume));
    } catch {
      // Without session storage the draft is lost on reload; the address is still allowed.
    }
    window.location.reload();
    return true;
  }

  async function run(action: 'connect' | 'print' | 'drawer', step = 'manage') {
    if (network && reloadToReach(step)) return;
    setBusy(true);
    try {
      if (action === 'connect' && network) {
        await checkEpsonConnection(draft);
        toast('success', 'The Epson printer responded.');
      } else if (action === 'connect') {
        const names = await qzConnector.listPrinters();
        setPrinters(names);
        if (names.length) toast('success', 'QZ Tray connected. Choose the printer attached to this till.');
        else toast('error', 'QZ Tray connected, but it found no printers.');
      } else {
        const problem = validateHardware(draft);
        if (problem) throw new Error(problem);
        const connector = network ? epsonConnector : qzConnector;
        if (action === 'print') {
          await connector.testPrint(draft);
          toast('success', 'Test sent. Check the printer for the slip.');
        } else {
          setTestSent(false);
          await connector.openCashDrawer(draft);
          setTestSent(true);
        }
      }
    } catch (cause) {
      toast('error', cause instanceof Error ? cause.message : 'The hardware didn’t respond. Check the printer connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  /** Saves and reports back, so a wizard step can refuse to advance on failure. */
  function trySave(): boolean {
    if (!scope) return false;
    try {
      store(scope, draft);
      setDraftState(null);
      toast('success', `${draft.registerName.trim()} saved on this browser.`);
      return true;
    } catch (cause) {
      toast('error', cause instanceof Error ? cause.message : 'Couldn’t save on this browser.');
      return false;
    }
  }

  // Printers this browser's other tills already reach: one tap instead of typing.
  const knownPrinters = [
    ...new Map(
      Object.entries(registers)
        .filter(([key, other]) => key !== scope && other.connector === 'epson-epos' && other.networkOrigin)
        .map(([, other]) => [other.networkOrigin!, { origin: other.networkOrigin!, till: other.registerName, deviceId: other.printer }]),
    ).values(),
  ];

  return {
    mounted,
    knownPrinters,
    resumedStep: resume?.step ?? null,
    scope,
    hasLocation: Boolean(locationId),
    saved,
    draft,
    dirty,
    network,
    update,
    run,
    busy,
    printers,
    testSent,
    setTestSent,
    trySave,
    reset: () => {
      setDraftState(null);
      setTestSent(false);
    },
  };
}
type Hardware = ReturnType<typeof useTillHardware>;

// ── Field groups, shared by the wizard steps and the manage page ──────────────

const fieldLabel = 'block text-label uppercase text-muted-foreground';

function BusyIcon({ busy, icon: Icon }: { busy: boolean; icon: IconComponent }) {
  return busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />;
}

/** Where the printer is and how to reach it — the connection check sits with it. */
function PrinterFields({ hardware, step }: { hardware: Hardware; step?: string }) {
  const { draft, update, run, busy, printers, network, knownPrinters } = hardware;
  // Typed as the person writes it; the draft holds the origin once it's a valid one.
  const [address, setAddress] = useState(() => draft.networkOrigin?.replace(/^https:\/\//, '') ?? '');
  const origin = normalisePrinterAddress(address);
  const choose = (value: string) => {
    setAddress(value);
    update({ networkOrigin: normalisePrinterAddress(value) ?? value.trim() }, true);
  };
  const others = knownPrinters.filter((known) => known.origin !== origin);
  if (network) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use an Epson printer with ePOS-Print turned on, on the same network as this till. On iPad its HTTPS certificate must be trusted,
          and allow local-network access if asked. AirPrint alone isn’t enough.
        </p>
        <Input
          id="till-printer-origin"
          label="Printer address"
          value={address}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="192.168.1.20"
          onChange={(event) => choose(event.target.value)}
          onBlur={() => origin && setAddress(origin.replace(/^https:\/\//, ''))}
          error={
            address.trim() && !origin
              ? 'Use the printer’s address on your local network, such as 192.168.1.20 or printer.local.'
              : undefined
          }
          hint="Type it, or paste the address of the printer’s own web page. It must support HTTPS, with a certificate this device trusts."
        />
        {others.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Already used on this browser:</span>
            {others.map((known) => (
              <Button
                key={known.origin}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAddress(known.origin.replace(/^https:\/\//, ''));
                  update({ networkOrigin: known.origin, ...(known.deviceId ? { printer: known.deviceId } : {}) }, true);
                }}
              >
                {known.origin.replace(/^https:\/\//, '')} · {known.till}
              </Button>
            ))}
          </div>
        )}
        <details className="rounded-lg border border-rule/50 bg-background/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">How to find the address</summary>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            {[
              'Print the printer’s network status sheet and look for its IP address. On many Epson TM printers, press the status sheet button on the back. The printer’s manual shows how for your model.',
              'Or open your router’s list of connected devices and look for one named TM-… or EPSON….',
              'Or use Epson’s free TM Utility app on this iPad. It finds the printer on your network and shows its IP address.',
            ].map((line, index) => (
              <li key={line} className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/8 text-micro font-semibold text-primary">
                  {index + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
        </details>
        <Input
          id="till-printer-device"
          label="Printer device ID"
          value={draft.printer}
          maxLength={64}
          onChange={(event) => update({ printer: event.target.value }, true)}
          hint="Usually local_printer — match the printer’s ePOS settings."
        />
        <Button type="button" variant="outline" className="gap-1.5" disabled={busy || !origin} onClick={() => void run('connect', step)}>
          <BusyIcon busy={busy} icon={Search} />
          Check the connection
        </Button>
      </div>
    );
  }
  const choices = [...new Set([...(draft.printer ? [draft.printer] : []), ...printers])];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Install{' '}
        <a
          className="font-medium text-primary underline-offset-4 hover:underline"
          href="https://qz.io/download/"
          target="_blank"
          rel="noreferrer"
        >
          QZ Tray
        </a>{' '}
        on this till and set the receipt printer up for raw ESC/POS printing. QZ asks permission before each command.
      </p>
      <Button type="button" variant="outline" className="gap-1.5" disabled={busy} onClick={() => void run('connect')}>
        <BusyIcon busy={busy} icon={Search} />
        Connect and find printers
      </Button>
      <div className="space-y-1.5">
        <label htmlFor="till-printer-name" className={fieldLabel}>
          Receipt printer
        </label>
        <Select
          id="till-printer-name"
          ariaLabel="Receipt printer"
          placeholder={choices.length ? 'Choose a printer' : 'Find printers first'}
          value={draft.printer}
          onValueChange={(printer) => update({ printer }, true)}
          options={choices.map((printer) => ({ value: printer, label: printer }))}
          className="w-full"
        />
      </div>
    </div>
  );
}

const printerReady = (hardware: Hardware) => {
  const { draft, network } = hardware;
  if (!network) return Boolean(draft.printer);
  return Boolean(draft.networkOrigin && normalisePrinterAddress(draft.networkOrigin) === draft.networkOrigin && draft.printer.trim());
};

function TestPrintButton({ hardware, step }: { hardware: Hardware; step?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="gap-1.5"
      disabled={hardware.busy || !printerReady(hardware)}
      onClick={() => void hardware.run('print', step)}
    >
      <BusyIcon busy={hardware.busy} icon={Printer} />
      Print a test slip
    </Button>
  );
}

/** How the drawer is wired, a test someone has to confirm by eye, then the automatic opening it unlocks. */
function DrawerFields({ hardware, step }: { hardware: Hardware; step?: string }) {
  const { draft, update, run, busy, testSent, setTestSent, network } = hardware;
  return (
    <div className="space-y-4">
      <ChoiceCards
        appearance="settings"
        value={draft.drawer}
        onChange={(drawer) => update({ drawer }, true)}
        options={[
          { value: 'manual', label: 'Opened by hand' },
          { value: 'printer', label: 'Through this printer' },
        ]}
      />
      {draft.drawer === 'printer' && (
        <>
          <details className="rounded-lg border border-rule/50 bg-background/60 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Pin and pulse</summary>
            <p className="mt-2 text-xs text-muted-foreground">
              Match the drawer’s cable, pin and pulse timing to the printer maker’s specification before testing.
            </p>
            <div className="mt-3 space-y-3">
              <ChoiceCards
                appearance="settings"
                value={String(draft.pin) as '2' | '5'}
                onChange={(pin) => update({ pin: Number(pin) as 2 | 5 }, true)}
                options={[
                  { value: '2', label: 'Pin 2' },
                  { value: '5', label: 'Pin 5' },
                ]}
              />
              <NumberStepper
                label="Pulse on"
                value={draft.pulseOnMs}
                min={network ? 100 : 2}
                max={network ? 500 : 510}
                step={network ? 100 : 2}
                unit="ms"
                onChange={(pulseOnMs) => update({ pulseOnMs }, true)}
              />
              {!network && (
                <NumberStepper
                  label="Pulse off"
                  value={draft.pulseOffMs}
                  min={2}
                  max={510}
                  step={2}
                  unit="ms"
                  onChange={(pulseOffMs) => update({ pulseOffMs }, true)}
                />
              )}
            </div>
          </details>
          {draft.drawerVerified ? (
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 size={16} className="text-success" aria-hidden="true" /> Drawer tested and confirmed
            </p>
          ) : testSent ? (
            <div className="rounded-lg border border-rule/50 bg-background/60 px-4 py-3" aria-live="polite">
              <p className="text-sm font-medium text-foreground">Did the drawer open?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Only confirm what you saw — a sent command doesn’t prove it opened.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9"
                  onClick={() => {
                    update({ drawerVerified: true });
                    setTestSent(false);
                  }}
                >
                  Yes, it opened
                </Button>
                <Button type="button" variant="outline" className="h-9" onClick={() => setTestSent(false)}>
                  No
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={busy || !printerReady(hardware)}
              onClick={() => void run('drawer', step)}
            >
              <BusyIcon busy={busy} icon={Zap} />
              Test — open the drawer
            </Button>
          )}
          <InfoRows>
            <InfoRow
              icon={Banknote}
              title="Open after cash payment"
              description={
                draft.drawerVerified ? 'Online cash sales only — never reprints or synced offline sales.' : 'Test the drawer first.'
              }
            >
              <Switch
                label="Open the drawer after a cash payment"
                checked={draft.openOnCash}
                disabled={!draft.drawerVerified}
                onChange={(openOnCash) => update({ openOnCash })}
              />
            </InfoRow>
          </InfoRows>
        </>
      )}
    </div>
  );
}

function NameField({ hardware }: { hardware: Hardware }) {
  return (
    <Input
      id="till-name"
      label="Till name"
      value={hardware.draft.registerName}
      maxLength={80}
      onChange={(event) => hardware.update({ registerName: event.target.value })}
      hint="Shown on this connector’s row, so you can tell tills apart."
    />
  );
}

/** Why there's nothing to set up here yet — the same answer for the wizard and the page. */
function useBlocker(hardware: Hardware): string | null {
  const capabilities = useAuthStore((state) => state.capabilities);
  if (!hasCapability(capabilities, 'settings:write')) return 'Ask a workspace administrator to set up this till’s hardware.';
  if (!hardware.hasLocation) return 'Choose a location first — hardware belongs to one location’s till.';
  return null;
}

// ── Connect wizard ────────────────────────────────────────────────────────────

export function TillHardwareConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const hardware = useTillHardware();
  const blocker = useBlocker(hardware);
  // Nothing is picked on a first setup, even though the draft starts at "none".
  const [picked, setPicked] = useState(() => Boolean(hardware.resumedStep));
  const { draft, update, mounted, saved } = hardware;

  if (!mounted || blocker) {
    return (
      <EditorShell eyebrow="Connect" title={DEFINITION.name} onClose={onClose}>
        {mounted ? <ErrorState title={blocker!} /> : <Bone className="h-96 w-full rounded-lg" />}
      </EditorShell>
    );
  }

  const automatic = draft.connector !== 'none';
  const steps: WizardStep[] = [
    {
      key: 'connector',
      title: 'How does this till reach its printer?',
      description: 'The printer is how DUMA opens the cash drawer. Receipts still print with AirPrint on iPad or the browser on desktop.',
      ready: picked || Boolean(saved),
      content: (
        <ProviderGrid
          ariaLabel="Printer connection"
          options={CONNECTORS}
          value={picked || saved ? draft.connector : null}
          onChange={(connector) => {
            setPicked(true);
            if (connector !== draft.connector)
              update(
                {
                  connector,
                  drawer: 'manual',
                  printer: connector === 'epson-epos' ? 'local_printer' : '',
                  pulseOnMs: 100,
                  pulseOffMs: 500,
                },
                true,
              );
          }}
        />
      ),
    },
    // Without a printer there is nothing to find or test, so it goes straight to naming.
    ...(automatic
      ? [
          {
            key: 'printer',
            title: draft.connector === 'epson-epos' ? 'Find the printer on your network' : 'Connect QZ Tray',
            description: 'Check the connection, then print a test slip to be sure it’s the right printer.',
            ready: printerReady(hardware),
            content: (
              <div className="space-y-4">
                <PrinterFields hardware={hardware} step="printer" />
                <TestPrintButton hardware={hardware} step="printer" />
              </div>
            ),
          },
          {
            key: 'drawer',
            title: 'How is the cash drawer connected?',
            description: 'A drawer plugged into the printer can open by itself after a cash payment, once you’ve seen it open in a test.',
            onContinue: () => {
              const problem = validateHardware(draft);
              if (problem) toast('error', problem);
              return !problem;
            },
            content: <DrawerFields hardware={hardware} step="drawer" />,
          },
        ]
      : []),
    {
      key: 'name',
      title: 'What should this till be called?',
      description: 'Each till keeps its own setup, so a name tells them apart.',
      ready: Boolean(draft.registerName.trim()),
      continueLabel: 'Save this till',
      onContinue: hardware.trySave,
      content: <NameField hardware={hardware} />,
    },
  ];

  return (
    <ConnectWizard
      eyebrow="Connect"
      title={DEFINITION.name}
      icon={<Printer size={20} aria-hidden="true" />}
      dirty={hardware.dirty}
      steps={steps}
      onClose={onClose}
      onFinish={onDone}
      initialIndex={Math.max(
        0,
        steps.findIndex((step) => step.key === hardware.resumedStep),
      )}
      rail={<WizardRail requirements={DEFINITION.requirements} note={BROWSER_NOTE} />}
    />
  );
}

// ── Manage page ───────────────────────────────────────────────────────────────

export function TillHardwareConnectorPage({ onClose, onConnect }: { onClose: () => void; onConnect: () => void }) {
  const hardware = useTillHardware();
  const blocker = useBlocker(hardware);
  const { saved, draft, dirty, mounted } = hardware;
  const automatic = draft.connector !== 'none';
  const problem = dirty ? validateHardware(draft) : null;

  return (
    <EditorShell
      eyebrow="Connector"
      title={DEFINITION.name}
      icon={<Printer size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty}
      actions={
        saved && !blocker ? (
          <Button variant="outline" className="h-9 gap-1.5" onClick={onConnect}>
            <Zap size={15} aria-hidden="true" />
            <span className="hidden md:inline">Run setup again</span>
          </Button>
        ) : null
      }
    >
      {!mounted ? (
        <Bone className="h-96 w-full rounded-lg" />
      ) : blocker ? (
        <ErrorState title={blocker} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Printer size={26} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold tracking-headline text-foreground">
                {saved ? saved.registerName : 'This till isn’t set up'}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{saved ? tillHardwareSummary(saved) : DEFINITION.description}</p>
            </div>
          </div>

          {!saved ? (
            <div className={panelClass}>
              <p className="text-sm text-muted-foreground">
                Connect this till’s receipt printer so DUMA can open the cash drawer after a cash payment. It takes a few minutes, with the
                printer switched on.
              </p>
              <Button className="mt-4 gap-1.5" onClick={onConnect}>
                <Plug size={15} aria-hidden="true" /> Set up this till
              </Button>
            </div>
          ) : (
            <SettingsTabBody
              narrowAside
              aside={
                <>
                  {automatic && (
                    <SettingsSection title="Test">
                      <div className="space-y-3">
                        <TestPrintButton hardware={hardware} />
                        {dirty && <p className="text-xs text-muted-foreground">Tests use what’s on screen; save to keep it.</p>}
                      </div>
                    </SettingsSection>
                  )}
                  <SettingsSection title="Receipts on iPad">
                    <p className="text-sm text-muted-foreground">
                      Open the receipt after a sale, then Share → Print to an AirPrint printer. If the printer opens the drawer on every
                      print, turn that off so card receipts and reprints don’t open it.
                    </p>
                  </SettingsSection>
                  <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">{BROWSER_NOTE}</p>
                </>
              }
            >
              <SettingsSection title="Till">
                <NameField hardware={hardware} />
              </SettingsSection>

              <SettingsSection
                title="Printer"
                actions={
                  <span className="text-sm text-muted-foreground">{CONNECTORS.find((c) => c.value === draft.connector)?.label}</span>
                }
              >
                <fieldset disabled={hardware.busy} className="min-w-0">
                  {automatic ? (
                    <PrinterFields hardware={hardware} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Staff open the drawer by hand. Run setup again to connect a printer and open it automatically.
                    </p>
                  )}
                </fieldset>
              </SettingsSection>

              {automatic && (
                <SettingsSection title="Cash drawer">
                  <fieldset disabled={hardware.busy} className="min-w-0">
                    <DrawerFields hardware={hardware} />
                  </fieldset>
                  {problem && <RowWarning className="mt-4">{problem}</RowWarning>}
                </SettingsSection>
              )}
            </SettingsTabBody>
          )}
        </div>
      )}

      <SaveBar
        dirty={dirty && Boolean(saved)}
        saving={false}
        disabled={Boolean(problem)}
        onSave={() => hardware.trySave()}
        onDiscard={hardware.reset}
      />
    </EditorShell>
  );
}

// ── In Settings → Till ────────────────────────────────────────────────────────

/** The till's hardware as one row on its settings page; setting it up happens in Connections. */
export function TillHardwareSummary() {
  const mounted = useMounted();
  const enabled = useModuleEnabled('pos');
  const capabilities = useAuthStore((state) => state.capabilities);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const locationId = useWorkspaceStore((state) => state.locationId);
  const scope = tenantId && locationId ? hardwareScope(tenantId, locationId) : null;
  const saved = useTillHardwareStore((state) => (scope ? state.registers[scope] : undefined));
  if (!mounted || !enabled || !hasCapability(capabilities, 'settings:write')) return null;
  return (
    <SettingsSection title="Hardware">
      <div className="-mx-2 flex flex-col gap-0.5">
        <Link
          href={`/settings/connectors?connector=till-hardware${saved ? '' : '&mode=connect'}`}
          className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
            <Printer size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {saved ? saved.registerName : 'Printer and cash drawer'}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {!scope ? 'Choose a location to set this till up' : saved ? tillHardwareSummary(saved) : 'Not set up on this browser'}
            </span>
          </span>
          <ChevronRight
            size={14}
            className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </SettingsSection>
  );
}
